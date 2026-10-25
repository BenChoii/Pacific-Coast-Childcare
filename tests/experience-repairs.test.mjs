import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { childDayEntries, dayKey, nextAttendance, csvDownload } from '../src/lib/careData.js'

const compiled=await build({entryPoints:['convex/fileEncryption.ts'],bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'})
const encryption=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const fakeKey=Buffer.alloc(32,41).toString('base64')

test('facility-local day crosses UTC midnight and DST correctly',()=>{
 assert.equal(dayKey(Date.parse('2026-10-26T00:30:00Z'),'America/Vancouver'),'2026-10-25')
 assert.equal(dayKey(Date.parse('2026-11-01T08:30:00Z'),'America/Vancouver'),'2026-11-01')
 assert.equal(dayKey(Date.parse('2026-11-01T09:30:00Z'),'America/Vancouver'),'2026-11-01')
 assert.equal(dayKey(Date.parse('2026-10-26T00:30:00Z'),'America/Toronto'),'2026-10-25')
})
test('a room closure overrides a regularly enrolled weekday',()=>{
 const child={room:'Sprouts',enrollmentDays:['Mon','Wed']}
 assert.equal(nextAttendance(child,[{kind:'closure',startDate:'2026-10-26',endDate:'2026-10-26',room:'Sprouts'}],'2026-10-26'),'2026-10-28')
 assert.equal(nextAttendance(child,[{kind:'closure',startDate:'2026-10-26',endDate:'2026-10-26',room:'Other class'}],'2026-10-26'),'2026-10-26')
})
test('a family event does not cancel attendance and absent schedules are not invented',()=>{
 assert.equal(nextAttendance({room:'Sprouts',enrollmentDays:['Mon']},[{kind:'event',startDate:'2026-10-26',endDate:'2026-10-26'}],'2026-10-26'),'2026-10-26')
 assert.equal(nextAttendance({enrollmentDays:[]},[],'2026-10-26'),null)
 assert.equal(nextAttendance({},[],'2026-10-26'),null)
})
test('daily attribution excludes a sibling and historical/undated records',()=>{
 const entries=[{id:1,childId:'a',date:'2026-10-25'},{id:2,childId:'b',date:'2026-10-25'},{id:3,childId:'a',date:'2026-10-24'},{id:4,childId:'a'}]
 assert.deepEqual(childDayEntries(entries,{id:'a'},'2026-10-25').map(r=>r.id),[1])
})
test('private blobs contain ciphertext and preserve bytes and MIME on authorized decryption',async()=>{
 process.env.PRIVATE_FILES_KEY=fakeKey
 const bytes=Buffer.from('%PDF-1.7\nA private daycare file')
 const sealed=await encryption.sealPrivateBlob(new Blob([bytes],{type:'application/pdf'}))
 assert.equal(sealed.type,'application/octet-stream')
 assert.ok(!(await sealed.text()).includes('A private daycare file'))
 const opened=await encryption.openPrivateBlob(sealed)
 assert.equal(opened.type,'application/pdf')
 assert.deepEqual(Buffer.from(await opened.arrayBuffer()),bytes)
})
test('private blobs reject corrupted ciphertext and a different encryption key',async()=>{
 process.env.PRIVATE_FILES_KEY=fakeKey
 const sealed=await encryption.sealPrivateBlob(new Blob(['confidential'],{type:'image/png'}))
 const bytes=new Uint8Array(await sealed.arrayBuffer());bytes[bytes.length-1]^=1
 await assert.rejects(encryption.openPrivateBlob(new Blob([bytes])))
 process.env.PRIVATE_FILES_KEY=Buffer.alloc(32,42).toString('base64')
 await assert.rejects(encryption.openPrivateBlob(sealed))
})
test('new private uploads never silently fall back to plaintext if encryption is unavailable',async()=>{
 delete process.env.PRIVATE_FILES_KEY
 await assert.rejects(encryption.sealPrivateBlob(new Blob(['private'])) ,/unavailable/)
})
test('CSV exports escape formulas and embedded quotes without executing spreadsheet content',async()=>{
 let captured
 const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,originalTimer=globalThis.setTimeout,originalDocument=globalThis.document
 URL.createObjectURL=blob=>{captured=blob;return 'blob:test'};URL.revokeObjectURL=()=>{}
 globalThis.setTimeout=fn=>{fn();return 0};globalThis.document={createElement:()=>({click(){}})}
 try {
  csvDownload('test.csv',['Name'],[['=HYPERLINK("bad")'],['Safe child']])
  const csv=await captured.text()
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'))
  assert.ok(csv.includes('"Safe child"'))
 }finally{URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;globalThis.setTimeout=originalTimer;globalThis.document=originalDocument}
})
