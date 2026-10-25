import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId, requireAdmin, requireStaff, requireRecord } from './lib'
import { recordOwnerEvent } from './notifications'
import { getAuthUserId } from '@convex-dev/auth/server'
import { dayStart, localDate, nextDate, sessionSeconds, weekStart } from './financeUtils'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('educators')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const facility = await ctx.db.get(fid)
    const now = Date.now(), zone = facility?.timezone || 'America/Vancouver', day = localDate(now, zone)
    const sessions = await ctx.db.query('clockSessions').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
    const out = []
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    for (const d of docs.filter((educator) => !user || user.role === 'admin' || (user.role === 'staff' && educator.userId === uid))) {
      const { _id, _creationTime, facilityId, order, imageId, ...rest } = d
      const ownSessions = sessions.filter(session => session.educatorId === _id)
      const midnight = dayStart(day, zone)
      const open = ownSessions.find(session => session.endedAt === undefined)
      // StaffClock adds elapsed time for the current shift on the client.
      const stats = facility?.isDemo && !ownSessions.length ? {} : {
        todaySeconds: sessionSeconds(ownSessions, midnight, dayStart(nextDate(day), zone), now, true),
        hoursWeek: sessionSeconds(ownSessions, dayStart(weekStart(day), zone), now, now) / 3600,
        clockInAt: open ? Math.max(open.startedAt, midnight) : rest.clockInAt ? Math.max(rest.clockInAt, midnight) : undefined,
        punches: ownSessions.flatMap(session => [
          ...(session.startedAt >= midnight ? [{ type: 'in', time: new Date(session.startedAt).toLocaleTimeString('en-CA', { timeZone: zone, hour: 'numeric', minute: '2-digit' }) }] : []),
          ...(session.endedAt && session.endedAt >= midnight ? [{ type: 'out', time: new Date(session.endedAt).toLocaleTimeString('en-CA', { timeZone: zone, hour: 'numeric', minute: '2-digit' }) }] : []),
        ]),
      }
      out.push({ id: _id, ...rest, ...stats, imageUrl: imageId ? await ctx.storage.getUrl(imageId) : null })
    }
    return out
  },
})

// Add an educator to the current facility (owner/admin, used in onboarding + Educators view).
export const add = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    room: v.string(),
    emoji: v.optional(v.string()),
    certifications: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { facilityId } = await requireAdmin(ctx)
    const all = await ctx.db
      .query('educators')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .collect()
    const order = all.length ? Math.max(...all.map((e) => e.order)) + 1 : 0
    return await ctx.db.insert('educators', {
      facilityId,
      name: args.name,
      role: args.role,
      room: args.room,
      emoji: args.emoji ?? '🧑‍🏫',
      hireDate: 'New',
      certifications: args.certifications ?? [],
      status: 'out',
      todaySeconds: 0,
      punches: [],
      hoursWeek: 0,
      hoursTarget: 38,
      pto: '0 days',
      order,
    })
  },
})

// Toggle clock in/out for an educator, recording the punch and accumulating time.
export const clock = mutation({
  args: { id: v.id('educators'), time: v.string() },
  handler: async (ctx, { id, time }) => {
    const { facilityId, user, userId } = await requireStaff(ctx)
    const e = await requireRecord(ctx, id, facilityId)
    if (user?.role === 'staff' && e.userId !== userId) throw new Error('You can only clock your own attendance.')
    const now = Date.now()
    const facility = await ctx.db.get(facilityId)
    const zone = facility?.timezone || 'America/Vancouver', day = localDate(now, zone)
    const sessions = await ctx.db.query('clockSessions').withIndex('by_educator', q => q.eq('educatorId', id)).collect()
    const open = sessions.find(row => row.endedAt === undefined)
    const stamp = new Date(now).toLocaleTimeString('en-CA', { timeZone: zone, hour: 'numeric', minute: '2-digit' })
    if (e.status === 'out' && !open) {
      await ctx.db.insert('clockSessions', { facilityId, educatorId: id, startedAt: now })
      await ctx.db.patch(id, { status: 'in', clockInAt: now, todaySeconds: sessionSeconds(sessions, dayStart(day, zone), now, now, true), punches: [{ type: 'in', time: stamp }] })
    } else {
      if (open) { await ctx.db.patch(open._id, { endedAt: now }); open.endedAt = now }
      else if (e.clockInAt && e.clockInAt <= now) {
        // Preserve a pre-upgrade open shift when its first clock-out arrives.
        const legacy = { facilityId, educatorId: id, startedAt: e.clockInAt, endedAt: now }
        await ctx.db.insert('clockSessions', legacy); sessions.push(legacy as any)
      }
      await ctx.db.patch(id, { status: 'out', clockInAt: undefined,
        todaySeconds: sessionSeconds(sessions, dayStart(day, zone), dayStart(nextDate(day), zone), now, true),
        hoursWeek: sessionSeconds(sessions, dayStart(weekStart(day), zone), now, now) / 3600,
        punches: [...(e.punches || []).slice(-19), { type: 'out', time: stamp }],
      })
    }
    await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'educator_attendance_changed', summary: `${e.name} clocked ${e.status === 'out' ? 'in' : 'out'}.` })
  },
})
