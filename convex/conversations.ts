import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId } from './lib'

// Conversations are family↔staff threads. Parents see only their own thread;
// educators/directors see every family thread. Each message is rendered from
// the current viewer's perspective ('me' vs 'them') using the author id, with
// a fallback to the legacy `from` field so the seeded demo still works.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    const facility = await ctx.db.get(fid)
    const isParent = me?.role === 'parent'

    let convos = await ctx.db
      .query('conversations')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    // Parents only ever see their own family thread.
    if (isParent && uid) convos = convos.filter((c) => c.parentUserId === uid)

    const result = []
    for (const c of convos) {
      const msgs = await ctx.db
        .query('messages')
        .withIndex('by_conversation', (q) => q.eq('conversationId', c._id))
        .collect()
      // From a parent's side, the thread is "the teachers"; from staff's side,
      // it's the family. Demo threads keep their seeded identity.
      const display =
        c.parentUserId && isParent
          ? { name: `${facility?.name || 'Your daycare'} team`, emoji: '🏫', role: 'Teachers & office' }
          : { name: c.name, emoji: c.emoji, role: c.role }
      result.push({
        id: c._id,
        name: display.name,
        role: display.role,
        emoji: display.emoji,
        online: c.online,
        unread: c.unread,
        messages: msgs.map((m) => ({
          id: m._id,
          from: m.authorId ? (m.authorId === uid ? 'me' : 'them') : m.from,
          author: m.authorName,
          text: m.text,
          time: m.time,
        })),
      })
    }
    return result
  },
})

export const send = mutation({
  args: { conversationId: v.id('conversations'), text: v.string(), time: v.string() },
  handler: async (ctx, { conversationId, text, time }) => {
    const convo = await ctx.db.get(conversationId)
    if (!convo) return
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    await ctx.db.insert('messages', {
      facilityId: convo.facilityId,
      conversationId,
      from: 'me', // legacy fallback
      authorId: uid ?? undefined,
      authorName: me?.name ?? undefined,
      authorRole: me?.role ?? undefined,
      text,
      time,
    })
    // Bump the unread counter so the other side sees a badge; the reader zeroes
    // it when they open the thread (markRead).
    await ctx.db.patch(conversationId, { unread: (convo.unread || 0) + 1 })
  },
})

export const markRead = mutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }) => {
    await ctx.db.patch(conversationId, { unread: 0 })
  },
})

// Staff/director can start a thread with a family that doesn't have one yet.
export const startWithParent = mutation({
  args: { parentUserId: v.id('users'), name: v.string() },
  handler: async (ctx, { parentUserId, name }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) throw new Error('No facility')
    const existing = await ctx.db
      .query('conversations')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    if (existing.some((c) => c.parentUserId === parentUserId)) return
    const order = existing.length
    await ctx.db.insert('conversations', {
      facilityId: fid,
      parentUserId,
      name,
      role: 'Parent',
      emoji: '👪',
      online: false,
      unread: 0,
      order,
    })
  },
})
