import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId, requireStaff } from './lib'
import { recordOwnerEvent } from './notifications'
import { getAuthUserId } from '@convex-dev/auth/server'
import { checkedDate, localDate, displayTime, boundedLimit, cleanText, facilityChildren, visibleChildren, dateWindow } from './workflowUtils'

export const list = query({
  args: { childId: v.optional(v.id('children')), date: v.optional(v.string()), limit: v.optional(v.number()), before: v.optional(v.number()) },
  handler: async (ctx, { childId, date, limit, before }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const facility = await ctx.db.get(fid)
    if (date) checkedDate(date, facility)
    const uid = await getAuthUserId(ctx), user = uid ? await ctx.db.get(uid) : null
    const kids = await facilityChildren(ctx, fid)
    const allowed = visibleChildren(kids, user, uid)
    if (childId && !allowed.some(k => k._id === childId)) return []
    const ids = new Set(allowed.map(k => k._id))
    const names = new Map(allowed.filter(k => kids.filter(c => c.name === k.name).length === 1).map(k => [k.name, k._id]))
    const size = boundedLimit(limit)
    if (before !== undefined && !Number.isFinite(before)) throw new Error('Invalid page cursor.')
    // Bound source reads and expose a before timestamp for older pages. The
    // date metadata and local-day bounds keep legacy records readable; legacy names are resolved only if unique.
    let source = ctx.db.query('activities').withIndex('by_facility', q => q.eq('facilityId', fid))
    if (childId || user?.role === 'parent') {
      const selected = childId ? allowed.filter(k => k._id === childId) : allowed
      if (!selected.length) return []
      source = source.filter(q => q.or(...selected.flatMap(k => [q.eq(q.field('childId'), k._id), ...(names.has(k.name) ? [q.eq(q.field('childName'), k.name)] : [])])))
    }
    if (date) {
      const { start, end } = dateWindow(date, facility)
      source = source.filter(q => q.or(q.eq(q.field('date'), date), q.and(q.gte(q.field('_creationTime'), start), q.lt(q.field('_creationTime'), end))))
    }
    if (before !== undefined) source = source.filter(q => q.lt(q.field('_creationTime'), before))
    const docs = await source.order('desc').take(2000)
    return docs.flatMap(entry => {
      const resolvedId = entry.childId || (entry.childName ? names.get(entry.childName) : undefined)
      if ((user?.role === 'parent' && (!resolvedId || !ids.has(resolvedId))) || (childId && resolvedId !== childId)) return []
      const entryDate = entry.date || localDate(entry.occurredAt || entry._creationTime, facility)
      if (date && entryDate !== date) return []
      const { _id, facilityId, createdBy, ...rest } = entry
      return [{ id: _id, ...rest, childId: resolvedId, date: entryDate, occurredAt: entry.occurredAt || entry._creationTime }]
    }).slice(0, size)
  },
})

export const add = mutation({
  args: {
    childId: v.optional(v.id('children')), type: v.string(), time: v.optional(v.string()), title: v.string(), detail: v.string(),
    amount: v.optional(v.string()), by: v.optional(v.string()), childName: v.optional(v.string()), date: v.optional(v.string()),
    durationMinutes: v.optional(v.number()), mood: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { facilityId: fid, userId, user, facility } = await requireStaff(ctx)
    if (!['meal', 'nap', 'diaper', 'activity', 'learning', 'note'].includes(args.type)) throw new Error('Choose a valid daily activity type. Use the incident form for incidents.')
    const kids = await facilityChildren(ctx, fid)
    const matches = args.childId ? kids.filter(child => child._id === args.childId) : kids.filter(child => child.name === args.childName)
    if (matches.length !== 1 || matches[0].archivedAt) throw new Error('Choose one active child for this update.')
    const child = matches[0]
    const occurredAt = Date.now(), date = checkedDate(args.date, facility)
    if (date > localDate(occurredAt, facility)) throw new Error('Daily updates cannot be dated in the future.')
    if (date !== localDate(occurredAt, facility) && user?.role !== 'admin') throw new Error('Ask the director to correct a past daily log.')
    if (args.durationMinutes !== undefined && (!Number.isFinite(args.durationMinutes) || args.durationMinutes < 0 || args.durationMinutes > 1440 || args.type !== 'nap')) throw new Error('Enter nap minutes between 0 and 1,440.')
    const mood = args.mood ? cleanText(args.mood, 'Mood', 80, true) : undefined
    const id = await ctx.db.insert('activities', {
      facilityId: fid, childId: child._id, childName: child.name, type: args.type, time: args.time ? cleanText(args.time, 'Time', 40, true) : displayTime(occurredAt, facility),
      title: cleanText(args.title, 'Activity title', 300, true), detail: cleanText(args.detail, 'Activity detail', 10000, true), amount: args.amount ? cleanText(args.amount, 'Amount', 160) : undefined,
      by: user?.name || cleanText(args.by || 'Educator', 'Author', 160, true), date, occurredAt, createdBy: userId || undefined,
      durationMinutes: args.durationMinutes, mood,
    })
    await recordOwnerEvent(ctx, { facilityId: fid, actorId: userId || undefined, type: 'activity_added', summary: `An educator added a ${args.type} update for ${child.name}.` })
    return id
  },
})
