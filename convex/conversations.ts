import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireStaff, requireRecord, childBelongsToParent } from './lib'
import { recordOwnerEvent } from './notifications'
import { boundedLimit, cleanText, displayTime, facilityChildren } from './workflowUtils'

async function access(ctx: any, conversationId: Id<'conversations'>) {
  const fid = await resolveFacilityId(ctx)
  if (!fid) throw new Error('Daycare access required.')
  const uid = await getAuthUserId(ctx), user = uid ? await ctx.db.get(uid) : null
  if (!uid) await requireStaff(ctx) // only the deliberately interactive demo
  const conversation = await requireRecord(ctx, conversationId, fid)
  if (user?.role === 'parent' && conversation.parentUserId !== uid) throw new Error('Not your family conversation.')
  return { fid, uid, user, conversation }
}
export const list = query({
  args: { limit: v.optional(v.number()), messageLimit: v.optional(v.number()) },
  handler: async (ctx, { limit, messageLimit }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx), me = uid ? await ctx.db.get(uid) : null
    const facility = await ctx.db.get(fid)
    const isParent = me?.role === 'parent'
    let source = ctx.db.query('conversations').withIndex('by_facility', q => q.eq('facilityId', fid))
    if (isParent) source = source.filter(q => q.eq(q.field('parentUserId'), uid))
    const convos = await source.take(boundedLimit(limit))
    const result = []
    for (const c of convos) {
      const recent = await ctx.db.query('messages').withIndex('by_conversation', q => q.eq('conversationId', c._id)).order('desc').take(1000)
      const read = uid ? await ctx.db.query('conversationReads').withIndex('by_conversation_user', q => q.eq('conversationId', c._id).eq('userId', uid)).first() : null
      const unread = uid ? recent.filter(m => m.authorId !== uid && (m.sequence !== undefined ? m.sequence > (read?.lastReadSequence || 0) : m._creationTime > (read?.lastReadAt || 0))).length : c.unread
      const msgs = recent.slice(0, boundedLimit(messageLimit, 100, 500)).reverse()
      const display = c.parentUserId && isParent ? { name: `${facility?.name || 'Your daycare'} team`, emoji: '🏫', role: 'Teachers & office' } : { name: c.name, emoji: c.emoji, role: c.role }
      result.push({ id: c._id, ...display, online: c.online, unread, unreadLimited: recent.length === 1000, hasEarlierMessages: recent.length > msgs.length,
        messages: msgs.map(m => ({ id: m._id, from: m.authorId ? (m.authorId === uid ? 'me' : 'them') : m.from, author: m.authorName, authorName: m.authorName, text: m.text, time: m.time, sentAt: m.sentAt || m._creationTime })),
      })
    }
    return result
  },
})
export const history = query({
  args: { conversationId: v.id('conversations'), before: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, { conversationId, before, limit }) => {
    const { uid } = await access(ctx, conversationId)
    let source = ctx.db.query('messages').withIndex('by_conversation', q => q.eq('conversationId', conversationId))
    if (before !== undefined) source = source.filter(q => q.lt(q.field('_creationTime'), before))
    const rows = await source.order('desc').take(boundedLimit(limit))
    return rows.reverse().map(m => ({ id: m._id, from: m.authorId ? (m.authorId === uid ? 'me' : 'them') : m.from, author: m.authorName, authorName: m.authorName, text: m.text, time: m.time, sentAt: m.sentAt || m._creationTime }))
  },
})
export const send = mutation({
  args: { conversationId: v.id('conversations'), text: v.string(), time: v.optional(v.string()) },
  handler: async (ctx, { conversationId, text, time }) => {
    const { fid, uid, user, conversation } = await access(ctx, conversationId)
    const content = cleanText(text, 'Message', 10000, true), sentAt = Date.now()
    const sequence = (conversation.lastSequence || 0) + 1
    const id = await ctx.db.insert('messages', { facilityId: fid, conversationId, from: 'me', authorId: uid || undefined, authorName: user?.name || undefined, authorRole: user?.role || undefined,
      text: content, time: uid ? displayTime(sentAt, await ctx.db.get(fid)) : cleanText(time || displayTime(sentAt), 'Time', 40, true), sentAt, sequence })
    await ctx.db.patch(conversationId, { lastSequence: sequence, unread: uid ? 0 : (conversation.unread || 0) + 1 })
    if (uid && user?.role !== 'admin') await recordOwnerEvent(ctx, { facilityId: fid, actorId: uid, type: 'message_sent', summary: `${user?.name || 'A member'} sent a message in the family conversation.` })
    return id
  },
})
export const markRead = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    const { fid, uid, conversation } = await access(ctx, conversationId)
    if (!uid) { await ctx.db.patch(conversationId, { unread: 0 }); return { ok: true } }
    const existing = await ctx.db.query('conversationReads').withIndex('by_conversation_user', q => q.eq('conversationId', conversationId).eq('userId', uid)).first()
    const newest = await ctx.db.query('messages').withIndex('by_conversation', q => q.eq('conversationId', conversationId)).order('desc').first()
    const data = { lastReadAt: Math.max(Date.now(), newest?._creationTime || 0), lastReadSequence: conversation.lastSequence || 0 }
    if (existing) await ctx.db.patch(existing._id, data)
    else await ctx.db.insert('conversationReads', { facilityId: fid, conversationId, userId: uid, ...data })
    return { ok: true }
  },
})
export const startWithParent = mutation({
  args: { parentUserId: v.id('users'), name: v.string() },
  handler: async (ctx, { parentUserId, name }) => {
    const { facilityId: fid } = await requireStaff(ctx)
    const parent = await ctx.db.get(parentUserId)
    const kids = await facilityChildren(ctx, fid)
    if (!parent || parent.facilityId !== fid || parent.role !== 'parent' || parent.accessStatus === 'suspended' || !kids.some(k => !k.archivedAt && childBelongsToParent(k, parentUserId))) throw new Error('An active linked parent is required.')
    const existing = await ctx.db.query('conversations').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
    const match = existing.find(c => c.parentUserId === parentUserId)
    if (match) return match._id
    return await ctx.db.insert('conversations', { facilityId: fid, parentUserId, name: cleanText(name, 'Family name', 160, true), role: 'Parent', emoji: '👪', online: false, unread: 0, lastSequence: 0, order: existing.length })
  },
})
