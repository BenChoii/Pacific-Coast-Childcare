import { query, mutation, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireFacility } from './lib'
import { getAuthUserId } from '@convex-dev/auth/server'

// Write the activity and schedule delivery in the same database transaction.
// Summaries contain action labels only, never message bodies or child health/HR data.
export async function recordOwnerEvent(ctx: any, event: {
  facilityId: any, actorId?: any, type: string, summary: string
}): Promise<void> {
  const facility = await ctx.db.get(event.facilityId)
  if (!facility || facility.isDemo || !facility.ownerUserId) return
  const id = await ctx.db.insert('ownerEvents', {
    ...event, summary: event.summary.slice(0, 500), createdAt: Date.now(), status: 'pending', attempts: 0,
  })
  await ctx.scheduler.runAfter(0, internal.ownerEmail.deliver, { id })
}

export const list = query({ args: {}, handler: async (ctx) => {
  if (!(await getAuthUserId(ctx))) return []
  const { user, facilityId } = await requireFacility(ctx)
  if (user.role !== 'admin') throw new Error('Directors only.')
  return await ctx.db.query('ownerEvents').withIndex('by_facility', q => q.eq('facilityId', facilityId)).order('desc').take(100)
}})

export const retry = mutation({ args: { id: v.id('ownerEvents') }, handler: async (ctx, { id }) => {
  const { user, facilityId } = await requireFacility(ctx)
  if (user.role !== 'admin') throw new Error('Directors only.')
  const event = await ctx.db.get(id)
  if (!event || event.facilityId !== facilityId) throw new Error('Activity not found.')
  if (event.status !== 'failed') throw new Error('Only failed emails can be retried.')
  await ctx.db.patch(id, { status: 'pending', attempts: 0, error: undefined })
  await ctx.scheduler.runAfter(0, internal.ownerEmail.deliver, { id })
}})

export const claim = internalMutation({ args: { id: v.id('ownerEvents') }, handler: async (ctx, { id }) => {
  const e = await ctx.db.get(id)
  if (!e || !['pending', 'retrying'].includes(e.status)) return null
  const f = await ctx.db.get(e.facilityId)
  const owner = f?.ownerUserId ? await ctx.db.get(f.ownerUserId) : null
  if (!f || !owner?.email) {
    await ctx.db.patch(id, { status: 'failed', error: 'The facility owner needs an email address.' })
    return null
  }
  await ctx.db.patch(id, { status: 'sending', attempts: e.attempts + 1, error: undefined })
  return { id, email: owner.email.trim(), facility: f.name, summary: e.summary, type: e.type, createdAt: e.createdAt }
}})

export const finish = internalMutation({ args: { id: v.id('ownerEvents'), ok: v.boolean(), error: v.optional(v.string()) }, handler: async (ctx, { id, ok, error }) => {
  const e = await ctx.db.get(id)
  if (!e || e.status !== 'sending') return
  if (ok) { await ctx.db.patch(id, { status: 'sent', sentAt: Date.now(), error: undefined }); return }
  const retry = e.attempts < 3
  await ctx.db.patch(id, { status: retry ? 'retrying' : 'failed', error: error?.slice(0, 300) || 'Email delivery failed.' })
  if (retry) await ctx.scheduler.runAfter(e.attempts * 60_000, internal.ownerEmail.deliver, { id })
}})
