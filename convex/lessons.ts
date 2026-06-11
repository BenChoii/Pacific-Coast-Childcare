import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId } from './lib'

// Lesson plans are scoped per facility. Each facility keeps one active plan
// (theme/week) plus a set of time-based, program-based blocks educators run.

async function facilityRoom(ctx: any, fid: any) {
  const p = await ctx.db
    .query('lessonPlans')
    .withIndex('by_facility', (q: any) => q.eq('facilityId', fid))
    .first()
  return p?.room ?? 'Main Room'
}

export const plan = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return { room: 'Main Room', week: '', theme: '' }
    const p = await ctx.db
      .query('lessonPlans')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .first()
    if (!p) return { room: 'Main Room', week: '', theme: '' }
    return { week: p.week, theme: p.theme, room: p.room }
  },
})

export const blocks = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('lessonBlocks')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    return docs.map(({ _id, _creationTime, facilityId, room, ...rest }) => ({ id: _id, ...rest }))
  },
})

export const setTheme = mutation({
  args: { week: v.string(), theme: v.string() },
  handler: async (ctx, { week, theme }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) throw new Error('No facility')
    const p = await ctx.db
      .query('lessonPlans')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .first()
    if (p) await ctx.db.patch(p._id, { week, theme })
    else await ctx.db.insert('lessonPlans', { facilityId: fid, room: 'Main Room', week, theme })
  },
})

export const addBlock = mutation({
  args: {
    day: v.string(),
    time: v.string(),
    title: v.string(),
    detail: v.string(),
    program: v.string(),
    materials: v.array(v.string()),
    objectives: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) throw new Error('No facility')
    const room = await facilityRoom(ctx, fid)
    const all = await ctx.db
      .query('lessonBlocks')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const dayBlocks = all.filter((b) => b.day === args.day)
    const order = dayBlocks.length ? Math.max(...dayBlocks.map((b) => b.order)) + 1 : 0
    return await ctx.db.insert('lessonBlocks', {
      facilityId: fid,
      room,
      ...args,
      order,
      status: 'planned',
      doneChildren: [],
    })
  },
})

export const updateBlock = mutation({
  args: {
    id: v.id('lessonBlocks'),
    time: v.string(),
    title: v.string(),
    detail: v.string(),
    program: v.string(),
    materials: v.array(v.string()),
    objectives: v.array(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields)
  },
})

export const deleteBlock = mutation({
  args: { id: v.id('lessonBlocks') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})

export const setStatus = mutation({
  args: { id: v.id('lessonBlocks'), status: v.string() },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status })
  },
})

export const toggleChild = mutation({
  args: { id: v.id('lessonBlocks'), child: v.string() },
  handler: async (ctx, { id, child }) => {
    const b = await ctx.db.get(id)
    if (!b) return
    const has = b.doneChildren.includes(child)
    await ctx.db.patch(id, {
      doneChildren: has ? b.doneChildren.filter((c) => c !== child) : [...b.doneChildren, child],
    })
  },
})
