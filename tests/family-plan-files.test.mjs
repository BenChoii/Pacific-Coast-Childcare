import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { queryRows } from './test-db-query.mjs'

// Actual upload/encryption, plan handlers and private-file authorization. Only
// transport, identity lookup and email queue delivery are local adapters.
process.env.PRIVATE_FILES_KEY = Buffer.alloc(32, 29).toString('base64')
const root = fileURLToPath(new URL('../', import.meta.url))
const output = await build({ stdin: { contents: "export * as lessons from './convex/lessons';export * as files from './convex/files';export * as privateFiles from './convex/privateFiles';export * as privateHttp from './convex/privateFileHttp';export * as encryption from './convex/fileEncryption';", resolveDir: root, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'family-file-boundaries', setup(b) {
  b.onResolve({ filter: /@convex-dev\/auth\/server|\.\/_generated\/(server|api)$|\.\/(notifications|familyNotifications)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
    path.includes('auth/server') ? 'export const getAuthUserId=async ctx=>ctx.uid??null;' :
    path.endsWith('/api') ? 'const ref=path=>new Proxy(()=>{},{get:(_,key)=>key===\'path\'?path:ref(path?path+\'.\'+key:String(key))});export const internal=ref(\'\');' :
    path.includes('familyNotifications') ? 'export const queuePlanNotifications=async(ctx,plan)=>{ctx.emailCalls.push(plan);return {queued:1,recorded:0,skipped:0}};' :
    path.includes('notifications') ? 'export const recordOwnerEvent=async(ctx,event)=>ctx.events.push(event);' :
    'export const action=x=>x,query=x=>x,mutation=x=>x,internalQuery=x=>x,internalMutation=x=>x,httpAction=x=>x;'
  }))
} }] })
const api = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
const pdf = Buffer.from('%PDF-1.4\nSynthetic class schedule\n%%EOF')
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
function fixture() {
  const rows = new Map([
    ['f', { _id: 'f', table: 'facilities', ownerUserId: 'owner', slug: 'test', timezone: 'America/Vancouver' }],
    ['g', { _id: 'g', table: 'facilities', ownerUserId: 'foreign' }],
    ...[['owner', 'admin', 'f'], ['director2', 'admin', 'f'], ['staff', 'staff', 'f'], ['parent-a', 'parent', 'f'], ['parent-b', 'parent', 'f'], ['foreign', 'admin', 'g']].map(([id, role, facilityId]) => [id, { _id: id, table: 'users', role, facilityId }]),
    ['kid-a', { _id: 'kid-a', table: 'children', facilityId: 'f', room: 'Cubs', parentUserId: 'parent-a' }],
    ['kid-b', { _id: 'kid-b', table: 'children', facilityId: 'f', room: 'Owls', parentUserId: 'parent-b' }],
  ])
  let next = 0
  const files = new Map()
  const ctx = { uid: 'owner', rows, files, events: [], emailCalls: [], reads: [], writes: [],
    db: {
      get: async id => rows.get(id) ?? null,
      insert: async (table, data) => { const id = `${table}-${++next}`; rows.set(id, { ...structuredClone(data), _id: id, table }); ctx.writes.push(id); return id },
      patch: async (id, data) => { Object.assign(rows.get(id), structuredClone(data)); ctx.writes.push(id) },
      delete: async id => { rows.delete(id); ctx.writes.push(id) },
      query: table => queryRows(() => [...rows.values()].filter(row => row.table === table)),
      system: { get: async id => files.has(id) ? { size: files.get(id).size, contentType: files.get(id).type } : null },
    }, storage: {
      store: async blob => { const id = `file-${++next}`; files.set(id, blob); return id },
      get: async id => { ctx.reads.push(id); return files.get(id) || null },
      delete: async id => files.delete(id),
      getUrl: async () => { throw new Error('Permanent public storage URLs are forbidden') },
    },
  }
  ctx.runQuery = async (ref, args) => { const [module, name] = ref.path.split('.'); return api[module][name].handler(ctx, args) }
  ctx.runMutation = ctx.runQuery
  return ctx
}
const fields = (extra = {}) => ({ title: 'Cubs daily schedule', kind: 'schedule', period: 'day', room: 'Cubs', startDate: '2026-10-27', endDate: '2026-10-27', overview: '', activities: '', goals: '', ...extra })
async function upload(ctx, mimeType = 'application/pdf', purpose = 'learning-plan') {
  const bytes = mimeType === 'application/pdf' ? pdf : png
  const { storageId } = await api.files.uploadFile.handler(ctx, { base64: bytes.toString('base64'), mimeType, purpose })
  return { storageId, name: mimeType === 'application/pdf' ? 'Class schedule.pdf' : 'Class schedule.png', mimeType, size: bytes.length }
}
const routes = []; api.privateHttp.registerPrivateFiles({ route: route => routes.push(route) })
const download = routes.find(route => route.method === 'GET').handler
const request = id => new Request(`https://unit.convex.site/files/private?storageId=${id}`, { headers: { Authorization: 'Bearer synthetic-session' } })

test('director uploads are encrypted and attachment-only daily drafts stay invisible until publication', async () => {
  const ctx = fixture(), file = await upload(ctx)
  const stored = ctx.files.get(file.storageId)
  assert.equal(stored.type, 'application/octet-stream')
  assert.equal((await stored.text()).includes('Synthetic class schedule'), false)
  assert.deepEqual(Buffer.from(await (await api.encryption.openPrivateBlob(stored)).arrayBuffer()), pdf)
  const id = await api.lessons.saveFamilyPlan.handler(ctx, fields({ attachments: [file] }))
  assert.equal(ctx.rows.get(id).status, 'draft')
  assert.deepEqual(ctx.emailCalls, [])
  ctx.uid = 'parent-a'; assert.deepEqual(await api.lessons.familyPlans.handler(ctx, {}), [])
  assert.equal((await download(ctx, request(file.storageId))).status, 403)
  ctx.uid = 'owner'; assert.equal((await download(ctx, request(file.storageId))).status, 200)
  assert.deepEqual(await api.lessons.publishFamilyPlan.handler(ctx, { id, published: true }), { queued: 1, recorded: 0, skipped: 0 })
  assert.equal(ctx.emailCalls.length, 1)
  assert.deepEqual(await api.lessons.publishFamilyPlan.handler(ctx, { id, published: true }), { queued: 0, recorded: 0, skipped: 0 })
  assert.equal(ctx.emailCalls.length, 1)
})

test('staff and parents cannot upload or register family-plan files as directors', async () => {
  const ctx = fixture()
  for (const uid of ['staff', 'parent-a']) {
    ctx.uid = uid
    await assert.rejects(upload(ctx), /owner\/director/)
    await assert.rejects(api.files.registerStoredUpload.handler(ctx, { storageId: 'forged', facilityId: 'f', uploadedBy: uid, purpose: 'learning-plan', mimeType: 'application/pdf', size: pdf.length }), /Director access/)
  }
  ctx.uid = null; await assert.rejects(upload(ctx), /Sign in/)
  assert.equal(ctx.files.size, 0)
})

test('attachments reject child documents, another uploader/tenant, forged metadata, missing blobs and excessive counts', async () => {
  for (const change of ['medical', 'uploader', 'tenant', 'size', 'mime', 'missing', 'duplicate', 'count']) {
    const ctx = fixture(), file = await upload(ctx)
    const registry = [...ctx.rows.values()].find(row => row.table === 'storedUploads')
    let attachments = [file]
    if (change === 'medical') registry.purpose = 'child-document'
    if (change === 'uploader') registry.uploadedBy = 'director2'
    if (change === 'tenant') registry.facilityId = 'g'
    if (change === 'size') file.size += 1
    if (change === 'mime') file.mimeType = 'image/png'
    if (change === 'missing') ctx.files.delete(file.storageId)
    if (change === 'duplicate') attachments.push(file)
    if (change === 'count') attachments = Array.from({ length: 6 }, (_, n) => ({ ...file, storageId: `distinct-${n}` }))
    await assert.rejects(api.lessons.saveFamilyPlan.handler(ctx, fields({ attachments })), undefined, change)
    assert.equal([...ctx.rows.values()].some(row => row.table === 'parentPlans'), false, change)
  }
})

test('published files require an active child in the correct class on every fresh download', async () => {
  const ctx = fixture(), file = await upload(ctx)
  const id = await api.lessons.saveFamilyPlan.handler(ctx, fields({ attachments: [file] }))
  await api.lessons.publishFamilyPlan.handler(ctx, { id, published: true })
  ctx.uid = 'parent-a'
  assert.equal((await api.lessons.familyPlans.handler(ctx, { childId: 'kid-a' }))[0].attachments[0].storageId, file.storageId)
  assert.equal((await download(ctx, request(file.storageId))).status, 200)
  ctx.uid = 'parent-b'; assert.deepEqual(await api.lessons.familyPlans.handler(ctx, {}), [])
  ctx.reads.length = 0; assert.equal((await download(ctx, request(file.storageId))).status, 403); assert.deepEqual(ctx.reads, [])
  ctx.uid = 'foreign'; assert.equal((await download(ctx, request(file.storageId))).status, 403)
  ctx.uid = 'parent-a'; ctx.rows.get('kid-a').room = 'Owls'
  assert.equal((await download(ctx, request(file.storageId))).status, 403)
  ctx.rows.get('kid-a').room = 'Unassigned'; ctx.rows.get(id).room = 'Unassigned'
  assert.deepEqual(await api.lessons.familyPlans.handler(ctx, { childId: 'kid-a' }), [])
  assert.equal((await download(ctx, request(file.storageId))).status, 403)
  ctx.rows.get(id).room = 'Cubs'
  ctx.rows.get('kid-a').room = 'Cubs'; ctx.rows.get('kid-a').archivedAt = 1
  assert.equal((await download(ctx, request(file.storageId))).status, 403)
  delete ctx.rows.get('kid-a').archivedAt; ctx.rows.get('parent-a').accessStatus = 'suspended'
  assert.equal((await download(ctx, request(file.storageId))).status, 403)
})

test('editing returns a shared file to draft, preserves legacy-client fields and unpublishing/removal revoke parent reads', async () => {
  const ctx = fixture(), file = await upload(ctx)
  const agenda = [{ startTime: '12:30', endTime: '14:30', title: 'Rest', location: 'Cubs room', weekdays: ['Tue'] }]
  const id = await api.lessons.saveFamilyPlan.handler(ctx, fields({ attachments: [file], agenda }))
  await api.lessons.publishFamilyPlan.handler(ctx, { id, published: true })
  ctx.uid = 'director2'
  await api.lessons.saveFamilyPlan.handler(ctx, { id, ...fields({ title: 'Revised schedule' }) })
  assert.deepEqual(ctx.rows.get(id).attachments, [file]); assert.deepEqual(ctx.rows.get(id).agenda.map(({ detail, ...row }) => row), agenda)
  assert.equal(ctx.rows.get(id).status, 'draft')
  ctx.uid = 'parent-a'; assert.equal((await download(ctx, request(file.storageId))).status, 403)
  ctx.uid = 'owner'; await api.lessons.publishFamilyPlan.handler(ctx, { id, published: true })
  await api.lessons.publishFamilyPlan.handler(ctx, { id, published: false })
  ctx.uid = 'parent-a'; assert.equal((await download(ctx, request(file.storageId))).status, 403)
  ctx.uid = 'owner'; await api.lessons.removeFamilyPlan.handler(ctx, { id })
  assert.equal((await download(ctx, request(file.storageId))).status, 403)
})

test('daily schedules require one real date and timetable ranges reject per-day overlaps', async () => {
  const ctx = fixture()
  await assert.rejects(api.lessons.saveFamilyPlan.handler(ctx, fields({ endDate: '2026-10-28' })), /one calendar date/)
  const block = (startTime, endTime, weekdays) => ({ startTime, endTime, title: 'Class activity', ...(weekdays ? { weekdays } : {}) })
  for (const agenda of [[block('24:00', '25:00')], [block('12:30', '12:30')], [block('12:30', '14:30'), block('13:00', '13:30', ['Tue'])], [block('12:30', '14:30', [])], Array.from({ length: 51 }, () => block('12:30', '14:30'))]) {
    await assert.rejects(api.lessons.saveFamilyPlan.handler(ctx, fields({ agenda })))
  }
  const agenda = [block('12:30', '14:30', ['Tue']), block('12:30', '14:30', ['Wed']), block('14:30', '15:00')]
  const id = await api.lessons.saveFamilyPlan.handler(ctx, fields({ agenda }))
  await api.lessons.publishFamilyPlan.handler(ctx, { id, published: true })
  assert.equal(ctx.rows.get(id).agenda.length, 3)
  assert.deepEqual(ctx.emailCalls, [], 'agenda-only publication does not pretend to share a new file')
})

test('the public demo never receives private attachment metadata and a signed-out download is denied', async () => {
  const ctx = fixture(), file = await upload(ctx)
  const id = await api.lessons.saveFamilyPlan.handler(ctx, fields({ attachments: [file] }))
  await api.lessons.publishFamilyPlan.handler(ctx, { id, published: true })
  ctx.rows.get('f').slug = 'demo'; ctx.rows.get('f').isDemo = true; ctx.uid = null
  const rows = await api.lessons.familyPlans.handler(ctx, {})
  assert.equal(rows.length, 1); assert.deepEqual(rows[0].attachments, [])
  assert.equal((await download(ctx, request(file.storageId))).status, 403)
})
