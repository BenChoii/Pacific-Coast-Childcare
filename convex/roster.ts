import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId } from './lib'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('roster')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    return docs.map(({ _id, _creationTime, facilityId, order, ...rest }) => ({ id: _id, ...rest }))
  },
})

// Toggle a child between checked-in and checked-out (caregiver attendance).
export const toggle = mutation({
  args: { id: v.id('roster'), time: v.string() },
  handler: async (ctx, { id, time }) => {
    const child = await ctx.db.get(id)
    if (!child) return
    const next = child.status === 'checked-in' ? 'checked-out' : 'checked-in'
    await ctx.db.patch(id, { status: next, time })
  },
})

// Set an explicit attendance status (checked-in | checked-out | absent | napping).
export const setStatus = mutation({
  args: { id: v.id('roster'), status: v.string(), time: v.string() },
  handler: async (ctx, { id, status, time }) => {
    await ctx.db.patch(id, { status, time: status === 'absent' ? '—' : time })
  },
})
