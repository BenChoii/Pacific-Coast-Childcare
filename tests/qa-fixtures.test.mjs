import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { queryRows } from './test-db-query.mjs'

const result=await build({entryPoints:[fileURLToPath(new URL('../convex/qaFixtures.ts',import.meta.url))],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'registration-only',setup(b){b.onResolve({filter:/\.\/_generated\/server$/},()=>({path:'server',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const internalQuery=x=>x,internalMutation=x=>x;'}))}}]})
const api=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const runId='aabbccdd'
function fixture(extra=[]){
 const rows=new Map([['owner',{_id:'owner',table:'users',email:`qa-mitten-${runId}-owner@example.invalid`,role:'admin',_creationTime:Date.now()}],...extra.map(row=>[row._id,row])]);let n=0
 const ctx={rows,writes:[],deletedFiles:[],storage:{getUrl:async id=>`mock:${id}`,delete:async id=>ctx.deletedFiles.push(id)},db:{get:async id=>rows.get(id)??null,patch:async(id,data)=>{ctx.writes.push(id);Object.assign(rows.get(id),data)},insert:async(table,data)=>{const id=`new${++n}`;rows.set(id,{_id:id,table,...data});ctx.writes.push(id);return id},delete:async id=>{rows.delete(id);ctx.writes.push(id)},query:table=>queryRows(()=>[...rows.values()].filter(row=>row.table===table)),system:{get:async()=>({_creationTime:Date.now()+1000,size:10})}}}
 return ctx
}
test('setup refuses customer emails, customer membership, demo and mismatched synthetic owners',async()=>{
 for(const fields of [{email:'owner@real.example'},{facilityId:'real'},{role:'parent'},{_creationTime:Date.now()-3_700_000}]){
  const ctx=fixture();Object.assign(ctx.rows.get('owner'),fields)
  await assert.rejects(api.setup.handler(ctx,{runId,ownerUserId:'owner'}))
  assert.deepEqual(ctx.writes,[])
 }
})
test('setup creates only a muted isolated fixture and retries recover the same tenant',async()=>{
 const ctx=fixture(),a=await api.setup.handler(ctx,{runId,ownerUserId:'owner'}),b=await api.setup.handler(ctx,{runId,ownerUserId:'owner'})
 assert.equal(a.facilityId,b.facilityId)
 const facility=ctx.rows.get(a.facilityId);assert.equal(facility.ownerEmailMode,'off');assert.equal(facility.isDemo,false);assert.equal(facility.freeLimit,1000)
})
test('cleanup dry run preserves everything; confirmed cleanup removes only exact synthetic tenant/auth/file records',async()=>{
 const ctx=fixture(),{facilityId}=await api.setup.handler(ctx,{runId,ownerUserId:'owner'})
 ctx.rows.set('account',{_id:'account',table:'authAccounts',userId:'owner',provider:'password',providerAccountId:`qa-mitten-${runId}-owner@example.invalid`})
 ctx.rows.set('session',{_id:'session',table:'authSessions',userId:'owner'})
 ctx.rows.set('refresh',{_id:'refresh',table:'authRefreshTokens',sessionId:'session'})
 ctx.rows.set('upload',{_id:'upload',table:'storedUploads',facilityId,storageId:'qa-file',uploadedBy:'owner'})
 ctx.rows.set('other',{_id:'other',table:'users',facilityId:'customer',email:'someone@real.example'})
 const args={runId,facilityId,userIds:['owner']}
 const before=ctx.rows.size,preview=await api.cleanup.handler(ctx,args)
 assert.equal(ctx.rows.size,before);assert.equal(preview.dryRun,true);assert.deepEqual(ctx.deletedFiles,[])
 const deleted=await api.cleanup.handler(ctx,{...args,dryRun:false})
 assert.equal(deleted.records,preview.records);assert.deepEqual([...ctx.rows.keys()],['other']);assert.deepEqual(ctx.deletedFiles,['qa-file'])
})
test('cleanup refuses the entire operation if a non-test user or outside dependent is attached',async()=>{
 for(const record of [{_id:'real',table:'users',email:'customer@example.com'},{_id:'foreign-message',table:'messages',conversationId:'conversation',facilityId:'customer'}]){
  const ctx=fixture(),{facilityId}=await api.setup.handler(ctx,{runId,ownerUserId:'owner'})
  ctx.rows.set('conversation',{_id:'conversation',table:'conversations',facilityId})
  ctx.rows.set(record._id,{...record,...(record.table==='users'?{facilityId}:{})})
  const before=ctx.rows.size
  await assert.rejects(api.cleanup.handler(ctx,{runId,facilityId,userIds:['owner'],dryRun:false}))
  assert.equal(ctx.rows.size,before);assert.deepEqual(ctx.deletedFiles,[])
 }
})
test('cleanup refuses outside file references and real Stripe artifacts without partial deletion',async()=>{
 for(const record of [{_id:'photo',table:'photos',facilityId:'customer',imageId:'qa-file'},{_id:'private',table:'childDocuments',facilityId:'customer',storageId:'qa-file'}]){
  const ctx=fixture(),{facilityId}=await api.setup.handler(ctx,{runId,ownerUserId:'owner'})
  ctx.rows.set('upload',{_id:'upload',table:'storedUploads',facilityId,storageId:'qa-file',uploadedBy:'owner'});ctx.rows.set(record._id,record)
  const before=ctx.rows.size
  await assert.rejects(api.cleanup.handler(ctx,{runId,facilityId,userIds:['owner'],dryRun:false}))
  assert.equal(ctx.rows.size,before);assert.deepEqual(ctx.deletedFiles,[])
 }
 const ctx=fixture(),{facilityId}=await api.setup.handler(ctx,{runId,ownerUserId:'owner'});ctx.rows.get(facilityId).stripeSubscriptionId='sub_real'
 await assert.rejects(api.cleanup.handler(ctx,{runId,facilityId,userIds:['owner'],dryRun:false}),/non-billing/)
})
test('cleanup can remove interrupted unaffiliated synthetic accounts but cannot accept unrelated IDs',async()=>{
 const ctx=fixture([{_id:'real',table:'users',email:'customer@example.com'}])
 await assert.rejects(api.cleanup.handler(ctx,{runId,userIds:['owner','real'],dryRun:false}))
 assert.ok(ctx.rows.has('owner'))
 await api.cleanup.handler(ctx,{runId,userIds:['owner'],dryRun:false})
 assert.deepEqual([...ctx.rows.keys()],['real'])
})
