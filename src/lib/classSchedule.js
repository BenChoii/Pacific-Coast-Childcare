export const SCHEDULE_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const SCHEDULE_DEFAULT_DAYS = SCHEDULE_WEEKDAYS.slice(0, 5)
const DEFAULT_ZONE = 'America/Vancouver'
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value

export function scheduleTimeZone(value) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: value || DEFAULT_ZONE }).format(); return value || DEFAULT_ZONE }
  catch { return DEFAULT_ZONE }
}
export function scheduleMinutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}
export function scheduleTimeLabel(value) {
  const minute = scheduleMinutes(value)
  if (minute === null) return 'Time needed'
  const hour = Math.floor(minute / 60)
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
}
export function scheduleClock(now = Date.now(), timeZone = DEFAULT_ZONE) {
  const zone = scheduleTimeZone(timeZone)
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday, minute: Number(parts.hour) * 60 + Number(parts.minute), timeZone: zone }
}
export function scheduleDays(block) {
  return block.weekdays === undefined ? [...SCHEDULE_WEEKDAYS] : Array.isArray(block.weekdays) ? SCHEDULE_WEEKDAYS.filter(day => block.weekdays.includes(day)) : []
}
export function scheduleAgendaIssues(rows, { required = false } = {}) {
  if (!Array.isArray(rows)) return ['Add the schedule as a list of time blocks.']
  const issues = []
  if (required && !rows.length) issues.push('Add at least one time block before publishing a class schedule.')
  if (rows.length > 50) return ['Keep each schedule to 50 time blocks or fewer.']
  for (const [index, row] of rows.entries()) {
    const label = `Block ${index + 1}`
    if (!row || typeof row !== 'object') { issues.push(`${label} needs a start time, end time and activity.`); continue }
    const start = scheduleMinutes(row.startTime), end = scheduleMinutes(row.endTime)
    if (start === null || end === null || start >= end) issues.push(`${label} needs a valid start and end time on the same day, with the end after the start.`)
    if (typeof row.title !== 'string' || !row.title.trim() || row.title.trim().length > 160) issues.push(`${label} needs an activity name of up to 160 characters.`)
    if (row.location !== undefined && (typeof row.location !== 'string' || row.location.trim().length > 100)) issues.push(`${label}'s planned location must be at most 100 characters.`)
    if (row.detail !== undefined && (typeof row.detail !== 'string' || row.detail.trim().length > 1500)) issues.push(`${label}'s details must be at most 1,500 characters.`)
    if (row.weekdays !== undefined && (!Array.isArray(row.weekdays) || !row.weekdays.length || row.weekdays.some(day => !SCHEDULE_WEEKDAYS.includes(day)) || new Set(row.weekdays).size !== row.weekdays.length)) issues.push(`${label} needs distinct, valid weekdays.`)
    for (let earlier = 0; earlier < index; earlier++) {
      const other = rows[earlier]
      if (!other || !Array.isArray(row.weekdays || []) || !Array.isArray(other.weekdays || [])) continue
      const otherStart = scheduleMinutes(other.startTime), otherEnd = scheduleMinutes(other.endTime)
      if (start !== null && end !== null && otherStart !== null && otherEnd !== null && start < otherEnd && end > otherStart && scheduleDays(row).some(day => scheduleDays(other).includes(day))) issues.push(`${label} overlaps block ${earlier + 1} on at least one weekday.`)
    }
  }
  return issues
}
export function newScheduleBlock(rows = []) {
  const last = rows.at(-1), lastEnd = scheduleMinutes(last?.endTime)
  const start = lastEnd !== null && lastEnd !== undefined && lastEnd <= 23 * 60 + 29 ? lastEnd : 9 * 60
  const value = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
  return { startTime: value(start), endTime: value(start + 30), title: '', location: '', detail: '', weekdays: [...SCHEDULE_DEFAULT_DAYS] }
}
export function availableScheduleRooms(plans = [], extraRooms = []) {
  return [...new Set([...extraRooms, ...plans.filter(hasSchedule).map(plan => plan.room)].filter(room => typeof room === 'string' && room.trim() && room.trim() !== 'Unassigned').map(room => room.trim()))].sort((a, b) => a.localeCompare(b))
}
const hasSchedule = plan => plan.kind === 'schedule' || (Array.isArray(plan.agenda) && plan.agenda.length > 0)
const agendaRows = plan => (plan.agenda || []).map((row, index) => ({ ...row, index, weekdays: scheduleDays(row), startMinute: scheduleMinutes(row.startTime), endMinute: scheduleMinutes(row.endTime) })).sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute || a.index - b.index)
const planTime = plan => plan.publishedAt || plan.updatedAt || plan.createdAt || 0

// This evaluates a published plan, not a live child-location/attendance feed.
// Both time and date come from the daycare's timezone rather than the device.
export function classScheduleToday(plans = [], { now = Date.now(), timeZone = DEFAULT_ZONE, room, events = [], rooms = [], preview = false, showTimeline = false } = {}) {
  const clock = scheduleClock(now, timeZone)
  const options = availableScheduleRooms(plans, rooms)
  const requested = typeof room === 'string' && room.trim() && room !== 'Unassigned' ? room.trim() : undefined
  const chosenRoom = requested || (options.length === 1 ? options[0] : undefined)
  const base = { ...clock, rooms: options, room: chosenRoom || '', current: null, next: null, timeline: [], plan: null, closure: null, state: 'unpublished' }
  if (preview) {
    const plan = plans.find(hasSchedule)
    if (!plan) return { ...base, state: 'preview' }
    return { ...base, state: 'preview', plan, room: plan.room || '', timeline: scheduleAgendaIssues(plan.agenda || []).length ? [] : agendaRows(plan) }
  }
  const single = plans.length === 1 ? plans[0] : null
  if (showTimeline && single && hasSchedule(single) && single.status === 'published' && (!single.room || !requested || single.room === requested) && validDate(single.startDate) && validDate(single.endDate) && !scheduleAgendaIssues(single.agenda || []).length &&
    (single.startDate > clock.date || single.endDate < clock.date || (single.agenda?.length && !single.agenda.some(row => scheduleDays(row).includes(clock.weekday))))) {
    return { ...base, state: 'planned', plan: single, room: single.room || '', timeline: agendaRows(single) }
  }
  if (!chosenRoom && options.length > 1) return { ...base, state: 'choose-room' }
  const closure = events.find(event => ['closure', 'holiday'].includes(event.kind) && event.startDate <= clock.date && event.endDate >= clock.date && (!event.room || event.room === chosenRoom))
  if (closure) return { ...base, closure, state: 'closed' }
  const eligible = plans.filter(plan => hasSchedule(plan) && plan.status === 'published' && validDate(plan.startDate) && validDate(plan.endDate) && plan.startDate <= clock.date && plan.endDate >= clock.date && (!plan.room || plan.room === chosenRoom) && !scheduleAgendaIssues(plan.agenda || []).length && (!plan.agenda?.length || plan.agenda.some(row => scheduleDays(row).includes(clock.weekday))))
  eligible.sort((a, b) => Number(!!b.room) - Number(!!a.room) || b.startDate.localeCompare(a.startDate) || planTime(b) - planTime(a) || String(b.id || '').localeCompare(String(a.id || '')))
  const plan = eligible[0]
  if (!plan) return base
  if (!plan.agenda?.length) return { ...base, plan, state: 'document' }
  const timeline = agendaRows(plan).filter(row => row.weekdays.includes(clock.weekday))
  const current = timeline.find(row => row.startMinute <= clock.minute && clock.minute < row.endMinute) || null
  const next = timeline.find(row => row.startMinute > clock.minute) || null
  const state = current ? 'current' : next ? 'upcoming' : 'finished'
  return { ...base, plan, timeline, current, next, state }
}
