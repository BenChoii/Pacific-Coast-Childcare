import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { queryRows } from './test-db-query.mjs'

const bundled = await build({
  stdin: { contents: "export * as educators from './convex/educators'; export * as payroll from './convex/payroll';", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'isolated-transport', setup(b) {
    b.onResolve({ filter: /@convex-dev\/auth\/server|\.\/_generated\/(server|api)|\.\/notifications$/ }, args => ({ path: args.path, namespace: 'mock' }))
    b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents:
      path.includes('auth/server') ? 'export async function getAuthUserId(ctx){return ctx.uid ?? null}' :
      path.includes('notifications') ? 'export async function recordOwnerEvent(ctx,event){ctx.events.push(structuredClone(event))}' :
      path.endsWith('/api') ? 'export const api={};export const internal={};' :
      'export const query=x=>x;export const mutation=x=>x;export const internalMutation=x=>x;export const internalQuery=x=>x;export const action=x=>x;'
    }))
  }}],
})
const { educators: api, payroll } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))
let now = Date.parse('2026-10-27T19:00:00Z')
Date.now = () => now
const row = (id, fields = {}) => ({ _id: id, table: 'educators', facilityId: 'f', userId: id === 'ed-owner' ? 'owner' : id === 'ed-staff' ? 'staff' : undefined, name: id, role: 'Educator', room: 'Sprouts', emoji: 'E', hireDate: 'New', certifications: [], status: 'out', todaySeconds: 999999, hoursWeek: 90, punches: [], hoursTarget: 40, pto: '0 days', order: 0, ...fields })
function fixture(extra = []) {
  now = Date.parse('2026-10-27T19:00:00Z')
  const rows = new Map([
    ['f', { _id: 'f', table: 'facilities', timezone: 'America/Vancouver', ownerUserId: 'owner', name: 'Synthetic daycare' }],
    ['g', { _id: 'g', table: 'facilities', timezone: 'America/Toronto', ownerUserId: 'foreign' }],
    ['owner', { _id: 'owner', table: 'users', facilityId: 'f', role: 'admin', name: 'Director' }],
    ['staff', { _id: 'staff', table: 'users', facilityId: 'f', role: 'staff', name: 'Educator' }],
    ['other', { _id: 'other', table: 'users', facilityId: 'f', role: 'staff', name: 'Second educator' }],
    ['suspended', { _id: 'suspended', table: 'users', facilityId: 'f', role: 'staff', accessStatus: 'suspended' }],
    ['parent', { _id: 'parent', table: 'users', facilityId: 'f', role: 'parent' }],
    ['foreign', { _id: 'foreign', table: 'users', facilityId: 'g', role: 'staff' }],
    ['child', { _id: 'child', table: 'children', facilityId: 'f', room: 'Meadow', parentUserId: 'parent' }],
    ['ed-owner', row('ed-owner')], ['ed-staff', row('ed-staff')],
    ['ed-foreign', row('ed-foreign', { facilityId: 'g', userId: 'foreign' })],
    ...extra.map(r => [r._id, r]),
  ])
  let seq = 0
  const ctx = { uid: 'owner', rows, events: [], writes: [], storage: { getUrl: async () => null }, db: {
    get: async id => structuredClone(rows.get(id) || null),
    patch: async (id, values) => { assert.ok(rows.has(id));ctx.writes.push({ id, values: structuredClone(values) });for (const [key, value] of Object.entries(values)) { if (value === undefined) delete rows.get(id)[key];else rows.get(id)[key] = structuredClone(value) } },
    insert: async (table, values) => { const id = `new-${++seq}`;rows.set(id, { _id: id, table, ...structuredClone(values) });ctx.writes.push({ id, table });return id },
    query: table => queryRows(() => [...rows.values()].filter(r => r.table === table).map(r => structuredClone(r))),
  }}
  return ctx
}
const shifts = ctx => [...ctx.rows.values()].filter(r => r.table === 'clockSessions')
const localRange = { startDate: '2026-10-27', endDate: '2026-10-27' }
const shiftArgs = (overrides = {}) => ({ educatorId: 'ed-owner', startedAt: now - 3 * 3600000, endedAt: now - 2 * 3600000, reason: 'Director confirmed a missed punch.', ...overrides })

test('director clocks their own attendance explicitly and repeated target-state requests are idempotent', async () => {
  const c = fixture()
  assert.equal((await api.setClock.handler(c, { id: 'ed-owner', status: 'in' })).changed, true)
  assert.equal((await api.setClock.handler(c, { id: 'ed-owner', status: 'in' })).changed, false)
  assert.equal(shifts(c).length, 1);assert.equal(c.events.length, 1)
  now += 3600000
  await api.setClock.handler(c, { id: 'ed-owner', status: 'out' })
  assert.equal((await api.setClock.handler(c, { id: 'ed-owner', status: 'out' })).changed, false)
  assert.equal(shifts(c).length, 1);assert.equal(c.events.length, 2)
  const owner = (await api.list.handler(c, { asOfDay: '2026-10-27' })).find(e => e.id === 'ed-owner')
  assert.equal(owner.status, 'out');assert.equal(owner.isCurrentUser, true);assert.equal(owner.todaySeconds, 3600);assert.equal(owner.hoursWeek, 1)
  assert.deepEqual(owner.punches.map(p => p.type), ['in', 'out'])
})

test('educator may clock only their own active account; parents and foreign records cannot write attendance', async () => {
  const c = fixture();c.uid = 'staff'
  await api.setClock.handler(c, { id: 'ed-staff', status: 'in' })
  for (const id of ['ed-owner', 'ed-foreign']) await assert.rejects(api.setClock.handler(c, { id, status: 'in' }), /own attendance|Not found/)
  c.uid = 'parent';await assert.rejects(api.setClock.handler(c, { id: 'ed-owner', status: 'in' }), /Educator or director/)
  c.uid = 'suspended';await assert.rejects(api.setClock.handler(c, { id: 'ed-staff', status: 'in' }), /access has ended/)
})

test('ledger status wins over a stale educator badge and old closed shifts cannot become open again', async () => {
  const c = fixture([{ _id: 'closed', table: 'clockSessions', facilityId: 'f', educatorId: 'ed-owner', startedAt: now - 7200000, endedAt: now - 3600000 }])
  Object.assign(c.rows.get('ed-owner'), { status: 'in', clockInAt: now - 7200000 })
  assert.equal((await api.list.handler(c, {})).find(e => e.id === 'ed-owner').status, 'out')
  await api.setClock.handler(c, { id: 'ed-owner', status: 'in' })
  assert.equal(shifts(c).length, 2);assert.equal(shifts(c).filter(s => s.endedAt === undefined).length, 1)
  c.rows.get('ed-owner').status = 'out'
  assert.equal((await api.list.handler(c, {})).find(e => e.id === 'ed-owner').status, 'in')
})

test('legacy open timestamp migrates once while a status-only badge invents no worked time', async () => {
  let c = fixture();Object.assign(c.rows.get('ed-owner'), { status: 'in', clockInAt: now - 1800000 })
  await api.setClock.handler(c, { id: 'ed-owner', status: 'out' })
  assert.equal(shifts(c).length, 1);assert.equal(shifts(c)[0].source, 'legacy-clock');assert.equal(c.rows.get('ed-owner').todaySeconds, 1800)
  await api.setClock.handler(c, { id: 'ed-owner', status: 'out' });assert.equal(shifts(c).length, 1)
  c = fixture();c.rows.get('ed-owner').status = 'in'
  await api.setClock.handler(c, { id: 'ed-owner', status: 'out' })
  assert.equal(shifts(c).length, 0);assert.equal(c.rows.get('ed-owner').todaySeconds, 0)
})

test('an inactive linked team member cannot clock in or be reassigned but an open shift can be closed', async () => {
  const c = fixture();c.rows.get('ed-staff').userId = 'suspended'
  await assert.rejects(api.setClock.handler(c, { id: 'ed-staff', status: 'in' }), /inactive/)
  await assert.rejects(api.assignRoom.handler(c, { id: 'ed-staff', room: 'Meadow' }), /Restore/)
  c.rows.set('open', { _id: 'open', table: 'clockSessions', facilityId: 'f', educatorId: 'ed-staff', startedAt: now - 3600000 })
  await api.setClock.handler(c, { id: 'ed-staff', status: 'out' })
  assert.equal(c.rows.get('open').endedAt, now)
})

test('multiple legacy open shifts refuse further punches instead of adding or hiding duplicate hours', async () => {
  const c = fixture([1, 2].map(n => ({ _id: `open${n}`, table: 'clockSessions', facilityId: 'f', educatorId: 'ed-owner', startedAt: now - n * 3600000 })))
  await assert.rejects(api.setClock.handler(c, { id: 'ed-owner', status: 'in' }), /overlapping open/)
  assert.equal(c.writes.length, 0)
})

test('self setup is idempotent and names alone never link a legacy educator record', async () => {
  const c = fixture([row('legacy', { name: 'Director' })]);c.rows.delete('ed-owner')
  const choose = await api.ensureSelf.handler(c, {})
  assert.equal(choose.needsLink, true);assert.equal(c.writes.length, 0)
  assert.ok(choose.candidates.some(e => e.id === 'legacy'))
  const linked = await api.ensureSelf.handler(c, { educatorId: 'legacy' })
  assert.equal(linked.id, 'legacy');assert.equal(c.rows.get('legacy').userId, 'owner')
  assert.equal((await api.ensureSelf.handler(c, { createNew: true })).id, 'legacy')
  assert.equal([...c.rows.values()].filter(r => r.table === 'educators' && r.userId === 'owner').length, 1)
})

test('director can explicitly create their own record without claiming somebody else’s unlinked record', async () => {
  const c = fixture([row('legacy', { name: 'Other employee' })]);c.rows.delete('ed-owner')
  const own = await api.ensureSelf.handler(c, { createNew: true })
  assert.equal(own.created, true);assert.equal(c.rows.get(own.id).userId, 'owner');assert.equal(c.rows.get('legacy').userId, undefined)
  c.uid = 'staff';await assert.rejects(api.ensureSelf.handler(c, { educatorId: 'legacy' }), /owner\/director/)
})

test('account linking is an explicit own-facility operation and cannot steal or duplicate another account', async () => {
  const c = fixture([row('unlinked')])
  for (const userId of ['staff', 'parent', 'foreign', 'suspended']) await assert.rejects(api.linkAccount.handler(c, { id: 'unlinked', userId }), /already linked|active educator/)
  await api.linkAccount.handler(c, { id: 'unlinked', userId: 'other' });assert.equal(c.rows.get('unlinked').userId, 'other')
  await assert.rejects(api.linkAccount.handler(c, { id: 'unlinked', userId: 'owner' }), /Unlink/)
  await api.linkAccount.handler(c, { id: 'unlinked' });assert.equal(c.rows.get('unlinked').userId, undefined)
  assert.equal(c.rows.has('unlinked'), true)
})

test('changing account links during a live shift is refused and attendance history is retained', async () => {
  const c = fixture();await api.setClock.handler(c, { id: 'ed-staff', status: 'in' })
  await assert.rejects(api.linkAccount.handler(c, { id: 'ed-staff' }), /Clock this educator out/)
  await api.setClock.handler(c, { id: 'ed-staff', status: 'out' });await api.linkAccount.handler(c, { id: 'ed-staff' })
  assert.equal(shifts(c).length, 1)
})

test('classroom assignments use clean names and validated weekly targets without changing actual hours', async () => {
  const c = fixture()
  await api.assignRoom.handler(c, { id: 'ed-owner', room: '  Meadow  ', hoursTarget: 32 })
  assert.equal(c.rows.get('ed-owner').room, 'Meadow');assert.equal(c.rows.get('ed-owner').hoursTarget, 32)
  await api.assignRoom.handler(c, { id: 'ed-owner', room: '' });assert.equal(c.rows.get('ed-owner').room, 'Unassigned')
  for (const hoursTarget of [-1, NaN, 169]) await assert.rejects(api.assignRoom.handler(c, { id: 'ed-owner', room: 'Sprouts', hoursTarget }), /between 0 and 168/)
  c.uid = 'staff';await assert.rejects(api.assignRoom.handler(c, { id: 'ed-staff', room: 'Meadow' }), /owner\/director/)
  assert.equal(shifts(c).length, 0)
})

test('manual shift creation feeds real period hours and correction retains old times, actor and reason', async () => {
  const c = fixture();const result = await api.saveShift.handler(c, shiftArgs())
  assert.equal(c.rows.get(result.id).source, 'manual');assert.equal(c.rows.get(result.id).createdBy, 'owner')
  let history = await api.attendance.handler(c, localRange);assert.equal(history.totalHours, 1);assert.equal(history.sessions[0].correctionCount, 0)
  const previous = structuredClone(c.rows.get(result.id))
  await api.saveShift.handler(c, shiftArgs({ id: result.id, endedAt: now - 3600000, reason: 'Verified actual departure.' }))
  const saved = c.rows.get(result.id);assert.equal(saved.corrections.length, 1);assert.equal(saved.corrections[0].startedAt, previous.startedAt);assert.equal(saved.corrections[0].endedAt, previous.endedAt);assert.equal(saved.corrections[0].changedBy, 'owner');assert.equal(saved.corrections[0].reason, 'Verified actual departure.')
  history = await api.attendance.handler(c, localRange);assert.equal(history.totalHours, 2);assert.equal(history.sessions[0].updatedByName, 'Director')
  assert.equal((await payroll.hoursForPeriod.handler(c, { periodStart: localRange.startDate, periodEnd: localRange.endDate })).find(e => e.educatorId === 'ed-owner').hours, 2)
})

test('closing an open session through a manual correction updates the current badge using fresh cloned database results', async () => {
  const c = fixture();await api.setClock.handler(c, { id: 'ed-owner', status: 'in' });const id = shifts(c)[0]._id
  now += 3600000
  await api.saveShift.handler(c, { id, educatorId: 'ed-owner', startedAt: now - 3600000, endedAt: now - 1000, reason: 'Missed clock-out, verified departure.' })
  assert.equal(c.rows.get('ed-owner').status, 'out');assert.equal(c.rows.get('ed-owner').clockInAt, undefined)
})

test('manual correction of an earlier day preserves a running legacy shift and refuses an overlap with it', async () => {
  const c = fixture();Object.assign(c.rows.get('ed-owner'), { status: 'in', clockInAt: now - 3600000 })
  await assert.rejects(api.saveShift.handler(c, shiftArgs({ startedAt: now - 1800000, endedAt: now - 1000 })), /overlaps/)
  assert.equal(c.writes.length, 0)
  await api.saveShift.handler(c, shiftArgs({ startedAt: now - 26 * 3600000, endedAt: now - 25 * 3600000 }))
  assert.equal(shifts(c).length, 2);assert.equal(shifts(c).filter(s => s.endedAt === undefined).length, 1)
  assert.equal(c.rows.get('ed-owner').status, 'in');assert.equal(c.rows.get('ed-owner').clockInAt, now - 3600000)
})

test('manual shifts reject future, reversed, oversized, overlapping or unexplained records without writes', async () => {
  const c = fixture();await api.saveShift.handler(c, shiftArgs());const initial = c.writes.length
  for (const overrides of [{ endedAt: now + 1000 }, { startedAt: now - 1000, endedAt: now - 2000 }, { startedAt: now - 25 * 3600000, endedAt: now }, { reason: '  ' }, {}]) await assert.rejects(api.saveShift.handler(c, shiftArgs(overrides)), /future|end after|within 24|reason|overlaps/)
  assert.equal(c.writes.length, initial)
  c.uid = 'staff';await assert.rejects(api.saveShift.handler(c, shiftArgs()), /owner\/director/)
  c.uid = 'owner';await assert.rejects(api.saveShift.handler(c, shiftArgs({ educatorId: 'ed-foreign' })), /Not found/)
})

test('recorded payroll locks both the original and replacement shift period while a void run allows correction', async () => {
  const c = fixture();const { id } = await api.saveShift.handler(c, shiftArgs())
  c.rows.set('paid', { _id: 'paid', table: 'payRuns', facilityId: 'f', status: 'recorded', periodStart: '2026-10-27', periodEnd: '2026-10-27', lines: [{ educatorId: 'ed-owner' }] })
  await assert.rejects(api.saveShift.handler(c, shiftArgs({ id, startedAt: now - 26 * 3600000, endedAt: now - 25 * 3600000 })), /payroll run/)
  await assert.rejects(api.saveShift.handler(c, shiftArgs({ startedAt: now - 3600000, endedAt: now - 1000 })), /payroll run/)
  c.rows.get('paid').status = 'void';await api.saveShift.handler(c, shiftArgs({ id, endedAt: now - 3600000 }))
  assert.equal(c.rows.get(id).corrections.length, 1)
})

test('attendance history is limited to the requester’s role and clips actual shifts to facility-local dates', async () => {
  const c = fixture([
    { _id: 'night', table: 'clockSessions', facilityId: 'f', educatorId: 'ed-staff', startedAt: Date.parse('2026-10-27T06:00:00Z'), endedAt: Date.parse('2026-10-27T08:00:00Z') },
    { _id: 'ownerShift', table: 'clockSessions', facilityId: 'f', educatorId: 'ed-owner', startedAt: now - 3600000, endedAt: now },
    { _id: 'foreignShift', table: 'clockSessions', facilityId: 'g', educatorId: 'ed-foreign', startedAt: now - 3600000, endedAt: now },
  ])
  c.uid = 'staff';const history = await api.attendance.handler(c, localRange)
  assert.equal(history.sessions.length, 1);assert.equal(history.totalHours, 1);assert.equal(history.timezone, 'America/Vancouver')
  assert.ok(history.rooms.includes('Meadow'))
  await assert.rejects(api.attendance.handler(c, { ...localRange, educatorId: 'ed-owner' }), /not available/)
  c.uid = 'parent';await assert.rejects(api.attendance.handler(c, localRange), /Educator or director/)
})

test('midnight date-key refresh resets daily totals without clearing a real open shift', async () => {
  const c = fixture();now = Date.parse('2026-11-01T06:00:00Z');await api.setClock.handler(c, { id: 'ed-owner', status: 'in' })
  now = Date.parse('2026-11-01T10:00:00Z')
  const owner = (await api.list.handler(c, { asOfDay: '2026-11-01' })).find(e => e.id === 'ed-owner')
  assert.equal(owner.status, 'in');assert.equal(owner.clockInAt, Date.parse('2026-11-01T07:00:00Z'));assert.equal(owner.todaySeconds, 0)
  const history = await api.attendance.handler(c, { startDate: '2026-11-01', endDate: '2026-11-01', educatorId: 'ed-owner' })
  assert.equal(history.totalHours, 3)
})

test('history dates and correction limits fail with actionable validation', async () => {
  const c = fixture()
  await assert.rejects(api.attendance.handler(c, { startDate: '2026-99-99', endDate: '2026-10-27' }), /valid attendance dates/)
  await assert.rejects(api.attendance.handler(c, { startDate: '2026-01-01', endDate: '2026-10-27' }), /93 days/)
  const { id } = await api.saveShift.handler(c, shiftArgs())
  c.rows.get(id).corrections = Array.from({ length: 50 }, () => ({ startedAt: 1, changedAt: 2, changedBy: 'owner', reason: 'Prior correction.' }))
  await assert.rejects(api.saveShift.handler(c, shiftArgs({ id })), /correction limit/)
  assert.equal(c.rows.get(id).corrections.length, 50)
})
