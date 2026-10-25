import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// Run the real handlers with only transport/auth registration mocked. No live
// Convex deployment, credentials, messages, database or billing are touched.
const bundled = await build({
  stdin: { contents: "export * as access from './convex/lib'; export * as kids from './convex/children'; export * as users from './convex/users';", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'mock-convex-transport', setup(b) {
    b.onResolve({ filter: /@convex-dev\/auth\/server|\.\/_generated\/server|\.\/notifications$/ }, args => ({ path: args.path, namespace: 'test-mock' }))
    b.onLoad({ filter: /.*/, namespace: 'test-mock' }, ({ path }) => ({ contents:
      path.includes('auth/server') ? 'export async function getAuthUserId(ctx) { return ctx.uid ?? null }' :
      path.includes('notifications') ? 'export async function recordOwnerEvent(ctx,event) { ctx.events.push(event) }' :
      'export const query = x => x; export const mutation = x => x; export const internalMutation = x => x; export const internalQuery = x => x;'
    }))
  } }],
})
const { access, kids, users } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

function fixture({ actor = 'owner', siblings = false, suspended = false } = {}) {
  const rows = new Map([
    ['facility', { _id: 'facility', table: 'facilities', slug: 'pcca', name: 'PCCA', ownerUserId: 'owner' }],
    ['demo', { _id: 'demo', table: 'facilities', slug: 'demo', isDemo: true }],
    ['otherFacility', { _id: 'otherFacility', table: 'facilities', slug: 'elsewhere' }],
    ['owner', { _id: 'owner', table: 'users', name: 'Owner', role: 'admin', facilityId: 'facility' }],
    ['parent', { _id: 'parent', table: 'users', name: 'Parent', role: 'parent', facilityId: 'facility', ...(suspended ? { accessStatus: 'suspended', accessReason: 'director' } : {}) }],
    ['otherParent', { _id: 'otherParent', table: 'users', name: 'Other parent', role: 'parent', facilityId: 'facility' }],
    ['staff', { _id: 'staff', table: 'users', name: 'Educator', role: 'staff', facilityId: 'facility' }],
    ['outsider', { _id: 'outsider', table: 'users', role: 'admin', facilityId: 'otherFacility' }],
    ['unassigned', { _id: 'unassigned', table: 'users', role: 'parent' }],
    ['child', { _id: 'child', table: 'children', name: 'Child A', room: 'Preschool', parentUserId: 'parent', facilityId: 'facility', order: 1 }],
    ['otherChild', { _id: 'otherChild', table: 'children', name: 'Other child', room: 'Preschool', parentUserId: 'otherParent', facilityId: 'facility', order: 3 }],
    ['invite', { _id: 'invite', table: 'invites', childId: 'child', facilityId: 'facility', used: false }],
  ])
  if (siblings) rows.set('sibling', { _id: 'sibling', table: 'children', name: 'Child B', room: 'Preschool', parentUserId: 'parent', facilityId: 'facility', order: 2 })
  const ctx = { uid: actor, rows, events: [], storage: { getUrl: async () => 'image-url' }, db: {
    async get(id) { return rows.get(id) ?? null },
    async patch(id, patch) { const row = rows.get(id); assert.ok(row); for (const [k,v] of Object.entries(patch)) { if (v === undefined) delete row[k]; else row[k] = v } },
    query(table) {
      let selected = [...rows.values()].filter(row => row.table === table)
      return { withIndex(_name, callback) {
        const q = { eq(key, value) { selected = selected.filter(row => row[key] === value); return q } }
        callback(q); return this
      }, async collect() { return selected }, async first() { return selected[0] ?? null } }
    },
  } }
  return ctx
}

test('parents and cross-facility admins cannot release children', async () => {
  const parent = fixture({ actor: 'parent' })
  await assert.rejects(kids.release.handler(parent, { id: 'child' }), /owner|director/i)
  assert.equal(parent.rows.get('child').archivedAt, undefined)
  const outsider = fixture({ actor: 'outsider' })
  await assert.rejects(kids.release.handler(outsider, { id: 'child' }), /not found/i)
})

test('releasing the last child archives the enrolment and denies a stale parent session', async () => {
  const ctx = fixture()
  await kids.release.handler(ctx, { id: 'child' })
  assert.ok(ctx.rows.get('child').archivedAt)
  assert.equal(ctx.rows.get('invite').used, true)
  assert.equal(ctx.rows.get('parent').accessStatus, 'suspended')
  assert.ok(ctx.rows.has('child'), 'care record is retained')
  ctx.uid = 'parent'
  assert.equal(await access.resolveFacilityId(ctx), null)
  await assert.rejects(access.requireFacility(ctx), /access has ended/i)
  assert.deepEqual(await kids.list.handler(ctx, {}), [])
})

test('a sibling keeps family access and released children disappear from the parent roster', async () => {
  const ctx = fixture({ siblings: true })
  await kids.release.handler(ctx, { id: 'child' })
  ctx.uid = 'parent'
  assert.equal(await access.resolveFacilityId(ctx), 'facility')
  const visible = await kids.list.handler(ctx, {})
  assert.deepEqual(visible.map(c => c.id), ['sibling'])
})

test('manual suspension survives child release and restoration', async () => {
  const ctx = fixture({ suspended: true })
  await kids.release.handler(ctx, { id: 'child' })
  assert.equal(ctx.rows.get('parent').accessReason, 'director')
  await kids.restore.handler(ctx, { id: 'child' })
  assert.equal(ctx.rows.get('parent').accessStatus, 'suspended')
})

test('restoring any sibling restores automatically suspended family access', async () => {
  const ctx = fixture({ siblings: true })
  await kids.release.handler(ctx, { id: 'child' })
  await kids.release.handler(ctx, { id: 'sibling' })
  assert.equal(ctx.rows.get('parent').accessStatus, 'suspended')
  await kids.restore.handler(ctx, { id: 'child' })
  assert.equal(ctx.rows.get('parent').accessStatus, 'active')
  assert.equal(ctx.rows.get('child').archivedAt, undefined)
})

test('signed-in accounts with missing or suspended membership never fall back to demo data', async () => {
  const ctx = fixture({ actor: 'unassigned' })
  assert.equal(await access.resolveFacilityId(ctx), null)
  ctx.uid = 'parent'; ctx.rows.get('parent').accessStatus = 'suspended'
  assert.equal(await access.resolveFacilityId(ctx), null)
  ctx.uid = null
  assert.equal(await access.resolveFacilityId(ctx), 'demo')
})

test('owner/self protection and cross-facility membership checks are enforced on the server', async () => {
  const ctx = fixture()
  await assert.rejects(users.setMemberAccess.handler(ctx, { id: 'owner', status: 'suspended' }), /own account|owner/i)
  await assert.rejects(users.setMemberAccess.handler(ctx, { id: 'outsider', status: 'suspended' }), /not found/i)
  await users.setMemberAccess.handler(ctx, { id: 'staff', status: 'suspended' })
  ctx.uid = 'staff'
  await assert.rejects(access.requireStaff(ctx), /access has ended/i)
})

test('class removal preserves enrolment/access, while attendance days accept only valid weekdays', async () => {
  const ctx = fixture()
  await kids.assignRoom.handler(ctx, { id: 'child', room: '' })
  assert.equal(ctx.rows.get('child').room, 'Unassigned')
  assert.equal(ctx.rows.get('child').archivedAt, undefined)
  ctx.uid = 'parent'; assert.equal(await access.resolveFacilityId(ctx), 'facility')
  ctx.uid = 'owner'
  await kids.setEnrollmentDays.handler(ctx, { id: 'child', days: ['Fri', 'Mon', 'Mon'] })
  assert.deepEqual(ctx.rows.get('child').enrollmentDays, ['Mon', 'Fri'])
  await assert.rejects(kids.setEnrollmentDays.handler(ctx, { id: 'child', days: ['Holiday'] }), /valid weekdays/i)
})
