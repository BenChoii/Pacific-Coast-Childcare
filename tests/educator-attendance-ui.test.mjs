import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { attendanceDay, educatorTodaySeconds, recordedDuration, shiftInputTimestamp, shiftInputValue } from '../src/lib/staffAttendance.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const icons = ['Clock', 'LogIn', 'LogOut', 'ChevronRight', 'ArrowLeft', 'Plus', 'Pencil', 'Users']
const built = await build({ entryPoints: [root + 'src/components/EducatorAttendance.jsx'], bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', plugins: [{ name: 'attendance-ui-adapters', setup(b) {
  b.onResolve({ filter: /^react$|^react\/jsx-runtime$|^convex\/react$|^lucide-react$|\/convex\/_generated\/api$|\/context\/AppContext\.jsx$|\/ui\.jsx$|\/AvatarUpload\.jsx$/ }, a => ({ path: a.path, namespace: 'hooks' }))
  b.onLoad({ filter: /.*/, namespace: 'hooks' }, ({ path }) => ({ contents:
    path === 'react' ? `const slot=init=>{const h=globalThis.__staffUI,i=h.cursor++;if(!(i in h.slots))h.slots[i]=init();return h.slots[i]};export const useState=init=>{const s=slot(()=>({value:typeof init==='function'?init():init}));return[s.value,next=>{const v=typeof next==='function'?next(s.value):next;if(!Object.is(v,s.value)){s.value=v;globalThis.__staffUI.dirty=true}}]},useEffect=(fn,deps)=>{const s=slot(()=>({}));if(!s.deps||deps.some((v,i)=>!Object.is(v,s.deps[i])))globalThis.__staffUI.effects.push(()=>{s.cleanup?.();s.cleanup=fn()});s.deps=deps};` :
    path === 'react/jsx-runtime' ? 'export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment="fragment";' :
    path === 'convex/react' ? `export const useMutation=ref=>async args=>{const h=globalThis.__staffUI;h.calls.push([ref,args]);return h.reply(ref,args)},useQuery=(ref,args)=>{const h=globalThis.__staffUI;h.queries.push([ref,args]);return args==='skip'?undefined:h.results[ref]};` :
    path === 'lucide-react' ? `export const ${icons.map(name => `${name}='icon-${name}'`).join(',')};` :
    path.endsWith('/api') ? 'export const api=new Proxy({},{get:(_,a)=>new Proxy({},{get:(_,b)=>a+"."+b})});' :
    path.includes('AppContext') ? 'export const useApp=()=>globalThis.__staffUI.app;' :
    path.includes('AvatarUpload') ? 'export default "avatar-upload";' :
    'export const Card="card",SectionHeader="section-header",Pill="pill",Avatar="avatar",StatCard="stat-card";'
  }))
} }] })
const UI = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
const now = Date.parse('2026-10-27T19:30:00Z')
const educator = { id: 'director-record', name: 'Director Example', userId: 'owner', isCurrentUser: true, status: 'out', accessStatus: 'active', canClock: true, room: 'Unassigned', role: 'Director', todaySeconds: 0, hoursWeek: 0 }

function fixture(component, props = {}, options = {}) {
  const saved = globalThis.__staffUI, timer = globalThis.setInterval, clear = globalThis.clearInterval
  globalThis.setInterval = () => 0; globalThis.clearInterval = () => {}
  const h = globalThis.__staffUI = { cursor: 0, slots: [], effects: [], dirty: false, calls: [], queries: [], toasts: [],
    app: { educators: [educator], viewer: { id: 'owner', role: 'admin' }, facility: { id: 'facility', isDemo: false, timezone: 'America/Vancouver' }, childrenList: [{ room: 'Sprouts' }], isAuthenticated: true, pushToast: value => h.toasts.push(value), setEducatorPhoto: async () => {}, ...options.app },
    results: { 'educators.attendance': { totalHours: 0, sessions: [], rooms: ['Sprouts'] }, 'users.listMembers': [], ...options.results }, reply: options.reply || (async () => ({ ok: true })) }
  const render = () => { globalThis.__staffUI = h; let tries = 0; do { h.dirty = false; h.cursor = 0; h.effects = []; h.tree = UI[component](props); for (const effect of h.effects) effect(); assert.ok(++tries < 10) } while (h.dirty); return h.tree }
  const cleanup = () => { for (const s of h.slots) s?.cleanup?.(); globalThis.__staffUI = saved; globalThis.setInterval = timer; globalThis.clearInterval = clear }
  render(); return { h, render, cleanup }
}
function nodes(tree) { if (tree == null || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...Object.values(tree.props || {}).flatMap(nodes)] }
function text(tree) { if (tree == null) return ''; if (typeof tree === 'string' || typeof tree === 'number') return String(tree); if (Array.isArray(tree)) return tree.map(text).join(' '); return text(tree.props?.children) }
const find = (f, predicate) => nodes(f.h.tree).find(predicate)
const button = (f, label) => find(f, n => n.type === 'button' && text(n).trim() === label)
const input = (f, type, index = 0) => nodes(f.h.tree).filter(n => n.type === 'input' && n.props.type === type)[index]

test('the team list exposes real clock actions and opens a functional management detail', () => {
  const f = fixture('EducatorTeam')
  try {
    assert.ok(find(f, n => n.type === UI.MyEducatorAttendance))
    assert.ok(find(f, n => n.type === UI.EducatorClockButton && n.props.educator.id === educator.id))
    find(f, n => n.type === 'button' && n.props['aria-label'] === 'Manage Director Example').props.onClick(); f.render()
    assert.equal(f.h.tree.type, UI.EducatorAttendanceDetail)
    assert.equal(f.h.tree.props.educator.id, educator.id)
  } finally { f.cleanup() }
})

test('clock action is explicit, waits for acknowledgement and retains a failed state for retry', async () => {
  let resolve
  const f = fixture('EducatorClockButton', { educator }, { reply: () => new Promise(r => resolve = r) })
  try {
    const pending = button(f, 'Clock in').props.onClick(); f.render()
    assert.deepEqual(f.h.calls, [['educators.setClock', { id: educator.id, status: 'in' }]])
    assert.equal(button(f, 'Saving…').props.disabled, true)
    assert.equal(f.h.toasts.length, 0)
    resolve({ ok: true }); await pending; f.render(); assert.equal(f.h.toasts.length, 1)
    f.h.reply = async () => { throw { data: 'This account is suspended.' } }
    await button(f, 'Clock in').props.onClick(); f.render()
    assert.match(text(f.h.tree), /This account is suspended/)
    assert.equal(f.h.toasts.length, 1)
  } finally { f.cleanup() }
})

test('a suspended team record cannot start a clock request', async () => {
  const f = fixture('EducatorClockButton', { educator: { ...educator, accessStatus: 'suspended', canClock: false } })
  try { assert.equal(button(f, 'Clock in').props.disabled, true); await button(f, 'Clock in').props.onClick(); assert.deepEqual(f.h.calls, []) }
  finally { f.cleanup() }
})

test('a director can close an existing shift after a team account is suspended', async () => {
  const f = fixture('EducatorClockButton', { educator: { ...educator, status: 'in', accessStatus: 'suspended', canClock: true } })
  try { assert.equal(button(f, 'Clock out').props.disabled, false); await button(f, 'Clock out').props.onClick(); assert.deepEqual(f.h.calls, [['educators.setClock', { id: educator.id, status: 'out' }]]) }
  finally { f.cleanup() }
})

test('director self setup requires an explicit legacy record choice or a separate self record', async () => {
  const f = fixture('MyEducatorAttendance', { now }, { app: { educators: [] }, reply: async (_ref, args) => args.educatorId || args.createNew ? { id: 'own' } : { needsLink: true, candidates: [{ id: 'legacy', name: 'Director', role: 'Director', room: 'Sprouts' }] } })
  try {
    await button(f, 'Set up my attendance').props.onClick(); f.render()
    assert.deepEqual(f.h.calls, [['educators.ensureSelf', {}]])
    assert.equal(button(f, 'Link my existing record').props.disabled, true)
    find(f, n => n.type === 'select').props.onChange({ target: { value: 'legacy' } }); f.render()
    await button(f, 'Link my existing record').props.onClick(); f.render()
    assert.deepEqual(f.h.calls[1], ['educators.ensureSelf', { educatorId: 'legacy' }])
  } finally { f.cleanup() }
})

test('duplicate self-linked records require review instead of choosing an arbitrary time clock', () => {
  const f = fixture('MyEducatorAttendance', { now }, { app: { educators: [educator, { ...educator, id: 'duplicate' }] } })
  try { assert.match(text(f.h.tree), /More than one team record/); assert.equal(find(f, n => n.type === UI.EducatorClockButton), undefined) }
  finally { f.cleanup() }
})

test('a classroom change stays entered on failure and only confirms after saving', async () => {
  const f = fixture('EducatorAttendanceDetail', { educator, now, onBack() {} }, { reply: async () => { throw { data: 'Network unavailable. Try again.' } } })
  try {
    find(f, n => n.type === 'input' && n.props.list === 'educator-room-options').props.onChange({ target: { value: 'Sprouts' } }); f.render()
    await button(f, 'Save classroom').props.onClick(); f.render()
    assert.deepEqual(f.h.calls[0], ['educators.assignRoom', { id: educator.id, room: 'Sprouts' }])
    assert.equal(find(f, n => n.type === 'input' && n.props.list).props.value, 'Sprouts')
    assert.match(text(f.h.tree), /Network unavailable/); assert.equal(f.h.toasts.length, 0)
  } finally { f.cleanup() }
})

test('past shift entries use the facility timezone, require a reason and preserve a rejected correction', async () => {
  const f = fixture('EducatorAttendanceDetail', { educator, now, onBack() {} }, { reply: async () => { throw { data: 'The shift overlaps a recorded shift.' } } })
  try {
    button(f, 'Record a past shift').props.onClick(); f.render()
    assert.equal(button(f, 'Save shift').props.disabled, true)
    input(f, 'datetime-local', 0).props.onChange({ target: { value: '2026-10-26T07:30' } }); f.render()
    input(f, 'datetime-local', 1).props.onChange({ target: { value: '2026-10-26T15:30' } }); f.render()
    find(f, n => n.type === 'textarea').props.onChange({ target: { value: 'Missed clock-out reviewed with educator.' } }); f.render()
    await find(f, n => n.type === 'form').props.onSubmit({ preventDefault() {} }); f.render()
    assert.deepEqual(f.h.calls[0], ['educators.saveShift', { educatorId: educator.id, startedAt: Date.parse('2026-10-26T14:30:00Z'), endedAt: Date.parse('2026-10-26T22:30:00Z'), reason: 'Missed clock-out reviewed with educator.' }])
    assert.equal(input(f, 'datetime-local', 0).props.value, '2026-10-26T07:30')
    assert.match(text(f.h.tree), /overlaps a recorded shift/)
    assert.equal(find(f, n => n.type === 'textarea').props.value, 'Missed clock-out reviewed with educator.')
    f.h.reply = async () => ({ ok: true }); await find(f, n => n.type === 'form').props.onSubmit({ preventDefault() {} }); f.render()
    assert.equal(find(f, n => n.type === 'form'), undefined)
  } finally { f.cleanup() }
})

test('account linking excludes suspended, parent and already-linked people and requires confirmation', async () => {
  const f = fixture('EducatorAttendanceDetail', { educator: { ...educator, userId: undefined }, now, onBack() {} }, { app: { educators: [{ ...educator, userId: undefined }, { id: 'other', userId: 'taken' }] }, results: { 'users.listMembers': [{ id: 'available', name: 'Educator', email: 'staff@example.invalid', role: 'staff', accessStatus: 'active' }, { id: 'parent', role: 'parent' }, { id: 'off', role: 'staff', accessStatus: 'suspended' }, { id: 'taken', role: 'staff', accessStatus: 'active' }] } })
  try {
    const select = find(f, n => n.type === 'select')
    assert.deepEqual(nodes(select).filter(n => n.type === 'option').map(n => n.props.value), ['', 'available'])
    select.props.onChange({ target: { value: 'available' } }); f.render()
    button(f, 'Review account link').props.onClick(); f.render(); assert.equal(f.h.calls.length, 0)
    await button(f, 'Confirm account link').props.onClick(); f.render()
    assert.deepEqual(f.h.calls[0], ['educators.linkAccount', { id: educator.id, userId: 'available' }])
  } finally { f.cleanup() }
})

test('a correction that leaves the displayed times untouched preserves exact recorded punch precision', async () => {
  const startedAt = Date.parse('2026-10-26T14:30:47.123Z'), endedAt = Date.parse('2026-10-26T22:30:16.456Z')
  const f = fixture('EducatorAttendanceDetail', { educator, now, onBack() {} }, { results: { 'educators.attendance': { totalHours: 8, rooms: [], sessions: [{ id: 'existing-shift', startedAt, endedAt }] } } })
  try {
    button(f, 'Correct').props.onClick(); f.render()
    find(f, n => n.type === 'textarea').props.onChange({ target: { value: 'Reviewed original punches without changing the times.' } }); f.render()
    await find(f, n => n.type === 'form').props.onSubmit({ preventDefault() {} }); f.render()
    assert.deepEqual(f.h.calls[0], ['educators.saveShift', { id: 'existing-shift', educatorId: educator.id, startedAt, endedAt, reason: 'Reviewed original punches without changing the times.' }])
  } finally { f.cleanup() }
})

test('invalid and overlong history date ranges never start a query', () => {
  const f = fixture('EducatorAttendanceDetail', { educator, now, onBack() {} })
  try {
    input(f, 'date', 0).props.onChange({ target: { value: '2026-01-01' } }); f.render()
    assert.deepEqual(f.h.queries.at(-2), ['educators.attendance', 'skip'])
    assert.match(text(f.h.tree), /up to 93 days/)
  } finally { f.cleanup() }
})

test('manual shift times retain the daycare timezone across DST and refuse missing/repeated times', () => {
  assert.equal(attendanceDay(Date.parse('2026-10-28T01:00Z'), 'America/Vancouver'), '2026-10-27')
  assert.equal(shiftInputValue(Date.parse('2026-10-26T14:30Z'), 'America/Vancouver'), '2026-10-26T07:30')
  assert.equal(shiftInputTimestamp('2026-12-01T07:30', 'America/Vancouver'), Date.parse('2026-12-01T15:30Z'))
  assert.throws(() => shiftInputTimestamp('2026-03-08T02:30', 'America/Vancouver'), /daylight saving/)
  assert.throws(() => shiftInputTimestamp('2026-11-01T01:30', 'America/Vancouver'), /daylight saving/)
  assert.throws(() => shiftInputTimestamp('2026-02-30T07:30', 'America/Vancouver'), /valid shift/)
})

test('empty totals stay truthful and an active shift adds elapsed time only once', () => {
  assert.equal(recordedDuration(undefined), '0h 0m')
  assert.equal(educatorTodaySeconds({ todaySeconds: 1800, status: 'in', clockInAt: now - 600000 }, now), 2400)
  assert.equal(educatorTodaySeconds({ status: 'out' }, now), 0)
})
