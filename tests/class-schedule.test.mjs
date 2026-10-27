import test from 'node:test'
import assert from 'node:assert/strict'
import { SCHEDULE_DEFAULT_DAYS, SCHEDULE_WEEKDAYS, scheduleAgendaIssues, scheduleClock, scheduleDays, scheduleMinutes, scheduleTimeLabel, newScheduleBlock, availableScheduleRooms, classScheduleToday } from '../src/lib/classSchedule.js'

const stamp = text => Date.parse(text)
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const blocks = [
  { startTime: '07:30', endTime: '08:30', title: 'Welcome & soft arrivals', location: 'Classroom', weekdays },
  { startTime: '08:30', endTime: '09:00', title: 'Morning circle', location: 'Circle area', weekdays },
  { startTime: '12:00', endTime: '12:30', title: 'Family-style lunch', location: 'Dining area', weekdays },
  { startTime: '12:30', endTime: '14:30', title: 'Rest & recharge', location: 'Rest area', weekdays },
  { startTime: '14:30', endTime: '15:00', title: 'Wake-up routine and movement', location: 'Classroom', weekdays },
  { startTime: '16:30', endTime: '17:30', title: 'Outdoor exploration', location: 'Outdoor play area', weekdays },
]
const plan = fields => ({ id: 'daily', kind: 'schedule', status: 'published', title: 'Daily program', period: 'month', startDate: '2026-10-01', endDate: '2026-10-31', room: 'Sprouts', publishedAt: 100, agenda: structuredClone(blocks), ...fields })
const at = (iso = '2026-10-27T19:45:00Z', overrides = {}) => ({ now: stamp(iso), timeZone: 'America/Vancouver', room: 'Sprouts', ...overrides })

test('at 12:45 Pacific the published class plan shows rest, planned location and the next activity', () => {
  const s = classScheduleToday([plan()], at())
  assert.equal(s.state, 'current');assert.equal(s.date, '2026-10-27');assert.equal(s.weekday, 'Tue')
  assert.equal(s.current.title, 'Rest & recharge');assert.equal(s.current.location, 'Rest area')
  assert.equal(s.next.title, 'Wake-up routine and movement');assert.equal(s.next.startTime, '14:30');assert.equal(s.timeline.length, 6)
})

test('activity starts are inclusive and ends are exclusive at exact handoff times', () => {
  assert.equal(classScheduleToday([plan()], at('2026-10-27T19:29:59Z')).current.title, 'Family-style lunch')
  assert.equal(classScheduleToday([plan()], at('2026-10-27T19:30:00Z')).current.title, 'Rest & recharge')
  assert.equal(classScheduleToday([plan()], at('2026-10-27T21:30:00Z')).current.title, 'Wake-up routine and movement')
})

test('before opening, between blocks and after the final activity never invent an activity for now', () => {
  let s = classScheduleToday([plan()], at('2026-10-27T14:00:00Z'));assert.equal(s.current, null);assert.equal(s.next.title, 'Welcome & soft arrivals')
  s = classScheduleToday([plan()], at('2026-10-27T17:00:00Z'));assert.equal(s.current, null);assert.equal(s.next.title, 'Family-style lunch')
  s = classScheduleToday([plan()], at('2026-10-28T00:30:00Z'));assert.equal(s.state, 'finished');assert.equal(s.current, null);assert.equal(s.next, null)
})

test('a class-specific published schedule takes priority over a newer all-class schedule', () => {
  const generic = plan({ id: 'all', room: '', publishedAt: 9999, agenda: blocks.map(b => ({ ...b, title: 'Generic ' + b.title })) })
  const other = plan({ id: 'other', room: 'Meadow', publishedAt: 99999 })
  const s = classScheduleToday([generic, other, plan()], at())
  assert.equal(s.plan.id, 'daily');assert.equal(s.current.title, 'Rest & recharge')
})

test('more recent effective dates and publication resolve overlapping schedule versions deterministically', () => {
  const original = plan({ id: 'old', publishedAt: 1 }), replacement = plan({ id: 'new', publishedAt: 2 })
  assert.equal(classScheduleToday([original, replacement], at()).plan.id, 'new')
  const special = plan({ id: 'day', period: 'day', startDate: '2026-10-27', endDate: '2026-10-27', publishedAt: 1 })
  assert.equal(classScheduleToday([replacement, special], at()).plan.id, 'day')
})

test('normal Today view ignores drafts, past programs, future programs and other class records', () => {
  for (const candidate of [plan({ status: 'draft' }), plan({ startDate: '2026-11-01', endDate: '2026-11-30' }), plan({ endDate: '2026-10-26' }), plan({ room: 'Other' })]) {
    const s = classScheduleToday([candidate], at());assert.equal(s.current, null);assert.equal(s.timeline.length, 0)
  }
})

test('a closure overrides the normal program, but another class closure and a family event do not', () => {
  const closure = { kind: 'closure', title: 'Staff learning day', startDate: '2026-10-27', endDate: '2026-10-27', room: 'Sprouts' }
  const closed = classScheduleToday([plan()], at(undefined, { events: [closure] }))
  assert.equal(closed.state, 'closed');assert.equal(closed.current, null);assert.equal(closed.next, null);assert.equal(closed.timeline.length, 0)
  assert.equal(classScheduleToday([plan()], at(undefined, { events: [{ ...closure, room: 'Meadow' }] })).state, 'current')
  assert.equal(classScheduleToday([plan()], at(undefined, { events: [{ ...closure, kind: 'event' }] })).state, 'current')
  assert.equal(classScheduleToday([plan()], at(undefined, { events: [{ ...closure, kind: 'holiday', room: '' }] })).state, 'closed')
})

test('multi-class manager views require a class selection before displaying a program', () => {
  const plans = [plan(), plan({ id: 'meadow', room: 'Meadow' })]
  assert.equal(classScheduleToday(plans, at(undefined, { room: undefined })).state, 'choose-room')
  assert.equal(classScheduleToday(plans, at(undefined, { room: 'Meadow' })).plan.id, 'meadow')
  assert.equal(classScheduleToday([plan({ room: '' })], at(undefined, { room: undefined, rooms: ['Sprouts', 'Meadow'] })).state, 'choose-room')
})

test('weekdays control recurrence and Saturday does not display a weekday-only program', () => {
  const s = classScheduleToday([plan()], at('2026-10-24T19:45:00Z'))
  assert.equal(s.weekday, 'Sat');assert.equal(s.state, 'unpublished')
  const weekend = plan({ room: '', id: 'weekend', agenda: [{ startTime: '12:00', endTime: '13:00', title: 'Weekend activity', weekdays: ['Sat'] }] })
  assert.equal(classScheduleToday([plan(), weekend], at('2026-10-24T19:45:00Z')).current.title, 'Weekend activity')
})

test('the same activity period can hold different weekday programs without a conflict', () => {
  const agenda = [
    { startTime: '10:30', endTime: '11:15', title: 'STEM lab', weekdays: ['Tue'] },
    { startTime: '10:30', endTime: '11:15', title: 'Music and movement', weekdays: ['Wed'] },
  ]
  assert.deepEqual(scheduleAgendaIssues(agenda), [])
  assert.equal(classScheduleToday([plan({ agenda })], at('2026-10-27T17:45:00Z')).current.title, 'STEM lab')
  assert.equal(classScheduleToday([plan({ agenda })], at('2026-10-28T17:45:00Z')).current.title, 'Music and movement')
})

test('overlapping blocks on any shared weekday are rejected, while adjacent blocks are allowed', () => {
  assert.match(scheduleAgendaIssues([{ startTime: '12:00', endTime: '13:00', title: 'A', weekdays: ['Mon', 'Tue'] }, { startTime: '12:30', endTime: '14:00', title: 'B', weekdays: ['Tue', 'Wed'] }]).join(' '), /overlaps/)
  assert.deepEqual(scheduleAgendaIssues([{ startTime: '12:00', endTime: '12:30', title: 'A' }, { startTime: '12:30', endTime: '13:00', title: 'B' }]), [])
})

test('agenda validation rejects malformed dates, empty weekdays, overnight times and excessive fields safely', () => {
  for (const bad of [
    { startTime: '12:30', endTime: '12:00', title: 'Backwards' }, { startTime: '23:30', endTime: '00:30', title: 'Overnight' },
    { startTime: '24:00', endTime: '24:30', title: 'Invalid' }, { startTime: '12:00', endTime: '13:00', title: '' },
    { startTime: '12:00', endTime: '13:00', title: 'A', weekdays: [] }, { startTime: '12:00', endTime: '13:00', title: 'A', weekdays: ['Mon', 'Mon'] },
    { startTime: '12:00', endTime: '13:00', title: 'A', weekdays: null }, { startTime: '12:00', endTime: '13:00', title: 'A', location: 'x'.repeat(101) },
    { startTime: '12:00', endTime: '13:00', title: 'A', detail: 'x'.repeat(1501) },
  ]) assert.ok(scheduleAgendaIssues([bad]).length)
  assert.ok(scheduleAgendaIssues(null).length);assert.ok(scheduleAgendaIssues([], { required: true }).length)
  assert.ok(scheduleAgendaIssues(Array.from({ length: 51 }, () => ({ startTime: '12:00', endTime: '13:00', title: 'A' }))).length)
})

test('draft previews show every weekday variant without a current-activity or location claim', () => {
  const s = classScheduleToday([plan({ status: 'draft', startDate: '2026-12-01', endDate: '2026-12-31' })], at(undefined, { preview: true }))
  assert.equal(s.state, 'preview');assert.equal(s.timeline.length, 6);assert.equal(s.current, null);assert.equal(s.next, null)
})

test('calendar views retain the full published agenda outside its date range without claiming it is happening now', () => {
  for (const fields of [{ startDate: '2026-12-01', endDate: '2026-12-31' }, { startDate: '2026-09-01', endDate: '2026-09-30' }]) {
    const s = classScheduleToday([plan(fields)], at(undefined, { showTimeline: true }))
    assert.equal(s.state, 'planned');assert.equal(s.timeline.length, 6);assert.equal(s.current, null);assert.equal(s.next, null)
  }
})

test('an uploaded program without timed blocks remains a document rather than an invented live activity', () => {
  const p = plan({ agenda: [], attachments: [{ storageId: 'file', name: 'Class program.pdf' }], overview: 'Read the daily program.' })
  const s = classScheduleToday([p], at())
  assert.equal(s.state, 'document');assert.equal(s.plan.attachments[0].name, 'Class program.pdf');assert.equal(s.current, null);assert.equal(s.next, null)
})

test('timed agenda on a learning update remains usable while an ordinary untimed learning overview is not a daily schedule', () => {
  assert.equal(classScheduleToday([plan({ kind: 'learning' })], at()).current.title, 'Rest & recharge')
  assert.equal(classScheduleToday([plan({ kind: 'learning', agenda: [] })], at()).state, 'unpublished')
})

test('facility timezone controls local date across UTC midnight and both daylight-saving clock occurrences', () => {
  assert.deepEqual(scheduleClock(stamp('2026-10-28T01:00:00Z'), 'America/Vancouver'), { date: '2026-10-27', weekday: 'Tue', minute: 18 * 60, timeZone: 'America/Vancouver' })
  const fall = plan({ startDate: '2026-11-01', endDate: '2026-11-01', agenda: [{ startTime: '01:00', endTime: '02:00', title: 'Planned early block', weekdays: ['Sun'] }] })
  for (const iso of ['2026-11-01T08:30:00Z', '2026-11-01T09:30:00Z']) assert.equal(classScheduleToday([fall], at(iso)).current.title, 'Planned early block')
  assert.equal(scheduleClock(stamp('2026-10-27T19:45:00Z'), 'Bad/Zone').timeZone, 'America/Vancouver')
})

test('new owner blocks default to weekdays and valid sequential times without inferring any real program', () => {
  const fresh = newScheduleBlock([]);assert.deepEqual(fresh.weekdays, SCHEDULE_DEFAULT_DAYS);assert.equal(fresh.title, '')
  assert.equal(newScheduleBlock([{ endTime: '12:30' }]).startTime, '12:30');assert.equal(newScheduleBlock([{ endTime: '12:30' }]).endTime, '13:00')
  assert.equal(newScheduleBlock([{ endTime: '23:29' }]).endTime, '23:59')
  assert.deepEqual(scheduleDays({}), SCHEDULE_WEEKDAYS)
  assert.equal(scheduleMinutes('7:30'), null);assert.equal(scheduleMinutes('07:30'), 450);assert.equal(scheduleTimeLabel('12:30'), '12:30 PM');assert.equal(scheduleTimeLabel('00:00'), '12:00 AM')
})

test('class choices trim and deduplicate names while preserving distinct actual class labels', () => {
  assert.deepEqual(availableScheduleRooms([plan(), plan({ room: 'Meadow' }), plan({ kind: 'learning', agenda: [], room: 'Ignored' })], [' Sprouts ', 'Unassigned', '']), ['Meadow', 'Sprouts'])
})
