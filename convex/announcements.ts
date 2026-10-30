import { internalAction, internalMutation, query, mutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { childBelongsToParent, randomToken, requireAdmin, resolveFacilityId } from './lib'
import { recordOwnerEvent } from './notifications'
import { cleanText } from './workflowUtils'

const MAX_RECIPIENTS = 500
const MAX_ATTEMPTS = 3
const LEASE_MS = 120_000
const audience = v.union(v.literal('everyone'), v.literal('families'), v.literal('staff'))
const emailAddress = (value: unknown) => typeof value === 'string' && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
const testAddress = (value: string) => /@[^@]*\.invalid$/i.test(value)

// Parents need an active link to a current child; educators need an active account.
// The director sees every announcement they post.
export function audienceIncludes(user: any, announcement: any, children: any[]) {
  if (!user || user.facilityId !== announcement.facilityId || user.accessStatus === 'suspended') return false
  if (user.role === 'admin') return true
  if (user.role === 'staff') return announcement.audience !== 'families'
  if (user.role === 'parent') return announcement.audience !== 'staff' &&
    children.some(child => child.facilityId === announcement.facilityId && !child.archivedAt && childBelongsToParent(child, user._id))
  return false
}

export const list = query({
  args: {},
  handler: async ctx => {
    const fid = await resolveFacilityId(ctx), uid = await getAuthUserId(ctx)
    if (!fid || !uid) return { items: [], unread: 0, canPost: false }
    const user = await ctx.db.get(uid)
    const children = user?.role === 'parent' ? await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', fid)).collect() : []
    const rows = await ctx.db.query('announcements').withIndex('by_facility', q => q.eq('facilityId', fid)).order('desc').take(100)
    const visible = rows.filter(row => audienceIncludes(user, row, children)).slice(0, 30)
    const read = await ctx.db.query('announcementReads').withIndex('by_user', q => q.eq('userId', uid)).first()
    const seen = read?.lastSeenAt || 0
    return {
      canPost: user?.role === 'admin',
      unread: visible.filter(row => row.createdAt > seen && row.authorId !== uid).length,
      items: visible.map(row => ({ id: row._id, title: row.title, body: row.body, audience: row.audience, authorName: row.authorName, createdAt: row.createdAt, emailed: row.emailed, isNew: row.createdAt > seen && row.authorId !== uid })),
    }
  },
})

export const post = mutation({
  args: { title: v.string(), body: v.string(), audience, email: v.boolean() },
  handler: async (ctx, args) => {
    const { facilityId, userId, user, facility } = await requireAdmin(ctx)
    const title = cleanText(args.title, 'Title', 120, true), body = cleanText(args.body, 'Announcement', 5000, true)
    const createdAt = Date.now()
    const id = await ctx.db.insert('announcements', { facilityId, title, body, audience: args.audience, authorId: userId, authorName: user.name || undefined, emailed: args.email, createdAt })
    let queued = 0, recorded = 0
    if (args.email && !facility.isDemo) {
      const announcement = { facilityId, audience: args.audience }
      const members = await ctx.db.query('users').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
      const children = await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
      const recipients = members.filter(m => m._id !== userId && m.role !== 'admin' && audienceIncludes(m, announcement, children) && emailAddress(m.email))
      if (recipients.length > MAX_RECIPIENTS) throw new Error('Too many email recipients for one announcement. Contact Mitten support.')
      const seenEmails = new Set<string>()
      for (const member of recipients) {
        const email = member.email!.trim().toLowerCase()
        if (seenEmails.has(email)) continue
        seenEmails.add(email)
        const suppressed = testAddress(email) || (member.role === 'parent' && facility.familyEmailMode === 'off')
        const row = await ctx.db.insert('announcementEmails', { facilityId, announcementId: id, userId: member._id, status: suppressed ? 'recorded' : 'pending', attempts: 0, createdAt, updatedAt: createdAt })
        if (suppressed) recorded++
        else { await ctx.scheduler.runAfter(0, internal.announcements.deliver, { id: row }); queued++ }
      }
    }
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'announcement.posted', summary: `Posted an announcement to ${args.audience === 'everyone' ? 'everyone' : args.audience === 'families' ? 'families' : 'educators'}${args.email ? `, with ${queued} email copies` : ''}.` })
    return { id, queued, recorded }
  },
})

export const remove = mutation({
  args: { id: v.id('announcements') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireAdmin(ctx)
    const row = await ctx.db.get(id)
    if (!row || row.facilityId !== facilityId) throw new Error('Announcement not found.')
    // Unsent email copies stop at claim time because the announcement is gone.
    await ctx.db.delete(id)
  },
})

export const markSeen = mutation({
  args: {},
  handler: async ctx => {
    const fid = await resolveFacilityId(ctx), uid = await getAuthUserId(ctx)
    if (!fid || !uid) return
    const existing = await ctx.db.query('announcementReads').withIndex('by_user', q => q.eq('userId', uid)).first()
    if (existing) await ctx.db.patch(existing._id, { facilityId: fid, lastSeenAt: Date.now() })
    else await ctx.db.insert('announcementReads', { facilityId: fid, userId: uid, lastSeenAt: Date.now() })
  },
})

export const claim = internalMutation({
  args: { id: v.id('announcementEmails') },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id)
    if (!row || (!['pending', 'retrying'].includes(row.status) && !(row.status === 'sending' && (row.sendingAt || 0) < Date.now() - LEASE_MS))) return null
    if (row.attempts >= MAX_ATTEMPTS) { await ctx.db.patch(id, { status: 'failed', error: 'Delivery was interrupted repeatedly.', updatedAt: Date.now() }); return null }
    const facility = await ctx.db.get(row.facilityId), announcement = await ctx.db.get(row.announcementId), member = await ctx.db.get(row.userId)
    const children = await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', row.facilityId)).collect()
    // Recheck membership at delivery time: a release or deletion stops a queued email.
    if (!facility || facility.isDemo || !announcement || !audienceIncludes(member, announcement, children) || !emailAddress(member?.email) || testAddress(member!.email!) || (member!.role === 'parent' && facility.familyEmailMode === 'off')) {
      await ctx.db.patch(id, { status: 'skipped', deliveryToken: undefined, sendingAt: undefined, updatedAt: Date.now() }); return null
    }
    const deliveryToken = randomToken()
    await ctx.db.patch(id, { status: 'sending', attempts: row.attempts + 1, sendingAt: Date.now(), deliveryToken, error: undefined, updatedAt: Date.now() })
    return { id, deliveryToken, email: member!.email!.trim(), facility: facility.name, title: announcement.title, body: announcement.body, author: announcement.authorName || '' }
  },
})

export const finish = internalMutation({
  args: { id: v.id('announcementEmails'), deliveryToken: v.string(), ok: v.boolean() },
  handler: async (ctx, { id, deliveryToken, ok }) => {
    const row = await ctx.db.get(id)
    if (!row || row.status !== 'sending' || row.deliveryToken !== deliveryToken) return
    const retry = !ok && row.attempts < MAX_ATTEMPTS
    await ctx.db.patch(id, { status: ok ? 'sent' : retry ? 'retrying' : 'failed', sentAt: ok ? Date.now() : undefined,
      error: ok ? undefined : 'The email could not be delivered.', deliveryToken: undefined, sendingAt: undefined, updatedAt: Date.now() })
    if (retry) await ctx.scheduler.runAfter(row.attempts * 60_000, internal.announcements.deliver, { id })
  },
})

export const deliver = internalAction({
  args: { id: v.id('announcementEmails') },
  handler: async (ctx, { id }) => {
    const event = await ctx.runMutation(internal.announcements.claim, { id })
    if (!event) return
    let ok = false
    try {
      const key = process.env.MITTEN_OWNER_EVENTS_KEY
      if (key) {
        const response = await fetch('https://mitten.care/api/announcement-email', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(event) })
        ok = response.ok
      }
    } catch { /* Do not log private addresses or relay payloads. */ }
    await ctx.runMutation(internal.announcements.finish, { id, deliveryToken: event.deliveryToken, ok })
  },
})

export const recoverInterrupted = internalMutation({
  args: {},
  handler: async ctx => {
    let recovered = 0
    for (const status of ['pending', 'retrying', 'sending']) {
      const rows = await ctx.db.query('announcementEmails').withIndex('by_status', q => q.eq('status', status)).take(100)
      for (const row of rows) {
        if ((row.sendingAt || row.updatedAt) > Date.now() - LEASE_MS) continue
        if (row.attempts >= MAX_ATTEMPTS) { await ctx.db.patch(row._id, { status: 'failed', updatedAt: Date.now(), error: 'Email delivery was interrupted.' }); continue }
        await ctx.scheduler.runAfter(0, internal.announcements.deliver, { id: row._id }); recovered++
      }
    }
    return { recovered }
  },
})
