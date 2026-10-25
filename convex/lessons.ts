import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId, requireAdmin, requireStaff } from './lib'
import { getAuthUserId } from '@convex-dev/auth/server'
import { recordOwnerEvent } from './notifications'

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
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    if (me?.role === 'parent') return { room: 'Main Room', week: '', theme: '' }
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
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    if (me?.role === 'parent') return []
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
    const { facilityId: fid } = await requireAdmin(ctx)
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
    const { facilityId: fid } = await requireAdmin(ctx)
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
    const { facilityId } = await requireAdmin(ctx)
    const block = await ctx.db.get(id)
    if (!block || block.facilityId !== facilityId) throw new Error('Lesson not found.')
    await ctx.db.patch(id, fields)
  },
})

export const deleteBlock = mutation({
  args: { id: v.id('lessonBlocks') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireAdmin(ctx)
    const block = await ctx.db.get(id)
    if (!block || block.facilityId !== facilityId) throw new Error('Lesson not found.')
    await ctx.db.delete(id)
  },
})

export const setStatus = mutation({
  args: { id: v.id('lessonBlocks'), status: v.string() },
  handler: async (ctx, { id, status }) => {
    const { facilityId } = await requireStaff(ctx)
    const block = await ctx.db.get(id)
    if (!block || block.facilityId !== facilityId) throw new Error('Lesson not found.')
    if (!['planned', 'active', 'done'].includes(status)) throw new Error('Invalid lesson status.')
    await ctx.db.patch(id, { status })
  },
})

export const toggleChild = mutation({
  args: { id: v.id('lessonBlocks'), child: v.string() },
  handler: async (ctx, { id, child }) => {
    const { facilityId } = await requireStaff(ctx)
    const b = await ctx.db.get(id)
    if (!b || b.facilityId !== facilityId) throw new Error('Lesson not found.')
    const kids = await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    if (!kids.some(k => k.name === child && !k.archivedAt)) throw new Error('Child not found.')
    const has = b.doneChildren.includes(child)
    await ctx.db.patch(id, {
      doneChildren: has ? b.doneChildren.filter((c) => c !== child) : [...b.doneChildren, child],
    })
  },
})

// Family-facing plans are separate published snapshots, never educator completion records.
const parentFields = {
  title: v.string(), period: v.union(v.literal('week'), v.literal('month')),
  startDate: v.string(), endDate: v.string(), room: v.optional(v.string()),
  overview: v.string(), activities: v.string(), goals: v.string(),
}
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s

export const familyPlans = query({
  args: { childId: v.optional(v.id('children')) },
  handler: async (ctx, { childId }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    let rooms: Set<string> | null = null
    if (user?.role === 'parent') {
      const kids = await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
      const mine = kids.filter(k => k.parentUserId === uid && !k.archivedAt)
      if (childId && !mine.some(k => k._id === childId)) return []
      const selected = childId ? mine.filter(k => k._id === childId) : mine
      if (!selected.length) return []
      rooms = new Set(selected.map(k => k.room))
    }
    const rows = await ctx.db.query('parentPlans').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
    return rows.filter(r => (user?.role === 'admin' || r.status === 'published') && (!rooms || !r.room || rooms.has(r.room)))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map(({ _id, facilityId, createdBy, ...r }) => ({ id: _id, ...r }))
  },
})

export const saveFamilyPlan = mutation({
  args: { id: v.optional(v.id('parentPlans')), ...parentFields },
  handler: async (ctx, { id, ...args }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    if (!args.title.trim() || args.title.length > 160) throw new Error('Add a title of up to 160 characters.')
    if (!validDate(args.startDate) || !validDate(args.endDate) || args.endDate < args.startDate) throw new Error('Choose a valid date range.')
    if ([args.overview, args.activities, args.goals].some(s => s.length > 15000) || (args.room?.length ?? 0) > 100) throw new Error('Please shorten the plan.')
    const data = { ...args, title: args.title.trim(), room: args.room?.trim() || undefined, updatedAt: Date.now() }
    if (id) {
      const p = await ctx.db.get(id)
      if (!p || p.facilityId !== facilityId) throw new Error('Plan not found.')
      // Saving edits returns the plan to draft; publishing is an explicit step.
      await ctx.db.patch(id, { ...data, status: 'draft' })
      if (p.status === 'published') await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'lesson-plan.updated', summary: `Updated published family plan ${args.title.trim()} and returned it to draft for review before republication.` })
    } else id = await ctx.db.insert('parentPlans', { ...data, facilityId, status: 'draft', createdBy: userId, createdAt: Date.now() })
    return id
  },
})

export const publishFamilyPlan = mutation({
  args: { id: v.id('parentPlans'), published: v.boolean() },
  handler: async (ctx, { id, published }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const p = await ctx.db.get(id)
    if (!p || p.facilityId !== facilityId) throw new Error('Plan not found.')
    if (published && !p.overview.trim() && !p.activities.trim()) throw new Error('Add an overview or activities before publishing.')
    if ((p.status === 'published') === published) return
    await ctx.db.patch(id, { status: published ? 'published' : 'draft', publishedAt: published ? Date.now() : p.publishedAt, updatedAt: Date.now() })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: published ? 'lesson-plan.published' : 'lesson-plan.unpublished', summary: `${published ? 'Published' : 'Unpublished'} ${p.period === 'week' ? 'weekly' : 'monthly'} family plan: ${p.title} (${p.startDate} to ${p.endDate}).` })
  },
})

export const removeFamilyPlan = mutation({
  args: { id: v.id('parentPlans') },
  handler: async (ctx, { id }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const p = await ctx.db.get(id)
    if (!p || p.facilityId !== facilityId) throw new Error('Plan not found.')
    await ctx.db.delete(id)
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'lesson-plan.removed', summary: `Removed family learning plan ${p.title} (${p.startDate} to ${p.endDate}).` })
  },
})
