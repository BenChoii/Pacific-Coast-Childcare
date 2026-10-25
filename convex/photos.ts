import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { recordOwnerEvent } from './notifications'
import { resolveFacilityId, requireStaff, requireRecord } from './lib'
import { checkedDate, localDate, boundedLimit, cleanText, facilityChildren, visibleChildren, relativeTime, dateWindow } from './workflowUtils'
import { assertOwnedUpload } from './files'

function sharedWith(photo: any, kids: any[], isParent: boolean, selectedId?: any) {
  if (!isParent && !selectedId) return true
  const selected = selectedId ? kids.filter(k => k._id === selectedId) : kids
  if (photo.audience === 'family') return !!photo.childId && selected.some(k => k._id === photo.childId)
  return selected.some(k => !photo.room || photo.room === 'All rooms' || (k.room !== 'Unassigned' && photo.room === k.room))
}
export const list = query({
  args: { childId: v.optional(v.id('children')), individualOnly: v.optional(v.boolean()), date: v.optional(v.string()), limit: v.optional(v.number()), before: v.optional(v.number()) },
  handler: async (ctx, { childId, individualOnly, date, limit, before }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx), me = uid ? await ctx.db.get(uid) : null
    const facility = await ctx.db.get(fid)
    if (date) checkedDate(date, facility)
    const kids = visibleChildren(await facilityChildren(ctx, fid), me, uid)
    if (childId && !kids.some(k => k._id === childId)) return []
    if (individualOnly && !childId) throw new Error('Choose a child for individually attributed photo memories.')
    let source = ctx.db.query('photos').withIndex('by_facility', q => q.eq('facilityId', fid))
    if (individualOnly) source=source.filter(q=>q.eq(q.field('childId'),childId))
    if (before !== undefined && !Number.isFinite(before)) throw new Error('Invalid page cursor.')
    if (childId || me?.role === 'parent') {
      const selected = childId ? kids.filter(k => k._id === childId) : kids
      if (!selected.length) return []
      const rooms = [...new Set(selected.map(k => k.room).filter(room => room && room !== 'Unassigned'))]
      source = source.filter(q => q.or(
        q.and(q.eq(q.field('audience'), 'family'), q.or(...selected.map(k => q.eq(q.field('childId'), k._id)))),
        q.and(q.neq(q.field('audience'), 'family'), q.or(...['', 'All rooms', ...rooms].map(room => q.eq(q.field('room'), room))))
      ))
    }
    if (date) { const {start,end}=dateWindow(date,facility); source=source.filter(q=>q.and(q.gte(q.field('_creationTime'),start),q.lt(q.field('_creationTime'),end))) }
    if (before !== undefined) source = source.filter(q => q.lt(q.field('_creationTime'), before))
    const rows = await source.order('desc').take(2000)
    const visible = rows.filter(p => sharedWith(p, kids, me?.role === 'parent', childId) && (!date || localDate(p.createdAt || p._creationTime, facility) === date)).slice(0, boundedLimit(limit))
    const result = []
    for (const p of visible) {
      const { _id, facilityId, order, imageId, createdBy, ...rest } = p
      const reactions = await ctx.db.query('photoReactions').withIndex('by_photo', q => q.eq('photoId', _id)).take(10000)
      const createdAt = p.createdAt || p._creationTime
      result.push({ id: _id, ...rest, createdAt, date: localDate(createdAt, facility), time: relativeTime(createdAt), likes: facility?.isDemo && !reactions.length ? p.likes : reactions.length,
        liked: uid ? reactions.some(r => r.userId === uid) : !!p.liked, imageId: imageId || undefined, imageUrl: facility?.isDemo && imageId ? await ctx.storage.getUrl(imageId) : null })
    }
    return result
  },
})
export const add = mutation({
  args: { caption: v.string(), room: v.string(), emoji: v.optional(v.string()), gradient: v.optional(v.string()), imageId: v.optional(v.id('_storage')), audience: v.optional(v.string()), childId: v.optional(v.id('children')), childName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { facilityId: fid, userId, facility } = await requireStaff(ctx)
    const audience = args.audience || 'all'
    if (!['all', 'family'].includes(audience)) throw new Error('Invalid audience.')
    const child = args.childId ? await requireRecord(ctx, args.childId, fid) : null
    if (child?.archivedAt) throw new Error('Child has been released.')
    if (audience === 'family' && !child) throw new Error('Choose the child whose family should receive this photo.')
    const room = child?.room || cleanText(args.room, 'Room', 100, true)
    if (audience === 'all') {
      const kids = await facilityChildren(ctx, fid)
      if (!facility?.isDemo && (room === 'Unassigned' || room === 'All rooms' || !kids.some(k => !k.archivedAt && k.room === room))) throw new Error('Choose an active classroom before sharing a class photo.')
    }
    if (args.imageId) await assertOwnedUpload(ctx, args.imageId, fid, userId, ['photo'])
    else if (!facility?.isDemo) throw new Error('Upload a photo before sharing it.')
    const top = await ctx.db.query('photos').withIndex('by_facility', q => q.eq('facilityId', fid)).order('desc').first()
    const createdAt = Date.now()
    const id = await ctx.db.insert('photos', { facilityId: fid, emoji: cleanText(args.emoji || '📸', 'Emoji', 20), caption: cleanText(args.caption, 'Caption', 5000), room, gradient: cleanText(args.gradient || 'from-brand-400 to-grape-500', 'Gradient', 160), imageId: args.imageId,
      audience, childId: child?._id, childName: child?.name, time: '', likes: 0, liked: false, order: (top?.order || 0) + 1, createdAt, createdBy: userId || undefined })
    await recordOwnerEvent(ctx, { facilityId: fid, actorId: userId || undefined, type: 'photo_added', summary: 'An educator shared a new classroom photo.' })
    return id
  },
})
export const like = mutation({
  args: { id: v.id('photos') },
  handler: async (ctx, { id }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) throw new Error('Daycare access required.')
    const photo = await requireRecord(ctx, id, fid)
    const uid = await getAuthUserId(ctx), user = uid ? await ctx.db.get(uid) : null
    if (!uid) { await requireStaff(ctx); await ctx.db.patch(id, { likes: Math.max(0, photo.likes + (photo.liked ? -1 : 1)), liked: !photo.liked }); return { liked: !photo.liked } }
    const kids = visibleChildren(await facilityChildren(ctx, fid), user, uid)
    if (!sharedWith(photo, kids, user?.role === 'parent')) throw new Error(photo.audience === 'family' ? 'Not your family photo.' : 'Photo is not shared with your class.')
    const existing = await ctx.db.query('photoReactions').withIndex('by_photo_user', q => q.eq('photoId', id).eq('userId', uid)).first()
    if (existing) await ctx.db.delete(existing._id)
    else await ctx.db.insert('photoReactions', { facilityId: fid, photoId: id, userId: uid, createdAt: Date.now() })
    return { liked: !existing }
  },
})
export const remove = mutation({
  args: { id: v.id('photos') },
  handler: async (ctx, { id }) => {
    const { facilityId, userId } = await requireStaff(ctx)
    const photo = await requireRecord(ctx, id, facilityId)
    const reactions = await ctx.db.query('photoReactions').withIndex('by_photo', q => q.eq('photoId', id)).collect()
    for (const reaction of reactions) await ctx.db.delete(reaction._id)
    await ctx.db.delete(id)
    if (photo.imageId) {
      const others = await ctx.db.query('photos').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
      if (!others.some(p => p.imageId === photo.imageId)) await ctx.storage.delete(photo.imageId)
    }
    await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'photo_removed', summary: 'A classroom photo was removed.' })
    return { ok: true }
  },
})
