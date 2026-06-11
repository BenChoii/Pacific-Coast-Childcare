import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId } from './lib'

// Newest photos first. Parents only see whole-class photos plus photos targeted
// to their own child's family — never another family's private photos.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    const isParent = me?.role === 'parent'

    let myChildIds = new Set()
    if (isParent && uid) {
      const kids = await ctx.db
        .query('children')
        .withIndex('by_facility', (q) => q.eq('facilityId', fid))
        .collect()
      myChildIds = new Set(kids.filter((c) => c.parentUserId === uid).map((c) => c._id))
    }

    const docs = await ctx.db
      .query('photos')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .order('desc')
      .collect()

    const visible = docs.filter((p) => {
      if (!isParent) return true // educators + directors see everything
      if (p.audience === 'family') return !!p.childId && myChildIds.has(p.childId)
      return true // whole-class (or legacy) photos
    })

    const result = []
    for (const p of visible) {
      const { _id, _creationTime, facilityId, order, imageId, ...rest } = p
      result.push({
        id: _id,
        ...rest,
        imageUrl: imageId ? await ctx.storage.getUrl(imageId) : null,
      })
    }
    return result
  },
})

export const add = mutation({
  args: {
    caption: v.string(),
    room: v.string(),
    emoji: v.optional(v.string()),
    gradient: v.optional(v.string()),
    imageId: v.optional(v.id('_storage')),
    audience: v.optional(v.string()), // 'all' | 'family'
    childId: v.optional(v.id('children')),
    childName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) throw new Error('No facility')
    const top = await ctx.db
      .query('photos')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .order('desc')
      .first()
    const order = (top?.order ?? 0) + 1
    return await ctx.db.insert('photos', {
      facilityId: fid,
      emoji: args.emoji ?? '📸',
      caption: args.caption,
      room: args.room,
      gradient: args.gradient ?? 'from-brand-400 to-grape-500',
      imageId: args.imageId,
      audience: args.audience ?? 'all',
      childId: args.childId,
      childName: args.childName,
      time: 'Just now',
      likes: 0,
      liked: false,
      order,
    })
  },
})

export const like = mutation({
  args: { id: v.id('photos') },
  handler: async (ctx, { id }) => {
    const p = await ctx.db.get(id)
    if (!p) return
    await ctx.db.patch(id, { likes: p.likes + 1, liked: !p.liked })
  },
})
