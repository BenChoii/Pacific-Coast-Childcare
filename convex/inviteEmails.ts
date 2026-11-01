import { internalAction, internalMutation, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { randomToken, requireAdmin } from './lib'
import { queueInviteEmail, testAddress } from './inviteQueue'

const MAX_ATTEMPTS = 3
const LEASE_MS = 120_000

function stillOpen(invite: any) {
  return invite && !invite.used && (!invite.expiresAt || invite.expiresAt > Date.now()) && !!invite.email
}

export const resend = mutation({
  args: { id: v.id('invites') },
  handler: async (ctx, { id }) => {
    const { facilityId, facility } = await requireAdmin(ctx)
    const invite = await ctx.db.get(id)
    if (!invite || invite.facilityId !== facilityId || !stillOpen(invite)) throw new Error('This invitation is no longer open. Create a new one.')
    if (facility.isDemo) throw new Error('The demo daycare cannot send email.')
    if (invite.emailStatus === 'sending' && (invite.emailSendingAt || 0) > Date.now() - LEASE_MS) return { queued: true }
    return { queued: await queueInviteEmail(ctx, id, invite.email!) }
  },
})

export const claim = internalMutation({
  args: { id: v.id('invites') },
  handler: async (ctx, { id }) => {
    const invite = await ctx.db.get(id)
    const status = invite?.emailStatus || ''
    if (!invite || (!['pending', 'retrying'].includes(status) && !(status === 'sending' && (invite.emailSendingAt || 0) < Date.now() - LEASE_MS))) return null
    const attempts = invite.emailAttempts || 0
    if (attempts >= MAX_ATTEMPTS) { await ctx.db.patch(id, { emailStatus: 'failed', emailDeliveryToken: undefined, emailSendingAt: undefined }); return null }
    const facility = await ctx.db.get(invite.facilityId)
    const child = invite.childId ? await ctx.db.get(invite.childId) : null
    // Recheck at delivery: a revoked, used or expired invite never goes out.
    if (!facility || facility.isDemo || !stillOpen(invite) || testAddress(invite.email!) || (invite.childId && (!child || child.archivedAt))) {
      await ctx.db.patch(id, { emailStatus: 'skipped', emailDeliveryToken: undefined, emailSendingAt: undefined }); return null
    }
    const deliveryToken = randomToken()
    await ctx.db.patch(id, { emailStatus: 'sending', emailAttempts: attempts + 1, emailSendingAt: Date.now(), emailDeliveryToken: deliveryToken })
    return { id, deliveryToken, email: invite.email!, facility: facility.name, role: invite.role, token: invite.token, childName: child?.first || child?.name || '', expiresAt: invite.expiresAt || null }
  },
})

export const finish = internalMutation({
  args: { id: v.id('invites'), deliveryToken: v.string(), ok: v.boolean() },
  handler: async (ctx, { id, deliveryToken, ok }) => {
    const invite = await ctx.db.get(id)
    if (!invite || invite.emailStatus !== 'sending' || invite.emailDeliveryToken !== deliveryToken) return
    const attempts = invite.emailAttempts || 0
    const retry = !ok && attempts < MAX_ATTEMPTS
    await ctx.db.patch(id, { emailStatus: ok ? 'sent' : retry ? 'retrying' : 'failed', emailedAt: ok ? Date.now() : invite.emailedAt, emailDeliveryToken: undefined, emailSendingAt: undefined })
    if (retry) await ctx.scheduler.runAfter(attempts * 60_000, internal.inviteEmails.deliver, { id })
  },
})

export const deliver = internalAction({
  args: { id: v.id('invites') },
  handler: async (ctx, { id }) => {
    const event = await ctx.runMutation(internal.inviteEmails.claim, { id })
    if (!event) return
    let ok = false
    try {
      const key = process.env.MITTEN_OWNER_EVENTS_KEY
      if (key) {
        const response = await fetch('https://mitten.care/api/invite-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(event) })
        ok = response.ok
      }
    } catch { /* Do not log private addresses or invitation tokens. */ }
    await ctx.runMutation(internal.inviteEmails.finish, { id, deliveryToken: event.deliveryToken, ok })
  },
})

export const recoverInterrupted = internalMutation({
  args: {},
  handler: async ctx => {
    let recovered = 0
    for (const status of ['pending', 'retrying', 'sending']) {
      const rows = await ctx.db.query('invites').withIndex('by_emailStatus', q => q.eq('emailStatus', status)).take(100)
      for (const row of rows) {
        if ((row.emailSendingAt || row.createdAt) > Date.now() - LEASE_MS) continue
        if ((row.emailAttempts || 0) >= MAX_ATTEMPTS) { await ctx.db.patch(row._id, { emailStatus: 'failed', emailDeliveryToken: undefined, emailSendingAt: undefined }); continue }
        await ctx.scheduler.runAfter(0, internal.inviteEmails.deliver, { id: row._id }); recovered++
      }
    }
    return { recovered }
  },
})
