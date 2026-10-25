import { internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

// Internal deployment-operator helpers only. Public APIs cannot invoke these.
// Every writable/deletable identity is confined to one exact synthetic run.
const roles = ['owner', 'parent-a', 'parent-b', 'staff'] as const
const MAX_PER_QUERY = 100, MAX_TOTAL = 1000
function namespace(runId: string) {
  if (!/^[a-z0-9]{8,32}$/.test(runId)) throw new Error('Use a synthetic QA run ID of 8–32 lowercase letters/digits.')
  return { slug: `mitten-qa-${runId}`, emails: new Set(roles.map(role => `qa-mitten-${runId}-${role}@example.invalid`)), ownerEmail: `qa-mitten-${runId}-owner@example.invalid` }
}
async function exactFixture(ctx: QueryCtx | MutationCtx, runId: string, facilityId: Id<'facilities'>) {
  const ns = namespace(runId), facility = await ctx.db.get(facilityId)
  if (!facility || facility.slug !== ns.slug || facility.name !== `Mitten QA ${runId}` || facility.isDemo !== false || facility.ownerEmailMode !== 'off' || !facility.ownerUserId || facility.stripeCustomerId || facility.stripeSubscriptionId || facility.stripeAccountId) throw new Error('Not the exact synthetic, muted, non-billing QA fixture.')
  const owner = await ctx.db.get(facility.ownerUserId)
  if (!owner || owner.email !== ns.ownerEmail || owner.facilityId !== facilityId) throw new Error('Synthetic fixture owner does not match.')
  return { ns, facility, owner }
}
export const setup = internalMutation({
  args: { runId: v.string(), ownerUserId: v.id('users') },
  handler: async (ctx, { runId, ownerUserId }) => {
    const ns = namespace(runId), owner = await ctx.db.get(ownerUserId)
    if (!owner || owner.email !== ns.ownerEmail || owner.role !== 'admin') throw new Error('A freshly signed-up matching synthetic owner is required.')
    const existing = await ctx.db.query('facilities').withIndex('by_slug', q => q.eq('slug', ns.slug)).first()
    if (existing) {
      const fixture = await exactFixture(ctx, runId, existing._id)
      if (fixture.owner._id !== ownerUserId) throw new Error('Run belongs to another owner.')
      return { facilityId: existing._id, slug: ns.slug, reused: true }
    }
    if (Date.now() - owner._creationTime > 3_600_000) throw new Error('Sign up a fresh synthetic owner for this QA run.')
    if (owner.facilityId || owner.accessStatus === 'suspended') throw new Error('Only an unaffiliated fresh synthetic owner can create this fixture.')
    const facilityId = await ctx.db.insert('facilities', { name: `Mitten QA ${runId}`, slug: ns.slug, ownerUserId, plan: 'free', freeLimit: 1000, ownerEmailMode: 'off', autoInvoice: false, isDemo: false, timezone: 'America/Vancouver', addons: { bookkeeping: true }, createdAt: Date.now() })
    await ctx.db.patch(ownerUserId, { facilityId, accessStatus: 'active' })
    return { facilityId, slug: ns.slug, reused: false }
  },
})
export const inspect = internalQuery({
  args: { runId: v.string(), facilityId: v.id('facilities'), storageId: v.optional(v.id('_storage')) },
  handler: async (ctx, { runId, facilityId, storageId }) => {
    await exactFixture(ctx, runId, facilityId)
    const events = await ctx.db.query('ownerEvents').withIndex('by_facility', q => q.eq('facilityId', facilityId)).take(MAX_PER_QUERY + 1)
    if (events.length > MAX_PER_QUERY) throw new Error('Fixture event inspection limit exceeded.')
    let storageUrl: string | null = null
    if (storageId) {
      const owned = await ctx.db.query('storedUploads').withIndex('by_storage', q => q.eq('storageId', storageId)).first()
      if (!owned || owned.facilityId !== facilityId) throw new Error('Only this synthetic fixture’s uploads may be inspected.')
      storageUrl = await ctx.storage.getUrl(storageId)
    }
    return { eventCount: events.length, eventsAllRecordedWithoutSending: events.every(event => event.status === 'recorded' && event.attempts === 0), storageUrl }
  },
})

const facilityTables = [
  ['directoryListings','by_facility'],['invites','by_facility'],['children','by_facility'],['activities','by_facility'],['roster','by_facility'],
  ['conversations','by_facility'],['invoices','by_facility'],['subsidies','by_facility'],['photos','by_facility'],['lessonPlans','by_facility'],['lessonBlocks','by_facility'],
  ['milestones','by_facility'],['resources','by_facility'],['educators','by_facility'],['employeeProfiles','by_facility'],['extraServices','by_facility'],
  ['extraCharges','by_facility'],['planSubscriptions','by_facility'],['payRuns','by_facility'],['inquiries','by_facility'],['bookkeepingDocs','by_facility'],
  ['calendarEvents','by_facility'],['parentPlans','by_facility'],['attendanceEvents','by_facility_date'],['storedUploads','by_facility'],['childDocuments','by_facility'],
  ['incidents','by_facility'],['ownerEvents','by_facility'],['clockSessions','by_facility'],
] as const
async function collectCleanup(ctx: any, runId: string, facilityId: any, userIds: any[]) {
  const ns = namespace(runId)
  const fixture = facilityId ? await exactFixture(ctx, runId, facilityId) : null
  if (!userIds.length || userIds.length > 4 || new Set(userIds).size !== userIds.length) throw new Error('Supply the distinct synthetic user IDs from this run, up to four.')
  const users = []
  for (const id of userIds) {
    const user = await ctx.db.get(id)
    if (!user || !ns.emails.has(user.email) || (user.facilityId && user.facilityId !== facilityId)) throw new Error('Cleanup refuses a non-synthetic or other-facility user.')
    users.push(user)
  }
  const selected = new Map<string, any>(), counts: Record<string, number> = {}, uploads: any[] = []
  const add = (table: string, rows: any[]) => {
    if (rows.length > MAX_PER_QUERY) throw new Error(`Synthetic cleanup limit exceeded for ${table}; no changes applied.`)
    for (const row of rows) { if (row.facilityId && row.facilityId !== facilityId) throw new Error('An outside dependent record prevents cleanup.'); if (!selected.has(row._id)) { selected.set(row._id, row); counts[table] = (counts[table] || 0) + 1 } }
    if (selected.size > MAX_TOTAL) throw new Error('Synthetic cleanup total limit exceeded; no changes applied.')
  }
  const rowsBy = async (table: string, index: string, field: string, value: any) => await ctx.db.query(table).withIndex(index, (q: any) => q.eq(field, value)).take(MAX_PER_QUERY + 1)
  if (fixture) {
    const members = await rowsBy('users', 'by_facility', 'facilityId', facilityId)
    if (members.some((user: any) => !userIds.includes(user._id) || !ns.emails.has(user.email))) throw new Error('A non-selected or non-synthetic member is attached; cleanup refuses the entire tenant.')
    if (!userIds.includes(fixture.owner._id)) throw new Error('Include the exact synthetic owner in cleanup.')
    for (const [table, index] of facilityTables) {
      const rows = await rowsBy(table, index, 'facilityId', facilityId)
      if (rows.some((row: any) => row.facilityId !== facilityId)) throw new Error('Unexpected cross-tenant record.')
      add(table, rows)
      if (table === 'storedUploads') uploads.push(...rows)
      if (table === 'conversations') for (const row of rows) { add('messages', await rowsBy('messages','by_conversation','conversationId',row._id)); add('conversationReads', await rowsBy('conversationReads','by_conversation_user','conversationId',row._id)) }
      if (table === 'photos') for (const row of rows) add('photoReactions', await rowsBy('photoReactions','by_photo','photoId',row._id))
      if (table === 'invoices') for (const row of rows) {
        const attempts = await rowsBy('paymentAttempts','by_invoice','invoiceId',row._id)
        if (attempts.some((attempt: any) => attempt.facilityId !== facilityId || attempt.stripeSessionId)) throw new Error('Live/external payment artifacts are never cleaned by this fixture helper.')
        add('paymentAttempts', attempts)
      }
    }
  }
  for (const user of users) {
    const sessions = await rowsBy('authSessions','userId','userId',user._id)
    add('authSessions',sessions)
    for (const session of sessions) {
      add('authRefreshTokens',await rowsBy('authRefreshTokens','sessionId','sessionId',session._id))
      add('authVerifiers',await rowsBy('authVerifiers','by_session','sessionId',session._id))
    }
    const accounts = await rowsBy('authAccounts','userIdAndProvider','userId',user._id)
    if (accounts.some((account: any) => account.provider !== 'password' || !ns.emails.has(account.providerAccountId))) throw new Error('Cleanup refuses a non-synthetic auth account.')
    add('authAccounts',accounts)
    for (const account of accounts) { add('authVerificationCodes',await rowsBy('authVerificationCodes','accountId','accountId',account._id)); add('authRateLimits',await rowsBy('authRateLimits','identifier','identifier',account._id)) }
    add('users',[user])
  }
  const storageIds = new Set<any>()
  for (const upload of uploads) {
    if (upload.uploadedBy && !userIds.includes(upload.uploadedBy)) throw new Error('Non-test upload owner; cleanup refused.')
    if (!upload.uploadedBy) {
      const profile = upload.onboardingProfileId ? await ctx.db.get(upload.onboardingProfileId) : null
      if (!profile || profile.facilityId !== facilityId) throw new Error('Upload lacks a matching synthetic account or onboarding owner.')
    }
    const registrations = await rowsBy('storedUploads','by_storage','storageId',upload.storageId)
    if (registrations.some((row: any) => row.facilityId !== facilityId)) throw new Error('File is registered outside the exact fixture; cleanup refused.')
    const metadata = await ctx.db.system.get(upload.storageId)
    if (metadata && metadata._creationTime < fixture!.facility.createdAt) throw new Error('File predates this fixture; cleanup refused.')
    for (const [table,field,index] of [['users','imageId','by_image'],['children','imageId','by_image'],['educators','imageId','by_image'],['photos','imageId','by_image'],['facilities','logoId','by_logo']]) {
      const refs = await rowsBy(table,index,field,upload.storageId)
      if (refs.some((row: any) => table === 'users' ? !userIds.includes(row._id) : row.facilityId !== facilityId && row._id !== facilityId)) throw new Error('File has an outside reference; cleanup refused.')
    }
    for (const table of ['bookkeepingDocs','childDocuments']) {
      const refs = await rowsBy(table,'by_storage','storageId',upload.storageId)
      if (refs.some((row: any) => row.facilityId !== facilityId)) throw new Error('Private file has an outside document reference; cleanup refused.')
    }
    const migrations = await rowsBy('privateFileRotations','by_source','sourceId',upload.storageId)
    const replacements = await rowsBy('privateFileRotations','by_replacement','replacementId',upload.storageId)
    if ([...migrations,...replacements].some((row: any) => row.facilityId !== facilityId)) throw new Error('File migration belongs to another tenant.')
    add('privateFileRotations',[...migrations,...replacements]);storageIds.add(upload.storageId)
  }
  return { records: [...selected.values()], counts, storageIds: [...storageIds], facility: fixture?.facility }
}
export const cleanup = internalMutation({
  args: { runId: v.string(), facilityId: v.optional(v.id('facilities')), userIds: v.array(v.id('users')), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { runId, facilityId, userIds, dryRun = true }) => {
    const selected = await collectCleanup(ctx,runId,facilityId,userIds)
    if (!dryRun) {
      for (const id of selected.storageIds) await ctx.storage.delete(id)
      for (const row of selected.records) await ctx.db.delete(row._id)
      if (selected.facility) await ctx.db.delete(selected.facility._id)
    }
    return { dryRun, records: selected.records.length, files: selected.storageIds.length, facility: !!selected.facility, counts: selected.counts }
  },
})

// Recover IDs after an interrupted signup without scanning unrelated accounts.
export const locate = internalQuery({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const ns = namespace(runId), userIds: Id<'users'>[] = []
    for (const email of ns.emails) {
      const matches = await ctx.db.query('users').withIndex('email', q => q.eq('email', email)).take(2)
      if (matches.length > 1) throw new Error('Duplicate synthetic identities require manual review.')
      if (matches[0]) userIds.push(matches[0]._id)
    }
    const facility = await ctx.db.query('facilities').withIndex('by_slug', q => q.eq('slug', ns.slug)).first()
    if (facility) await exactFixture(ctx, runId, facility._id)
    return { userIds, facilityId: facility?._id }
  },
})
