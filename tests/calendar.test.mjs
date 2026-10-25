import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import path from 'node:path'

// Exercise the actual server handlers with an isolated in-memory database.
// The adapters replace only Convex transport, auth boundary and email delivery;
// no backend deployment, network request or production mutation is performed.
async function handlers(filename) {
  const modules = {
    server: 'export const query=x=>x; export const mutation=x=>x; export const internalMutation=x=>x;',
    values: 'const value=(...a)=>({}); export const v=new Proxy({}, {get:()=>value});',
    auth: 'export const getAuthUserId=async ctx=>ctx.uid;',
    notifications: 'export const recordOwnerEvent=async(ctx,event)=>{ctx.events.push(event)};',
    lib: `export const resolveFacilityId=async ctx=>ctx.blocked?null:ctx.fid;
      export const requireAdmin=async ctx=>{if(ctx.role!=='admin'||ctx.blocked)throw Error('Directors only');return {facilityId:ctx.fid,userId:ctx.uid,user:{role:ctx.role}}};
      export const requireStaff=async ctx=>{if(!['admin','staff'].includes(ctx.role)||ctx.blocked)throw Error('Staff only');return {facilityId:ctx.fid,userId:ctx.uid,user:{role:ctx.role}}};`,
  }
  const result = await build({ entryPoints: [path.resolve(filename)], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'convex-unit-boundaries', setup(b) {
    b.onResolve({ filter: /^\.\/_generated\/server$/ }, () => ({ path: 'server', namespace: 'fixture' }))
    b.onResolve({ filter: /^convex\/values$/ }, () => ({ path: 'values', namespace: 'fixture' }))
    b.onResolve({ filter: /^@convex-dev\/auth\/server$/ }, () => ({ path: 'auth', namespace: 'fixture' }))
    b.onResolve({ filter: /^\.\/lib$/ }, () => ({ path: 'lib', namespace: 'fixture' }))
    b.onResolve({ filter: /^\.\/notifications$/ }, () => ({ path: 'notifications', namespace: 'fixture' }))
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
  } }] })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}
const calendar = await handlers('convex/calendar.ts')
const lessons = await handlers('convex/lessons.ts')
const PCCA = 'md71dthy9rnqejp2msa0sjd0sx88whxq'
function context({ role = 'admin', fid = 'facility-a', uid = role === 'parent' ? 'parent-a' : 'owner-a', rows = {}, blocked = false } = {}) {
  const tables = Object.fromEntries(Object.entries(rows).map(([name, docs]) => [name, docs.map(d => ({ ...d }))]))
  tables.users ||= []; if (!tables.users.some(u => u._id === uid)) tables.users.push({ _id: uid, role, facilityId: fid })
  let seq = 0
  const find = id => Object.values(tables).flat().find(d => d._id === id)
  const ctx = { role, fid, uid, blocked, tables, events: [], db: {
    get: async id => find(id) ? structuredClone(find(id)) : null,
    insert: async (table, data) => { const _id = `${table}-${++seq}`; (tables[table] ||= []).push({ ...data, _id }); return _id },
    patch: async (id, data) => { const d = find(id); assert.ok(d, `Missing ${id}`); Object.assign(d, data) },
    delete: async id => { for (const name of Object.keys(tables)) tables[name] = tables[name].filter(d => d._id !== id) },
    query: table => { let filters = []; const q = { withIndex(_name, callback) { const matcher = { eq(key, value) { filters.push([key, value]); return matcher } }; callback(matcher); return q }, async collect() { return (tables[table] || []).filter(d => filters.every(([key, value]) => d[key] === value)) }, async first() { return (await q.collect())[0] || null } }; return q },
  } }
  return ctx
}
const kids = [
  { _id: 'kid-a', facilityId: 'facility-a', parentUserId: 'parent-a', room: 'Cubs' },
  { _id: 'kid-b', facilityId: 'facility-a', parentUserId: 'parent-b', room: 'Owls' },
  { _id: 'kid-archived', facilityId: 'facility-a', parentUserId: 'parent-a', room: 'Owls', archivedAt: 1 },
]
const event = (id, room, facilityId = 'facility-a') => ({ _id: id, facilityId, room, title: id, kind: 'closure', startDate: '2026-12-25', endDate: '2026-12-25', description: '' })
test('calendar is scoped to active own child and its room, never other tenant or archived sibling', async () => {
  const ctx = context({ role: 'parent', rows: { children: kids, calendarEvents: [event('all'), event('cubs', 'Cubs'), event('owls', 'Owls'), event('other-tenant', undefined, 'facility-b')] } })
  assert.deepEqual((await calendar.list.handler(ctx, { childId: 'kid-a' })).map(e => e.id), ['all', 'cubs'])
  assert.deepEqual(await calendar.list.handler(ctx, { childId: 'kid-b' }), [])
  assert.deepEqual(await calendar.list.handler(ctx, { childId: 'kid-archived' }), [])
  assert.deepEqual((await calendar.list.handler(ctx, {})).map(e => e.id), ['all', 'cubs'])
  ctx.blocked = true; assert.deepEqual(await calendar.list.handler(ctx, {}), [])
})
test('calendar rejects parent mutations, impossible/reversed dates and cross-tenant updates', async () => {
  const args = { title: 'Closed', startDate: '2026-12-24', endDate: '2026-12-25', kind: 'closure', description: '' }
  await assert.rejects(calendar.save.handler(context({ role: 'parent' }), args), /Directors only/)
  await assert.rejects(calendar.save.handler(context(), { ...args, startDate: '2026-02-30' }), /valid date range/)
  await assert.rejects(calendar.save.handler(context(), { ...args, startDate: '2026-12-26' }), /valid date range/)
  const ctx = context({ rows: { calendarEvents: [event('foreign', undefined, 'facility-b')] } })
  await assert.rejects(calendar.save.handler(ctx, { ...args, id: 'foreign' }), /not found/)
  await assert.rejects(calendar.remove.handler(ctx, { id: 'foreign' }), /not found/)
  assert.equal(ctx.events.length, 0)
})
test('calendar writes and removals each record an owner activity', async () => {
  const ctx = context()
  const id = await calendar.save.handler(ctx, { title: 'Closure', startDate: '2026-12-25', endDate: '2026-12-25', kind: 'closure', description: '' })
  assert.equal(ctx.tables.calendarEvents[0].title, 'Closure')
  assert.equal(ctx.events[0].type, 'calendar.updated')
  await calendar.remove.handler(ctx, { id }); assert.equal(ctx.events[1].type, 'calendar.removed')
})
test('PCCA calendar import is exact, idempotent, preserves owner edits and does not invent term breaks', async () => {
  const ctx = context({ fid: PCCA, rows: { facilities: [{ _id: PCCA, slug: 'pacific-coast-childcare-academy', name: 'Pacific Coast Childcare Academy', ownerUserId: 'kiran' }] } })
  assert.deepEqual(await calendar.importPccaCalendar.handler(ctx, { facilityId: PCCA }), { inserted: 16, alreadyImported: 0, plansInserted: 1 })
  const closures = ctx.tables.calendarEvents.filter(e => e.kind === 'closure')
  assert.equal(closures.length, 14)
  assert.deepEqual(closures.map(e => e.startDate), ['2026-09-07','2026-09-30','2026-10-12','2026-10-31','2026-11-11','2026-12-24','2026-12-25','2027-01-01','2027-02-15','2027-03-26','2027-03-29','2027-05-24','2027-07-01','2027-08-02'])
  assert.ok(closures.every(e => e.startDate === e.endDate))
  assert.equal(ctx.tables.calendarEvents.find(e => e.startDate === '2027-08-20').kind, 'event')
  assert.match(ctx.tables.calendarEvents.find(e => e.startDate === '2027-08-20').description, /Proposed|proposed/)
  assert.equal(ctx.tables.calendarEvents.find(e => e.startDate === '2026-10-21').kind, 'event')
  const plan = ctx.tables.parentPlans[0]
  assert.equal(plan.status, 'published'); assert.equal(plan.title, 'Gratitude & belonging')
  assert.equal(plan.activities, 'Make a gratitude tree; invite children to notice kind actions.')
  assert.equal(ctx.events.length, 1); assert.equal(ctx.events[0].type, 'calendar.imported')
  closures[0].title = 'Edited by owner'; plan.activities = 'Owner edit'
  assert.deepEqual(await calendar.importPccaCalendar.handler(ctx, { facilityId: PCCA }), { inserted: 0, alreadyImported: 16, plansInserted: 0 })
  assert.equal(closures[0].title, 'Edited by owner'); assert.equal(plan.activities, 'Owner edit'); assert.equal(ctx.events.length, 1)
  await assert.rejects(calendar.importPccaCalendar.handler(ctx, { facilityId: 'other' }), /Expected the Pacific/)
})
const familyPlan = (id, room, status = 'published', facilityId = 'facility-a') => ({ _id: id, facilityId, room, title: id, period: 'week', startDate: '2026-11-02', endDate: '2026-11-06', overview: 'Learning', activities: 'Building', goals: 'Cooperation', status })
test('family plans expose only published plans for the parent child room', async () => {
  const ctx = context({ role: 'parent', rows: { children: kids, parentPlans: [familyPlan('all'), familyPlan('ours', 'Cubs'), familyPlan('draft', 'Cubs', 'draft'), familyPlan('others', 'Owls'), familyPlan('other-tenant', undefined, 'published', 'facility-b')] } })
  assert.deepEqual((await lessons.familyPlans.handler(ctx, { childId: 'kid-a' })).map(p => p.id), ['all', 'ours'])
  assert.deepEqual(await lessons.familyPlans.handler(ctx, { childId: 'kid-b' }), [])
  assert.deepEqual(await lessons.familyPlans.handler(ctx, { childId: 'kid-archived' }), [])
  ctx.blocked = true; assert.deepEqual(await lessons.familyPlans.handler(ctx, {}), [])
})
test('family plan edits return published work to draft and require explicit republication with owner events', async () => {
  const ctx = context({ rows: { parentPlans: [familyPlan('plan')] } })
  const fields = { title: 'Updated', period: 'week', startDate: '2026-11-02', endDate: '2026-11-06', overview: 'New overview', activities: '', goals: '' }
  await lessons.saveFamilyPlan.handler(ctx, { id: 'plan', ...fields })
  assert.equal(ctx.tables.parentPlans[0].status, 'draft'); assert.equal(ctx.events[0].type, 'lesson-plan.updated')
  await lessons.publishFamilyPlan.handler(ctx, { id: 'plan', published: true })
  assert.equal(ctx.tables.parentPlans[0].status, 'published'); assert.equal(ctx.events[1].type, 'lesson-plan.published')
  await lessons.publishFamilyPlan.handler(ctx, { id: 'plan', published: true }); assert.equal(ctx.events.length, 2)
  await lessons.publishFamilyPlan.handler(ctx, { id: 'plan', published: false }); assert.equal(ctx.events[2].type, 'lesson-plan.unpublished')
  await lessons.removeFamilyPlan.handler(ctx, { id: 'plan' }); assert.equal(ctx.events[3].type, 'lesson-plan.removed')
})
test('family plan writes reject parents, impossible dates, blank publication and cross-tenant records', async () => {
  const fields = { title: 'Plan', period: 'month', startDate: '2026-11-01', endDate: '2026-11-30', overview: '', activities: '', goals: '' }
  await assert.rejects(lessons.saveFamilyPlan.handler(context({ role: 'parent' }), fields), /Directors only/)
  await assert.rejects(lessons.saveFamilyPlan.handler(context(), { ...fields, endDate: '2026-11-31' }), /valid date range/)
  const ctx = context({ rows: { parentPlans: [familyPlan('foreign', undefined, 'draft', 'facility-b'), { ...familyPlan('empty', undefined, 'draft'), overview: '', activities: '' }] } })
  await assert.rejects(lessons.saveFamilyPlan.handler(ctx, { ...fields, id: 'foreign' }), /not found/)
  await assert.rejects(lessons.publishFamilyPlan.handler(ctx, { id: 'foreign', published: true }), /not found/)
  await assert.rejects(lessons.publishFamilyPlan.handler(ctx, { id: 'empty', published: true }), /overview or activities/)
})
test('parents cannot read educator working blocks or make lesson mutations', async () => {
  const ctx = context({ role: 'parent' })
  assert.deepEqual(await lessons.plan.handler(ctx, {}), { room: 'Main Room', week: '', theme: '' })
  assert.deepEqual(await lessons.blocks.handler(ctx, {}), [])
  await assert.rejects(lessons.updateBlock.handler(ctx, { id: 'x' }), /Directors only/)
  await assert.rejects(lessons.setStatus.handler(ctx, { id: 'x', status: 'done' }), /Staff only/)
})
