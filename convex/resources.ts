import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId, requireStaff, requireRecord } from './lib'
import { getAuthUserId } from '@convex-dev/auth/server'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    if (user?.role === 'parent') return []
    const docs = await ctx.db
      .query('resources')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    return docs.map(({ _id, _creationTime, facilityId, order, ...rest }) => ({ id: _id, ...rest }))
  },
})

export const add = mutation({
  args: { title: v.string(), url: v.string(), type: v.string(), note: v.string(), category: v.string() },
  handler: async (ctx, args) => {
    const { facilityId: fid } = await requireStaff(ctx)
    const all = await ctx.db
      .query('resources')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const order = all.length ? Math.max(...all.map((r) => r.order)) + 1 : 0
    return await ctx.db.insert('resources', { ...args, facilityId: fid, order })
  },
})

export const remove = mutation({
  args: { id: v.id('resources') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireStaff(ctx)
    await requireRecord(ctx, id, facilityId)
    await ctx.db.delete(id)
  },
})
