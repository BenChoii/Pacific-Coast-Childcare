import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { recordOwnerEvent } from './notifications'
import { resolveFacilityId, requireStaff, requireRecord } from './lib'

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
    let myRooms = new Set<string>()
    if (isParent && uid) {
      const kids = await ctx.db
        .query('children')
        .withIndex('by_facility', (q) => q.eq('facilityId', fid))
        .collect()
      const mine = kids.filter((c) => !c.archivedAt && c.parentUserId === uid)
      myChildIds = new Set(mine.map((c) => c._id))
      myRooms = new Set(mine.map((c) => c.room).filter((room) => room !== 'Unassigned'))
    }

    const docs = await ctx.db
      .query('photos')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .order('desc')
      .collect()

    const visible = docs.filter((p) => {
      if (!isParent) return true // educators + directors see everything
      if (p.audience === 'family') return !!p.childId && myChildIds.has(p.childId)
      return !p.room || p.room === 'All rooms' || myRooms.has(p.room)
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
    const { facilityId: fid, userId } = await requireStaff(ctx)
    if (args.childId) { const child = await requireRecord(ctx, args.childId, fid); if (child.archivedAt) throw new Error('Child has been released.') }
    if (args.audience && !['all', 'family'].includes(args.audience)) throw new Error('Invalid audience.')
    const top = await ctx.db
      .query('photos')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .order('desc')
      .first()
    const order = (top?.order ?? 0) + 1
    const id = await ctx.db.insert('photos', {
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
    await recordOwnerEvent(ctx, { facilityId: fid, actorId: userId || undefined, type: 'photo_added', summary: 'An educator shared a new classroom photo.' })
    return id
  },
})

export const like = mutation({
  args: { id: v.id('photos') },
  handler: async (ctx, { id }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) throw new Error('Daycare access required.')
    const p = await requireRecord(ctx, id, fid)
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    if (user?.role === 'parent') {
      const kids = await ctx.db.query('children').withIndex('by_facility', (q) => q.eq('facilityId', fid)).collect()
      const mine = kids.filter((child) => !child.archivedAt && child.parentUserId === uid)
      if (p.audience === 'family') {
        if (!mine.some((child) => child._id === p.childId)) throw new Error('Not your family photo.')
      } else if (p.room && p.room !== 'All rooms' && !mine.some((child) => child.room !== 'Unassigned' && child.room === p.room)) throw new Error('Photo is not shared with your class.')
    }
    await ctx.db.patch(id, { likes: p.likes + 1, liked: !p.liked })
  },
})
