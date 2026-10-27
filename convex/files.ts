import { action, mutation, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { requireFacility, childBelongsToParent } from './lib'
import { sealPrivateBlob } from './fileEncryption'

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const publicPurposes = ['photo', 'avatar', 'child-photo', 'child-document', 'bookkeeping', 'intake', 'learning-plan']
export function validateFileBytes(bytes: Uint8Array, mimeType: string) {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new Error('Upload a file of up to 8 MiB.')
  const prefix = (...values: number[]) => values.every((value, i) => bytes[i] === value)
  const ascii = (offset: number, text: string) => [...text].every((c, i) => bytes[offset + i] === c.charCodeAt(0))
  const valid = (mimeType === 'image/jpeg' && prefix(0xff, 0xd8, 0xff)) ||
    (mimeType === 'image/png' && prefix(137, 80, 78, 71, 13, 10, 26, 10)) ||
    (mimeType === 'image/gif' && (ascii(0, 'GIF87a') || ascii(0, 'GIF89a'))) ||
    (mimeType === 'image/webp' && ascii(0, 'RIFF') && ascii(8, 'WEBP')) ||
    (mimeType === 'application/pdf' && ascii(0, '%PDF-'))
  if (!valid) throw new Error('Use a valid JPEG, PNG, WebP, GIF or PDF file.')
}

// Only trusted server storage.store actions can create ownership records.
export const registerStoredUpload = internalMutation({
  args: { storageId: v.id('_storage'), facilityId: v.id('facilities'), uploadedBy: v.optional(v.id('users')), purpose: v.string(), mimeType: v.string(), size: v.number(), onboardingProfileId: v.optional(v.id('employeeProfiles')) },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.size) || args.size < 1 || args.size > MAX_UPLOAD_BYTES) throw new Error('Invalid upload size.')
    if (args.purpose === 'hr') {
      const profile = args.onboardingProfileId ? await ctx.db.get(args.onboardingProfileId) : null
      if (!profile || profile.facilityId !== args.facilityId || profile.status !== 'pending' || profile.revokedAt || (profile.expiresAt ?? profile.createdAt + 7 * 86400000) <= Date.now()) throw new Error('Active employee upload invitation required.')
    } else {
      const user = args.uploadedBy ? await ctx.db.get(args.uploadedBy) : null
      if (!user || user.facilityId !== args.facilityId || user.accessStatus === 'suspended') throw new Error('Active upload owner required.')
      if (['bookkeeping', 'learning-plan'].includes(args.purpose) && user.role !== 'admin') throw new Error('Director access required.')
      if (['photo', 'intake'].includes(args.purpose) && !['admin', 'staff'].includes(user.role || '')) throw new Error('Educator access required.')
    }
    const existing = await ctx.db.query('storedUploads').withIndex('by_storage', q => q.eq('storageId', args.storageId)).first()
    if (existing) {
      if (existing.facilityId !== args.facilityId || existing.uploadedBy !== args.uploadedBy || existing.onboardingProfileId !== args.onboardingProfileId) throw new Error('File ownership is already recorded.')
      return existing._id
    }
    if (args.purpose === 'hr') {
      const prior = await ctx.db.query('storedUploads').withIndex('by_facility', q => q.eq('facilityId', args.facilityId)).filter(q => q.eq(q.field('onboardingProfileId'), args.onboardingProfileId)).take(20)
      if (prior.length >= 20) throw new Error('This onboarding link has reached its upload limit. Ask the daycare for a new link.')
    }
    return await ctx.db.insert('storedUploads', { ...args, createdAt: Date.now() })
  },
})
export async function assertOwnedUpload(ctx: any, storageId: any, facilityId: any, userId: any, purposes?: string[]) {
  const upload = await ctx.db.query('storedUploads').withIndex('by_storage', (q: any) => q.eq('storageId', storageId)).first()
  if (!upload || upload.facilityId !== facilityId || upload.uploadedBy !== userId || (purposes && !purposes.includes(upload.purpose))) throw new Error('This file was not uploaded for this account and purpose. Upload it again.')
  return upload
}
export const uploadContext = internalQuery({
  args: {},
  handler: async ctx => {
    const { facilityId, userId, user } = await requireFacility(ctx)
    return { facilityId, userId, role: user.role }
  },
})
export const uploadFile = action({
  args: { base64: v.optional(v.string()), bytes: v.optional(v.bytes()), mimeType: v.string(), purpose: v.optional(v.string()) },
  handler: async (ctx, { base64, bytes: raw, mimeType, purpose = 'avatar' }) => {
    if (!await getAuthUserId(ctx)) throw new Error('Sign in before uploading a file.')
    const membership = await ctx.runQuery(internal.files.uploadContext, {})
    if (!publicPurposes.includes(purpose)) throw new Error('Invalid upload purpose.')
    if (purpose === 'bookkeeping' && membership.role !== 'admin') throw new Error('Only the owner/director can upload bookkeeping documents.')
    if (purpose === 'learning-plan' && membership.role !== 'admin') throw new Error('Only the owner/director can upload family schedules and learning plans.')
    if (['photo', 'intake'].includes(purpose) && !['admin', 'staff'].includes(membership.role || '')) throw new Error('Educator or director access required.')
    if (!['child-document', 'bookkeeping', 'intake', 'learning-plan'].includes(purpose) && !mimeType.startsWith('image/')) throw new Error('Choose an image for this upload.')
    if ((base64 === undefined) === (raw === undefined)) throw new Error('Provide exactly one file payload.')
    let bytes: Uint8Array
    if (raw !== undefined) bytes = new Uint8Array(raw)
    else {
      if (!base64 || base64.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4) throw new Error('Upload a file of up to 8 MiB.')
      try { bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)) } catch { throw new Error('The file could not be read. Choose it again.') }
    }
    validateFileBytes(bytes, mimeType)
    const original = new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: mimeType })
    const stored = purpose === 'avatar' ? original : await sealPrivateBlob(original)
    const storageId = await ctx.storage.store(stored)
    try {
      await ctx.runMutation(internal.files.registerStoredUpload, { storageId, facilityId: membership.facilityId, uploadedBy: membership.userId, purpose, mimeType, size: bytes.byteLength })
    } catch (error) {
      await ctx.storage.delete(storageId)
      throw error
    }
    return { storageId }
  },
})

// Legacy direct uploads remain available for older clients, but an arbitrary
// returned storageId cannot be attached without a trusted ownership record.
export const generateUploadUrl = mutation({
  args: {}, handler: async ctx => { await requireFacility(ctx); return await ctx.storage.generateUploadUrl() },
})
export const setMyAvatar = mutation({
  args: { imageId: v.id('_storage') },
  handler: async (ctx, { imageId }) => {
    const { userId, user, facilityId } = await requireFacility(ctx)
    if (imageId !== user.imageId) await assertOwnedUpload(ctx, imageId, facilityId, userId, ['avatar'])
    await ctx.db.patch(userId, { imageId })
  },
})
export const setChildPhoto = mutation({
  args: { id: v.id('children'), imageId: v.id('_storage') },
  handler: async (ctx, { id, imageId }) => {
    const { facilityId, user, userId } = await requireFacility(ctx)
    const child = await ctx.db.get(id)
    if (!child || child.archivedAt || child.facilityId !== facilityId || (user.role === 'parent' && !childBelongsToParent(child, userId))) throw new Error('Child not found.')
    if (imageId !== child.imageId) await assertOwnedUpload(ctx, imageId, facilityId, userId, ['child-photo'])
    await ctx.db.patch(id, { imageId })
  },
})
export const setEducatorPhoto = mutation({
  args: { id: v.id('educators'), imageId: v.id('_storage') },
  handler: async (ctx, { id, imageId }) => {
    const { facilityId, user, userId } = await requireFacility(ctx)
    const educator = await ctx.db.get(id)
    if (!educator || educator.facilityId !== facilityId || (user.role !== 'admin' && educator.userId !== userId)) throw new Error('Educator not found.')
    if (imageId !== educator.imageId) await assertOwnedUpload(ctx, imageId, facilityId, userId, ['avatar'])
    await ctx.db.patch(id, { imageId })
  },
})
