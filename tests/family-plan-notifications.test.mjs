import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import { queryRows } from './test-db-query.mjs'

globalThis.crypto ||= webcrypto
const bundle = await build({
  stdin: { contents: "export * as notices from './convex/familyNotifications'; export {default as relay} from './api/family-plan-email.js';", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'isolated-mail-and-transport', setup(b) {
    b.onResolve({ filter: /@convex-dev\/auth\/server|\.\/_generated\/(server|api)|^nodemailer$/ }, a => ({ path: a.path, namespace: 'mock' }))
    b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents:
      path === 'nodemailer' ? 'export default {createTransport:options=>globalThis.__familyMailFactory(options)};' :
      path.includes('auth/server') ? 'export async function getAuthUserId(ctx){return ctx.uid ?? null}' :
      path.endsWith('/api') ? "const ref=path=>new Proxy(()=>{}, {get:(_,key)=>key==='path'?path:ref(path?path+'.'+key:String(key))});export const api=ref('');export const internal=ref('');" :
      'export const query=x=>x;export const mutation=x=>x;export const internalAction=x=>x;export const internalMutation=x=>x;export const internalQuery=x=>x;'
    }))
  }}],
})
const { notices: api, relay } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
let now = Date.parse('2026-10-27T20:00:00Z')
Date.now = () => now
const basePlan = fields => ({ _id: 'plan', table: 'parentPlans', facilityId: 'f', title: 'Class program', kind: 'schedule', status: 'published', room: 'Sprouts', startDate: '2026-10-27', endDate: '2026-10-31', attachments: [{ storageId: 'private-file', name: 'Program.pdf' }], ...fields })
function fixture(extra = []) {
  now = Date.parse('2026-10-27T20:00:00Z')
  const rows = new Map([
    ['f', { _id: 'f', table: 'facilities', name: 'Synthetic daycare', ownerUserId: 'owner', familyEmailMode: 'on' }],
    ['g', { _id: 'g', table: 'facilities', name: 'Other daycare', ownerUserId: 'foreign-owner' }],
    ['owner', { _id: 'owner', table: 'users', facilityId: 'f', role: 'admin' }],
    ['staff', { _id: 'staff', table: 'users', facilityId: 'f', role: 'staff', email: 'staff@example.test' }],
    ['pa', { _id: 'pa', table: 'users', facilityId: 'f', role: 'parent', email: 'a@example.test' }],
    ['pb', { _id: 'pb', table: 'users', facilityId: 'f', role: 'parent', email: 'b@example.test' }],
    ['pc', { _id: 'pc', table: 'users', facilityId: 'f', role: 'parent', email: 'other-class@example.test' }],
    ['ps', { _id: 'ps', table: 'users', facilityId: 'f', role: 'parent', accessStatus: 'suspended', email: 'suspended@example.test' }],
    ['pr', { _id: 'pr', table: 'users', facilityId: 'f', role: 'parent', email: 'released@example.test' }],
    ['foreign-parent', { _id: 'foreign-parent', table: 'users', facilityId: 'g', role: 'parent', email: 'foreign@example.test' }],
    ['a', { _id: 'a', table: 'children', facilityId: 'f', room: 'Sprouts', parentUserId: 'pa', guardianUserIds: ['pb'] }],
    ['b', { _id: 'b', table: 'children', facilityId: 'f', room: 'Meadow', parentUserId: 'pc' }],
    ['s', { _id: 's', table: 'children', facilityId: 'f', room: 'Sprouts', parentUserId: 'ps' }],
    ['r', { _id: 'r', table: 'children', facilityId: 'f', room: 'Sprouts', parentUserId: 'pr', archivedAt: now - 1 }],
    ['foreign-child', { _id: 'foreign-child', table: 'children', facilityId: 'g', room: 'Sprouts', parentUserId: 'foreign-parent' }],
    ['plan', basePlan()], ...extra.map(row => [row._id, row]),
  ])
  let seq = 0
  const ctx = { uid: 'owner', rows, scheduled: [], db: {
    get: async id => structuredClone(rows.get(id) || null),
    insert: async (table, values) => { const id = `notice${++seq}`;rows.set(id, { _id: id, table, ...structuredClone(values) });return id },
    patch: async (id, values) => { for (const [key, value] of Object.entries(values)) { if (value === undefined) delete rows.get(id)[key];else rows.get(id)[key] = structuredClone(value) } },
    query: table => queryRows(() => [...rows.values()].filter(row => row.table === table).map(row => structuredClone(row))),
  }, scheduler: { runAfter: async (delay, ref, args) => ctx.scheduled.push({ delay, ref: ref.path, args: structuredClone(args) }) } }
  ctx.runMutation = async (ref, args) => api[ref.path.split('.')[1]].handler(ctx, args)
  return ctx
}
const emailRows = c => [...c.rows.values()].filter(row => row.table === 'familyPlanEmails')
async function queue(c) { return await api.queuePlanNotifications(c, structuredClone(c.rows.get('plan'))) }
const byParent = (c, userId) => emailRows(c).find(row => row.parentUserId === userId)
function fakeResponse() {
  const state = { headers: {}, status: 0, body: null }
  const res = { setHeader(key, value) { state.headers[key] = value;return res }, status(code) { state.status = code;return res }, json(body) { state.body = body;return res } }
  return { state, res }
}
async function relayCall(body, headers = {}, method = 'POST') { const response = fakeResponse();await relay({ method, headers, body }, response.res);return response.state }
const relayEvent = fields => ({ id: 'outbox1', deliveryToken: 'leased-token', email: 'a@example.test', facility: 'Synthetic daycare', title: 'Weekly learning plan', room: 'Sprouts', startDate: '2026-10-27', endDate: '2026-10-31', kind: 'learning', ...fields })
async function withMail(fn, factory) {
  const names = ['MITTEN_OWNER_EVENTS_KEY', 'MITTEN_SMTP_PASSWORD', 'MITTEN_SMTP_USER', 'MITTEN_FROM', 'MITTEN_SMTP_HOST', 'MITTEN_SMTP_PORT']
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]))
  const previousFactory = globalThis.__familyMailFactory
  process.env.MITTEN_OWNER_EVENTS_KEY = 'unit-only-mail-key';process.env.MITTEN_SMTP_PASSWORD = 'unit-only-mail-password';process.env.MITTEN_SMTP_USER = 'onboarding@mitten.care';process.env.MITTEN_FROM = 'onboarding@mitten.care';process.env.MITTEN_SMTP_HOST = 'mail.spacemail.com';process.env.MITTEN_SMTP_PORT = '465'
  const sent = [], transports = []
  globalThis.__familyMailFactory = config => { transports.push(config);return factory ? factory(config, sent) : { sendMail: async message => { sent.push(message);return { messageId: message.messageId } } } }
  try { return await fn({ sent, transports, authorization: 'Bearer unit-only-mail-key' }) }
  finally { for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name];else process.env[name] = value }globalThis.__familyMailFactory = previousFactory }
}

test('publish queues only active guardians of active children in the shared class', async () => {
  const c = fixture();assert.deepEqual(await queue(c), { queued: 2, recorded: 0, skipped: 0 })
  assert.deepEqual(emailRows(c).map(row => row.parentUserId).sort(), ['pa', 'pb']);assert.equal(c.scheduled.length, 2)
  for (const row of emailRows(c)) { assert.equal(row.status, 'pending');assert.equal(row.attempts, 0);assert.equal('email' in row, false);assert.equal('attachments' in row, false) }
})

test('all-class shares include every active enrolled family but never suspended or released members', async () => {
  const c = fixture();c.rows.get('plan').room = ''
  assert.equal((await queue(c)).queued, 3);assert.deepEqual(emailRows(c).map(row => row.parentUserId).sort(), ['pa', 'pb', 'pc'])
})

test('draft and text-only changes send no upload alert; identical uploaded-file revision is deduplicated', async () => {
  const c = fixture();c.rows.get('plan').status = 'draft';assert.equal((await queue(c)).queued, 0)
  c.rows.get('plan').status = 'published';c.rows.get('plan').attachments = [];assert.equal((await queue(c)).queued, 0)
  c.rows.get('plan').attachments = [{ storageId: 'private-file', name: 'Program.pdf' }];await queue(c)
  c.rows.get('plan').title = 'Renamed program';c.rows.get('plan').agenda = [{ startTime: '12:30', endTime: '14:30', title: 'Rest' }]
  assert.deepEqual(await queue(c), { queued: 0, recorded: 0, skipped: 2 });assert.equal(c.scheduled.length, 2)
  c.rows.get('plan').attachments.push({ storageId: 'new-private-file', name: 'New program.pdf' });assert.equal((await queue(c)).queued, 2)
})

test('revision ignores upload ordering but changes when class, date window or actual file IDs change', () => {
  const p = basePlan({ attachments: [{ storageId: 'a' }, { storageId: 'b' }] })
  assert.equal(api.planRevision(p), api.planRevision({ ...p, attachments: [...p.attachments].reverse() }))
  for (const fields of [{ room: 'Meadow' }, { startDate: '2026-10-28' }, { endDate: '2026-11-01' }, { attachments: [{ storageId: 'new' }] }]) assert.notEqual(api.planRevision(p), api.planRevision({ ...p, ...fields }))
})

test('one upload share deduplicates normalized email aliases within its eligible parent set', async () => {
  const c = fixture([
    { _id: 'duplicate', table: 'users', facilityId: 'f', role: 'parent', email: 'A@EXAMPLE.TEST' },
    { _id: 'dupe-child', table: 'children', facilityId: 'f', room: 'Sprouts', parentUserId: 'duplicate' },
  ])
  assert.deepEqual(await queue(c), { queued: 2, recorded: 0, skipped: 1 });assert.equal(emailRows(c).length, 2)
})

test('muted QA and invalid-domain addresses record activity without scheduling or reaching HTTP mail delivery', async () => {
  const c = fixture();c.rows.get('f').familyEmailMode = 'off'
  assert.deepEqual(await queue(c), { queued: 0, recorded: 2, skipped: 0 });assert.equal(c.scheduled.length, 0)
  const d = fixture();d.rows.get('pa').email = 'qa@example.invalid';d.rows.get('pb').email = 'qa2@example.invalid'
  assert.deepEqual(await queue(d), { queued: 0, recorded: 2, skipped: 0 });assert.equal(d.scheduled.length, 0)
  const originalFetch = globalThis.fetch;let calls = 0;globalThis.fetch = async () => { calls++;throw Error('Must not reach transport') }
  try { await api.deliver.handler(d, { id: emailRows(d)[0]._id });assert.equal(calls, 0) } finally { globalThis.fetch = originalFetch }
})

test('permission and publication changes are rechecked when a queued email is claimed', async () => {
  const changes = [
    c => { c.rows.get('pa').accessStatus = 'suspended' }, c => { c.rows.get('a').archivedAt = now },
    c => { c.rows.get('a').room = 'Meadow' }, c => { c.rows.get('pa').facilityId = 'g' },
    c => { c.rows.get('plan').status = 'draft' }, c => { c.rows.get('plan').attachments = [{ storageId: 'different' }] },
    c => { c.rows.get('f').familyEmailMode = 'off' }, c => { c.rows.get('pa').email = 'qa@example.invalid' },
  ]
  for (const change of changes) {
    const c = fixture();await queue(c);const row = byParent(c, 'pa');change(c)
    assert.equal(await api.claim.handler(c, { id: row._id }), null);assert.equal(c.rows.get(row._id).status, 'skipped')
  }
  const c = fixture();await queue(c);const row = byParent(c, 'pb');c.rows.get('a').guardianUserIds = []
  assert.equal(await api.claim.handler(c, { id: row._id }), null)
})

test('lease token blocks simultaneous workers and stale completions; sent state cannot be sent again', async () => {
  const c = fixture();await queue(c);const id = byParent(c, 'pa')._id
  const first = await api.claim.handler(c, { id });assert.ok(first.deliveryToken);assert.equal(c.rows.get(id).attempts, 1)
  assert.equal(await api.claim.handler(c, { id }), null)
  await api.finish.handler(c, { id, deliveryToken: 'wrong', ok: true });assert.equal(c.rows.get(id).status, 'sending')
  now += 120001;const replacement = await api.claim.handler(c, { id });assert.notEqual(replacement.deliveryToken, first.deliveryToken)
  await api.finish.handler(c, { id, deliveryToken: first.deliveryToken, ok: true });assert.equal(c.rows.get(id).status, 'sending')
  await api.finish.handler(c, { id, deliveryToken: replacement.deliveryToken, ok: true });assert.equal(c.rows.get(id).status, 'sent')
  assert.equal(await api.claim.handler(c, { id }), null)
})

test('delivery failures retry at most three attempts and owner retry affects only current failed revisions', async () => {
  const c = fixture();await queue(c);const id = byParent(c, 'pa')._id
  for (let attempt = 1; attempt <= 3; attempt++) {
    const lease = await api.claim.handler(c, { id });assert.equal(c.rows.get(id).attempts, attempt)
    await api.finish.handler(c, { id, deliveryToken: lease.deliveryToken, ok: false })
    assert.equal(c.rows.get(id).status, attempt === 3 ? 'failed' : 'retrying')
  }
  assert.deepEqual(c.scheduled.slice(2).map(job => job.delay), [60000, 120000])
  c.rows.set('stale', { ...structuredClone(c.rows.get(id)), _id: 'stale', revision: 'older-revision' })
  assert.deepEqual(await api.retryPlan.handler(c, { planId: 'plan' }), { retried: 1 })
  assert.equal(c.rows.get(id).attempts, 0);assert.equal(c.rows.get('stale').status, 'failed')
  c.uid = 'staff';await assert.rejects(api.retryPlan.handler(c, { planId: 'plan' }), /owner\/director/)
})

test('recovery scans are bounded and do not reschedule a recent active lease', async () => {
  const c = fixture();for (let i = 0; i < 105; i++) c.rows.set('p' + i, { _id: 'p' + i, table: 'familyPlanEmails', facilityId: 'f', planId: 'plan', parentUserId: 'pa', revision: 'x', status: 'pending', attempts: 0, createdAt: now - 300000, updatedAt: now - 300000 })
  c.rows.set('active', { _id: 'active', table: 'familyPlanEmails', status: 'sending', attempts: 1, sendingAt: now, updatedAt: now })
  assert.equal((await api.recoverInterrupted.handler(c, {})).recovered, 100);assert.equal(c.scheduled.length, 100)
})

test('delivery status is director-only and returns counts for the current revision without private recipient addresses', async () => {
  const c = fixture();await queue(c)
  c.rows.set('stale', { _id: 'stale', table: 'familyPlanEmails', planId: 'plan', status: 'sent', revision: 'old' })
  const status = await api.deliveryStatus.handler(c, { planId: 'plan' });assert.equal(status.pending, 2);assert.equal(status.sent, 0)
  assert.equal(JSON.stringify(status).includes('example.test'), false)
  c.uid = 'staff';await assert.rejects(api.deliveryStatus.handler(c, { planId: 'plan' }), /owner\/director/)
  c.uid = 'owner';c.rows.get('plan').facilityId = 'g';await assert.rejects(api.deliveryStatus.handler(c, { planId: 'plan' }), /Plan not found/)
})

test('the delivery action forwards only the claimed event with its lease token and never fetches a file', async () => {
  const c = fixture();await queue(c);const id = byParent(c, 'pa')._id
  const savedKey = process.env.MITTEN_OWNER_EVENTS_KEY, savedFetch = globalThis.fetch
  process.env.MITTEN_OWNER_EVENTS_KEY = 'unit-only-outbox-key';const calls = []
  globalThis.fetch = async (url, options) => { calls.push({ url, options });return { ok: true } }
  try {
    await api.deliver.handler(c, { id });assert.equal(c.rows.get(id).status, 'sent');assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://mitten.care/api/family-plan-email');assert.equal(calls[0].options.headers.Authorization, 'Bearer unit-only-outbox-key')
    const body = JSON.parse(calls[0].options.body);assert.ok(body.deliveryToken);assert.equal(body.email, 'a@example.test');assert.equal('attachments' in body, false);assert.equal('storageId' in body, false)
    await api.deliver.handler(c, { id });assert.equal(calls.length, 1)
  } finally { globalThis.fetch = savedFetch;if (savedKey === undefined) delete process.env.MITTEN_OWNER_EVENTS_KEY;else process.env.MITTEN_OWNER_EVENTS_KEY = savedKey }
})

test('public or malformed mail relay requests fail before creating an SMTP transport', async () => {
  await withMail(async ({ transports, authorization }) => {
    assert.equal((await relayCall(relayEvent())).status, 401)
    assert.equal((await relayCall(relayEvent(), { authorization: 'Bearer wrong' })).status, 401)
    assert.equal((await relayCall(relayEvent(), {}, 'GET')).status, 405)
    for (const fields of [{ email: 'a@example.test\r\nBcc: other@example.test' }, { email: 'qa@example.invalid' }, { facility: 'Bad\nHeader' }, { title: 'x'.repeat(161) }, { startDate: 'bad-date' }, { kind: 'arbitrary' }]) assert.equal((await relayCall(relayEvent(fields), { authorization })).status, 400)
    assert.equal(transports.length, 0)
  })
})

test('authenticated SMTP relay sends a stable-ID login notice without uploaded files, tokens or child details', async () => {
  await withMail(async ({ transports, sent, authorization }) => {
    const reply = await relayCall(relayEvent(), { authorization });assert.equal(reply.status, 200);assert.equal(reply.headers['Cache-Control'], 'no-store')
    assert.equal(transports[0].host, 'mail.spacemail.com');assert.equal(transports[0].secure, true);assert.equal(transports[0].auth.user, 'onboarding@mitten.care')
    assert.equal(sent.length, 1);assert.equal(sent[0].messageId, '<family-plan-outbox1@mitten.care>');assert.equal(sent[0].to, 'a@example.test')
    assert.match(sent[0].text, /https:\/\/mitten\.care\/app\?open=calendar/);assert.equal('attachments' in sent[0], false)
    assert.equal(JSON.stringify(sent[0]).includes('leased-token'), false);assert.equal(JSON.stringify(sent[0]).includes('private-file'), false)
  })
})

test('SMTP failures and missing configuration return a bounded error without leaking private server data', async () => {
  await withMail(async ({ authorization, sent }) => {
    const reply = await relayCall(relayEvent(), { authorization });assert.equal(reply.status, 502)
    assert.equal(JSON.stringify(reply.body).includes('smtp-private-detail'), false);assert.equal(JSON.stringify(reply.body).includes('a@example.test'), false);assert.equal(sent.length, 0)
    delete process.env.MITTEN_SMTP_PASSWORD;assert.equal((await relayCall(relayEvent(), { authorization })).status, 503)
  }, () => ({ sendMail: async () => { throw Error('smtp-private-detail') } }))
})
