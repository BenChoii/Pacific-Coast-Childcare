import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId } from './lib'

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
    return docs.map(({ _id, _creationTime, facilityId, childName, ...rest }) => ({ id: _id, ...rest }))
  },
})

export const add = mutation({
  args: {
    type: v.string(),
    time: v.string(),
    title: v.string(),
    detail: v.string(),
    amount: v.optional(v.string()),
    by: v.string(),
    childName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) throw new Error('No facility')
    return await ctx.db.insert('activities', { ...args, facilityId: fid })
  },
})
