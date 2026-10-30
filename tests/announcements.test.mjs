import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import { queryRows } from './test-db-query.mjs'

globalThis.crypto ||= webcrypto
const bundle = await build({
  stdin: { contents: "export * as notices from './convex/announcements'; export {default as relay} from './api/announcement-email.js';", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'isolated-mail-and-transport', setup(b) {
    b.onResolve({ filter: /@convex-dev\/auth\/server|\.\/_generated\/(server|api)|^nodemailer$/ }, a => ({ path: a.path, namespace: 'mock' }))
    b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents:
      path === 'nodemailer' ? 'export default {createTransport:options=>globalThis.__announcementMailFactory(options)};' :
      path.includes('auth/server') ? 'export async function getAuthUserId(ctx){return ctx.uid ?? null}' :
      path.endsWith('/api') ? "const ref=path=>new Proxy(()=>{}, {get:(_,key)=>key==='path'?path:ref(path?path+'.'+key:String(key))});export const api=ref('');export const internal=ref('');" :
      'export const query=x=>x;export const mutation=x=>x;export const internalAction=x=>x;export const internalMutation=x=>x;export const internalQuery=x=>x;'
    }))
  }}],
})
const { notices: api, relay } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
let now = Date.parse('2026-10-30T16:00:00Z')
Date.now = () => now

function fixture(uid = 'owner') {
  now = Date.parse('2026-10-30T16:00:00Z')
  const rows = new Map([
    ['f', { _id: 'f', table: 'facilities', name: 'Synthetic daycare', ownerUserId: 'owner', familyEmailMode: 'on' }],
    ['g', { _id: 'g', table: 'facilities', name: 'Other daycare', ownerUserId: 'foreign-owner' }],
    ['owner', { _id: 'owner', table: 'users', facilityId: 'f', role: 'admin', name: 'Director', email: 'owner@example.test' }],
    ['staff', { _id: 'staff', table: 'users', facilityId: 'f', role: 'staff', email: 'staff@example.test' }],
    ['staff-off', { _id: 'staff-off', table: 'users', facilityId: 'f', role: 'staff', accessStatus: 'suspended', email: 'gone@example.test' }],
    ['pa', { _id: 'pa', table: 'users', facilityId: 'f', role: 'parent', email: 'a@example.test' }],
    ['pb', { _id: 'pb', table: 'users', facilityId: 'f', role: 'parent', email: 'A@example.test' }],
    ['ps', { _id: 'ps', table: 'users', facilityId: 'f', role: 'parent', accessStatus: 'suspended', email: 'suspended@example.test' }],
    ['pr', { _id: 'pr', table: 'users', facilityId: 'f', role: 'parent', email: 'released@example.test' }],
    ['foreign-parent', { _id: 'foreign-parent', table: 'users', facilityId: 'g', role: 'parent', email: 'foreign@example.test' }],
    ['a', { _id: 'a', table: 'children', facilityId: 'f', room: 'Sprouts', parentUserId: 'pa', guardianUserIds: ['pb'] }],
    ['s', { _id: 's', table: 'children', facilityId: 'f', room: 'Sprouts', parentUserId: 'ps' }],
    ['r', { _id: 'r', table: 'children', facilityId: 'f', room: 'Sprouts', parentUserId: 'pr', archivedAt: now - 1 }],
    ['foreign-child', { _id: 'foreign-child', table: 'children', facilityId: 'g', parentUserId: 'foreign-parent' }],
  ])
  let seq = 0
  const ctx = { uid, rows, scheduled: [], db: {
    get: async id => structuredClone(rows.get(id) || null),
    insert: async (table, values) => { const id = `row${++seq}`;now += 1;rows.set(id, { _id: id, _creationTime: now, table, ...structuredClone(values) });return id },
    patch: async (id, values) => { for (const [key, value] of Object.entries(values)) { if (value === undefined) delete rows.get(id)[key];else rows.get(id)[key] = structuredClone(value) } },
    delete: async id => { rows.delete(id) },
    query: table => queryRows(() => [...rows.values()].filter(row => row.table === table).map(row => structuredClone(row))),
  }, scheduler: { runAfter: async (delay, ref, args) => ctx.scheduled.push({ delay, ref: ref.path, args: structuredClone(args) }) } }
  ctx.runMutation = async (ref, args) => api[ref.path.split('.')[1]].handler(ctx, args)
  return ctx
}
const emails = c => [...c.rows.values()].filter(row => row.table === 'announcementEmails')
const as = (c, uid) => ({ ...c, uid })

test('only the director can post', async () => {
  for (const uid of ['staff', 'pa']) await assert.rejects(api.post.handler(fixture(uid), { title: 'Hi', body: 'Body', audience: 'everyone', email: false }), /owner\/director/)
})

test('everyone announcement reaches active educators and linked parents, once per address', async () => {
  const c = fixture()
  const result = await api.post.handler(c, { title: 'Pajama day', body: 'Friday is pajama day.', audience: 'everyone', email: true })
  assert.deepEqual(emails(c).map(row => row.userId).sort(), ['pa', 'staff'])
  assert.equal(result.queued, 2)
  assert.equal(c.scheduled.filter(job => job.ref === 'announcements.deliver').length, 2)
  for (const uid of ['staff', 'pa', 'pb']) {
    const listed = await api.list.handler(as(c, uid), {})
    assert.equal(listed.items.length, 1); assert.equal(listed.unread, 1); assert.equal(listed.canPost, false)
  }
  const own = await api.list.handler(c, {})
  assert.equal(own.canPost, true); assert.equal(own.unread, 0)
})

test('audiences separate families and educators; suspended, released and foreign accounts see nothing', async () => {
  const c = fixture()
  await api.post.handler(c, { title: 'Staff meeting', body: 'Tuesday 6 PM.', audience: 'staff', email: true })
  await api.post.handler(c, { title: 'Family BBQ', body: 'Saturday.', audience: 'families', email: false })
  assert.deepEqual(emails(c).map(row => row.userId), ['staff'])
  assert.deepEqual((await api.list.handler(as(c, 'staff'), {})).items.map(i => i.title), ['Staff meeting'])
  assert.deepEqual((await api.list.handler(as(c, 'pa'), {})).items.map(i => i.title), ['Family BBQ'])
  for (const uid of ['ps', 'pr', 'staff-off', 'foreign-parent']) assert.equal((await api.list.handler(as(c, uid), {})).items.length, 0)
})

test('family email mode off records parent copies without sending', async () => {
  const c = fixture(); c.rows.get('f').familyEmailMode = 'off'
  const result = await api.post.handler(c, { title: 'Closure', body: 'Snow day.', audience: 'everyone', email: true })
  assert.equal(result.queued, 1); assert.equal(result.recorded, 1)
  assert.equal(emails(c).find(row => row.userId === 'pa').status, 'recorded')
})

test('markSeen clears the unread count', async () => {
  const c = fixture()
  await api.post.handler(c, { title: 'Hello', body: 'Welcome back.', audience: 'everyone', email: false })
  now += 1000
  await api.markSeen.handler(as(c, 'staff'), {})
  assert.equal((await api.list.handler(as(c, 'staff'), {})).unread, 0)
})

test('delivery rechecks membership and stops after deletion or release', async () => {
  const c = fixture()
  const { id } = await api.post.handler(c, { title: 'Update', body: 'Text', audience: 'everyone', email: true })
  const [first, second] = emails(c)
  c.rows.get(first.userId).accessStatus = 'suspended'
  assert.equal(await api.claim.handler(c, { id: first._id }), null)
  assert.equal(c.rows.get(first._id).status, 'skipped')
  const claimed = await api.claim.handler(c, { id: second._id })
  assert.equal(claimed.title, 'Update'); assert.equal(claimed.body, 'Text')
  await api.finish.handler(c, { id: second._id, deliveryToken: claimed.deliveryToken, ok: true })
  assert.equal(c.rows.get(second._id).status, 'sent')
  await api.remove.handler(c, { id })
  c.rows.get(second._id).status = 'pending'
  assert.equal(await api.claim.handler(c, { id: second._id }), null)
})

function fakeResponse() {
  const state = { headers: {}, status: 0, body: null }
  return { state, setHeader: (k, v) => { state.headers[k] = v }, status(code) { state.status = code; return this }, json(body) { state.body = body; return this } }
}
test('relay requires the private key and sends the announcement text', async () => {
  process.env.MITTEN_OWNER_EVENTS_KEY = 'k'; process.env.MITTEN_SMTP_PASSWORD = 'p'
  const sent = []
  globalThis.__announcementMailFactory = () => ({ sendMail: async mail => { sent.push(mail) } })
  const event = { id: 'abc123', email: 'parent@example.test', facility: 'Synthetic daycare', title: 'Pajama day', body: 'Friday.\nBring a blanket.', author: 'Director' }
  let res = fakeResponse(); await relay({ method: 'POST', headers: {}, body: event }, res); assert.equal(res.state.status, 401)
  res = fakeResponse(); await relay({ method: 'POST', headers: { authorization: 'Bearer k' }, body: { ...event, title: 'a\nb' } }, res); assert.equal(res.state.status, 400)
  res = fakeResponse(); await relay({ method: 'POST', headers: { authorization: 'Bearer k' }, body: event }, res)
  assert.equal(res.state.status, 200)
  assert.equal(sent[0].subject, 'Synthetic daycare: Pajama day')
  assert.match(sent[0].text, /Bring a blanket\./); assert.match(sent[0].text, /open=messages/)
})
