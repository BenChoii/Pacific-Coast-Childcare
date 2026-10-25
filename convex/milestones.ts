import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireStaff } from './lib'
import { recordOwnerEvent } from './notifications'
import { authorizedChild, visibleChildren, facilityChildren, boundedLimit, cleanText, localDate } from './workflowUtils'

export const list = query({
  args: { childId: v.optional(v.id('children')), limit: v.optional(v.number()), before: v.optional(v.number()) },
  handler: async (ctx, { childId, limit, before }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx), me = uid ? await ctx.db.get(uid) : null
    const kids = visibleChildren(await facilityChildren(ctx, fid), me, uid)
    const ids = new Set(kids.map(k => k._id))
    if (childId && !ids.has(childId)) return []
    let source = childId ? ctx.db.query('milestones').withIndex('by_child', q => q.eq('childId', childId)) : ctx.db.query('milestones').withIndex('by_facility', q => q.eq('facilityId', fid))
    if (before !== undefined && !Number.isFinite(before)) throw new Error('Invalid page cursor.')
    if (me?.role === 'parent' && !childId) {
      if (!kids.length) return []
      source=source.filter(q=>q.or(...kids.map(k=>q.eq(q.field('childId'),k._id))))
    }
    if (before !== undefined) source = source.filter(q => q.lt(q.field('_creationTime'), before))
    const rows = await source.order('desc').take(2000)
    return rows.filter(m => m.facilityId === fid && (me?.role !== 'parent' || ids.has(m.childId))).slice(0, boundedLimit(limit)).map(({ _id, facilityId, ...rest }) => ({ id: _id, ...rest }))
  },
})
export const add = mutation({
  args: { childId: v.id('children'), domain: v.string(), label: v.string(), status: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { childId, domain, label, status, note }) => {
    const { facilityId, userId, user, facility } = await requireStaff(ctx)
    const child = await authorizedChild(ctx, childId, facilityId)
    if (!['Motor', 'Language', 'Social', 'Cognitive', 'Self-help'].includes(domain)) throw new Error('Choose a valid developmental domain.')
    if (!['Emerging', 'Progressing', 'Mastered'].includes(status)) throw new Error('Choose a valid milestone status.')
    const id = await ctx.db.insert('milestones', { facilityId, childId, childName: child.name, domain, label: cleanText(label, 'Milestone label', 300, true), status, note: note ? cleanText(note, 'Milestone note', 5000) : undefined, date: localDate(Date.now(), facility), by: user?.name || 'Educator', createdAt: Date.now() })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'milestone_added', summary: `Added a ${domain.toLowerCase()} milestone for ${child.name}.` })
    return id
  },
})
export const remove = mutation({
  args: { id: v.id('milestones') },
  handler: async (ctx, { id }) => {
    const { facilityId, userId } = await requireStaff(ctx)
    const milestone = await ctx.db.get(id)
    if (!milestone || milestone.facilityId !== facilityId) throw new Error('Milestone not found.')
    await ctx.db.delete(id)
    await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'milestone_removed', summary: `Removed a milestone entry for ${milestone.childName}.` })
    return { ok: true }
  },
})
