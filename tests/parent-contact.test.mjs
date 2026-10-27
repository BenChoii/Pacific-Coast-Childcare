import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const adapters = {
  server: 'export const query=x=>x,mutation=x=>x,internalMutation=x=>x;',
  values: 'export const v=new Proxy({},{get:()=>()=>({})});',
  auth: 'export const getAuthUserId=async ctx=>ctx.uid;',
  notifications: 'export const recordOwnerEvent=async(ctx,event)=>ctx.events.push(event);',
  files: 'export const assertOwnedUpload=async()=>{};',
}
const backendBuild = await build({ entryPoints: [root + 'convex/facilities.ts'], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'parent-contact-boundaries', setup(b) {
  for (const [filter, path] of [[/^\.\/_generated\/server$/, 'server'], [/^convex\/values$/, 'values'], [/^@convex-dev\/auth\/server$/, 'auth'], [/^\.\/notifications$/, 'notifications'], [/^\.\/files$/, 'files']]) b.onResolve({ filter }, () => ({ path, namespace: 'mock' }))
  b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: adapters[path] }))
} }] })
// Keep the real membership/guardian checks from convex/lib.ts. Only transport,
// mail notifications and file storage are replaced, with no external calls.
const backend = await import(`data:text/javascript;base64,${Buffer.from(backendBuild.outputFiles[0].text).toString('base64')}`)
function context(uid = 'parent') {
  const rows = {
    facilities: [{ _id: 'facility', ownerUserId: 'owner', name: 'Example Childcare', billingEmail: 'billing@example.com' }, { _id: 'other-facility', ownerUserId: 'other-owner', name: 'Other Daycare' }],
    users: [{ _id: 'owner', name: 'Owner Example', email: 'owner@example.com', facilityId: 'facility', role: 'admin' }, { _id: 'parent', name: 'Parent', facilityId: 'facility', role: 'parent' }, { _id: 'staff', facilityId: 'facility', role: 'staff' }],
    children: [{ _id: 'child', facilityId: 'facility', parentUserId: 'parent' }],
  }
  const get = id => Object.values(rows).flat().find(row => row._id === id)
  const ctx = { uid, rows, events: [], db: {
    get: async id => get(id) ? structuredClone(get(id)) : null,
    patch: async (id, data) => { Object.assign(get(id), data) },
    query: table => { const filters = []; const q = { withIndex(_name, callback) { const index = { eq(key, value) { filters.push([key, value]); return index } }; callback(index); return q }, collect: async () => structuredClone((rows[table] || []).filter(row => filters.every(([key, value]) => row[key] === value))), first: async () => (await q.collect())[0] || null }; return q },
  } }
  return ctx
}

test('parent contact is scoped to an active child in the signed-in parent’s facility', async () => {
  const ctx = context()
  assert.equal((await backend.parentContact.handler(ctx, {})).email, 'owner@example.com')
  ctx.rows.children[0].guardianUserIds = ['parent']; delete ctx.rows.children[0].parentUserId
  assert.equal((await backend.parentContact.handler(ctx, {})).name, 'Owner Example')
  ctx.rows.children[0].facilityId = 'other-facility'
  await assert.rejects(backend.parentContact.handler(ctx, {}), /active child/)
  ctx.rows.children[0].facilityId = 'facility'; ctx.rows.children[0].archivedAt = Date.now()
  await assert.rejects(backend.parentContact.handler(ctx, {}), /active child/)
  ctx.rows.children = []
  await assert.rejects(backend.parentContact.handler(ctx, {}), /active child/)
})

test('anonymous, suspended and educator accounts cannot read a parent’s contact endpoint', async () => {
  for (const uid of [null, 'staff', 'parent']) {
    const ctx = context(uid)
    if (uid === 'parent') ctx.rows.users[1].accessStatus = 'suspended'
    await assert.rejects(backend.parentContact.handler(ctx, {}), /authenticated|Families and directors|access has ended/)
  }
})

test('contact prefers configured details and owner email before billing fallback', async () => {
  const ctx = context(), facility = ctx.rows.facilities[0]
  facility.parentContactEmail = 'director@example.com'; facility.parentContactName = 'Director Contact'
  let result = await backend.parentContact.handler(ctx, {})
  assert.equal(result.email, 'director@example.com'); assert.equal(result.name, 'Director Contact')
  assert.equal(result.configuredEmail, undefined, 'parent response excludes setup-only metadata')
  delete facility.parentContactEmail; delete facility.parentContactName
  result = await backend.parentContact.handler(ctx, {}); assert.equal(result.email, 'owner@example.com')
  ctx.rows.users[0].email = ''
  result = await backend.parentContact.handler(ctx, {}); assert.equal(result.email, 'billing@example.com')
  ctx.rows.users[0].email = 'invalid owner email'
  result = await backend.parentContact.handler(ctx, {}); assert.equal(result.email, null, 'invalid owner email does not silently select a different inbox')
})

test('only directors configure the parent contact, including during initial setup', async () => {
  const ctx = context('owner'); ctx.rows.children = []
  assert.equal((await backend.parentContact.handler(ctx, {})).fallbackEmail, 'owner@example.com')
  await backend.setParentContact.handler(ctx, { email: '  daycare@example.com ', name: '  Director   Example  ' })
  assert.equal(ctx.rows.facilities[0].parentContactEmail, 'daycare@example.com')
  assert.equal(ctx.rows.facilities[0].parentContactName, 'Director Example')
  assert.equal(ctx.events[0].type, 'parent_contact_updated')
  await assert.rejects(backend.setParentContact.handler(ctx, { email: 'bad\n@example.com' }), /valid parent contact/)
  await assert.rejects(backend.setParentContact.handler(ctx, { name: 'x'.repeat(121) }), /120/)
  await backend.setParentContact.handler(ctx, { email: '', name: '' })
  assert.equal(ctx.rows.facilities[0].parentContactEmail, undefined)
  ctx.uid = 'parent'
  await assert.rejects(backend.setParentContact.handler(ctx, { email: 'other@example.com' }), /owner\/director/)
})

const uiBuild = await build({ entryPoints: [root + 'src/components/ParentContact.jsx'], bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', plugins: [{ name: 'contact-ui-hooks', setup(b) {
  b.onResolve({ filter: /^react$|^react\/jsx-runtime$|^convex\/react$|^lucide-react$|\/convex\/_generated\/api$|\/context\/AppContext\.jsx$|\/ui\.jsx$/ }, args => ({ path: args.path, namespace: 'hook' }))
  b.onLoad({ filter: /.*/, namespace: 'hook' }, ({ path }) => ({ contents:
    path === 'react' ? `const slot=init=>{const h=globalThis.__contactUI,i=h.cursor++;if(!(i in h.slots))h.slots[i]=init();return h.slots[i]};export const useState=init=>{const s=slot(()=>({value:typeof init==='function'?init():init}));return[s.value,next=>{const v=typeof next==='function'?next(s.value):next;if(!Object.is(v,s.value)){s.value=v;globalThis.__contactUI.dirty=true}}]},useEffect=(fn,deps)=>{const s=slot(()=>({}));if(!s.deps||deps.some((v,i)=>!Object.is(v,s.deps[i])))globalThis.__contactUI.effects.push(fn);s.deps=deps};` :
    path === 'react/jsx-runtime' ? 'export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment="fragment";' :
    path === 'convex/react' ? `export const useQuery=(ref,args)=>{const h=globalThis.__contactUI;h.queries.push([ref,args]);return args==='skip'?undefined:h.contact},useMutation=ref=>async args=>{const h=globalThis.__contactUI;h.calls.push([ref,args]);return h.reply(ref,args)};` :
    path === 'lucide-react' ? 'export const Mail="mail-icon",Copy="copy-icon",Check="check-icon";' :
    path.endsWith('/api') ? 'export const api=new Proxy({},{get:(_,a)=>new Proxy({},{get:(_,b)=>a+"."+b})});' :
    path.includes('AppContext') ? 'export const useApp=()=>globalThis.__contactUI.app;' : 'export const Card="card";'
  }))
} }] })
const UI = await import(`data:text/javascript;base64,${Buffer.from(uiBuild.outputFiles[0].text).toString('base64')}`)
function fixture(component = 'ParentContact', options = {}) {
  const previous = globalThis.__contactUI, navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const h = globalThis.__contactUI = { cursor: 0, slots: [], effects: [], dirty: false, queries: [], calls: [], contact: { email: 'owner@example.com', name: 'Owner Example', facilityName: 'Example Childcare', configuredEmail: '', configuredName: '', fallbackEmail: 'owner@example.com' }, app: { isAuthenticated: true, facility: { id: 'facility', isDemo: false }, viewer: { role: 'parent', hasActiveChildren: true } }, reply: async () => ({ ok: true }), ...options }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async email => { h.copied = email } } } })
  const render = () => { globalThis.__contactUI = h; let tries = 0; do { h.cursor = 0; h.effects = []; h.dirty = false; h.tree = UI[component]({ compact: true }); for (const effect of h.effects) effect(); assert.ok(++tries < 10) } while (h.dirty); return h.tree }
  const cleanup = () => { globalThis.__contactUI = previous; if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor); else delete globalThis.navigator }
  render(); return { h, render, cleanup }
}
function nodes(tree) { if (tree == null || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...Object.values(tree.props || {}).flatMap(nodes)] }
function text(tree) { if (tree == null) return ''; if (typeof tree === 'string' || typeof tree === 'number') return String(tree); if (Array.isArray(tree)) return tree.map(text).join(' '); return text(tree.props?.children) }
const find = (f, predicate) => nodes(f.h.tree).find(predicate)
const button = (f, label) => find(f, node => node.type === 'button' && text(node).trim() === label)

test('parent contact opens a generic email without child data and acknowledges only successful copying', async () => {
  const f = fixture()
  try {
    const link = find(f, node => node.type === 'a')
    assert.equal(text(link).trim(), 'Email Owner')
    const mailto = new URL(link.props.href)
    assert.equal(mailto.protocol, 'mailto:')
    assert.equal(mailto.searchParams.get('subject'), 'Parent concern - Example Childcare')
    assert.equal(mailto.searchParams.has('body'), false)
    assert.match(text(f.h.tree), /Opens your mail app/)
    let resolve
    navigator.clipboard.writeText = email => new Promise(done => { f.h.pendingEmail = email; resolve = done })
    const pending = button(f, 'Copy email').props.onClick(); f.render()
    assert.equal(button(f, 'Email copied'), undefined)
    resolve(); await pending; f.render()
    assert.equal(f.h.pendingEmail, 'owner@example.com'); assert.ok(button(f, 'Email copied'))
    navigator.clipboard.writeText = async () => { throw Error('denied') }
    await button(f, 'Email copied').props.onClick(); f.render()
    assert.equal(button(f, 'Email copied'), undefined)
    assert.match(text(f.h.tree), /Copy was unavailable.*owner@example.com/)
  } finally { f.cleanup() }
})

test('unlinked parents do not start a contact query', () => {
  const f = fixture('ParentContact', { app: { isAuthenticated: true, viewer: { role: 'parent', hasActiveChildren: false }, facility: { isDemo: false } } })
  try { assert.equal(f.h.tree, null); assert.deepEqual(f.h.queries[0], ['facilities.parentContact', 'skip']) } finally { f.cleanup() }
})

test('contact settings retain edits on failure and mark saved only after acknowledgement', async () => {
  const f = fixture('ParentContactSettings', { app: { isAuthenticated: true, viewer: { role: 'admin' }, facility: { isDemo: false } } })
  try {
    find(f, node => node.type === 'input' && node.props.type === 'email').props.onChange({ target: { value: 'contact@example.com' } }); f.render()
    f.h.reply = async () => { throw { data: 'Please retry later.' } }
    await find(f, node => node.type === 'form').props.onSubmit({ preventDefault() {} }); f.render()
    assert.equal(find(f, node => node.type === 'input' && node.props.type === 'email').props.value, 'contact@example.com')
    assert.match(text(f.h.tree), /Please retry later/)
    assert.doesNotMatch(text(f.h.tree), /Parent contact saved/)
    f.h.reply = async () => ({ ok: true })
    await find(f, node => node.type === 'form').props.onSubmit({ preventDefault() {} }); f.render()
    assert.match(text(f.h.tree), /Parent contact saved/)
    assert.deepEqual(f.h.calls.at(-1), ['facilities.setParentContact', { email: 'contact@example.com', name: '' }])
  } finally { f.cleanup() }
})
