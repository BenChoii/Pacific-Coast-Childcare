import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { requireFacility } from './lib'

// Returns a short-lived URL the client PUTs an image to; the response gives a
// storageId we then attach to a user/child/educator/photo.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
})

// Current user's profile photo.
export const setMyAvatar = mutation({
  args: { imageId: v.id('_storage') },
  handler: async (ctx, { imageId }) => {
    const uid = await getAuthUserId(ctx)
    if (!uid) throw new Error('Sign in first')
    await ctx.db.patch(uid, { imageId })
  },
})

// A child's profile photo (any member of the child's facility can set it).
export const setChildPhoto = mutation({
  args: { id: v.id('children'), imageId: v.id('_storage') },
  handler: async (ctx, { id, imageId }) => {
    const { facilityId } = await requireFacility(ctx)
    const child = await ctx.db.get(id)
    if (!child || child.facilityId !== facilityId) throw new Error('Not found')
    await ctx.db.patch(id, { imageId })
  },
})

// An educator's profile photo.
export const setEducatorPhoto = mutation({
  args: { id: v.id('educators'), imageId: v.id('_storage') },
  handler: async (ctx, { id, imageId }) => {
    const { facilityId } = await requireFacility(ctx)
    const e = await ctx.db.get(id)
    if (!e || e.facilityId !== facilityId) throw new Error('Not found')
    await ctx.db.patch(id, { imageId })
  },
})
