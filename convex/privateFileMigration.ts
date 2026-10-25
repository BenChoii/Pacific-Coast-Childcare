import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { randomToken } from './lib'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { openPrivateBlob, sealPrivateBlob } from './fileEncryption'

// Operator-only migration. Inventory is read-only; copying/revocation always
// requires dryRun:false. Never log document bytes, names or public storage URLs.
const TABLES = ['bookkeepingDocs', 'employeeProfiles', 'childDocuments', 'photos', 'children'] as const
const tableArg = v.union(v.literal('bookkeepingDocs'), v.literal('employeeProfiles'), v.literal('childDocuments'), v.literal('photos'), v.literal('children'))
const MAX_REFERENCES = 250
const MAX_BYTES = 8 * 1024 * 1024
const PRIVATE_PURPOSES = ['bookkeeping', 'hr', 'child-document', 'private-migration', 'photo', 'child-photo']
const publicFields = [['users', 'imageId', 'by_image'], ['educators', 'imageId', 'by_image'], ['facilities', 'logoId', 'by_logo']] as const

async function references(ctx: any, storageId: any, facilityId: any) {
  for (const [table, field, index] of publicFields) {
    const used = await ctx.db.query(table).withIndex(index, (q: any) => q.eq(field, storageId)).first()
    if (used) return { blocked: `Public ${table} reference requires manual review.`, refs: [], upload: null }
  }
  const profiles = await ctx.db.query('employeeProfiles').take(MAX_REFERENCES + 1)
  if (profiles.length > MAX_REFERENCES) return { blocked: 'Employee profile scan limit exceeded. Add a normalized document index before migration.', refs: [], upload: null }
  const books = await ctx.db.query('bookkeepingDocs').withIndex('by_storage', (q: any) => q.eq('storageId', storageId)).take(MAX_REFERENCES + 1)
  const children = await ctx.db.query('childDocuments').withIndex('by_storage', (q: any) => q.eq('storageId', storageId)).take(MAX_REFERENCES + 1)
  if (books.length > MAX_REFERENCES || children.length > MAX_REFERENCES) return { blocked: 'Private reference limit exceeded; manual review required.', refs: [], upload: null }
  const photos = await ctx.db.query('photos').withIndex('by_image', (q: any) => q.eq('imageId', storageId)).take(MAX_REFERENCES + 1)
  const avatars = await ctx.db.query('children').withIndex('by_image', (q: any) => q.eq('imageId', storageId)).take(MAX_REFERENCES + 1)
  if (photos.length > MAX_REFERENCES || avatars.length > MAX_REFERENCES) return { blocked: 'Private media reference limit exceeded; manual review required.', refs: [], upload: null }
  const refs = [...photos.map((row: any) => ({ table: 'photos', row })), ...avatars.map((row: any) => ({ table: 'children', row })), ...books.map((row: any) => ({ table: 'bookkeepingDocs', row })), ...children.map((row: any) => ({ table: 'childDocuments', row })),
    ...profiles.filter((row: any) => row.documents?.some((d: any) => d.storageId === storageId)).map((row: any) => ({ table: 'employeeProfiles', row }))]
  if (refs.length > MAX_REFERENCES) return { blocked: 'Combined private reference limit exceeded; manual review required.', refs: [], upload: null }
  if (refs.some(ref => ref.row.facilityId !== facilityId)) return { blocked: 'Object is shared by private records in multiple daycares; manual review required.', refs: [], upload: null }
  const uploads = await ctx.db.query('storedUploads').withIndex('by_storage', (q: any) => q.eq('storageId', storageId)).take(2)
  if (uploads.length > 1) return { blocked: 'Duplicate upload ownership records require manual review.', refs: [], upload: null }
  const upload = uploads[0]
  if (upload && (upload.facilityId !== facilityId || !PRIVATE_PURPOSES.includes(upload.purpose))) return { blocked: 'A public or foreign upload registration requires manual review.', refs: [], upload: null }
  return { blocked: null, refs, upload }
}
async function replaceReferences(ctx: any, facts: any, sourceId: any, replacementId: any) {
  for (const { table, row } of facts.refs) {
    if (table === 'employeeProfiles') await ctx.db.patch(row._id, { documents: row.documents.map((d: any) => d.storageId === sourceId ? { ...d, storageId: replacementId } : d) })
    else if (table === 'photos' || table === 'children') await ctx.db.patch(row._id, { imageId: replacementId })
    else await ctx.db.patch(row._id, { storageId: replacementId, updatedAt: Date.now() })
  }
  if (facts.upload) await ctx.db.patch(facts.upload._id, { storageId: replacementId })
}

export const inventory = internalQuery({
  args: { facilityId: v.id('facilities'), table: tableArg, cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { facilityId, table, cursor, limit }) => {
    if (!TABLES.includes(table)) throw new Error('Invalid private document table.')
    const facility = await ctx.db.get(facilityId)
    if (!facility || facility.isDemo) throw new Error('Choose a real daycare for private file inventory.')
    const page = await ctx.db.query(table).withIndex('by_facility', q => q.eq('facilityId', facilityId)).paginate({ cursor: cursor || null, numItems: Math.min(25, Math.max(1, Math.floor(limit || 10))) })
    const ids = [...new Set(page.page.flatMap((row: any) => table === 'employeeProfiles' ? (row.documents || []).map((d: any) => d.storageId) : (table === 'photos' || table === 'children') ? (row.imageId ? [row.imageId] : []) : row.storageId ? [row.storageId] : []))] as any[]
    const candidates = []
    for (const storageId of ids) {
      const rotated = await ctx.db.query('privateFileRotations').withIndex('by_replacement', q => q.eq('replacementId', storageId)).first()
      const job = await ctx.db.query('privateFileRotations').withIndex('by_source', q => q.eq('sourceId', storageId)).first()
      const upload = await ctx.db.query('storedUploads').withIndex('by_storage', q => q.eq('storageId', storageId)).first()
      candidates.push({ storageId, state: rotated ? 'protected_replacement' : job?.status || (upload && PRIVATE_PURPOSES.includes(upload.purpose) ? 'registered_private' : 'legacy_candidate') })
    }
    return { recordsScanned: page.page.length, privateObjects: ids.length, candidates, isDone: page.isDone, nextCursor: page.continueCursor }
  },
})

type Inspection = { eligible: false; reason: string } | { eligible: true; phase: 'copy' | 'revoke'; jobId?: Id<'privateFileRotations'>; replacementId?: Id<'_storage'>; references?: number }
async function inspectState(ctx: QueryCtx | MutationCtx, { facilityId, storageId, forceRegistered }: { facilityId: Id<'facilities'>; storageId: Id<'_storage'>; forceRegistered?: boolean }): Promise<Inspection> {
    const facility = await ctx.db.get(facilityId)
    if (!facility || facility.isDemo) return { eligible: false, reason: 'Choose a real daycare.' }
    const rotated = await ctx.db.query('privateFileRotations').withIndex('by_replacement', q => q.eq('replacementId', storageId)).first()
    if (rotated) return { eligible: false, reason: 'Already a protected replacement.' }
    const job = await ctx.db.query('privateFileRotations').withIndex('by_source', q => q.eq('sourceId', storageId)).first()
    if (job && job.facilityId !== facilityId) return { eligible: false, reason: 'Another daycare owns this migration.' }
    if (job?.status === 'references_updated') return { eligible: true, phase: 'revoke', jobId: job._id, replacementId: job.replacementId }
    if (job?.status === 'revoked') return { eligible: false, reason: 'Already revoked.' }
    const facts = await references(ctx, storageId, facilityId)
    if (facts.blocked || !facts.refs.length) return { eligible: false, reason: facts.blocked || 'No private references remain.' }
    if (facts.upload && !forceRegistered && !job) return { eligible: false, reason: 'Registered private upload; use forceRegistered only after review.' }
    return { eligible: true, phase: 'copy', references: facts.refs.length, jobId: job?._id }
}
export const inspect = internalQuery({
  args: { facilityId: v.id('facilities'), storageId: v.id('_storage'), forceRegistered: v.optional(v.boolean()) },
  handler: inspectState,
})
export const reserve = internalMutation({
  args: { facilityId: v.id('facilities'), storageId: v.id('_storage'), forceRegistered: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const state = await inspectState(ctx, args)
    if (!state.eligible || state.phase === 'revoke') return state
    const job = state.jobId ? await ctx.db.get(state.jobId) : null
    if (job?.status === 'copying' && job.updatedAt > Date.now() - 120_000) return { eligible: false, reason: 'Another copy worker holds the lease.' }
    const claimToken = randomToken(), now = Date.now()
    const values = { status: 'copying', claimToken, updatedAt: now, error: undefined }
    const jobId = job ? job._id : await ctx.db.insert('privateFileRotations', { facilityId: args.facilityId, sourceId: args.storageId, createdAt: now, ...values })
    if (job) await ctx.db.patch(jobId, values)
    return { ...state, jobId, claimToken }
  },
})
export const commitCopy = internalMutation({
  args: { jobId: v.id('privateFileRotations'), claimToken: v.string(), replacementId: v.id('_storage'), mimeType: v.string(), size: v.number() },
  handler: async (ctx, { jobId, claimToken, replacementId, mimeType, size }) => {
    const job = await ctx.db.get(jobId)
    if (!job || job.status !== 'copying' || job.claimToken !== claimToken) throw new Error('Copy lease changed; the unreferenced replacement must be removed.')
    if (replacementId === job.sourceId || !Number.isInteger(size) || size < 1 || size > MAX_BYTES) throw new Error('Invalid replacement file.')
    const facts = await references(ctx, job.sourceId, job.facilityId)
    if (facts.blocked || !facts.refs.length) throw new Error(facts.blocked || 'Private references changed before migration commit.')
    await replaceReferences(ctx, facts, job.sourceId, replacementId)
    if (!facts.upload) await ctx.db.insert('storedUploads', { facilityId: job.facilityId, storageId: replacementId, purpose: 'private-migration', mimeType, size, createdAt: Date.now() })
    await ctx.db.patch(jobId, { replacementId, status: 'references_updated', updatedAt: Date.now(), claimToken: undefined, error: undefined })
    return { referencesUpdated: facts.refs.length }
  },
})
export const failCopy = internalMutation({
  args: { jobId: v.id('privateFileRotations'), claimToken: v.string() },
  handler: async (ctx, { jobId, claimToken }) => {
    const job = await ctx.db.get(jobId)
    if (job?.status === 'copying' && job.claimToken === claimToken) await ctx.db.patch(jobId, { status: 'failed', claimToken: undefined, error: 'Copy or reference verification failed. Original remains preserved.', updatedAt: Date.now() })
  },
})
export const verifyRevoke = internalQuery({
  args: { jobId: v.id('privateFileRotations') },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId)
    if (!job || job.status !== 'references_updated' || !job.replacementId) throw new Error('Migration is not ready to revoke the source.')
    const facts = await references(ctx, job.sourceId, job.facilityId)
    if (facts.blocked || facts.refs.length || facts.upload) throw new Error(facts.blocked || 'Source is still referenced; do not delete it.')
    return { sourceId: job.sourceId, replacementId: job.replacementId }
  },
})
export const markRevoked = internalMutation({
  args: { jobId: v.id('privateFileRotations') },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId)
    if (job?.status === 'revoked') return
    if (!job || job.status !== 'references_updated' || !job.replacementId) throw new Error('Migration state changed before revocation.')
    const facts = await references(ctx, job.sourceId, job.facilityId)
    if (facts.blocked || facts.refs.length || facts.upload) throw new Error(facts.blocked || 'Source is still referenced; do not delete it.')
    const replacement = await ctx.db.system.get(job.replacementId)
    if (!replacement) throw new Error('Verified replacement is missing; original will not be revoked.')
    const original = await ctx.db.system.get(job.sourceId)
    if (original) await ctx.storage.delete(job.sourceId)
    await ctx.db.patch(jobId, { status: 'revoked', updatedAt: Date.now(), error: undefined })
  },
})
async function equalBytes(a: Blob, b: Blob) {
  if (a.size !== b.size || a.size < 1 || a.size > MAX_BYTES) return false
  const first = new Uint8Array(await crypto.subtle.digest('SHA-256', await a.arrayBuffer()))
  const second = new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()))
  return first.every((byte, index) => byte === second[index])
}
export const rotateBatch = internalAction({
  args: { facilityId: v.id('facilities'), storageIds: v.array(v.id('_storage')), dryRun: v.optional(v.boolean()), forceRegistered: v.optional(v.boolean()) },
  handler: async (ctx, { facilityId, storageIds, dryRun = true, forceRegistered }) => {
    if (!storageIds.length || storageIds.length > 5 || new Set(storageIds).size !== storageIds.length) throw new Error('Choose one to five distinct private objects per batch.')
    const results: any[] = []
    for (const storageId of storageIds) {
      let copyId: any, state: any
      try {
        state = await ctx.runQuery(internal.privateFileMigration.inspect, { facilityId, storageId, forceRegistered })
        if (dryRun || !state.eligible) { results.push({ storageId, ...state, dryRun }); continue }
        state = await ctx.runMutation(internal.privateFileMigration.reserve, { facilityId, storageId, forceRegistered })
        if (!state.eligible) { results.push({ storageId, ...state }); continue }
        if (state.phase !== 'revoke') {
          const stored = await ctx.storage.get(storageId)
          if (!stored || stored.size > MAX_BYTES + 512) throw new Error('Original file unavailable or exceeds the safe 8 MiB copy limit.')
          const original = await openPrivateBlob(stored)
          if (original.size < 1 || original.size > MAX_BYTES) throw new Error('Original file unavailable or exceeds the safe 8 MiB copy limit.')
          copyId = await ctx.storage.store(await sealPrivateBlob(original))
          const copy = await ctx.storage.get(copyId)
          if (!copy || !await equalBytes(original, await openPrivateBlob(copy))) throw new Error('Replacement copy failed byte verification.')
          await ctx.runMutation(internal.privateFileMigration.commitCopy, { jobId: state.jobId, claimToken: state.claimToken, replacementId: copyId, mimeType: original.type || 'application/octet-stream', size: original.size })
          copyId = undefined // now referenced: never remove on later cleanup failure
        }
        const ready = await ctx.runQuery(internal.privateFileMigration.verifyRevoke, { jobId: state.jobId })
        const replacementStored = await ctx.storage.get(ready.replacementId)
        if (!replacementStored) throw new Error('Replacement unavailable; original will not be revoked.')
        const replacement = await openPrivateBlob(replacementStored)
        const source = await ctx.storage.get(ready.sourceId)
        if (source && !await equalBytes(await openPrivateBlob(source), replacement)) throw new Error('Replacement differs; original will not be revoked.')
        await ctx.runMutation(internal.privateFileMigration.markRevoked, { jobId: state.jobId })
        results.push({ storageId, status: 'revoked', jobId: state.jobId })
      } catch {
        if (copyId) { try { await ctx.storage.delete(copyId) } catch {} }
        if (state?.claimToken) await ctx.runMutation(internal.privateFileMigration.failCopy, { jobId: state.jobId, claimToken: state.claimToken })
        results.push({ storageId, status: 'needs_review', jobId: state?.jobId, reason: 'Migration interrupted or a safety check refused it. Inspect job; original or verified replacement remains preserved.' })
      }
    }
    return { dryRun, results }
  },
})

// Include incomplete jobs when resuming: once references move, inventory pages
// contain the replacement and no longer expose the source awaiting revocation.
export const jobs = internalQuery({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { cursor, limit }) => {
    const page = await ctx.db.query('privateFileRotations').paginate({ cursor: cursor || null, numItems: Math.min(25, Math.max(1, Math.floor(limit || 10))) })
    return { jobs: page.page.map(job => ({ jobId: job._id, facilityId: job.facilityId, storageId: job.sourceId, replacementId: job.replacementId, status: job.status, updatedAt: job.updatedAt, error: job.error })), isDone: page.isDone, nextCursor: page.continueCursor }
  },
})
export const rollbackReferences = internalMutation({
  args: { jobId: v.id('privateFileRotations') },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId)
    if (!job || job.status !== 'references_updated' || !job.replacementId) throw new Error('Only an unrevoked source can be restored.')
    const facts = await references(ctx, job.replacementId, job.facilityId)
    if (facts.blocked || !facts.refs.length) throw new Error(facts.blocked || 'Replacement references changed; review manually.')
    await replaceReferences(ctx, facts, job.replacementId, job.sourceId)
    await ctx.db.patch(jobId, { status: 'rolled_back', updatedAt: Date.now(), claimToken: undefined, error: undefined })
    return { replacementId: job.replacementId }
  },
})
export const rollbackState = internalQuery({
  args: { jobId: v.id('privateFileRotations') },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId)
    if (!job || job.status !== 'references_updated' || !job.replacementId) throw new Error('Rollback is available only before the source URL is revoked.')
    return { sourceId: job.sourceId, replacementId: job.replacementId }
  },
})
export const rollback = internalAction({
  args: { jobId: v.id('privateFileRotations'), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { jobId, dryRun = true }):Promise<any> => {
    const state = await ctx.runQuery(internal.privateFileMigration.rollbackState, { jobId })
    const original = await ctx.storage.get(state.sourceId), replacement = await ctx.storage.get(state.replacementId)
    if (!original || !replacement || !await equalBytes(await openPrivateBlob(original), await openPrivateBlob(replacement))) throw new Error('A verified original is unavailable. Resume forward recovery; old revoked URLs cannot be restored.')
    if (dryRun) return { dryRun, canRestoreOriginalReferences: true }
    await ctx.runMutation(internal.privateFileMigration.rollbackReferences, { jobId })
    // Keep the now-unreferenced replacement tracked in the job for operator
    // review rather than deleting data while another operation may be resuming.
    return { dryRun, status: 'rolled_back', retainedReplacement: state.replacementId }
  },
})
