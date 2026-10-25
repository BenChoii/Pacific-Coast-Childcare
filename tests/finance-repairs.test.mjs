import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { webcrypto } from 'node:crypto'

// Real finance handlers, real tenant helpers and real upload ownership checks.
// Only Convex transport/auth and outbound owner-alert delivery are replaced.
// All database records and Stripe HTTP responses in this suite are local mocks.
const bundle = await build({
  stdin: { contents: "export * as invoices from './convex/invoices'; export * as payments from './convex/payments'; export * as billing from './convex/billing'; export * as books from './convex/bookkeeping'; export * as payroll from './convex/payroll'; export * as educators from './convex/educators'; export * as extras from './convex/extras'; export * as subsidies from './convex/subsidies'; export * as money from './convex/financeUtils';", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  plugins: [{ name: 'mock-transport', setup(b) {
    b.onResolve({filter: /@convex-dev\/auth\/server|\.\/_generated\/(server|api)|\.\/notifications$/}, args => ({path:args.path,namespace:'mock'}))
    b.onLoad({filter:/.*/,namespace:'mock'}, ({path}) => ({contents:
      path.includes('auth/server') ? 'export async function getAuthUserId(ctx){return ctx.uid ?? null}' :
      path.includes('notifications') ? 'export async function recordOwnerEvent(ctx,event){ctx.events.push(event)}' :
      path.endsWith('/api') ? "const ref = path => new Proxy(()=>{}, {get:(_,key)=>key==='path'?path:ref(path?path+'.'+key:String(key))}); export const api=ref(''); export const internal=ref('');" :
      'export const query=x=>x;export const mutation=x=>x;export const internalMutation=x=>x;export const internalQuery=x=>x;export const action=x=>x;'
    }))
  }}],
})
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
function fixture(extra=[]) {
  const rows=new Map([
    ['f',{_id:'f',table:'facilities',name:'Daycare',ownerUserId:'owner',timezone:'America/Vancouver',autoInvoice:true}],
    ['owner',{_id:'owner',table:'users',role:'admin',facilityId:'f',name:'Owner'}],
    ['parent',{_id:'parent',table:'users',role:'parent',facilityId:'f'}],
    ['staff',{_id:'staff',table:'users',role:'staff',facilityId:'f'}],
    ['child',{_id:'child',table:'children',parentUserId:'parent',facilityId:'f',name:'Child',monthlyTuition:100}],
    ...extra.map(row=>[row._id,row]),
  ])
  let counter=0
  const ctx={uid:'owner',rows,events:[],writes:[],storage:{getUrl:async()=>{throw Error('Permanent URLs must not be requested')},delete:async()=>{}},db:{
    get:async id=>rows.get(id)??null,
    patch:async(id,values)=>{ctx.writes.push({id,values}); Object.assign(rows.get(id),values)},
    insert:async(table,values)=>{const id=`new-${++counter}`;ctx.writes.push({id,table,values});rows.set(id,{_id:id,table,...values});return id},
    delete:async id=>{ctx.writes.push({id,delete:true});rows.delete(id)},
    query(table){let selected=[...rows.values()].filter(row=>row.table===table);return {
      withIndex(_name,callback){const q={eq(key,val){selected=selected.filter(row=>row[key]===val);return q},gte(){return q},lte(){return q}};callback(q);return this},
      order(){selected.reverse();return this},collect:async()=>selected,take:async n=>selected.slice(0,n),first:async()=>selected[0]??null,
    }},
  }}
  ctx.runMutation=async(ref,args)=>{const [module,name]=ref.path.split('.');return api[module][name].handler(ctx,args)}
  ctx.runQuery=ctx.runMutation
  return ctx
}
const invoice=(fields={})=>({_id:'inv',table:'invoices',facilityId:'f',invId:'INV-1',parentUserId:'parent',period:'Oct 2026',amount:100,status:'due',items:[{label:'Tuition',amt:100}],order:1,...fields})
const educator=(fields={})=>({_id:'ed',table:'educators',facilityId:'f',name:'Educator',role:'ECE',status:'out',todaySeconds:999999,hoursWeek:80,punches:[],payType:'hourly',payRate:20,vacationPct:4,...fields})
const makeInvoice=fields=>({parentUserId:'parent',billTo:'Family',period:'Oct 2026',due:'Oct 15, 2026',items:[{label:'Tuition',amt:100}],includeExtras:true,...fields})

test('extras and monthly plans preserve cents and expire subsidies against invoice month',async()=>{
  const ctx=fixture([
    {_id:'extra',table:'extraCharges',facilityId:'f',childId:'child',serviceName:'Lunch',amount:10.25,status:'unbilled',createdAt:Date.parse('2026-10-01T12:00:00Z')},
    {_id:'plan',table:'planSubscriptions',facilityId:'f',childId:'child',serviceName:'Meals',monthlyAmount:20.55,active:true},
    {_id:'sub',table:'subsidies',facilityId:'f',childId:'child',type:'other',status:'approved',monthlyAmount:5.15,startDate:'2026-10-01',expiryDate:'2026-10-31'},
    {_id:'expired',table:'subsidies',facilityId:'f',childId:'child',type:'other',status:'approved',monthlyAmount:1000,expiryDate:'2026-09-30'},
    {_id:'future',table:'subsidies',facilityId:'f',childId:'child',type:'other',status:'approved',monthlyAmount:1000,startDate:'2026-11-01'},
  ])
  const result=await api.invoices.create.handler(ctx,makeInvoice())
  assert.equal(result.amount,125.65)
  assert.equal(ctx.rows.get('extra').status,'billed')
  assert.equal(ctx.events[0].type,'invoice_created')
})
test('monthly zero/negative invoice does not lose unbilled extras; NaN input is rejected',async()=>{
  const ctx=fixture([
    {_id:'child',table:'children',parentUserId:'parent',facilityId:'f',name:'Child',monthlyTuition:0},
    {_id:'extra',table:'extraCharges',facilityId:'f',childId:'child',serviceName:'Lunch',amount:10.25,status:'unbilled'},
    {_id:'sub',table:'subsidies',facilityId:'f',childId:'child',type:'other',status:'approved',monthlyAmount:100},
  ])
  assert.deepEqual(await api.invoices.generateMonthly.handler(ctx,{}),{created:0})
  assert.equal(ctx.rows.get('extra').status,'unbilled')
  await assert.rejects(api.invoices.create.handler(ctx,makeInvoice({items:[{label:'Broken',amt:NaN}]})),/finite/)
})
test('paid, void, processing and another-family invoices cannot create charge attempts',async()=>{
  for (const status of ['paid','void','processing']) {
    const ctx=fixture([invoice({status})]);ctx.uid='parent'
    await assert.rejects(api.invoices.beginCheckout.handler(ctx,{id:'INV-1'}),/already|awaiting|canceled/)
    assert.equal(ctx.writes.length,0)
  }
  const ctx=fixture([invoice({parentUserId:'someone-else'})]);ctx.uid='parent'
  await assert.rejects(api.invoices.beginCheckout.handler(ctx,{id:'INV-1'}),/not found/)
})
test('checkout attempts are reused and any recorded prior session can reconcile exact amount/account',async()=>{
  const ctx=fixture([invoice()]);ctx.uid='parent'
  const first=await api.invoices.beginCheckout.handler(ctx,{id:'INV-1'})
  const again=await api.invoices.beginCheckout.handler(ctx,{id:'INV-1'})
  assert.equal(first.attemptId,again.attemptId)
  await api.invoices.attachAttempt.handler(ctx,{attemptId:first.attemptId,sessionId:'cs_first',url:'https://checkout.stripe.com/test'})
  ctx.rows.get('inv').stripeSessionId='cs_later'
  for(const invalid of [{amountCents:9999},{currency:'usd'},{accountId:'acct_wrong'}]) {
    await assert.rejects(api.invoices.recordVerifiedPayment.handler(ctx,{id:'INV-1',sessionId:'cs_first',paidOn:'2026-10-25',amountCents:10000,currency:'cad',...invalid}),/does not match/)
  }
  await api.invoices.recordVerifiedPayment.handler(ctx,{id:'INV-1',sessionId:'cs_first',paidOn:'2026-10-25',amountCents:10000,currency:'cad'})
  assert.equal(ctx.rows.get('inv').status,'paid')
  const count=ctx.events.length
  await api.invoices.recordVerifiedPayment.handler(ctx,{id:'INV-1',sessionId:'cs_first',paidOn:'2026-10-25',amountCents:10000,currency:'cad'})
  assert.equal(ctx.events.length,count)
})
test('checkout callback stays on app and duplicate API calls use Stripe idempotency key',async()=>{
  const ctx=fixture([invoice()]);ctx.uid='parent'
  const oldFetch=globalThis.fetch,oldKey=process.env.STRIPE_SECRET_KEY
  process.env.STRIPE_SECRET_KEY='unit-test-only'
  const requests=[]
  globalThis.fetch=async(_url,opts)=>{requests.push(opts);return {ok:true,json:async()=>({id:'cs_local',url:'https://checkout.stripe.com/local'})}}
  try{
    const a=await api.payments.createCheckoutSession.handler(ctx,{id:'INV-1',origin:'https://mitten.care'})
    const b=await api.payments.createCheckoutSession.handler(ctx,{id:'INV-1',origin:'https://mitten.care'})
    assert.equal(a.url,b.url);assert.equal(requests.length,1)
    assert.match(new URLSearchParams(requests[0].body).get('success_url'),/^https:\/\/mitten.care\/app\?stripe=success/)
    assert.match(requests[0].headers['Idempotency-Key'],/^tuition-/)
    const bad=await api.payments.createCheckoutSession.handler(ctx,{id:'INV-1',origin:'https://attacker.invalid'})
    assert.match(bad.error,/return address/)
  } finally {globalThis.fetch=oldFetch;if(oldKey===undefined) delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=oldKey}
})
test('signed payment webhook records once and failed reconciliation is not marked consumed',async()=>{
  const ctx=fixture([invoice(),{_id:'a',table:'paymentAttempts',facilityId:'f',invoiceId:'inv',invId:'INV-1',amountCents:10000,currency:'cad',status:'open',stripeSessionId:'cs_webhook'}])
  const event={eventId:'evt_1',type:'checkout.session.completed',data:{object:{id:'cs_webhook',mode:'payment',payment_status:'paid',amount_total:10000,currency:'cad',metadata:{invId:'INV-1'}}}}
  await api.billing.handleStripeEvent.handler(ctx,event)
  await api.billing.handleStripeEvent.handler(ctx,event)
  assert.equal(ctx.rows.get('inv').status,'paid')
  assert.equal([...ctx.rows.values()].filter(row=>row.table==='stripeWebhookEvents').length,1)
  await assert.rejects(api.billing.handleStripeEvent.handler(ctx,{...event,eventId:'evt_bad',data:{object:{...event.data.object,amount_total:1}}}),/does not match/)
  assert.equal([...ctx.rows.values()].some(row=>row.eventId==='evt_bad'),false)
})
test('bookkeeping is director-only and unregistered/cross-owner attachments are rejected',async()=>{
  const ctx=fixture([{_id:'book',table:'bookkeepingDocs',facilityId:'f',storageId:'private',amount:12.34,createdAt:1}])
  ctx.uid='staff'
  assert.deepEqual(await api.books.listByFacility.handler(ctx,{}),[])
  await assert.rejects(api.books.remove.handler(ctx,{id:'book'}),/director/)
  ctx.uid='owner'
  const rows=await api.books.listByFacility.handler(ctx,{})
  assert.equal(rows[0].hasFile,true);assert.equal(rows[0].fileUrl,null)
  await assert.rejects(api.books.add.handler(ctx,{storageId:'unregistered'}),/not uploaded/)
  ctx.rows.set('upload',{_id:'upload',table:'storedUploads',facilityId:'different',uploadedBy:'owner',purpose:'bookkeeping',storageId:'private'})
  await assert.rejects(api.books.add.handler(ctx,{storageId:'private'}),/not uploaded/)
  ctx.rows.get('upload').facilityId='f'
  await api.books.add.handler(ctx,{storageId:'private',amount:1.005})
  assert.equal(ctx.events.at(-1).type,'bookkeeping_document_added')
})
test('payroll rejects invalid/reversed/duplicate periods and preserves void history',async()=>{
  const ctx=fixture([educator()])
  const args={periodStart:'2026-10-01',periodEnd:'2026-10-14',entries:[{educatorId:'ed',regularHours:70,otHours:2,statPay:10}]}
  await assert.rejects(api.payroll.runPayroll.handler(ctx,{...args,periodStart:'2026-99-99'}),/valid date/)
  await assert.rejects(api.payroll.runPayroll.handler(ctx,{...args,periodStart:'2026-10-20'}),/valid date/)
  await assert.rejects(api.payroll.runPayroll.handler(ctx,{...args,entries:[args.entries[0],args.entries[0]]}),/distinct/)
  await assert.rejects(api.payroll.runPayroll.handler(ctx,{...args,entries:[{...args.entries[0],regularHours:NaN}]}),/valid nonnegative/)
  const run=await api.payroll.runPayroll.handler(ctx,args)
  assert.equal(run.totalGross,1470)
  await assert.rejects(api.payroll.runPayroll.handler(ctx,args),/already covers/)
  await api.payroll.deleteRun.handler(ctx,{runId:run.runId})
  assert.equal(ctx.rows.get(run.runId).status,'void')
  assert.deepEqual(await api.payroll.listRuns.handler(ctx,{}),[])
  assert.equal((await api.payroll.listRuns.handler(ctx,{includeVoided:true})).length,1)
})
test('staff clock uses persistent shifts, resets local daily display and supplies actual period hours',async()=>{
  const ctx=fixture([educator(),{_id:'yesterday',table:'clockSessions',facilityId:'f',educatorId:'ed',startedAt:Date.parse('2026-10-20T16:00:00Z'),endedAt:Date.parse('2026-10-20T20:00:00Z')}])
  const rows=await api.educators.list.handler(ctx,{})
  assert.equal(rows[0].todaySeconds,0)
  const hours=await api.payroll.hoursForPeriod.handler(ctx,{periodStart:'2026-10-20',periodEnd:'2026-10-20'})
  assert.equal(hours[0].hours,4)
  await api.educators.clock.handler(ctx,{id:'ed',time:'spoofed'})
  assert.equal(ctx.rows.get('ed').status,'in')
  await api.educators.clock.handler(ctx,{id:'ed',time:'spoofed'})
  assert.equal(ctx.rows.get('ed').status,'out')
  assert.equal([...ctx.rows.values()].filter(row=>row.table==='clockSessions').length,2)
  ctx.uid='staff'
  await assert.rejects(api.educators.clock.handler(ctx,{id:'ed',time:'now'}),/own attendance/)
})
test('local period clipping handles Vancouver daylight-saving boundaries',()=>{
  assert.equal(api.money.dayStart('2026-11-02')-api.money.dayStart('2026-11-01'),25*3600000)
  assert.equal(api.money.dayStart('2026-03-09')-api.money.dayStart('2026-03-08'),23*3600000)
  assert.equal(api.money.validDate('2026-99-99'),false)
  assert.equal(api.money.cents(1.005),101)
})
test('Stripe signature fails closed, rejects stale events and supports rotated signing secrets',async()=>{
  const source=await readFile(new URL('../convex/http.js',import.meta.url),'utf8')
  const fn=source.slice(source.indexOf('export async function verifyStripeSignature'),source.indexOf("http.route({\n  path: '/stripe/webhook'"))
  const {verifyStripeSignature}=await import(`data:text/javascript;base64,${Buffer.from(fn).toString('base64')}`)
  globalThis.crypto ||= webcrypto
  const payload='{"id":"evt_test"}',secret='local-test-secret',now=Date.now(),t=String(Math.floor(now/1000))
  const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,enc.encode(`${t}.${payload}`))).toString('hex')
  assert.equal(await verifyStripeSignature(payload,`t=${t},v1=${sig}`,undefined,now),false)
  assert.equal(await verifyStripeSignature(payload,`t=${t},v1=${sig}`,secret,now+301000),false)
  assert.equal(await verifyStripeSignature(payload,`t=${t},v1=${'0'.repeat(64)},v1=${sig}`,secret,now),true)
})

test('cross-midnight shifts split at the facility midnight instead of carrying yesterday totals',async()=>{
  const originalNow=Date.now
  Date.now=()=>Date.parse('2026-10-25T10:00:00Z')
  try {
    const ctx=fixture([educator(),{_id:'overnight',table:'clockSessions',facilityId:'f',educatorId:'ed',startedAt:Date.parse('2026-10-25T05:00:00Z'),endedAt:Date.parse('2026-10-25T09:00:00Z')}])
    assert.equal((await api.educators.list.handler(ctx,{}))[0].todaySeconds,7200)
    assert.equal((await api.payroll.hoursForPeriod.handler(ctx,{periodStart:'2026-10-24',periodEnd:'2026-10-24'}))[0].hours,2)
    assert.equal((await api.payroll.hoursForPeriod.handler(ctx,{periodStart:'2026-10-25',periodEnd:'2026-10-25'}))[0].hours,2)
  } finally {Date.now=originalNow}
})
test('bookkeeping edit explicitly clears optional fields without clearing protected metadata',async()=>{
  const ctx=fixture([{_id:'book',table:'bookkeepingDocs',facilityId:'f',vendor:'Old vendor',amount:50}])
  await api.books.update.handler(ctx,{id:'book',clearFields:['vendor','amount']})
  assert.equal(ctx.rows.get('book').vendor,undefined)
  assert.equal(ctx.rows.get('book').amount,undefined)
  await assert.rejects(api.books.update.handler(ctx,{id:'book',clearFields:['facilityId']}),/cannot be cleared/)
  assert.equal(ctx.rows.get('book').facilityId,'f')
})
test('subscription return requires current director and matching facility, not only a complete Stripe session',async()=>{
  const ctx=fixture()
  const savedFetch=globalThis.fetch,savedKey=process.env.STRIPE_SECRET_KEY
  process.env.STRIPE_SECRET_KEY='local-unit-test'
  globalThis.fetch=async()=>({ok:true,json:async()=>({mode:'subscription',status:'complete',payment_status:'paid',subscription:'sub_other',metadata:{facilityId:'other-facility'}})})
  try {
    assert.deepEqual(await api.billing.confirmSubscription.handler(ctx,{sessionId:'cs_other'}),{ok:false})
    assert.equal(ctx.writes.length,0)
    ctx.uid='parent'
    assert.deepEqual(await api.billing.confirmSubscription.handler(ctx,{sessionId:'cs_other'}),{ok:false})
  } finally {globalThis.fetch=savedFetch;if(savedKey===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=savedKey}
})
test('actual Stripe HTTP handler returns retryable error instead of acknowledging failed database updates',async()=>{
  const source=await readFile(new URL('../convex/http.js',import.meta.url),'utf8')
  const slice=source.slice(source.indexOf('export async function verifyStripeSignature'),source.indexOf('// ── Public childcare directory'))
  const module=`let route; const http={route: value=>{route=value}}; const httpAction=value=>value; const internal={billing:{handleStripeEvent:'event'}}; ${slice}\nexport const handler=route.handler;`
  const {handler}=await import(`data:text/javascript;base64,${Buffer.from(module).toString('base64')}`)
  const payload=JSON.stringify({id:'evt_http',type:'invoice.payment_failed',data:{object:{}}}),secret='local-test-secret',timestamp=String(Math.floor(Date.now()/1000))
  const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,enc.encode(`${timestamp}.${payload}`))).toString('hex')
  const saved=process.env.STRIPE_WEBHOOK_SECRET
  const request=()=>new Request('https://local.invalid/stripe/webhook',{method:'POST',body:payload,headers:{'stripe-signature':`t=${timestamp},v1=${sig}`}})
  try {
    delete process.env.STRIPE_WEBHOOK_SECRET
    assert.equal((await handler({},request())).status,503)
    process.env.STRIPE_WEBHOOK_SECRET=secret
    assert.equal((await handler({runMutation:async()=>{throw new Error('Simulated DB interruption')}},request())).status,500)
    assert.equal((await handler({runMutation:async()=>{}},request())).status,200)
  } finally {if(saved===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;else process.env.STRIPE_WEBHOOK_SECRET=saved}
})
test('changed payroll and bookkeeping interfaces parse without writing a production bundle',async()=>{
  const {transform}=await import('esbuild')
  for(const path of ['../src/views/payroll.jsx','../src/views/bookkeeping.jsx']) {
    const source=await readFile(new URL(path,import.meta.url),'utf8')
    await transform(source,{loader:'jsx',format:'esm',logLevel:'silent'})
  }
})

test('archiving financial documents preserves the record and original file for director history',async()=>{
  const ctx=fixture([{_id:'book',table:'bookkeepingDocs',facilityId:'f',storageId:'private',amount:12.34,createdAt:1}])
  await api.books.remove.handler(ctx,{id:'book'})
  assert.ok(ctx.rows.get('book').archivedAt)
  assert.equal(ctx.rows.get('book').storageId,'private')
  assert.deepEqual(await api.books.listByFacility.handler(ctx,{}),[])
  assert.equal((await api.books.listByFacility.handler(ctx,{includeArchived:true})).length,1)
  assert.equal((await api.books.summary.handler(ctx,{})).expense,0)
})


test('secondary guardians see their active child extras and subsidies without exposing another family',async()=>{
  const ctx=fixture([
    {_id:'guardian',table:'users',facilityId:'f',role:'parent'},
    {_id:'child',table:'children',facilityId:'f',name:'Child',parentUserId:'parent',guardianUserIds:['guardian']},
    {_id:'extra',table:'extraCharges',facilityId:'f',childId:'child',childName:'Child',serviceName:'Lunch',amount:10.25,status:'unbilled',createdAt:Date.parse('2026-10-01T12:00:00Z')},
    {_id:'plan',table:'planSubscriptions',facilityId:'f',childId:'child',childName:'Child',serviceName:'Meals',monthlyAmount:20.55,active:true},
    {_id:'sub',table:'subsidies',facilityId:'f',childId:'child',type:'other',status:'approved',monthlyAmount:5.15},
    {_id:'foreignsub',table:'subsidies',facilityId:'f',childId:'otherchild',type:'other',status:'approved',monthlyAmount:100},
  ])
  ctx.uid='guardian'
  assert.equal((await api.extras.listCharges.handler(ctx,{})).length,1)
  assert.equal((await api.extras.listSubscriptions.handler(ctx,{})).length,1)
  assert.deepEqual((await api.subsidies.listByFacility.handler(ctx,{})).map(row=>row.id),['sub'])
  ctx.rows.get('child').archivedAt=Date.now()
  assert.deepEqual(await api.extras.listCharges.handler(ctx,{}),[])
  assert.deepEqual(await api.subsidies.listByFacility.handler(ctx,{}),[])
})


test('actual extra-charge and plan writers feed their stored dollar fields into invoice generation',async()=>{
  const ctx=fixture([
    {_id:'svc',table:'extraServices',facilityId:'f',name:'Late pickup',emoji:'Clock',kind:'incident',pricing:'flat',amount:9.50,active:true},
    {_id:'meals',table:'extraServices',facilityId:'f',name:'Meals',emoji:'Meal',kind:'plan',pricing:'monthly',amount:10.25,active:true},
  ])
  await api.extras.logCharge.handler(ctx,{serviceId:'svc',childId:'child',childName:'Child'})
  await api.extras.subscribePlan.handler(ctx,{serviceId:'meals',childId:'child'})
  const created=await api.invoices.create.handler(ctx,makeInvoice())
  assert.equal(created.amount,119.75)
  const stored=[...ctx.rows.values()].find(row=>row.table==='invoices')
  assert.equal(stored.items.some(item=>item.label.includes('undefined')),false)
  assert.equal([...ctx.rows.values()].find(row=>row.table==='extraCharges').status,'billed')
})
