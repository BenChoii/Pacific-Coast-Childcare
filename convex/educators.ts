import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId, requireFacility } from './lib'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('educators')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const out = []
    for (const d of docs) {
      const { _id, _creationTime, facilityId, order, imageId, ...rest } = d
      out.push({ id: _id, ...rest, imageUrl: imageId ? await ctx.storage.getUrl(imageId) : null })
    }
    return out
  },
})

// Add an educator to the current facility (owner/admin, used in onboarding + Educators view).
export const add = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    room: v.string(),
    emoji: v.optional(v.string()),
    certifications: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { facilityId } = await requireFacility(ctx)
    const all = await ctx.db
      .query('educators')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .collect()
    const order = all.length ? Math.max(...all.map((e) => e.order)) + 1 : 0
    return await ctx.db.insert('educators', {
      facilityId,
      name: args.name,
      role: args.role,
      room: args.room,
      emoji: args.emoji ?? '🧑‍🏫',
      hireDate: 'New',
      certifications: args.certifications ?? [],
      status: 'out',
      todaySeconds: 0,
      punches: [],
      hoursWeek: 0,
      hoursTarget: 38,
      pto: '0 days',
      order,
    })
  },
})

// Toggle clock in/out for an educator, recording the punch and accumulating time.
export const clock = mutation({
  args: { id: v.id('educators'), time: v.string() },
  handler: async (ctx, { id, time }) => {
    const e = await ctx.db.get(id)
    if (!e) return
    if (e.status === 'out') {
      await ctx.db.patch(id, {
        status: 'in',
        clockInAt: Date.now(),
        punches: [...e.punches, { type: 'in', time }],
      })
    } else {
      const sessionSec = e.clockInAt ? Math.round((Date.now() - e.clockInAt) / 1000) : 0
      await ctx.db.patch(id, {
        status: 'out',
        clockInAt: undefined,
        todaySeconds: e.todaySeconds + sessionSec,
        punches: [...e.punches, { type: 'out', time }],
      })
    }
  },
})
