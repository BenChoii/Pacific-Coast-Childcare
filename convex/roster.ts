import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireStaff, requireRecord } from './lib'
import { recordOwnerEvent } from './notifications'
import { checkedDate, localDate, displayTime, cleanText, facilityChildren, visibleChildren, authorizedChild, boundedLimit } from './workflowUtils'

const statuses = ['checked-in', 'checked-out', 'absent', 'napping']
const present = (status: string) => status === 'checked-in' || status === 'napping'

export function summarizeAttendance(events: any[], date: string) {
  const ordered = events.slice().sort((a, b) => a.occurredAt - b.occurredAt || a._creationTime - b._creationTime)
  const latest = ordered[ordered.length - 1]
  const arrival = ordered.find(e => e.status === 'checked-in')
  const departures = ordered.filter(e => e.status === 'checked-out')
  const departure = departures[departures.length - 1]
  return {
    status: latest?.status || 'checked-out', time: latest?.displayTime || '—', attendanceDate: date,
    checkInTime: arrival?.displayTime || '—', checkInAt: arrival?.occurredAt,
    checkOutAt: departure?.occurredAt,
  }
}
export async function attendanceForDate(ctx: any, facilityId: any, date: string) {
  const events = await ctx.db.query('attendanceEvents').withIndex('by_facility_date', (q: any) => q.eq('facilityId', facilityId).eq('date', date)).collect()
  const byChild = new Map<string, any[]>()
  for (const event of events) byChild.set(event.childId, [...(byChild.get(event.childId) || []), event])
  return new Map([...byChild].map(([id, rows]) => [id, summarizeAttendance(rows, date)]))
}

export const list = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date: requestedDate }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const facility = await ctx.db.get(fid)
    const date = checkedDate(requestedDate, facility)
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    const kids = await facilityChildren(ctx, fid)
    const activeKids = visibleChildren(kids, user, uid)
    const states = await attendanceForDate(ctx, fid, date)
    const rows = await ctx.db.query('roster').withIndex('by_facility', (q) => q.eq('facilityId', fid)).collect()
    return activeKids.map(child => {
      const matching = rows.filter(row => row.childId === child._id || (!row.childId && row.name === child.name && kids.filter(k => k.name === child.name).length === 1))
      const row = matching[0]
      const state = states.get(child._id) || (facility?.isDemo && !requestedDate ? { status: row?.status || child.status, time: row?.time || child.checkInTime, checkInTime: child.checkInTime, attendanceDate: date } : summarizeAttendance([], date))
      return { id: row?._id, childId: child._id, name: child.name, room: child.room, emoji: child.emoji, mood: child.mood, ...state }
    })
  },
})

async function writeStatus(ctx: any, membership: any, child: any, status: string, requestedDate?: string, suppliedTime?: string) {
  if (!statuses.includes(status)) throw new Error('Invalid attendance status.')
  const { facilityId, userId, user, facility } = membership
  const date = checkedDate(requestedDate, facility)
  const today = localDate(Date.now(), facility)
  if (date > today) throw new Error('Attendance cannot be recorded in the future.')
  if (date !== today && user?.role !== 'admin') throw new Error('Ask the director to correct historical attendance.')
  const events = await ctx.db.query('attendanceEvents').withIndex('by_child_date', (q: any) => q.eq('childId', child._id).eq('date', date)).collect()
  const current = summarizeAttendance(events, date)
  if (status === 'napping' && !present(current.status)) throw new Error('Check the child in before recording a nap.')
  if (status === 'absent' && present(current.status)) throw new Error('Check the child out before recording an absence.')
  if (status === current.status && events.length) return { ok: true, ...current }
  const occurredAt = Date.now()
  const time = status === 'absent' ? '—' : suppliedTime ? cleanText(suppliedTime, 'Time', 40, true) : displayTime(occurredAt, facility)
  const event = { facilityId, childId: child._id, date, status, occurredAt, displayTime: time, byUserId: userId || undefined }
  const eventId = await ctx.db.insert('attendanceEvents', event)
  const storedEvent = await ctx.db.get(eventId)
  const state = summarizeAttendance([...events, storedEvent || { ...event, _creationTime: occurredAt, _id: eventId }], date)
  // Current-state caches are compatibility mirrors, never a competing source.
  if (date === today) {
    await ctx.db.patch(child._id, { status, attendanceDate: date, checkInTime: state.checkInTime, checkInAt: state.checkInAt, checkOutAt: state.checkOutAt })
    const rows = await ctx.db.query('roster').withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId)).collect()
    const kids = await facilityChildren(ctx, facilityId)
    const matching = rows.filter((row: any) => row.childId === child._id || (!row.childId && row.name === child.name && kids.filter(k => k.name === child.name).length === 1))
    const patch = { childId: child._id, status, time, attendanceDate: date, checkInAt: state.checkInAt, checkOutAt: state.checkOutAt }
    if (matching.length) for (const row of matching) await ctx.db.patch(row._id, patch)
    else await ctx.db.insert('roster', { facilityId, name: child.name, emoji: child.emoji, mood: child.mood || '—', order: child.order || 0, ...patch })
  }
  await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'attendance_changed', summary: `${child.name}: ${status} on ${date}.` })
  return { ok: true, ...state }
}
// Enrolment changes append a current-day checkout rather than allowing a
// restored child to inherit an earlier checked-in state. Prior days stay intact.
export async function closeAttendanceForEnrolmentChange(ctx: any, membership: any, child: any) {
  const date = localDate(Date.now(), membership.facility)
  const events = await ctx.db.query('attendanceEvents').withIndex('by_child_date', (q: any) => q.eq('childId', child._id).eq('date', date)).collect()
  if (present(summarizeAttendance(events, date).status)) await writeStatus(ctx, membership, child, 'checked-out', date)
}

async function childForRoster(ctx: any, row: any, facilityId: any) {
  if (row.childId) return await authorizedChild(ctx, row.childId, facilityId)
  const kids = await facilityChildren(ctx, facilityId)
  const matches = kids.filter(k => k.name === row.name && !k.archivedAt)
  if (matches.length !== 1) throw new Error('Choose the child by their enrolment record; this legacy roster name is ambiguous.')
  return matches[0]
}

export const toggle = mutation({
  args: { id: v.id('roster'), time: v.optional(v.string()), date: v.optional(v.string()) },
  handler: async (ctx, { id, time, date: requestedDate }) => {
    const membership = await requireStaff(ctx)
    const row = await requireRecord(ctx, id, membership.facilityId)
    const child = await childForRoster(ctx, row, membership.facilityId)
    const date = checkedDate(requestedDate, membership.facility)
    const rows = await ctx.db.query('attendanceEvents').withIndex('by_child_date', q => q.eq('childId', child._id).eq('date', date)).collect()
    const current = summarizeAttendance(rows, date)
    const status = present(current.status) ? 'checked-out' : 'checked-in'
    return await writeStatus(ctx, membership, child, status, date, time)
  },
})
export const setStatus = mutation({
  args: { id: v.id('roster'), status: v.string(), time: v.optional(v.string()), date: v.optional(v.string()) },
  handler: async (ctx, { id, status, time, date }) => {
    const membership = await requireStaff(ctx)
    const row = await requireRecord(ctx, id, membership.facilityId)
    return await writeStatus(ctx, membership, await childForRoster(ctx, row, membership.facilityId), status, date, time)
  },
})
export const setChildStatus = mutation({
  args: { childId: v.id('children'), status: v.string(), time: v.optional(v.string()), date: v.optional(v.string()) },
  handler: async (ctx, { childId, status, time, date }) => {
    const membership = await requireStaff(ctx)
    return await writeStatus(ctx, membership, await authorizedChild(ctx, childId, membership.facilityId), status, date, time)
  },
})
export const history = query({
  args: { childId: v.id('children'), date: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { childId, date: requestedDate, limit }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx), user = uid ? await ctx.db.get(uid) : null
    await authorizedChild(ctx, childId, fid, user, uid)
    const date = checkedDate(requestedDate, await ctx.db.get(fid))
    const rows = await ctx.db.query('attendanceEvents').withIndex('by_child_date', q => q.eq('childId', childId).eq('date', date)).order('desc').take(boundedLimit(limit))
    return rows.map(({ _id, byUserId, facilityId, ...row }) => ({ id: _id, ...row }))
  },
})
