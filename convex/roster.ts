import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId, requireStaff, requireRecord } from './lib'
import { recordOwnerEvent } from './notifications'
import { getAuthUserId } from '@convex-dev/auth/server'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('roster')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    const kids = await ctx.db.query('children').withIndex('by_facility', (q) => q.eq('facilityId', fid)).collect()
    const activeKids = kids.filter((child) => !child.archivedAt && (user?.role !== 'parent' || child.parentUserId === uid))
    const ids = new Set(activeKids.map((child) => child._id))
    return docs.flatMap(({ _id, _creationTime, facilityId, order, ...rest }) => {
      const matching = kids.filter((child) => child.name === rest.name)
      const childId = rest.childId || (matching.length === 1 ? matching[0]._id : undefined)
      if (childId ? !ids.has(childId) : user?.role === 'parent' || !activeKids.some((child) => child.name === rest.name)) return []
      return [{ id: _id, ...rest, childId }]
    })
  },
})

// Toggle a child between checked-in and checked-out (caregiver attendance).
export const toggle = mutation({
  args: { id: v.id('roster'), time: v.string() },
  handler: async (ctx, { id, time }) => {
    const { facilityId, userId } = await requireStaff(ctx)
    const child = await requireRecord(ctx, id, facilityId)
    const next = child.status === 'checked-in' ? 'checked-out' : 'checked-in'
    await ctx.db.patch(id, { status: next, time })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'attendance_changed', summary: `${child.name}'s attendance was updated.` })
  },
})

// Set an explicit attendance status (checked-in | checked-out | absent | napping).
export const setStatus = mutation({
  args: { id: v.id('roster'), status: v.string(), time: v.string() },
  handler: async (ctx, { id, status, time }) => {
    const { facilityId, userId } = await requireStaff(ctx)
    const child = await requireRecord(ctx, id, facilityId)
    if (!['checked-in', 'checked-out', 'absent', 'napping'].includes(status)) throw new Error('Invalid attendance status.')
    await ctx.db.patch(id, { status, time: status === 'absent' ? '—' : time })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'attendance_changed', summary: `${child.name}'s attendance was updated.` })
  },
})
