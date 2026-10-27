import { query, mutation } from './_generated/server'
import { v, ConvexError } from 'convex/values'
import { resolveFacilityId, requireAdmin, requireStaff, requireRecord } from './lib'
import { recordOwnerEvent } from './notifications'
import { getAuthUserId } from '@convex-dev/auth/server'
import { dateRange, dayStart, localDate, nextDate, sessionSeconds, weekStart, validDate } from './financeUtils'
import { cleanText, timezone } from './workflowUtils'
import type { Id } from './_generated/dataModel'

const fail = (message: string): never => { throw new ConvexError(message) }
function checkedText(value: string, label: string, max: number, required = false) {
  try { return cleanText(value, label, max, required) }
  catch (error) { return fail(error instanceof Error ? error.message : `Choose a valid ${label.toLowerCase()}.`) }
}
const roomName = (room: string) => checkedText(room, 'Classroom', 100) || 'Unassigned'
const sessionsFor = (ctx: any, id: any): Promise<any[]> => ctx.db.query('clockSessions').withIndex('by_educator', (q: any) => q.eq('educatorId', id)).collect()

async function accountState(ctx: any, educator: any) {
  if (!educator.userId) return 'unlinked'
  const account = await ctx.db.get(educator.userId)
  return account && account.facilityId === educator.facilityId && ['admin', 'staff'].includes(account.role) && account.accessStatus !== 'suspended' ? 'active' : 'suspended'
}
// Preserve a real pre-ledger open shift only when no later ledger entry already
// accounts for it. A stale status badge alone is never evidence of worked time.
function legacyOpen(educator: any, sessions: any[], now: number) {
  const start = educator.clockInAt
  return educator.status === 'in' && Number.isFinite(start) && start > 0 && start <= now &&
    !sessions.some(row => row.startedAt >= start || (row.endedAt !== undefined && row.endedAt >= start))
    ? { facilityId: educator.facilityId, educatorId: educator._id, startedAt: start } : null
}
function openShift(educator: any, sessions: any[], now: number) {
  return sessions.find(row => row.endedAt === undefined) || legacyOpen(educator, sessions, now)
}
async function syncBadge(ctx: any, educator: any, sessions: any[], now: number, zone: string) {
  const open = sessions.find(row => row.endedAt === undefined)
  const day = localDate(now, zone)
  await ctx.db.patch(educator._id, {
    status: open ? 'in' : 'out', clockInAt: open?.startedAt,
    todaySeconds: sessionSeconds(sessions, dayStart(day, zone), dayStart(nextDate(day), zone), now, true),
    hoursWeek: sessionSeconds(sessions, dayStart(weekStart(day), zone), now, now) / 3600,
  })
}

export const list = query({
  args: { asOfDay: v.optional(v.string()) },
  handler: async (ctx, { asOfDay }) => {
    // A date key invalidates the reactive query at midnight. The server remains
    // authoritative if a device clock or timezone is incorrect.
    if (asOfDay !== undefined && !validDate(asOfDay)) fail('Choose a valid attendance date.')
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db.query('educators').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
    const facility = await ctx.db.get(fid)
    const now = Date.now(), zone = timezone(facility), day = localDate(now, zone)
    const sessions = await ctx.db.query('clockSessions').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
    const uid = await getAuthUserId(ctx), user = uid ? await ctx.db.get(uid) : null
    const out = []
    for (const d of docs.filter(e => !user || user.role === 'admin' || (user.role === 'staff' && e.userId === uid))) {
      const { _id, _creationTime, facilityId, order, imageId, ...rest } = d
      const ownSessions: any[] = sessions.filter(row => row.educatorId === _id)
      const legacy = legacyOpen(d, ownSessions, now)
      if (legacy) ownSessions.push(legacy)
      const open = ownSessions.find(row => row.endedAt === undefined)
      const midnight = dayStart(day, zone), tomorrow = dayStart(nextDate(day), zone)
      const state = await accountState(ctx, d)
      const stats = facility?.isDemo && !ownSessions.length ? {} : {
        status: open ? 'in' : 'out',
        todaySeconds: sessionSeconds(ownSessions, midnight, tomorrow, now, true),
        hoursWeek: sessionSeconds(ownSessions, dayStart(weekStart(day), zone), now, now) / 3600,
        clockInAt: open ? Math.max(open.startedAt, midnight) : undefined,
        punches: ownSessions.flatMap(row => [
          ...(row.startedAt >= midnight && row.startedAt < tomorrow ? [{ type: 'in', at: row.startedAt }] : []),
          ...(row.endedAt !== undefined && row.endedAt >= midnight && row.endedAt < tomorrow ? [{ type: 'out', at: row.endedAt }] : []),
        ]).sort((a, b) => a.at - b.at).map(punch => ({ type: punch.type, time: new Date(punch.at).toLocaleTimeString('en-CA', { timeZone: zone, hour: 'numeric', minute: '2-digit' }) })),
      }
      out.push({ id: _id, ...rest, ...stats, isCurrentUser: !!uid && d.userId === uid, accessStatus: state, canClock: state !== 'suspended' || !!open, imageUrl: imageId ? await ctx.storage.getUrl(imageId) : null })
    }
    return out
  },
})

export const add = mutation({
  args: { name: v.string(), role: v.string(), room: v.string(), emoji: v.optional(v.string()), certifications: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const all = await ctx.db.query('educators').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const name = checkedText(args.name, 'Educator name', 160, true)
    const id = await ctx.db.insert('educators', {
      facilityId, name, role: checkedText(args.role, 'Educator role', 100, true), room: roomName(args.room), emoji: args.emoji || '🧑‍🏫',
      hireDate: 'New', certifications: (args.certifications || []).slice(0, 20).map(value => checkedText(value, 'Certification', 100)),
      status: 'out', todaySeconds: 0, punches: [], hoursWeek: 0, hoursTarget: 38, pto: '0 days',
      order: all.length ? Math.max(...all.map(e => e.order)) + 1 : 0,
    })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'educator_added', summary: `${name}'s educator record was added.` })
    return id
  },
})

// The director explicitly chooses an existing unlinked staff record or creates
// their own record. Names never grant an account access to someone else's row.
export const ensureSelf = mutation({
  args: { educatorId: v.optional(v.id('educators')), createNew: v.optional(v.boolean()) },
  handler: async (ctx, { educatorId, createNew }) => {
    const { facilityId, userId, user } = await requireAdmin(ctx)
    const all = await ctx.db.query('educators').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const own = all.filter(e => e.userId === userId)
    if (own.length > 1) fail('More than one educator record is linked to your account. Ask support to review these records before clocking in.')
    if (own.length) return { id: own[0]._id, created: false }
    if (educatorId) {
      const existing = await requireRecord(ctx, educatorId, facilityId)
      if (existing.userId && existing.userId !== userId) fail('That educator record already belongs to another account.')
      await ctx.db.patch(educatorId, { userId })
      await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'educator_account_linked', summary: 'The director linked their account to an existing educator record.' })
      return { id: educatorId, created: false }
    }
    const candidates = all.filter(e => !e.userId)
    if (candidates.length && !createNew) return { needsLink: true, candidates: candidates.map(e => ({ id: e._id, name: e.name, role: e.role, room: e.room })) }
    const id = await ctx.db.insert('educators', {
      facilityId, userId, name: user.name || 'Director', role: 'Director', room: 'Unassigned', emoji: '🏫', hireDate: 'New', certifications: [],
      status: 'out', todaySeconds: 0, punches: [], hoursWeek: 0, hoursTarget: 40, pto: '0 days', order: all.length ? Math.max(...all.map(e => e.order)) + 1 : 0,
    })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'educator_added', summary: 'The director created their own educator attendance record.' })
    return { id, created: true }
  },
})

export const linkAccount = mutation({
  args: { id: v.id('educators'), userId: v.optional(v.id('users')) },
  handler: async (ctx, { id, userId: linkedUserId }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const educator = await requireRecord(ctx, id, facilityId)
    if (educator.userId === linkedUserId) return { ok: true, changed: false }
    if (educator.userId && linkedUserId) fail('Unlink the current account first. An educator record cannot be reassigned silently.')
    const sessions = await sessionsFor(ctx, id)
    if (openShift(educator, sessions, Date.now())) fail('Clock this educator out before changing the linked account.')
    if (linkedUserId) {
      const account = await ctx.db.get(linkedUserId)
      if (!account || account.facilityId !== facilityId || !['admin', 'staff'].includes(account.role || '') || account.accessStatus === 'suspended') fail('Choose an active educator or director account from this daycare.')
      const all = await ctx.db.query('educators').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
      if (all.some(e => e._id !== id && e.userId === linkedUserId)) fail('That account is already linked to another educator record.')
    }
    await ctx.db.patch(id, { userId: linkedUserId })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: linkedUserId ? 'educator_account_linked' : 'educator_account_unlinked', summary: `${educator.name}'s educator sign-in link was ${linkedUserId ? 'added' : 'removed'}. Attendance history was retained.` })
    return { ok: true, changed: true }
  },
})

export const assignRoom = mutation({
  args: { id: v.id('educators'), room: v.string(), hoursTarget: v.optional(v.number()) },
  handler: async (ctx, { id, room, hoursTarget }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const educator = await requireRecord(ctx, id, facilityId)
    if (await accountState(ctx, educator) === 'suspended') fail('Restore this team member’s access before changing their assignment.')
    if (hoursTarget !== undefined && (!Number.isFinite(hoursTarget) || hoursTarget < 0 || hoursTarget > 168)) fail('Weekly target hours must be between 0 and 168.')
    const nextRoom = roomName(room)
    if (educator.room === nextRoom && (hoursTarget === undefined || educator.hoursTarget === hoursTarget)) return { ok: true, changed: false }
    await ctx.db.patch(id, { room: nextRoom, ...(hoursTarget !== undefined ? { hoursTarget } : {}) })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'educator_assignment_changed', summary: `${educator.name}'s assignment was changed to ${nextRoom}.` })
    return { ok: true, changed: true }
  },
})

async function changeClock(ctx: any, id: Id<'educators'>, desired?: 'in' | 'out') {
  const { facilityId, user, userId, facility } = await requireStaff(ctx)
  const educator = await requireRecord(ctx, id, facilityId)
  if (user?.role === 'staff' && educator.userId !== userId) fail('You can only clock your own attendance.')
  const now = Date.now(), zone = timezone(facility)
  const sessions = await sessionsFor(ctx, id)
  const opens = sessions.filter(row => row.endedAt === undefined)
  if (opens.length > 1) fail('This educator has overlapping open shifts. Ask the director to review the attendance history before adding another punch.')
  let open = opens[0]
  const legacy = !open ? legacyOpen(educator, sessions, now) : null
  const status = desired || (open || legacy ? 'out' : 'in')
  if (status === 'in' && await accountState(ctx, educator) === 'suspended') fail('This team member’s access is inactive. Restore it before clocking them in.')
  if (!open && legacy) {
    const legacyId = await ctx.db.insert('clockSessions', { ...legacy, createdAt: now, createdBy: userId || undefined, source: 'legacy-clock' })
    open = { ...legacy, _id: legacyId }; sessions.push(open)
  }
  if (status === 'in' && open) {
    await syncBadge(ctx, educator, sessions, now, zone)
    return { ok: true, changed: false, status, sessionId: open._id }
  }
  if (status === 'out' && !open) {
    await syncBadge(ctx, educator, sessions, now, zone)
    return { ok: true, changed: false, status }
  }
  if (status === 'in') {
    const row = { facilityId, educatorId: id, startedAt: now, createdAt: now, createdBy: userId || undefined, source: 'clock' }
    const sessionId = await ctx.db.insert('clockSessions', row)
    sessions.push({ ...row, _id: sessionId })
    await syncBadge(ctx, educator, sessions, now, zone)
    await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'educator_attendance_changed', summary: `${educator.name} clocked in.` })
    return { ok: true, changed: true, status, sessionId }
  }
  if (open.startedAt > now) fail('This shift starts in the future. Ask the director to correct it before clocking out.')
  await ctx.db.patch(open._id, { endedAt: now, updatedAt: now, updatedBy: userId || undefined })
  open.endedAt = now
  await syncBadge(ctx, educator, sessions, now, zone)
  await recordOwnerEvent(ctx, { facilityId, actorId: userId || undefined, type: 'educator_attendance_changed', summary: `${educator.name} clocked out.` })
  return { ok: true, changed: true, status, sessionId: open._id }
}

export const setClock = mutation({ args: { id: v.id('educators'), status: v.union(v.literal('in'), v.literal('out')) }, handler: async (ctx, { id, status }) => changeClock(ctx, id, status) })
// Compatibility for previously loaded clients. New buttons send an explicit
// target state so a retry/double-click cannot toggle a saved clock-in back out.
export const clock = mutation({ args: { id: v.id('educators'), time: v.string() }, handler: async (ctx, { id }) => changeClock(ctx, id) })

export const attendance = query({
  args: { startDate: v.string(), endDate: v.string(), educatorId: v.optional(v.id('educators')) },
  handler: async (ctx, { startDate, endDate, educatorId }) => {
    const { facilityId, facility, user, userId } = await requireStaff(ctx)
    try { dateRange(startDate, endDate) } catch { fail('Choose valid attendance dates with the end on or after the start.') }
    if (Date.parse(endDate) - Date.parse(startDate) > 92 * 86400000) fail('Choose an attendance range of 93 days or fewer.')
    const zone = timezone(facility), now = Date.now(), start = dayStart(startDate, zone), end = dayStart(nextDate(endDate), zone)
    const allEducators = await ctx.db.query('educators').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const visible = allEducators.filter(e => (!user || user.role === 'admin' || e.userId === userId) && (!educatorId || e._id === educatorId))
    if (educatorId && !visible.length) fail('Educator attendance is not available for this account.')
    const ids = new Set(visible.map(e => e._id))
    const records = await ctx.db.query('clockSessions').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const selected = records.filter(row => ids.has(row.educatorId) && row.startedAt < end && (row.endedAt ?? now) > start).sort((a, b) => b.startedAt - a.startedAt)
    if (selected.length > 1000) fail('This range has more than 1,000 shifts. Choose fewer dates or one educator.')
    const kids = await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const educators = []
    for (const e of visible) educators.push({ id: e._id, name: e.name, room: e.room, userId: e.userId, isCurrentUser: e.userId === userId, accessStatus: await accountState(ctx, e) })
    const sessions = []
    for (const row of selected) {
      const actor = row.updatedBy ? await ctx.db.get(row.updatedBy) : row.createdBy ? await ctx.db.get(row.createdBy) : null
      sessions.push({ id: row._id, educatorId: row.educatorId, name: visible.find(e => e._id === row.educatorId)?.name || 'Educator', startedAt: row.startedAt, endedAt: row.endedAt, source: row.source || 'clock', updatedAt: row.updatedAt, updatedByName: actor?.name || undefined, correctionCount: row.corrections?.length || 0 })
    }
    const rooms = [...new Set([...allEducators.map(e => e.room), ...kids.filter(k => !k.archivedAt).map(k => k.room)].filter(r => r && r !== 'Unassigned'))].sort()
    return { timezone: zone, startDate, endDate, rooms, educators, sessions, totalHours: Math.round(sessionSeconds(selected, start, end, now) / 36) / 100 }
  },
})

export const saveShift = mutation({
  args: { educatorId: v.id('educators'), id: v.optional(v.id('clockSessions')), startedAt: v.number(), endedAt: v.number(), reason: v.string() },
  handler: async (ctx, { educatorId, id, startedAt, endedAt, reason }) => {
    const { facilityId, facility, userId } = await requireAdmin(ctx)
    const educator = await requireRecord(ctx, educatorId, facilityId)
    const now = Date.now(), zone = timezone(facility)
    if (![startedAt, endedAt].every(value => Number.isSafeInteger(value) && value > 0) || startedAt >= endedAt) fail('Choose a valid start and end time, with the end after the start.')
    if (startedAt > now || endedAt > now) fail('Attendance cannot be recorded in the future.')
    if (endedAt - startedAt > 24 * 3600000) fail('Keep each shift within 24 hours. Split a longer record into separate shifts.')
    const explanation = checkedText(reason, 'Correction reason', 300, true)
    const existing = id ? await requireRecord(ctx, id, facilityId) : null
    if (existing && existing.educatorId !== educatorId) fail('Choose the educator who owns this shift.')
    if ((existing?.corrections?.length || 0) >= 50) fail('This shift has reached its correction limit. Contact support before changing it again.')
    const sessions = await sessionsFor(ctx, educatorId)
    const legacy = legacyOpen(educator, sessions, now)
    if ([...sessions, ...(legacy ? [legacy] : [])].some(row => (!id || row._id !== id) && row.startedAt < endedAt && (row.endedAt ?? now) > startedAt)) fail('This shift overlaps another recorded or open shift. Correct the existing shift instead.')
    const runs = await ctx.db.query('payRuns').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const protectedRange = (a: number, b: number, run: any) => a < dayStart(nextDate(run.periodEnd), zone) && b > dayStart(run.periodStart, zone)
    if (runs.some(run => run.status !== 'void' && run.lines.some(line => line.educatorId === educatorId) && (protectedRange(startedAt, endedAt, run) || (existing && protectedRange(existing.startedAt, existing.endedAt ?? now, run))))) fail('A recorded payroll run covers this shift. Review and void that run before correcting attendance, then prepare payroll again.')
    // Correcting a past day must not silently close an actual pre-ledger shift
    // that is still running today. Preserve it once after validation succeeds.
    if (legacy) {
      const legacyId = await ctx.db.insert('clockSessions', { ...legacy, createdAt: now, createdBy: userId, source: 'legacy-clock' })
      sessions.push({ ...legacy, _id: legacyId })
    }
    let savedId = id
    if (existing && id) {
      const corrections = [...(existing.corrections || []), { startedAt: existing.startedAt, ...(existing.endedAt !== undefined ? { endedAt: existing.endedAt } : {}), changedAt: now, changedBy: userId, reason: explanation }]
      await ctx.db.patch(id, { startedAt, endedAt, updatedAt: now, updatedBy: userId, corrections })
      const index = sessions.findIndex(row => row._id === id)
      if (index >= 0) sessions[index] = { ...sessions[index], startedAt, endedAt }
    } else {
      savedId = await ctx.db.insert('clockSessions', { facilityId, educatorId, startedAt, endedAt, createdAt: now, createdBy: userId, updatedAt: now, updatedBy: userId, source: 'manual', corrections: [] })
      sessions.push({ _id: savedId, facilityId, educatorId, startedAt, endedAt })
    }
    await syncBadge(ctx, educator, sessions, now, zone)
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'educator_attendance_corrected', summary: `${educator.name}'s shift was ${id ? 'corrected' : 'added'} (${new Date(startedAt).toISOString()} to ${new Date(endedAt).toISOString()}). Reason: ${explanation}`.slice(0, 500) })
    return { ok: true, id: savedId }
  },
})
