import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({ entryPoints: ['convex/notifications.ts'], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'isolated-transport', setup(b) {
  b.onResolve({ filter: /^\.\/_generated\/server$/ }, () => ({ path: 'server', namespace: 'mock' }))
  b.onResolve({ filter: /^\.\/_generated\/api$/ }, () => ({ path: 'api', namespace: 'mock' }))
  b.onResolve({ filter: /^@convex-dev\/auth\/server$/ }, () => ({ path: 'auth', namespace: 'mock' }))
  b.onResolve({ filter: /^convex\/values$/ }, () => ({ path: 'values', namespace: 'mock' }))
  b.onResolve({ filter: /^\.\/lib$/ }, () => ({ path: 'lib', namespace: 'mock' }))
  b.onLoad({ filter: /.*/, namespace: 'mock' }, ({path}) => ({ contents: ({
    auth: 'export const getAuthUserId=async ctx=>ctx.uid;',
    server: 'export const query=x=>x,mutation=x=>x,internalQuery=x=>x,internalMutation=x=>x;',
    api: 'export const internal={ownerEmail:{deliver:"deliver"}};',
    values: 'export const v = new Proxy({}, {get:()=>()=>({})});',
    lib: 'let token=0;export const randomToken=()=>String(++token);export const requireFacility=async ctx=>ctx.membership;',
  })[path] }))
} }] })
const api = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
function context() {
 const docs = {facility:{_id:'facility',ownerUserId:'owner',name:'Daycare'},owner:{_id:'owner',email:'owner@example.com'}}
 const scheduled=[]
 return {docs,scheduled,membership:{user:{role:'admin'},facilityId:'facility'},db:{get:async id=>docs[id]||null,insert:async(_t,data)=>{docs.event={...data,_id:'event'};return 'event'},patch:async(id,data)=>Object.assign(docs[id],data)},scheduler:{runAfter:async(...args)=>scheduled.push(args)}}
}
test('owner event and delivery are recorded together; demo actions never send mail',async()=>{
 const ctx=context();await api.recordOwnerEvent(ctx,{facilityId:'facility',type:'onboarded',summary:'A parent joined'})
 assert.equal(ctx.docs.event.status,'pending');assert.equal(ctx.scheduled.length,1)
 ctx.docs.facility.isDemo=true;await api.recordOwnerEvent(ctx,{facilityId:'facility',type:'ignored',summary:'demo'});assert.equal(ctx.scheduled.length,1)
})
test('only one delivery can claim an event; destination resolves from correct facility owner',async()=>{
 const ctx=context();await api.recordOwnerEvent(ctx,{facilityId:'facility',type:'onboarded',summary:'A parent joined'})
 const event=await api.claim.handler(ctx,{id:'event'});assert.equal(event.email,'owner@example.com');assert.equal(await api.claim.handler(ctx,{id:'event'}),null)
 await api.finish.handler(ctx,{id:'event',ok:true,deliveryToken:event.deliveryToken});assert.equal(ctx.docs.event.status,'sent');assert.ok(ctx.docs.event.sentAt)
})
test('mail failures have bounded retries and remain visible; parents cannot manually resend',async()=>{
 const ctx=context();await api.recordOwnerEvent(ctx,{facilityId:'facility',type:'updated',summary:'Calendar updated'})
 for(let i=0;i<3;i++){const claim=await api.claim.handler(ctx,{id:'event'});await api.finish.handler(ctx,{id:'event',ok:false,error:'Delivery failed',deliveryToken:claim.deliveryToken})}
 assert.equal(ctx.docs.event.status,'failed');assert.equal(ctx.docs.event.attempts,3);assert.equal(ctx.scheduled.length,3)
 ctx.membership.user.role='parent';await assert.rejects(api.retry.handler(ctx,{id:'event'}),/Directors only/)
})
