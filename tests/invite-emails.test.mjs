import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import { queryRows } from './test-db-query.mjs'

globalThis.crypto ||= webcrypto
const bundle = await build({
  stdin: { contents: "export * as invites from './convex/inviteEmails'; export * as facilities from './convex/facilities'; export {default as relay} from './api/invite-email.js';", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'isolated-mail-and-transport', setup(b) {
    b.onResolve({ filter: /@convex-dev\/auth\/server|\.\/_generated\/(server|api)|^nodemailer$/ }, a => ({ path: a.path, namespace: 'mock' }))
    b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents:
      path === 'nodemailer' ? 'export default {createTransport:options=>globalThis.__inviteMailFactory(options)};' :
      path.includes('auth/server') ? 'export async function getAuthUserId(ctx){return ctx.uid ?? null}' :
      path.endsWith('/api') ? "const ref=path=>new Proxy(()=>{}, {get:(_,key)=>key==='path'?path:ref(path?path+'.'+key:String(key))});export const api=ref('');export const internal=ref('');" :
      'export const query=x=>x;export const mutation=x=>x;export const action=x=>x;export const internalAction=x=>x;export const internalMutation=x=>x;export const internalQuery=x=>x;'
    }))
  }}],
})
const { invites: api, facilities, relay } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
let now = Date.parse('2026-11-01T16:00:00Z')
Date.now = () => now

function fixture(uid = 'owner') {
  now = Date.parse('2026-11-01T16:00:00Z')
  const rows = new Map([
    ['f', { _id: 'f', table: 'facilities', name: 'Synthetic daycare', slug: 'synthetic', ownerUserId: 'owner' }],
    ['demo', { _id: 'demo', table: 'facilities', name: 'Demo', slug: 'demo', ownerUserId: 'demo-owner', isDemo: true }],
    ['owner', { _id: 'owner', table: 'users', facilityId: 'f', role: 'admin', email: 'owner@mitten.care' }],
    ['demo-owner', { _id: 'demo-owner', table: 'users', facilityId: 'demo', role: 'admin' }],
    ['pa', { _id: 'pa', table: 'users', facilityId: 'f', role: 'parent', email: 'pa@mitten.care' }],
    ['c', { _id: 'c', table: 'children', facilityId: 'f', first: 'Weston', name: 'Weston W' }],
    ['dc', { _id: 'dc', table: 'children', facilityId: 'demo', first: 'Demo', name: 'Demo child' }],
  ])
  let seq = 0
  const ctx = { uid, rows, scheduled: [], db: {
    get: async id => structuredClone(rows.get(id) || null),
    insert: async (table, values) => { const id = `row${++seq}`;now += 1;rows.set(id, { _id: id, _creationTime: now, table, ...structuredClone(values) });return id },
    patch: async (id, values) => { for (const [key, value] of Object.entries(values)) { if (value === undefined) delete rows.get(id)[key];else rows.get(id)[key] = structuredClone(value) } },
    delete: async id => { rows.delete(id) },
    query: table => queryRows(() => [...rows.values()].filter(row => row.table === table).map(row => structuredClone(row))),
  }, scheduler: { runAfter: async (delay, ref, args) => ctx.scheduled.push({ delay, ref: ref.path, args: structuredClone(args) }) } }
  return ctx
}
const inviteRows = c => [...c.rows.values()].filter(row => row.table === 'invites')

test('an addressed parent invitation is queued for email; an unaddressed one is not', async () => {
  const c = fixture()
  const plain = await facilities.generateInvite.handler(c, { role: 'parent', childId: 'c' })
  assert.equal(plain.emailQueued, false)
  const sent = await facilities.generateInvite.handler(c, { role: 'parent', childId: 'c', email: ' Test@Mitten.care ' })
  assert.equal(sent.emailQueued, true)
  const row = inviteRows(c).find(r => r.token === sent.token)
  assert.equal(row.email, 'test@mitten.care'); assert.equal(row.emailStatus, 'pending')
  assert.deepEqual(c.scheduled.map(j => j.ref), ['inviteEmails.deliver'])
  const listed = await facilities.listInvites.handler(c, {})
  assert.equal(listed.find(i => i.token === sent.token).emailStatus, 'pending')
})

test('test addresses and the demo daycare never reach the relay', async () => {
  const c = fixture()
  const r = await facilities.generateInvite.handler(c, { role: 'parent', childId: 'c', email: 'someone@example.com' })
  assert.equal(r.emailQueued, false)
  assert.equal(inviteRows(c)[0].emailStatus, 'skipped')
  const d = fixture('demo-owner')
  assert.equal((await facilities.generateInvite.handler(d, { role: 'parent', childId: 'dc', email: 'test@mitten.care' })).emailQueued, false)
  assert.equal(c.scheduled.length + d.scheduled.length, 0)
})

test('delivery claims once, sends the join token and records success', async () => {
  const c = fixture()
  const { token } = await facilities.generateInvite.handler(c, { role: 'parent', childId: 'c', email: 'test@mitten.care' })
  const id = inviteRows(c)[0]._id
  const claimed = await api.claim.handler(c, { id })
  assert.equal(claimed.token, token); assert.equal(claimed.childName, 'Weston'); assert.equal(claimed.facility, 'Synthetic daycare')
  assert.equal(await api.claim.handler(c, { id }), null, 'a second claim inside the lease is refused')
  await api.finish.handler(c, { id, deliveryToken: claimed.deliveryToken, ok: true })
  assert.equal(c.rows.get(id).emailStatus, 'sent'); assert.ok(c.rows.get(id).emailedAt)
})

test('failed delivery retries, then gives up; revoked or used invites are skipped', async () => {
  const c = fixture()
  await facilities.generateInvite.handler(c, { role: 'parent', childId: 'c', email: 'test@mitten.care' })
  const id = inviteRows(c)[0]._id
  for (let i = 0; i < 3; i++) {
    const claimed = await api.claim.handler(c, { id })
    await api.finish.handler(c, { id, deliveryToken: claimed.deliveryToken, ok: false })
  }
  assert.equal(c.rows.get(id).emailStatus, 'failed')
  await facilities.revokeInvite.handler(c, { id })
  await assert.rejects(api.resend.handler(c, { id }), /no longer open/)
  c.rows.get(id).used = false; c.rows.get(id).emailStatus = 'pending'; c.rows.get(id).emailAttempts = 0
  c.rows.get('c').archivedAt = now
  assert.equal(await api.claim.handler(c, { id }), null)
  assert.equal(c.rows.get(id).emailStatus, 'skipped')
})

test('only the director can resend, and resend requeues an open invite', async () => {
  const c = fixture()
  await facilities.generateInvite.handler(c, { role: 'parent', childId: 'c', email: 'test@mitten.care' })
  const id = inviteRows(c)[0]._id
  await assert.rejects(api.resend.handler({ ...c, uid: 'pa' }, { id }), /owner\/director/)
  c.rows.get(id).emailStatus = 'failed'
  assert.deepEqual(await api.resend.handler(c, { id }), { queued: true })
  assert.equal(c.rows.get(id).emailStatus, 'pending'); assert.equal(c.rows.get(id).emailAttempts, 0)
})

function fakeResponse() {
  const state = { headers: {}, status: 0, body: null }
  return { state, setHeader: (k, v) => { state.headers[k] = v }, status(code) { state.status = code; return this }, json(body) { state.body = body; return this } }
}
test('relay requires the private key and emails the join link', async () => {
  process.env.MITTEN_OWNER_EVENTS_KEY = 'k'; process.env.MITTEN_SMTP_PASSWORD = 'p'
  const sent = []
  globalThis.__inviteMailFactory = () => ({ sendMail: async mail => { sent.push(mail) } })
  const event = { id: 'abc123', email: 'test@mitten.care', facility: 'Synthetic daycare', role: 'parent', token: 'a'.repeat(32), childName: 'Weston', expiresAt: now + 7 * 86400_000 }
  let res = fakeResponse(); await relay({ method: 'POST', headers: {}, body: event }, res); assert.equal(res.state.status, 401)
  res = fakeResponse(); await relay({ method: 'POST', headers: { authorization: 'Bearer k' }, body: { ...event, token: '../x' } }, res); assert.equal(res.state.status, 400)
  res = fakeResponse(); await relay({ method: 'POST', headers: { authorization: 'Bearer k' }, body: event }, res)
  assert.equal(res.state.status, 200)
  assert.equal(sent[0].to, 'test@mitten.care')
  assert.equal(sent[0].subject, 'Synthetic daycare invited you to Mitten')
  assert.match(sent[0].text, new RegExp(`https://mitten\\.care/join\\?t=${'a'.repeat(32)}`))
  assert.match(sent[0].text, /Weston's day/)
})
