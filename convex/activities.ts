import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId, requireStaff } from './lib'
import { recordOwnerEvent } from './notifications'
import { getAuthUserId } from '@convex-dev/auth/server'

// Newest activity first — the timeline reads top-down.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('activities')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .order('desc')
      .collect()
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    const kids = user?.role === 'parent' ? await ctx.db.query('children').withIndex('by_facility', (q) => q.eq('facilityId', fid)).collect() : []
    const mine = kids.filter((child) => !child.archivedAt && child.parentUserId === uid)
    const ids = new Set(mine.map((child) => child._id))
    const names = new Set(mine.filter((child) => kids.filter((c) => c.name === child.name).length === 1).map((child) => child.name))
    return docs.filter((entry) => user?.role !== 'parent' || (entry.childId ? ids.has(entry.childId) : !!entry.childName && names.has(entry.childName))).map(({ _id, _creationTime, facilityId, ...rest }) => ({ id: _id, ...rest }))
  },
})

export const add = mutation({
  args: {
    childId: v.optional(v.id('children')),
    type: v.string(),
    time: v.string(),
    title: v.string(),
    detail: v.string(),
    amount: v.optional(v.string()),
    by: v.string(),
    childName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { facilityId: fid, userId } = await requireStaff(ctx)
    const kids = await ctx.db.query('children').withIndex('by_facility', (q) => q.eq('facilityId', fid)).collect()
    const matches = args.childId ? kids.filter((child) => child._id === args.childId) : kids.filter((child) => child.name === args.childName)
    if ((args.childId || args.childName) && (matches.length !== 1 || matches[0].archivedAt)) throw new Error('Choose one active child for this update.')
    const child = matches[0]
    const id = await ctx.db.insert('activities', { ...args, childId: child?._id, childName: child?.name, facilityId: fid })
    await recordOwnerEvent(ctx, { facilityId: fid, actorId: userId || undefined, type: 'activity_added', summary: 'An educator added a daily activity update.' })
    return id
  },
})
