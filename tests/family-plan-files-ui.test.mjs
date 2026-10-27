import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// Execute the actual upload and preview components using isolated React hook,
// upload/download and fetch boundaries. No live upload, session or mail call.
const root = fileURLToPath(new URL('../', import.meta.url))
const icons = ['Download', 'FileText', 'ImagePlus', 'Loader2', 'X']
const output = await build({ entryPoints: [root + 'src/components/PlanAttachments.jsx'], bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env.VITE_CONVEX_URL': '"https://unit.convex.cloud"' }, plugins: [{ name: 'file-ui-boundaries', setup(b) {
  b.onResolve({ filter: /^react$|^react\/jsx-runtime$|^convex\/react$|^@convex-dev\/auth\/react$|^lucide-react$|_generated\/api$|\/lib\/files\.js$/ }, args => ({ path: args.path, namespace: 'fixture' }))
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
    path === 'react' ? `const slot=init=>{const h=globalThis.__familyFileHooks,i=h.cursor++;if(!(i in h.slots))h.slots[i]=init();return h.slots[i]};export const useState=init=>{const s=slot(()=>({value:typeof init==='function'?init():init}));return[s.value,next=>{const value=typeof next==='function'?next(s.value):next;if(!Object.is(value,s.value)){s.value=value;globalThis.__familyFileHooks.dirty=true}}]},useRef=value=>slot(()=>({current:value})),useEffect=(fn,deps)=>{const s=slot(()=>({}));if(!s.deps||deps.some((v,i)=>!Object.is(v,s.deps[i])))globalThis.__familyFileHooks.effects.push(()=>{s.cleanup?.();s.cleanup=fn()});s.deps=deps};` :
    path === 'react/jsx-runtime' ? 'export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment="fragment";' :
    path === 'convex/react' ? 'export const useAction=()=>globalThis.__familyFileHooks.upload;' :
    path === '@convex-dev/auth/react' ? 'export const useAuthToken=()=>globalThis.__familyFileHooks.token;' :
    path === 'lucide-react' ? `export const ${icons.map(name => `${name}='icon-${name}'`).join(',')};` :
    path.endsWith('/api') ? 'export const api={files:{uploadFile:"upload"}};' :
    'export const fileToBase64=async file=>file.payload||"synthetic-base64";export const usePrivateDownload=()=>globalThis.__familyFileHooks.download;'
  }))
} }] })
const components = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
const attachment = { storageId: 'pdf-file', name: 'Cubs schedule.pdf', mimeType: 'application/pdf', size: 180 }
function fixture(component, props = {}) {
  const previous = globalThis.__familyFileHooks
  const h = globalThis.__familyFileHooks = { cursor: 0, slots: [], effects: [], dirty: false, token: 'synthetic-session', attachments: props.attachments || [], calls: [], busyChanges: [],
    upload: async fields => { h.calls.push(fields); return { storageId: `uploaded-${h.calls.length}` } },
    download: async (...args) => { h.downloads.push(args) }, downloads: [],
  }
  const render = () => {
    globalThis.__familyFileHooks = h
    let iterations = 0
    do {
      h.dirty = false; h.cursor = 0; h.effects = []
      const editor = { attachments: h.attachments, onChange: rows => { h.attachments = rows }, onBusyChange: value => h.busyChanges.push(value) }
      h.tree = component({ ...editor, ...props })
      for (const effect of h.effects) effect()
      assert.ok(++iterations < 10, 'Effects must settle')
    } while (h.dirty)
    return h.tree
  }
  const cleanup = () => { for (const slot of h.slots) slot?.cleanup?.(); globalThis.__familyFileHooks = previous }
  render(); return { h, render, cleanup, props }
}
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...Object.values(tree.props || {}).flatMap(nodes)]
const text = tree => tree == null ? '' : typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children)
const find = (f, predicate) => nodes(f.h.tree).find(predicate)
const button = (f, label) => find(f, node => node.type === 'button' && text(node).trim() === label)
const input = f => find(f, node => node.type === 'input' && node.props.type === 'file')

test('attachment upload retains completed files and a readable failure when a later upload fails', async () => {
  const f = fixture(components.PlanAttachmentEditor)
  try {
    let calls = 0
    f.h.upload = async fields => { f.h.calls.push(fields); if (++calls === 2) throw new Error('Connection interrupted. Choose the remaining file again.'); return { storageId: 'completed' } }
    f.render()
    const control = { files: [{ name: 'Schedule.pdf', type: 'application/pdf', size: 80, payload: 'pdf' }, { name: 'Learning.png', type: 'image/png', size: 90, payload: 'png' }], value: 'selected' }
    await input(f).props.onChange({ currentTarget: control }); f.render()
    assert.equal(f.h.attachments.length, 1)
    assert.equal(f.h.attachments[0].storageId, 'completed')
    assert.equal(f.h.calls[0].purpose, 'learning-plan')
    assert.equal(f.h.calls[0].mimeType, 'application/pdf')
    assert.match(text(f.h.tree), /Connection interrupted/)
    assert.match(text(f.h.tree), /Schedule.pdf/)
    assert.deepEqual(f.h.busyChanges, [true, false])
    assert.equal(control.value, '')
  } finally { f.cleanup() }
})

test('the editor validates count/type/size before any upload and preserves existing attachments', async () => {
  const f = fixture(components.PlanAttachmentEditor, { attachments: Array.from({ length: 4 }, (_, i) => ({ ...attachment, storageId: `saved-${i}` })) })
  try {
    for (const files of [[{ type: 'image/png', size: 10 }, { type: 'image/png', size: 10 }], [{ type: 'text/html', size: 10 }], [{ type: 'application/pdf', size: 8 * 1024 * 1024 + 1 }]]) {
      await input(f).props.onChange({ currentTarget: { files, value: 'selected' } }); f.render()
      assert.equal(f.h.calls.length, 0)
      assert.equal(f.h.attachments.length, 4)
      assert.ok(find(f, node => node.props?.role === 'alert'))
    }
  } finally { f.cleanup() }
})

test('private PDF previews use an authenticated object URL and revoke it on session change', async () => {
  const original = { fetch: globalThis.fetch, create: URL.createObjectURL, revoke: URL.revokeObjectURL }
  const calls = [], revoked = []
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, blob: async () => new Blob(['%PDF-test'], { type: 'application/pdf' }) } }
  URL.createObjectURL = () => 'blob:private-pdf'; URL.revokeObjectURL = url => revoked.push(url)
  const f = fixture(components.PrivatePlanAttachment, { attachment })
  try {
    await button(f, 'Preview file').props.onClick(); f.render()
    assert.equal(calls.length, 1)
    assert.equal(calls[0].options.headers.Authorization, 'Bearer synthetic-session')
    assert.equal(calls[0].url, 'https://unit.convex.site/files/private?storageId=pdf-file')
    const frame = find(f, node => node.type === 'iframe')
    assert.equal(frame.props.src, 'blob:private-pdf')
    assert.equal(frame.props.title, 'Preview Cubs schedule.pdf')
    await button(f, 'Download file').props.onClick(); f.render()
    assert.deepEqual(f.h.downloads, [['pdf-file', 'Cubs schedule.pdf']])
    f.h.token = 'different-session'; f.render()
    assert.equal(find(f, node => node.type === 'iframe'), undefined)
    assert.deepEqual(revoked, ['blob:private-pdf'])
  } finally { f.cleanup(); globalThis.fetch = original.fetch; URL.createObjectURL = original.create; URL.revokeObjectURL = original.revoke }
})

test('a denied preview offers an error without creating an iframe or public file URL', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return { ok: false, status: 403 } }
  const f = fixture(components.PrivatePlanAttachment, { attachment })
  try {
    await button(f, 'Preview file').props.onClick(); f.render()
    assert.equal(calls, 1); assert.match(text(f.h.tree), /access has changed/)
    assert.equal(find(f, node => node.type === 'iframe' || node.type === 'img'), undefined)
    f.h.token = null; f.render()
    await button(f, 'Preview file').props.onClick(); f.render()
    assert.equal(calls, 1); assert.match(text(f.h.tree), /sign in again/)
  } finally { f.cleanup(); globalThis.fetch = oldFetch }
})
