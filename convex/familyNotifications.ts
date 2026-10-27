import { internalAction, internalMutation, query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { childBelongsToParent, randomToken, requireAdmin } from './lib'

const MAX_RECIPIENTS = 500
const MAX_ATTEMPTS = 3
const LEASE_MS = 120_000
const emailAddress = (value: unknown) => typeof value === 'string' && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
const testAddress = (value: string) => /@[^@]*\.invalid$/i.test(value)

// A version identifies a set of shared files, its class and effective dates.
// Re-publishing an unchanged upload never creates a second email for a parent.
export function planRevision(plan: any) {
  return JSON.stringify({ files: (plan.attachments || []).map((a: any) => a.storageId).sort(), room: plan.room || '', start: plan.startDate, end: plan.endDate })
}
function parentMayRead(parent: any, plan: any, children: any[]) {
  return parent?.role === 'parent' && parent.accessStatus !== 'suspended' && parent.facilityId === plan.facilityId &&
    children.some(child => child.facilityId === plan.facilityId && childBelongsToParent(child, parent._id) && (!plan.room || child.room === plan.room))
}

// Called in the same transaction that publishes the plan. Draft saves do not
// notify anyone. Email contains a sign-in link, never the uploaded file itself.
export async function queuePlanNotifications(ctx: any, plan: any): Promise<{ queued: number; recorded: number; skipped: number }> {
  const result = { queued: 0, recorded: 0, skipped: 0 }
  if (plan.status !== 'published' || !plan._id || !plan.attachments?.length) return result
  const facility = await ctx.db.get(plan.facilityId)
  if (!facility || facility.isDemo) return result
  const parents = await ctx.db.query('users').withIndex('by_facility', (q: any) => q.eq('facilityId', plan.facilityId)).collect()
  const children = await ctx.db.query('children').withIndex('by_facility', (q: any) => q.eq('facilityId', plan.facilityId)).collect()
  const selected = parents.filter((parent: any) => parentMayRead(parent, plan, children) && emailAddress(parent.email))
  if (selected.length > MAX_RECIPIENTS) throw new Error('This class has too many email recipients for one share. Contact Mitten support.')
  const revision = planRevision(plan), seenEmails = new Set<string>()
  for (const parent of selected) {
    const email = parent.email.trim().toLowerCase()
    if (seenEmails.has(email)) { result.skipped++; continue }
    seenEmails.add(email)
    const existing = await ctx.db.query('familyPlanEmails').withIndex('by_plan_user_revision', (q: any) => q.eq('planId', plan._id).eq('parentUserId', parent._id).eq('revision', revision)).first()
    if (existing) { result.skipped++; continue }
    const suppressed = facility.familyEmailMode === 'off' || testAddress(email)
    const id = await ctx.db.insert('familyPlanEmails', { facilityId: plan.facilityId, planId: plan._id, parentUserId: parent._id, revision,
      status: suppressed ? 'recorded' : 'pending', attempts: 0, createdAt: Date.now(), updatedAt: Date.now() })
    if (suppressed) result.recorded++
    else { await ctx.scheduler.runAfter(0, internal.familyNotifications.deliver, { id }); result.queued++ }
  }
  return result
}

export const deliveryStatus = query({
  args: { planId: v.id('parentPlans') },
  handler: async (ctx, { planId }) => {
    const { facilityId } = await requireAdmin(ctx)
    const plan = await ctx.db.get(planId)
    if (!plan || plan.facilityId !== facilityId) throw new Error('Plan not found.')
    const rows = await ctx.db.query('familyPlanEmails').withIndex('by_plan', q => q.eq('planId', planId)).collect()
    const revision = planRevision(plan)
    const counts: Record<string, number> = { pending: 0, sending: 0, retrying: 0, sent: 0, failed: 0, skipped: 0, recorded: 0 }
    for (const row of rows.filter(row => row.revision === revision)) counts[row.status] = (counts[row.status] || 0) + 1
    return counts
  },
})

export const retryPlan = mutation({
  args: { planId: v.id('parentPlans') },
  handler: async (ctx, { planId }) => {
    const { facilityId } = await requireAdmin(ctx)
    const plan = await ctx.db.get(planId)
    if (!plan || plan.facilityId !== facilityId || plan.status !== 'published') throw new Error('Share the current plan before retrying emails.')
    const rows = await ctx.db.query('familyPlanEmails').withIndex('by_plan', q => q.eq('planId', planId)).collect()
    let retried = 0
    for (const row of rows.filter(row => row.revision === planRevision(plan) && row.status === 'failed')) {
      await ctx.db.patch(row._id, { status: 'pending', attempts: 0, error: undefined, deliveryToken: undefined, sendingAt: undefined, updatedAt: Date.now() })
      await ctx.scheduler.runAfter(0, internal.familyNotifications.deliver, { id: row._id }); retried++
    }
    return { retried }
  },
})

export const claim = internalMutation({
  args: { id: v.id('familyPlanEmails') },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id)
    if (!row || (!['pending', 'retrying'].includes(row.status) && !(row.status === 'sending' && (row.sendingAt || 0) < Date.now() - LEASE_MS))) return null
    if (row.attempts >= MAX_ATTEMPTS) { await ctx.db.patch(id, { status: 'failed', error: 'Delivery was interrupted repeatedly. Retry from the learning plan.', updatedAt: Date.now() }); return null }
    const facility = await ctx.db.get(row.facilityId), plan = await ctx.db.get(row.planId), parent = await ctx.db.get(row.parentUserId)
    const children = await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', row.facilityId)).collect()
    // Recheck membership, publication and class at delivery time. A release or
    // room change must stop an email queued before that change.
    if (!facility || facility.isDemo || facility.familyEmailMode === 'off' || !plan || plan.facilityId !== row.facilityId || plan.status !== 'published' || planRevision(plan) !== row.revision || !parentMayRead(parent, plan, children) || !emailAddress(parent?.email) || testAddress(parent!.email!)) {
      await ctx.db.patch(id, { status: 'skipped', deliveryToken: undefined, sendingAt: undefined, updatedAt: Date.now() }); return null
    }
    const deliveryToken = randomToken()
    await ctx.db.patch(id, { status: 'sending', attempts: row.attempts + 1, sendingAt: Date.now(), deliveryToken, error: undefined, updatedAt: Date.now() })
    return { id, deliveryToken, email: parent!.email!.trim(), facility: facility.name, title: plan.title, room: plan.room || '', startDate: plan.startDate, endDate: plan.endDate, kind: plan.kind || 'learning' }
  },
})

export const finish = internalMutation({
  args: { id: v.id('familyPlanEmails'), deliveryToken: v.string(), ok: v.boolean() },
  handler: async (ctx, { id, deliveryToken, ok }) => {
    const row = await ctx.db.get(id)
    if (!row || row.status !== 'sending' || row.deliveryToken !== deliveryToken) return
    const retry = !ok && row.attempts < MAX_ATTEMPTS
    await ctx.db.patch(id, { status: ok ? 'sent' : retry ? 'retrying' : 'failed', sentAt: ok ? Date.now() : undefined,
      error: ok ? undefined : 'The email could not be delivered. Please retry from the learning plan.',
      deliveryToken: undefined, sendingAt: undefined, updatedAt: Date.now() })
    if (retry) await ctx.scheduler.runAfter(row.attempts * 60_000, internal.familyNotifications.deliver, { id })
  },
})

export const deliver = internalAction({
  args: { id: v.id('familyPlanEmails') },
  handler: async (ctx, { id }) => {
    const event = await ctx.runMutation(internal.familyNotifications.claim, { id })
    if (!event) return
    let ok = false
    try {
      const key = process.env.MITTEN_OWNER_EVENTS_KEY
      if (key) {
        const response = await fetch('https://mitten.care/api/family-plan-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(event) })
        ok = response.ok
      }
    } catch { /* Do not log private addresses or relay payloads. */ }
    await ctx.runMutation(internal.familyNotifications.finish, { id, deliveryToken: event.deliveryToken, ok })
  },
})

export const recoverInterrupted = internalMutation({
  args: {},
  handler: async ctx => {
    let recovered = 0
    for (const status of ['pending', 'retrying', 'sending']) {
      const rows = await ctx.db.query('familyPlanEmails').withIndex('by_status', q => q.eq('status', status)).take(100)
      for (const row of rows) {
        if ((row.sendingAt || row.updatedAt) > Date.now() - LEASE_MS) continue
        if (row.attempts >= MAX_ATTEMPTS) { await ctx.db.patch(row._id, { status: 'failed', updatedAt: Date.now(), error: 'Email delivery was interrupted. Please retry.' }); continue }
        await ctx.scheduler.runAfter(0, internal.familyNotifications.deliver, { id: row._id }); recovered++
      }
    }
    return { recovered }
  },
})
