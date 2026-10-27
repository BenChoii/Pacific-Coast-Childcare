import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dashboardProgram } from '../src/lib/familyProgram.js'

const date = '2026-10-27'
const image = { storageId: 'class-program-photo', name: 'Daily program.jpg', mimeType: 'image/jpeg' }
const plan = (extra = {}) => ({ id: 'class-schedule', title: 'Our class program', room: 'Sprouts', kind: 'schedule', status: 'published', startDate: '2026-10-26', endDate: '2026-10-30', attachments: [image], ...extra })

test('program selection prioritizes a current class schedule, then global schedule, then learning files', () => {
  const classSchedule = plan(), globalSchedule = plan({ id: 'global-schedule', room: '' }), classLearning = plan({ id: 'class-learning', kind: 'learning' }), globalLearning = plan({ id: 'global-learning', room: '', kind: 'learning' })
  const options = { date, room: 'Sprouts' }
  assert.equal(dashboardProgram([globalLearning, classLearning, globalSchedule, classSchedule], options)?.id, classSchedule.id)
  assert.equal(dashboardProgram([classLearning, globalLearning, globalSchedule], options)?.id, globalSchedule.id)
  assert.equal(dashboardProgram([globalLearning, classLearning], options)?.id, classLearning.id)
  assert.equal(dashboardProgram([globalLearning], options)?.id, globalLearning.id)
  const legacySchedule = plan({ id: 'legacy', kind: undefined, agenda: [{ title: 'Play', startTime: '09:00', endTime: '10:00' }] })
  assert.equal(dashboardProgram([classLearning, legacySchedule], options)?.id, legacySchedule.id)
})

test('draft, future, expired, other-class, impossible dates and attachment-free plans are not photo spotlight candidates', () => {
  const excluded = [plan({ status: 'draft' }), plan({ startDate: '2026-10-28' }), plan({ endDate: '2026-10-26' }), plan({ room: 'Explorers' }), plan({ startDate: '2026-02-30' }), plan({ attachments: [] }), plan({ attachments: undefined })]
  assert.equal(dashboardProgram(excluded, { date, room: 'Sprouts' }), null)
  assert.equal(dashboardProgram([plan()], { date: '2026-02-30', room: 'Sprouts' }), null)
  const firstDay = plan({ startDate: date, endDate: date })
  assert.equal(dashboardProgram([firstDay], { date, room: 'Sprouts' }), firstDay)
})

test('selection is deterministic and leaves the server plan order intact', () => {
  const older = plan({ id: 'older', publishedAt: 100 }), newer = plan({ id: 'newer', publishedAt: 200 }), plans = [older, newer]
  assert.equal(dashboardProgram(plans, { date, room: 'Sprouts' }), newer)
  assert.deepEqual(plans, [older, newer])
})

const root = fileURLToPath(new URL('../', import.meta.url))
const built = await build({ entryPoints: [root + 'src/components/ParentScheduleSpotlight.jsx'], bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', plugins: [{ name: 'spotlight-ui-boundaries', setup(b) {
  b.onResolve({ filter: /^react$|^react\/jsx-runtime$|^lucide-react$|\/ui\.jsx$|\/ClassSchedule\.jsx$|\/PlanAttachments\.jsx$|\/useProtectedMedia\.js$/ }, args => ({ path: args.path, namespace: 'mock' }))
  b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents:
    path === 'react' ? `const slot=init=>{const h=globalThis.__spotlightUI,i=h.cursor++;if(!(i in h.slots))h.slots[i]=init();return h.slots[i]};export const useState=init=>{const s=slot(()=>({value:typeof init==='function'?init():init}));return[s.value,next=>{const v=typeof next==='function'?next(s.value):next;if(!Object.is(v,s.value)){s.value=v;globalThis.__spotlightUI.dirty=true}}]},useRef=value=>slot(()=>({current:value??globalThis.__spotlightUI.dialog})),useEffect=(fn,deps)=>{const s=slot(()=>({}));if(!s.deps||deps.some((v,i)=>!Object.is(v,s.deps[i])))globalThis.__spotlightUI.effects.push(()=>{s.cleanup?.();s.cleanup=fn()});s.deps=deps};` :
    path === 'react/jsx-runtime' ? 'export const jsx=(type,props,key)=>({type,props,key}),jsxs=jsx,Fragment="fragment";' :
    path === 'lucide-react' ? 'export const CalendarDays="calendar-icon",Expand="expand-icon",X="close-icon";' :
    path.includes('ClassSchedule') ? 'export const ClassScheduleNow="class-schedule-now";' :
    path.includes('PlanAttachments') ? 'export const PlanAttachments="plan-attachments";' :
    path.includes('useProtectedMedia') ? `export const useProtectedMedia=rows=>{const h=globalThis.__spotlightUI;h.mediaRequests.push(rows);return rows.map(row=>({...row,...h.media[row.imageId]}))};` : 'export const Card="card";'
  }))
} }] })
const UI = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
function fixture(component = UI.default, initialProps = {}) {
  const saved = globalThis.__spotlightUI, originalNow = Date.now, interval = globalThis.setInterval, clear = globalThis.clearInterval, win = globalThis.window, doc = globalThis.document
  Date.now = () => Date.parse('2026-10-28T01:30:00Z') // Still October 27 at daycare.
  globalThis.setInterval = () => 0; globalThis.clearInterval = () => {}
  const listeners = { addEventListener() {}, removeEventListener() {} }; globalThis.window = listeners; globalThis.document = listeners
  const h = globalThis.__spotlightUI = { cursor: 0, slots: [], effects: [], dirty: false, mediaRequests: [], media: { [image.storageId]: { imageUrl: 'blob:current-private-program' } }, dialog: { showModal() { h.open = true }, close() { h.open = false } } }
  let props = { child: { id: 'child-one', room: 'Sprouts' }, plans: [plan()], timeZone: 'America/Vancouver', ...initialProps }
  const render = changes => { props = { ...props, ...changes }; globalThis.__spotlightUI = h; let tries = 0; do { h.cursor = 0; h.effects = []; h.dirty = false; h.tree = component(props); for (const effect of h.effects) effect(); assert.ok(++tries < 10) } while (h.dirty); return h.tree }
  const cleanup = () => { for (const slot of h.slots) slot?.cleanup?.(); Date.now = originalNow; globalThis.setInterval = interval; globalThis.clearInterval = clear; globalThis.window = win; globalThis.document = doc; globalThis.__spotlightUI = saved }
  render(); return { h, render, cleanup }
}
function nodes(tree) { if (tree == null || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...Object.values(tree.props || {}).flatMap(nodes)] }
function text(tree) { if (tree == null) return ''; if (typeof tree === 'string' || typeof tree === 'number') return String(tree); if (Array.isArray(tree)) return tree.map(text).join(' '); return text(tree.props?.children) }
const find = (f, predicate) => nodes(f.h.tree).find(predicate)

test('a program photo is front and centre without requiring manual time blocks, using daycare’s current date', () => {
  const f = fixture(UI.default, { plans: [plan({ startDate: date, endDate: date, agenda: [] })] })
  try {
    const photoNode = find(f, node => node.type?.name === 'ProgramPhoto')
    assert.equal(photoNode?.props.attachment.storageId, image.storageId)
    assert.match(text(f.h.tree), /Our class program/)
    assert.ok(find(f, node => node.type === 'class-schedule-now'))
  } finally { f.cleanup() }
})

test('switching children remounts protected photo state and removes another class’s program', () => {
  const f = fixture()
  try {
    const initial = find(f, node => node.type?.name === 'ProgramPhoto')
    assert.equal(initial.key, 'child-one:class-program-photo')
    const otherImage = { ...image, storageId: 'explorers-photo' }
    f.render({ child: { id: 'child-two', room: 'Explorers' }, plans: [plan(), plan({ id: 'explorers', title: 'Explorers program', room: 'Explorers', attachments: [otherImage] })] })
    const next = find(f, node => node.type?.name === 'ProgramPhoto')
    assert.equal(next.key, 'child-two:explorers-photo'); assert.equal(next.props.attachment.storageId, otherImage.storageId)
    assert.doesNotMatch(text(f.h.tree), /Our class program/)
    f.render({ plans: undefined })
    assert.equal(find(f, node => node.type?.name === 'ProgramPhoto'), undefined)
    assert.match(text(f.h.tree), /Loading your child’s class program/)
  } finally { f.cleanup() }
})

test('PDF-only and timed-only schedules have useful fallbacks', () => {
  const f = fixture(UI.default, { plans: [plan({ attachments: [{ storageId: 'pdf', name: 'Program.pdf', mimeType: 'application/pdf' }] })] })
  try {
    assert.equal(find(f, node => node.type === 'plan-attachments')?.props.attachments[0].storageId, 'pdf')
    assert.equal(find(f, node => node.type?.name === 'ProgramPhoto'), undefined)
    f.render({ plans: [plan({ attachments: [], agenda: [{ title: 'Stories', startTime: '10:00', endTime: '11:00' }] })] })
    assert.equal(find(f, node => node.type === 'class-schedule-now')?.props.plans[0].agenda[0].title, 'Stories')
    assert.equal(find(f, node => node.type?.name === 'ProgramPhoto'), undefined)
  } finally { f.cleanup() }
})

test('protected program photos preserve proportions and open a full-size view', () => {
  const parent = fixture(), photoNode = find(parent, node => node.type?.name === 'ProgramPhoto'), ProgramPhoto = photoNode.type
  parent.cleanup()
  const f = fixture(ProgramPhoto, photoNode.props)
  try {
    assert.deepEqual(f.h.mediaRequests[0], [{ imageId: image.storageId, imageUrl: null }])
    const photo = find(f, node => node.type === 'img')
    assert.match(photo.props.className, /object-contain/); assert.doesNotMatch(photo.props.className, /object-cover/)
    find(f, node => node.type === 'button' && node.props['aria-label'] === 'Open Our class program at full size').props.onClick(); f.render()
    assert.equal(f.h.open, true)
    assert.ok(find(f, node => node.type === 'a' && node.props.href === 'blob:current-private-program'))
    assert.equal(find(f, node => node.type === 'img' && node.props.className === 'h-auto w-full')?.props.src, 'blob:current-private-program')
    find(f, node => node.type === 'button' && node.props['aria-label'] === 'Close full-size program').props.onClick(); f.render()
    assert.equal(f.h.open, false)
  } finally { f.cleanup() }
})

test('a revoked or failed program photo displays a retry action instead of a stale image', () => {
  const parent = fixture(), photoNode = find(parent, node => node.type?.name === 'ProgramPhoto'), ProgramPhoto = photoNode.type
  parent.cleanup()
  const f = fixture(ProgramPhoto, photoNode.props)
  try {
    let retried = false
    f.h.media[image.storageId] = { imageUrl: null, imageError: true, retryImage: () => { retried = true } }; f.render()
    assert.equal(find(f, node => node.type === 'img'), undefined)
    assert.match(text(f.h.tree), /photo could not load/)
    find(f, node => node.type === 'button' && text(node).trim() === 'Try again').props.onClick()
    assert.equal(retried, true)
  } finally { f.cleanup() }
})
