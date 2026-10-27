import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { queryRows } from './test-db-query.mjs'

// Actual authorization, outbox, HTTP, relay and AppContext code; local DB,
// transport/auth lookup and SMTP boundaries only. No live data or sends.
const root=fileURLToPath(new URL('../',import.meta.url))
const result=await build({stdin:{contents:"export * as privateFiles from './convex/privateFiles'; export * as privateHttp from './convex/privateFileHttp'; export * as notifications from './convex/notifications'; export * as ownerEmail from './convex/ownerEmail'; export * as preferences from './convex/preferences'; export * as users from './convex/users'; export * as access from './convex/lib'; export {default as recoveryRelay} from './api/auth-email';",resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'transport-only',setup(b){
 b.onResolve({filter:/@convex-dev\/auth\/server|\.\/_generated\/(server|api)$|^nodemailer$/},a=>({path:a.path,namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},({path})=>({contents:
 path==='nodemailer'? 'export default {createTransport:()=>({sendMail:async mail=>globalThis.__smtpMessages.push(mail)})};':
 path.includes('auth/server')?'export const getAuthUserId=async ctx=>ctx.uid??null;':
 path.endsWith('/api')?"const ref=path=>new Proxy(()=>{}, {get:(_,key)=>key==='path'?path:ref(path?path+'.'+key:String(key))});export const internal=ref('');":
 'export const query=x=>x,mutation=x=>x,internalQuery=x=>x,internalMutation=x=>x,internalAction=x=>x,httpAction=x=>x;'
 }))
}}]})
const api=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
function fixture(){
 const rows=new Map([
 ['f',{_id:'f',table:'facilities',ownerUserId:'owner',name:'Daycare'}],['g',{_id:'g',table:'facilities',name:'Other'}],
 ['owner',{_id:'owner',table:'users',role:'admin',facilityId:'f',email:'owner@example.test'}],
 ['admin2',{_id:'admin2',table:'users',role:'admin',facilityId:'f'}],
 ['parent',{_id:'parent',table:'users',role:'parent',facilityId:'f'}],
 ['guardian',{_id:'guardian',table:'users',role:'parent',facilityId:'f'}],
 ['staff',{_id:'staff',table:'users',role:'staff',facilityId:'f'}],
 ['outsider',{_id:'outsider',table:'users',role:'admin',facilityId:'g'}],
 ['child',{_id:'child',table:'children',facilityId:'f',parentUserId:'parent',guardianUserIds:['guardian'],name:'Child'}],
 ['other',{_id:'other',table:'children',facilityId:'f',parentUserId:'different-parent',name:'Other'}],
 ['document',{_id:'document',table:'childDocuments',facilityId:'f',childId:'child',storageId:'care-file',label:'Consent.pdf'}],
 ['otherDoc',{_id:'otherDoc',table:'childDocuments',facilityId:'f',childId:'other',storageId:'other-file',label:'Other.pdf'}],
 ['book',{_id:'book',table:'bookkeepingDocs',facilityId:'f',storageId:'book-file',fileName:'Receipt.pdf'}],
 ['profile',{_id:'profile',table:'employeeProfiles',facilityId:'f',documents:[{storageId:'hr-file',name:'Certificate.pdf'}]}],
 ])
 let n=0
 const ctx={uid:'owner',rows,scheduled:[],storageReads:[],db:{get:async id=>rows.get(id)??null,patch:async(id,values)=>{for(const[key,value]of Object.entries(values)){if(value===undefined)delete rows.get(id)[key];else rows.get(id)[key]=value}},insert:async(table,data)=>{const id=`event${++n}`;rows.set(id,{_id:id,table,...data});return id},query:table=>queryRows(()=>[...rows.values()].filter(row=>row.table===table))},scheduler:{runAfter:async(...args)=>ctx.scheduled.push(args)},storage:{get:async id=>{ctx.storageReads.push(id);return new Blob(['private file'],{type:'application/pdf'})}}}
 ctx.runQuery=async(ref,args)=>{const[module,name]=ref.path.split('.');return api[module][name].handler(ctx,args)}
 ctx.runMutation=ctx.runQuery
 return ctx
}
const routes=[];api.privateHttp.registerPrivateFiles({route:value=>routes.push(value)})
const download=routes.find(route=>route.method==='GET').handler
const request=(storageId,authorization='Bearer mock-jwt',origin='https://mitten.care')=>new Request(`https://unit.convex.site/files/private?storageId=${storageId}`,{headers:{...(authorization?{Authorization:authorization}:{}),Origin:origin}})

test('private care downloads authorize both guardians, reject other children/tenants and never expose permanent URLs',async()=>{
 const ctx=fixture();ctx.uid='guardian'
 assert.equal((await api.privateFiles.authorizeDownload.handler(ctx,{storageId:'care-file'})).name,'Consent.pdf')
 for(const storageId of ['other-file','book-file','hr-file']) await assert.rejects(api.privateFiles.authorizeDownload.handler(ctx,{storageId}),/not available/)
 ctx.uid='outsider';await assert.rejects(api.privateFiles.authorizeDownload.handler(ctx,{storageId:'book-file'}),/not available/)
 ctx.uid='owner';for(const storageId of ['book-file','hr-file','care-file']) assert.ok(await api.privateFiles.authorizeDownload.handler(ctx,{storageId}))
 ctx.uid='staff';await assert.rejects(api.privateFiles.authorizeDownload.handler(ctx,{storageId:'hr-file'}),/not available/)
})
test('suspension or child release denies a retained parent session before any private storage read',async()=>{
 const ctx=fixture();ctx.uid='guardian';ctx.rows.get('guardian').accessStatus='suspended'
 const denied=await download(ctx,request('care-file'))
 assert.equal(denied.status,403);assert.deepEqual(ctx.storageReads,[])
 delete ctx.rows.get('guardian').accessStatus;ctx.rows.get('child').archivedAt=Date.now()
 assert.equal((await download(ctx,request('care-file'))).status,403);assert.deepEqual(ctx.storageReads,[])
 ctx.uid=null;assert.equal((await download(ctx,request('care-file'))).status,403)
 assert.equal((await download(ctx,request('care-file',''))).status,401)
})
test('authorized private HTTP download has no-store attachment headers; arbitrary origin cannot bypass authorization',async()=>{
 const ctx=fixture();ctx.uid='parent'
 const response=await download(ctx,request('care-file'))
 assert.equal(response.status,200);assert.equal(await response.text(),'private file')
 assert.match(response.headers.get('cache-control'),/no-store/)
 assert.match(response.headers.get('content-disposition'),/^attachment;/)
 assert.equal(response.headers.get('x-content-type-options'),'nosniff')
 assert.equal(response.headers.get('access-control-allow-credentials'),null)
 ctx.uid='outsider'
 assert.equal((await download(ctx,request('care-file','Bearer invalid','https://attacker.invalid'))).status,403)
})
test('owner email preference is owner-only and muted queued deliveries stay in activity without sending',async()=>{
 const ctx=fixture();ctx.uid='admin2'
 await assert.rejects(api.preferences.setOwnerEmailMode.handler(ctx,{mode:'off'}),/Only the daycare owner/)
 ctx.uid='owner';await api.notifications.recordOwnerEvent(ctx,{facilityId:'f',type:'photo_added',summary:'Photo added'})
 await api.preferences.setOwnerEmailMode.handler(ctx,{mode:'off'})
 assert.equal(await api.notifications.claim.handler(ctx,{id:'event1'}),null)
 assert.equal(ctx.rows.get('event1').status,'recorded')
 ctx.rows.get('f').ownerEmailMode='all'
 await api.notifications.recordOwnerEvent(ctx,{facilityId:'f',type:'photo_added',summary:'Photo added'})
 ctx.rows.get('f').ownerEmailMode='important'
 assert.equal(await api.notifications.claim.handler(ctx,{id:'event2'}),null)
 await api.notifications.recordOwnerEvent(ctx,{facilityId:'f',type:'payment_confirmed',summary:'Payment confirmed'})
 assert.equal((await api.notifications.claim.handler(ctx,{id:'event3'})).email,'owner@example.test')
})
test('outbox single claim lease prevents stale completion; interrupted jobs recover with a new token',async()=>{
 const ctx=fixture();await api.notifications.recordOwnerEvent(ctx,{facilityId:'f',type:'invoice_created',summary:'Invoice issued'})
 const first=await api.notifications.claim.handler(ctx,{id:'event1'})
 assert.equal(await api.notifications.claim.handler(ctx,{id:'event1'}),null)
 ctx.rows.get('event1').sendingAt=Date.now()-121000
 assert.deepEqual(await api.notifications.recoverInterrupted.handler(ctx,{}),{recovered:1})
 const second=await api.notifications.claim.handler(ctx,{id:'event1'})
 assert.notEqual(first.deliveryToken,second.deliveryToken)
 await api.notifications.finish.handler(ctx,{id:'event1',deliveryToken:first.deliveryToken,ok:true})
 assert.equal(ctx.rows.get('event1').status,'sending')
 await api.notifications.finish.handler(ctx,{id:'event1',deliveryToken:second.deliveryToken,ok:true})
 assert.equal(ctx.rows.get('event1').status,'sent')
})
test('parent and suspended director cannot read/retry owner alert records; foreign event retry is denied',async()=>{
 const ctx=fixture();await api.notifications.recordOwnerEvent(ctx,{facilityId:'f',type:'invoice_created',summary:'Invoice issued'})
 ctx.rows.get('event1').status='failed';ctx.uid='parent'
 await assert.rejects(api.notifications.list.handler(ctx,{}),/Directors/)
 await assert.rejects(api.notifications.retry.handler(ctx,{id:'event1'}),/Directors/)
 ctx.uid='outsider';await assert.rejects(api.notifications.retry.handler(ctx,{id:'event1'}),/not found/)
 ctx.uid='owner';ctx.rows.get('owner').accessStatus='suspended'
 await assert.rejects(api.notifications.list.handler(ctx,{}),/access has ended/)
})
function relayResponse(){return{headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(value){this.body=value;return this}}}
test('recovery relay requires trusted bearer, eight digits and ten-minute expiry with one-minute clock tolerance',async()=>{
 const savedKey=process.env.MITTEN_OWNER_EVENTS_KEY,savedPassword=process.env.MITTEN_SMTP_PASSWORD
 process.env.MITTEN_OWNER_EVENTS_KEY='local-unit-relay';process.env.MITTEN_SMTP_PASSWORD='local-no-network-mock'
 globalThis.__smtpMessages=[]
 const invoke=async(body,authorization='Bearer local-unit-relay')=>{const res=relayResponse();await api.recoveryRelay({method:'POST',headers:{authorization},body},res);return res}
 const valid={email:'parent@example.test',code:'01234567',expiresAt:Date.now()+10*60000}
 try {
   assert.equal((await invoke(valid,'Bearer wrong')).statusCode,401)
   assert.equal((await invoke({...valid,code:'123456'})).statusCode,400)
   assert.equal((await invoke({...valid,expiresAt:Date.now()+12*60000})).statusCode,400)
   assert.equal((await invoke({...valid,expiresAt:Date.now()-1})).statusCode,400)
   assert.equal((await invoke(valid)).statusCode,200)
   assert.equal(__smtpMessages.length,1);assert.match(__smtpMessages[0].text,/01234567/);assert.match(__smtpMessages[0].text,/10 minutes/)
 } finally {if(savedKey===undefined)delete process.env.MITTEN_OWNER_EVENTS_KEY;else process.env.MITTEN_OWNER_EVENTS_KEY=savedKey;if(savedPassword===undefined)delete process.env.MITTEN_SMTP_PASSWORD;else process.env.MITTEN_SMTP_PASSWORD=savedPassword;delete globalThis.__smtpMessages}
})

// Run the actual provider effects in their registered order with tiny local
// React/Convex adapters. This catches cached-auth callback cleanup regressions.
const provider=await build({entryPoints:[root+'src/context/AppContext.jsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',logLevel:'silent',plugins:[{name:'provider-hooks',setup(b){
 b.onResolve({filter:/^react$|^react\/jsx-runtime$|^convex\/react$|^@convex-dev\/auth\/react$|\/convex\/_generated\/api$/},a=>({path:a.path,namespace:'hooks'}))
 b.onLoad({filter:/.*/,namespace:'hooks'},({path})=>({contents:
 path==='react'?`const slot=init=>{const h=globalThis.__hooks,i=h.cursor++;if(!(i in h.slots))h.slots[i]=init();return h.slots[i]};export const createContext=()=>({Provider:'provider'}),useContext=()=>({}),useState=init=>{const s=slot(()=>({value:typeof init==='function'?init():init}));return[s.value,next=>s.value=typeof next==='function'?next(s.value):next]},useCallback=fn=>fn,useMemo=fn=>fn,useRef=value=>slot(()=>({current:value})),useEffect=(fn,deps)=>{const s=slot(()=>({}));if(!s.deps||!deps||deps.some((value,i)=>value!==s.deps[i]))globalThis.__hooks.effects.push(fn);s.deps=deps};`:
 path==='react/jsx-runtime'?'export const jsx=(type,props)=>{if(type===\'provider\')globalThis.__hooks.app=props.value;return{type,props}};export const jsxs=jsx;':
 path==='convex/react'?`export const useConvexAuth=()=>globalThis.__hooks.auth,useQuery=(ref,args)=>{globalThis.__hooks.queries.push([ref,args]);return args==='skip'?undefined:ref==='users.viewer'?globalThis.__hooks.viewer:ref==='facilities.current'?{id:'f',isOwner:true}:[]},useMutation=ref=>async args=>{globalThis.__hooks.calls.push([ref,args]);return globalThis.__hooks.reply(ref,args)},useAction=useMutation;`:
 path.includes('auth/react')?'export const useAuthActions=()=>({signOut:async()=>{}});export const useAuthToken=()=>null;':`export const api=new Proxy({},{get:(_,a)=>new Proxy({},{get:(_,b)=>a+'.'+b})});`
 }))
}}]})
const {AppProvider}=await import(`data:text/javascript;base64,${Buffer.from(provider.outputFiles[0].text).toString('base64')}`)
async function providerCase({url='https://mitten.care/app?stripe=success&inv=INV&session_id=cs_mock',authenticated=true,suspended=false,reply=()=>({ok:true})}={}){
 const saved={window:globalThis.window,document:globalThis.document,sessionStorage:globalThis.sessionStorage,setTimeout:globalThis.setTimeout,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval}
 let current=new URL(url);const storage=new Map()
 globalThis.window={location:current,history:{replaceState(_a,_b,next){current=new URL(next,current);window.location=current}}}
 globalThis.sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}
 globalThis.document={documentElement:{style:{fontSize:''}}}
 globalThis.setTimeout=()=>0;globalThis.setInterval=()=>0;globalThis.clearInterval=()=>{}
 const h=globalThis.__hooks={slots:[],cursor:0,effects:[],calls:[],queries:[],auth:{isAuthenticated:authenticated,isLoading:!authenticated},viewer:authenticated?{id:'parent',role:'parent',hasFacility:true,hasActiveChildren:true,accessStatus:suspended?'suspended':'active'}:undefined,reply}
 const render=async()=>{h.cursor=0;h.effects=[];AppProvider({children:null});for(const effect of h.effects)effect();await new Promise(resolve=>setImmediate(resolve));h.cursor=0;h.effects=[];AppProvider({children:null});return h}
 try {await render();return{h,render,cleanup(){Object.assign(globalThis,saved);delete globalThis.__hooks}}}catch(error){Object.assign(globalThis,saved);delete globalThis.__hooks;throw new Error(error.message)}
}
test('cached authenticated payment callback confirms before removing parameters and shows billing',async()=>{
 const current=await providerCase()
 try {assert.equal(current.h.calls.filter(([name])=>name==='payments.confirmCheckout').length,1);assert.equal(window.location.search,'');assert.equal(current.h.app.view,'billing');assert.equal(current.h.app.paymentReturnError,'')}
 finally{current.cleanup()}
})
test('unresolved auth retains callback; failed confirmation retains parameters and retry can recover',async()=>{
 let current=await providerCase({authenticated:false})
 try{assert.equal(current.h.calls.length,0);assert.match(window.location.search,/stripe=success/)}finally{current.cleanup()}
 let success=false
 current=await providerCase({reply:()=>({ok:success})})
 try{assert.match(current.h.app.paymentReturnError,/not been confirmed/);assert.match(window.location.search,/session_id/);success=true;current.h.app.retryPaymentReturn();await current.render();assert.equal(current.h.app.paymentReturnError,'');assert.equal(window.location.search,'')}
 finally{current.cleanup()}
})
test('suspended viewer never subscribes to child/photo/workspace data',async()=>{
 const current=await providerCase({url:'https://mitten.care/app',suspended:true})
 try{for(const[name,args]of current.h.queries.filter(([name])=>['activities.list','photos.list','children.list','facilities.current'].includes(name))) assert.equal(args,'skip',name)}
 finally{current.cleanup()}
})

test('schedule email deep-link opens Calendar and consumes only the known navigation parameter',async()=>{
 const current=await providerCase({url:'https://mitten.care/app?open=calendar&source=family-email'})
 try {
   assert.equal(current.h.app.view,'calendar')
   assert.equal(window.location.pathname,'/app');assert.equal(window.location.search,'?source=family-email')
   current.h.app.setView('messages');await current.render()
   assert.equal(current.h.app.view,'messages','ordinary renders must preserve in-progress navigation')
 } finally {current.cleanup()}
})
test('schedule email intent survives unresolved authentication and StrictMode effect replay',async()=>{
 const current=await providerCase({url:'https://mitten.care/app?open=calendar',authenticated:false})
 try {
   assert.equal(window.location.search,'?open=calendar')
   current.h.auth={isAuthenticated:true,isLoading:false}
   current.h.viewer={id:'parent',role:'parent',hasFacility:true,hasActiveChildren:true,accessStatus:'active'}
   await current.render();assert.equal(current.h.app.view,'calendar');assert.equal(window.location.search,'')
   for(const slot of current.h.slots)if(slot&&'deps'in slot)slot.deps=undefined
   await current.render();assert.equal(current.h.app.view,'calendar')
 } finally {current.cleanup()}
})
test('unknown navigation intent starts on the dashboard and a payment callback retains precedence',async()=>{
 let current=await providerCase({url:'https://mitten.care/app?open=unknown'})
 try{assert.equal(current.h.app.view,'home')}finally{current.cleanup()}
 current=await providerCase({url:'https://mitten.care/app?open=calendar&stripe=success&inv=INV&session_id=cs_mock'})
 try{assert.equal(current.h.app.view,'billing');assert.equal(current.h.calls.filter(([name])=>name==='payments.confirmCheckout').length,1);assert.equal(window.location.search,'')}finally{current.cleanup()}
})


test('owner delivery action passes its lease token and a second active worker never reaches the relay',async()=>{
 const ctx=fixture();await api.notifications.recordOwnerEvent(ctx,{facilityId:'f',type:'invoice_created',summary:'Invoice issued'})
 const savedKey=process.env.MITTEN_OWNER_EVENTS_KEY,savedFetch=globalThis.fetch
 process.env.MITTEN_OWNER_EVENTS_KEY='local-unit-event-key'
 let calls=0,release
 globalThis.fetch=async()=>{calls++;return await new Promise(resolve=>release=resolve)}
 try{
   const sending=api.ownerEmail.deliver.handler(ctx,{id:'event1'})
   await new Promise(resolve=>setImmediate(resolve))
   assert.equal(calls,1);assert.equal(ctx.rows.get('event1').status,'sending')
   await api.ownerEmail.deliver.handler(ctx,{id:'event1'})
   assert.equal(calls,1)
   release({ok:true});await sending
   assert.equal(ctx.rows.get('event1').status,'sent')
 }finally{globalThis.fetch=savedFetch;if(savedKey===undefined)delete process.env.MITTEN_OWNER_EVENTS_KEY;else process.env.MITTEN_OWNER_EVENTS_KEY=savedKey}
})
