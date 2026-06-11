import { query, mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireFacility } from './lib'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('children')
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

// How many children the current facility has enrolled (drives the free tier).
export const count = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return 0
    const docs = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    return docs.length
  },
})

// Internal insert used by the billing.addChild orchestration action and seed.
export const insert = internalMutation({
  args: {
    facilityId: v.id('facilities'),
    first: v.string(),
    name: v.string(),
    age: v.string(),
    room: v.string(),
    emoji: v.string(),
    color: v.string(),
    parent: v.string(),
    allergies: v.array(v.string()),
    monthlyTuition: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', args.facilityId))
      .collect()
    const order = all.length ? Math.max(...all.map((c) => c.order)) + 1 : 0
    const childId = await ctx.db.insert('children', {
      ...args,
      status: 'checked-out',
      checkInTime: '—',
      mood: '—',
      napMinutes: 0,
      photosToday: 0,
      order,
    })
    // Mirror onto the attendance roster so educators see them immediately.
    await ctx.db.insert('roster', {
      facilityId: args.facilityId,
      name: args.name,
      emoji: args.emoji,
      status: 'checked-out',
      time: '—',
      mood: '—',
      order,
    })
    return { childId, count: all.length + 1 }
  },
})

export const remove = mutation({
  args: { id: v.id('children') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireFacility(ctx)
    const child = await ctx.db.get(id)
    if (!child || child.facilityId !== facilityId) throw new Error('Not found')
    // Remove the matching roster row too.
    const rosterRows = await ctx.db
      .query('roster')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .collect()
    for (const r of rosterRows) if (r.name === child.name) await ctx.db.delete(r._id)
    await ctx.db.delete(id)
  },
})

// Director sets a child's monthly tuition (powers real revenue analytics).
export const setTuition = mutation({
  args: { id: v.id('children'), monthlyTuition: v.number() },
  handler: async (ctx, { id, monthlyTuition }) => {
    const { facilityId } = await requireFacility(ctx)
    const child = await ctx.db.get(id)
    if (!child || child.facilityId !== facilityId) throw new Error('Not found')
    await ctx.db.patch(id, { monthlyTuition })
  },
})

// A signed-in parent claims their child from the facility roster, linking the
// child record to their account so the parent app shows their real child.
export const claim = mutation({
  args: { id: v.id('children') },
  handler: async (ctx, { id }) => {
    const uid = await getAuthUserId(ctx)
    if (!uid) throw new Error('Sign in first')
    const user = await ctx.db.get(uid)
    const child = await ctx.db.get(id)
    if (!child || !user?.facilityId || child.facilityId !== user.facilityId) throw new Error('Not found')
    await ctx.db.patch(id, { parentUserId: uid })
  },
})
