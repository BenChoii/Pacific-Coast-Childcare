import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// Exercise the actual handlers and membership helpers. Only Convex transport,
// authentication lookup and notification delivery are replaced; no network or
// live database is used.
const bundled = await build({
  stdin: {
    contents: "export * as activities from './convex/activities'; export * as photos from './convex/photos'; export * as roster from './convex/roster'; export * as children from './convex/children';",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts',
  },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'mock-convex-transport', setup(b) {
    b.onResolve({ filter: /@convex-dev\/auth\/server|\.\/_generated\/server|\.\/notifications$/ }, args => ({ path: args.path, namespace: 'test-mock' }))
    b.onLoad({ filter: /.*/, namespace: 'test-mock' }, ({ path }) => ({ contents:
      path.includes('auth/server') ? 'export async function getAuthUserId(ctx) { return ctx.uid ?? null }' :
      path.includes('notifications') ? 'export async function recordOwnerEvent() { throw new Error("Unexpected notification in privacy test") }' :
      'export const query = x => x; export const mutation = x => x; export const internalMutation = x => x; export const internalQuery = x => x;'
    }))
  } }],
})
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

function fixture(extra = []) {
  const rows = new Map([
    ['facility', { _id: 'facility', table: 'facilities', slug: 'pcca', ownerUserId: 'owner' }],
    ['owner', { _id: 'owner', table: 'users', role: 'admin', facilityId: 'facility' }],
    ['parent', { _id: 'parent', table: 'users', role: 'parent', facilityId: 'facility' }],
    ['otherParent', { _id: 'otherParent', table: 'users', role: 'parent', facilityId: 'facility' }],
    ['mine', { _id: 'mine', table: 'children', name: 'My Child', parentUserId: 'parent', facilityId: 'facility', room: 'Preschool' }],
    ['other', { _id: 'other', table: 'children', name: 'Other Child', parentUserId: 'otherParent', facilityId: 'facility', room: 'Toddlers' }],
    ...extra.map(row => [row._id, row]),
  ])
  const ctx = { uid: 'parent', rows, writes: [], storage: { getUrl: async id => `mock-storage:${id}` }, db: {
    async get(id) { return rows.get(id) ?? null },
    async patch(id, values) { ctx.writes.push({ id, values }); Object.assign(rows.get(id), values) },
    async insert(table, values) { ctx.writes.push({ table, values }); return 'new-record' },
    query(table) {
      let selected = [...rows.values()].filter(row => row.table === table)
      return { withIndex(_name, callback) {
        const q = { eq(key, value) { selected = selected.filter(row => row[key] === value); return q } }
        callback(q); return this
      }, order() { return this }, async collect() { return selected }, async first() { return selected[0] ?? null } }
    },
  } }
  return ctx
}
const activity = (id, fields = {}) => ({ _id: id, table: 'activities', facilityId: 'facility', type: 'note', title: id, detail: id, ...fields })
const photo = (id, fields = {}) => ({ _id: id, table: 'photos', facilityId: 'facility', room: 'Preschool', audience: 'all', likes: 0, ...fields })
const attendance = (id, childId, name) => ({ _id: id, table: 'roster', facilityId: 'facility', childId, name, status: 'checked-in' })

test('parents receive only their own targeted activity logs; unscoped legacy and other-family logs are withheld', async () => {
  const ctx = fixture([
    activity('own-id', { childId: 'mine', childName: 'My Child' }),
    activity('own-legacy-name', { childName: 'My Child' }),
    activity('other-id', { childId: 'other', childName: 'Other Child' }),
    activity('unscoped-legacy'),
    activity('other-tenant', { facilityId: 'another', childId: 'mine' }),
  ])
  assert.deepEqual((await api.activities.list.handler(ctx, {})).map(row => row.id), ['own-id', 'own-legacy-name'])
  ctx.uid = 'owner'
  assert.ok((await api.activities.list.handler(ctx, {})).some(row => row.id === 'unscoped-legacy'), 'history remains available to the director')
})

test('ambiguous same-name legacy logs are withheld, while an explicit own-child ID remains visible', async () => {
  const ctx = fixture([
    { _id: 'other', table: 'children', name: 'My Child', parentUserId: 'otherParent', facilityId: 'facility', room: 'Toddlers' },
    activity('ambiguous-name', { childName: 'My Child' }),
    activity('own-id', { childId: 'mine', childName: 'My Child' }),
    activity('other-id', { childId: 'other', childName: 'My Child' }),
    attendance('legacy-ambiguous-roster', undefined, 'My Child'),
    attendance('own-explicit-roster', 'mine', 'My Child'),
    attendance('other-explicit-roster', 'other', 'My Child'),
  ])
  assert.deepEqual((await api.activities.list.handler(ctx, {})).map(row => row.id), ['own-id'])
  assert.deepEqual((await api.roster.list.handler(ctx, {})).map(row => row.id), ['own-explicit-roster'])
})

test('released child logs and attendance stay hidden when another sibling keeps the parent active', async () => {
  const ctx = fixture([
    { _id: 'released', table: 'children', name: 'Released Child', parentUserId: 'parent', facilityId: 'facility', room: 'Toddlers', archivedAt: 123 },
    activity('active-log', { childId: 'mine' }),
    activity('released-log', { childId: 'released' }),
    activity('released-legacy-log', { childName: 'Released Child' }),
    attendance('active-roster', 'mine', 'My Child'),
    attendance('released-roster', 'released', 'Released Child'),
    attendance('other-roster', 'other', 'Other Child'),
  ])
  assert.deepEqual((await api.activities.list.handler(ctx, {})).map(row => row.id), ['active-log'])
  assert.deepEqual((await api.roster.list.handler(ctx, {})).map(row => row.id), ['active-roster'])
})

test('class and family photos follow active child room membership, never a released child or another family', async () => {
  const ctx = fixture([
    { _id: 'released', table: 'children', name: 'Released Child', parentUserId: 'parent', facilityId: 'facility', room: 'Toddlers', archivedAt: 123 },
    photo('own-class'), photo('all-rooms', { room: 'All rooms' }),
    photo('other-class', { room: 'Toddlers' }),
    photo('own-family', { audience: 'family', childId: 'mine' }),
    photo('other-family', { audience: 'family', childId: 'other' }),
    photo('released-family', { audience: 'family', childId: 'released' }),
  ])
  assert.deepEqual((await api.photos.list.handler(ctx, {})).map(row => row.id), ['own-class', 'all-rooms', 'own-family'])
  ctx.rows.get('mine').room = 'Unassigned'
  assert.deepEqual((await api.photos.list.handler(ctx, {})).map(row => row.id), ['all-rooms', 'own-family'])
})

test('a parent cannot directly write attendance/activity/photo records or claim another child', async () => {
  const ctx = fixture([
    attendance('other-roster', 'other', 'Other Child'),
    photo('other-family', { audience: 'family', childId: 'other' }),
    photo('other-class', { room: 'Toddlers' }),
  ])
  await assert.rejects(api.roster.toggle.handler(ctx, { id: 'other-roster', time: '10:00 AM' }), /educator|director/i)
  await assert.rejects(api.roster.setStatus.handler(ctx, { id: 'other-roster', status: 'checked-out', time: '10:00 AM' }), /educator|director/i)
  await assert.rejects(api.activities.add.handler(ctx, { childId: 'other', type: 'note', title: 'Change', detail: 'Change', by: 'Parent', time: '10:00 AM' }), /educator|director/i)
  await assert.rejects(api.photos.add.handler(ctx, { room: 'Toddlers', caption: 'Change' }), /educator|director/i)
  await assert.rejects(api.children.claim.handler(ctx, { id: 'other' }), /invitation linked to your child/i)
  await assert.rejects(api.photos.like.handler(ctx, { id: 'other-family' }), /not your family photo/i)
  await assert.rejects(api.photos.like.handler(ctx, { id: 'other-class' }), /not shared with your class/i)
  assert.deepEqual(ctx.writes, [])
})

test('suspended existing sessions receive no activity, photos, or attendance', async () => {
  const ctx = fixture([activity('own-log', { childId: 'mine' }), photo('own-class'), attendance('own-roster', 'mine', 'My Child')])
  ctx.rows.get('parent').accessStatus = 'suspended'
  for (const handler of [api.activities.list, api.photos.list, api.roster.list]) assert.deepEqual(await handler.handler(ctx, {}), [])
})
