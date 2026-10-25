import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { queryRows } from './test-db-query.mjs'

// Entire migration is local: fake database + Blob store. No Convex call,
// customer file download, actual encryption key, or production mutation.
process.env.PRIVATE_FILES_KEY=Buffer.alloc(32,27).toString('base64')
const result=await build({stdin:{contents:"export * from './convex/privateFileMigration'; export {openPrivateBlob} from './convex/fileEncryption';",resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'migration-transport',setup(b){
 b.onResolve({filter:/@convex-dev\/auth\/server|\.\/_generated\/(server|api)$/},args=>({path:args.path,namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},({path})=>({contents:path.includes('auth/server')?'export const getAuthUserId=async ctx=>ctx.uid??null;':path.endsWith('/api')?"const ref=path=>new Proxy(()=>{}, {get:(_,key)=>key==='path'?path:ref(path?path+'.'+key:String(key))});export const internal=ref('');":'export const internalQuery=x=>x,internalMutation=x=>x,internalAction=x=>x;'}))
}}]})
const api=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
function fixture(extra=[]){
 const rows=new Map([
 ['f',{_id:'f',table:'facilities',ownerUserId:'owner'}],['owner',{_id:'owner',table:'users',facilityId:'f',role:'admin'}],
 ['book',{_id:'book',table:'bookkeepingDocs',facilityId:'f',storageId:'legacy'}],
 ...extra.map(row=>[row._id,row]),
 ])
 const files=new Map([['legacy',new Blob(['customer-private-bytes'],{type:'application/pdf'})]])
 let n=0
 const ctx={rows,files,deletions:[],writes:[],db:{
  get:async id=>rows.get(id)??null,
  patch:async(id,values)=>{ctx.writes.push({id,values});for(const[key,value]of Object.entries(values)){if(value===undefined)delete rows.get(id)[key];else rows.get(id)[key]=value}},
  insert:async(table,values)=>{const id=`new${++n}`;rows.set(id,{_id:id,table,...values});ctx.writes.push({id,table,values});return id},
  query(table){const q=queryRows(()=>[...rows.values()].filter(row=>row.table===table));q.paginate=async({cursor,numItems})=>{const all=await q.collect(),offset=Number(cursor||0),end=Math.min(all.length,offset+numItems);return{page:all.slice(offset,end),isDone:end===all.length,continueCursor:String(end)}};return q},
  system:{get:async id=>files.has(id)?{_id:id,size:files.get(id).size}:null},
 },storage:{
  get:async id=>files.get(id)??null,
  store:async blob=>{const id=`copy${++n}`;files.set(id,blob);return id},
  delete:async id=>{ctx.deletions.push(id);files.delete(id)},
 }}
 ctx.runQuery=async(ref,args)=>api[ref.path.split('.')[1]].handler(ctx,args)
 ctx.runMutation=ctx.runQuery
 return ctx
}

test('migration is dry-run by default and reports paginated candidate counts without copying/deleting',async()=>{
 const ctx=fixture([{_id:'b2',table:'bookkeepingDocs',facilityId:'f',storageId:'legacy2'}])
 const page=await api.inventory.handler(ctx,{facilityId:'f',table:'bookkeepingDocs',limit:1})
 assert.equal(page.recordsScanned,1);assert.equal(page.isDone,false)
 assert.equal((await api.inventory.handler(ctx,{facilityId:'f',table:'bookkeepingDocs',limit:1,cursor:page.nextCursor})).recordsScanned,1)
 const result=await api.rotateBatch.handler(ctx,{facilityId:'f',storageIds:['legacy']})
 assert.equal(result.dryRun,true);assert.equal(result.results[0].eligible,true)
 assert.equal(ctx.writes.length,0);assert.deepEqual(ctx.deletions,[])
})
test('verified copy atomically updates all private records and ownership registry before old URL revocation',async()=>{
 const ctx=fixture([
 {_id:'profile',table:'employeeProfiles',facilityId:'f',documents:[{name:'Certificate',kind:'cert',storageId:'legacy'}]},
 {_id:'care',table:'childDocuments',facilityId:'f',storageId:'legacy'},
 {_id:'photo',table:'photos',facilityId:'f',imageId:'legacy'},
 {_id:'child',table:'children',facilityId:'f',imageId:'legacy'},
 {_id:'upload',table:'storedUploads',facilityId:'f',storageId:'legacy',purpose:'bookkeeping',uploadedBy:'owner',size:22,mimeType:'application/pdf'},
 ])
 const result=await api.rotateBatch.handler(ctx,{facilityId:'f',storageIds:['legacy'],dryRun:false,forceRegistered:true})
 assert.equal(result.results[0].status,'revoked')
 const job=ctx.rows.get(result.results[0].jobId),replacement=job.replacementId
 assert.ok(replacement);assert.equal(job.status,'revoked');assert.equal(ctx.files.get(replacement).type,'application/octet-stream');assert.equal((await ctx.files.get(replacement).text()).includes('customer-private-bytes'),false);assert.equal(await(await api.openPrivateBlob(ctx.files.get(replacement))).text(),'customer-private-bytes');assert.equal(ctx.files.has('legacy'),false)
 for(const id of ['book','care'])assert.equal(ctx.rows.get(id).storageId,replacement)
 for(const id of ['photo','child'])assert.equal(ctx.rows.get(id).imageId,replacement)
 assert.equal(ctx.rows.get('profile').documents[0].storageId,replacement)
 assert.equal(ctx.rows.get('upload').storageId,replacement);assert.equal(ctx.rows.get('upload').uploadedBy,'owner')
 assert.equal((await api.inventory.handler(ctx,{facilityId:'f',table:'bookkeepingDocs'})).candidates[0].state,'protected_replacement')
})
test('public avatar/logo and foreign private references refuse rotation instead of breaking another use',async()=>{
 for(const extra of [
 {_id:'public',table:'users',imageId:'legacy'},
 {_id:'public',table:'educators',imageId:'legacy'},
 {_id:'g',table:'facilities',logoId:'legacy'},
 {_id:'foreign',table:'childDocuments',facilityId:'g',storageId:'legacy'},
 ]){
  const ctx=fixture([extra])
  const result=await api.rotateBatch.handler(ctx,{facilityId:'f',storageIds:['legacy'],dryRun:false})
  assert.equal(result.results[0].eligible,false);assert.equal(ctx.files.has('legacy'),true);assert.deepEqual(ctx.deletions,[])
 }
})
test('interruption after references commit remains resumable; stale copy worker cannot overwrite lease',async()=>{
 const ctx=fixture()
 const originalRun=ctx.runMutation
 let interrupted=true
 ctx.runMutation=async(ref,args)=>{if(ref.path.endsWith('.markRevoked')&&interrupted){interrupted=false;throw Error('Simulated interruption')}return originalRun(ref,args)}
 const failed=await api.rotateBatch.handler(ctx,{facilityId:'f',storageIds:['legacy'],dryRun:false})
 assert.equal(failed.results[0].status,'needs_review');assert.equal(ctx.files.has('legacy'),true)
 const job=ctx.rows.get(failed.results[0].jobId);assert.equal(job.status,'references_updated')
 const resumed=await api.rotateBatch.handler(ctx,{facilityId:'f',storageIds:['legacy'],dryRun:false})
 assert.equal(resumed.results[0].status,'revoked');assert.equal(ctx.files.has('legacy'),false)
 const second=fixture(),first=await api.reserve.handler(second,{facilityId:'f',storageId:'legacy'})
 assert.equal((await api.reserve.handler(second,{facilityId:'f',storageId:'legacy'})).eligible,false)
 second.rows.get(first.jobId).updatedAt=Date.now()-121000
 const next=await api.reserve.handler(second,{facilityId:'f',storageId:'legacy'})
 await assert.rejects(api.commitCopy.handler(second,{jobId:first.jobId,claimToken:first.claimToken,replacementId:'fake',mimeType:'application/pdf',size:22}),/lease changed/)
 assert.notEqual(first.claimToken,next.claimToken)
})
test('final atomic revocation rechecks public references added after the copy and preserves old file',async()=>{
 const ctx=fixture(),originalRun=ctx.runMutation
 ctx.runMutation=async(ref,args)=>{if(ref.path.endsWith('.markRevoked'))ctx.rows.set('new-public',{_id:'new-public',table:'users',imageId:'legacy'});return originalRun(ref,args)}
 const result=await api.rotateBatch.handler(ctx,{facilityId:'f',storageIds:['legacy'],dryRun:false})
 assert.equal(result.results[0].status,'needs_review');assert.equal(ctx.files.has('legacy'),true)
 assert.equal(ctx.rows.get(result.results[0].jobId).status,'references_updated')
})
test('rollback is explicit and only available before original URL revocation',async()=>{
 const ctx=fixture(),originalRun=ctx.runMutation
 ctx.runMutation=async(ref,args)=>{if(ref.path.endsWith('.markRevoked'))throw Error('pause before revocation');return originalRun(ref,args)}
 const result=await api.rotateBatch.handler(ctx,{facilityId:'f',storageIds:['legacy'],dryRun:false})
 const jobId=result.results[0].jobId,job=ctx.rows.get(jobId)
 assert.equal((await api.rollback.handler(ctx,{jobId})).dryRun,true);assert.notEqual(ctx.rows.get('book').storageId,'legacy')
 assert.equal((await api.rollback.handler(ctx,{jobId,dryRun:false})).status,'rolled_back')
 assert.equal(ctx.rows.get('book').storageId,'legacy');assert.equal(ctx.files.has('legacy'),true)
 job.status='revoked'
 await assert.rejects(api.rollback.handler(ctx,{jobId,dryRun:false}),/only before/)
})
test('scan and batch limits refuse unsafe scope without deleting source',async()=>{
 const ctx=fixture(Array.from({length:251},(_,i)=>({_id:`p${i}`,table:'employeeProfiles',facilityId:'f',documents:[]})))
 const result=await api.rotateBatch.handler(ctx,{facilityId:'f',storageIds:['legacy'],dryRun:false})
 assert.equal(result.results[0].eligible,false);assert.match(result.results[0].reason,/scan limit/)
 await assert.rejects(api.rotateBatch.handler(ctx,{facilityId:'f',storageIds:['legacy','legacy'],dryRun:false}),/distinct/)
 assert.equal(ctx.files.has('legacy'),true)
})
