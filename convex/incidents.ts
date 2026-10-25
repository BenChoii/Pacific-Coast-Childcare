import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireFacility, requireStaff, requireRecord, childBelongsToParent } from './lib'
import { recordOwnerEvent } from './notifications'
import { authorizedChild, boundedLimit, cleanText, facilityChildren, localDate } from './workflowUtils'

export const list = query({
  args: { childId: v.optional(v.id('children')), limit: v.optional(v.number()) },
  handler: async (ctx, { childId, limit }) => {
    const facilityId = await resolveFacilityId(ctx)
    if (!facilityId) return []
    const uid = await getAuthUserId(ctx), user = uid ? await ctx.db.get(uid) : null
    const kids = await facilityChildren(ctx, facilityId)
    const allowed = new Set(kids.filter(k => !k.archivedAt && childBelongsToParent(k, uid)).map(k => k._id))
    if (user?.role === 'parent' && childId && !allowed.has(childId)) return []
    let source = childId ? ctx.db.query('incidents').withIndex('by_child', q => q.eq('childId', childId)) : ctx.db.query('incidents').withIndex('by_facility', q => q.eq('facilityId', facilityId))
    if (user?.role === 'parent') source = source.filter(q => q.eq(q.field('status'), 'shared'))
    const rows = await source.order('desc').take(1000)
    return rows.filter(r => r.facilityId === facilityId && (user?.role !== 'parent' || allowed.has(r.childId))).slice(0, boundedLimit(limit)).map(({ _id, facilityId, createdBy, ...r }) => ({ id: _id, ...r }))
  },
})
export const save = mutation({
  args: { id: v.optional(v.id('incidents')), childId: v.id('children'), occurredAt: v.number(), description: v.string(), actionTaken: v.string(), followUp: v.optional(v.string()) },
  handler: async (ctx, { id, childId, occurredAt, description, actionTaken, followUp }) => {
    const { facilityId, userId, facility } = await requireStaff(ctx)
    const child = await authorizedChild(ctx, childId, facilityId)
    if (!Number.isFinite(occurredAt) || occurredAt < 0 || occurredAt > Date.now() + 5 * 60000) throw new Error('Choose the actual incident time, not a future time.')
    const existing = id ? await requireRecord(ctx, id, facilityId) : null
    if (existing?.status === 'shared') throw new Error('A shared report is retained as written. Add a follow-up report to correct it.')
    if (existing && existing.childId !== childId) throw new Error('Start a separate report for a different child.')
    const data = { childId, childName: child.name, occurredAt, date: localDate(occurredAt, facility), description: cleanText(description, 'Incident description', 10000, true), actionTaken: cleanText(actionTaken, 'Action taken', 10000, true), followUp: cleanText(followUp || '', 'Follow-up', 5000), updatedAt: Date.now() }
    if (id) await ctx.db.patch(id, data)
    else id = await ctx.db.insert('incidents', { ...data, facilityId, createdBy: userId || undefined, createdAt: Date.now(), status: 'draft', acknowledgements: [] })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'incident_draft_saved', summary: `An incident report for ${child.name} is awaiting review and sharing.` })
    return id
  },
})
export const share = mutation({
  args: { id: v.id('incidents') },
  handler: async (ctx, { id }) => {
    const { facilityId, userId } = await requireStaff(ctx)
    const report = await requireRecord(ctx, id, facilityId)
    if (report.status === 'shared') return { ok: true }
    await authorizedChild(ctx, report.childId, facilityId)
    if (!report.description.trim() || !report.actionTaken.trim()) throw new Error('Complete the description and action taken before sharing.')
    await ctx.db.patch(id, { status: 'shared', sharedAt: Date.now(), updatedAt: Date.now() })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'incident_shared', summary: `An incident report for ${report.childName} was shared with the family and awaits acknowledgement.` })
    return { ok: true }
  },
})
export const acknowledge = mutation({
  args: { id: v.id('incidents') },
  handler: async (ctx, { id }) => {
    const { facilityId, userId, user } = await requireFacility(ctx)
    if (user.role !== 'parent') throw new Error('A parent or guardian must acknowledge this report.')
    const report = await requireRecord(ctx, id, facilityId)
    if (report.status !== 'shared') throw new Error('This report has not been shared yet.')
    await authorizedChild(ctx, report.childId, facilityId, user, userId)
    const acknowledgements = report.acknowledgements || []
    if (acknowledgements.some(a => a.userId === userId)) return { ok: true }
    await ctx.db.patch(id, { acknowledgements: [...acknowledgements, { userId, at: Date.now() }], updatedAt: Date.now() })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'incident_acknowledged', summary: `${user.name || 'A guardian'} acknowledged ${report.childName}'s incident report.` })
    return { ok: true }
  },
})
