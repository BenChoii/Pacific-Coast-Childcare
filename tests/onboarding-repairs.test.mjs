import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build, transform } from 'esbuild'

// Run only local exported handlers and the installed Password provider. The
// Convex transport/persistence/mail boundary is mocked; no backend is contacted.
// Fixed test key only, never load a deployment credential.
process.env.PRIVATE_FILES_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
const root = new URL('../', import.meta.url).pathname
const fixtures = {
  server: 'export const query=x=>x,mutation=x=>x,action=x=>x,internalQuery=x=>x,internalMutation=x=>x;',
  values: 'export const v=new Proxy({}, {get:()=>()=>({})});',
  api: `export const internal={users:{authIdentity:'authIdentity',reserveRecovery:'reserveRecovery'},onboarding:{activeToken:'activeToken',saveSubmission:'saveSubmission',adminFacilityId:'adminFacilityId',secretRow:'secretRow'},files:{registerStoredUpload:'registerStoredUpload'}};`,
  notifications: 'export const recordOwnerEvent=async(ctx,event)=>ctx.events.push(event);',
  lib: `export const requireFacility=async ctx=>ctx.membership,requireAdmin=async ctx=>ctx.membership,resolveFacilityId=async ctx=>ctx.fid,billingSummary=()=>({}),slugify=x=>x.toLowerCase().replace(/[^a-z0-9]+/g,'-'),FREE_LIMIT=5;
    let n=0;export const randomToken=()=>('local-token-'+(++n));
    export const childBelongsToParent=(child,userId)=>!!child&&(child.parentUserId===userId||(child.guardianUserIds||[]).includes(userId));`,
  auth: `export const convexAuth=cfg=>({auth:cfg,signIn:null,signOut:null,store:null,isAuthenticated:null});
    export const getAuthUserId=async ctx=>ctx.uid||null;
    export const createAccount=async(ctx,args)=>{ctx.authCalls.push(['create',args]);return {account:{emailVerified:false},user:{_id:'new-user'}}};
    export const retrieveAccount=async(ctx,args)=>{ctx.authCalls.push(['retrieve',args]);const a=ctx.rows.authAccounts.find(x=>x.providerAccountId===args.account.id);if(!a)return null;return {account:{...a,emailVerified:false},user:{_id:a.userId}}};
    export const invalidateSessions=async(ctx,args)=>ctx.authCalls.push(['invalidate',args]);
    export const modifyAccountCredentials=async(ctx,args)=>ctx.authCalls.push(['modify',args]);
    export const signInViaProvider=async(ctx,provider,args)=>{ctx.provider=provider;ctx.providerArgs=args;return ctx.resetResult??null};`,
}
async function load(file) {
  const result = await build({ entryPoints: [root + file], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', plugins: [{ name: 'isolated-convex', setup(b) {
    for (const [filter,path] of [[/^\.\/_generated\/server$/,'server'],[/^\.\/_generated\/api$/,'api'],[/^convex\/values$/,'values'],[/^@convex-dev\/auth\/server$/,'auth'],[/^\.\/lib$/,'lib'],[/^\.\/notifications$/,'notifications']]) b.onResolve({filter},()=>({path,namespace:'fixture'}))
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:fixtures[args.path],loader:'js'}))
  } }] })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}
const users = await load('convex/users.ts'), facilities = await load('convex/facilities.ts'), onboarding = await load('convex/onboarding.ts')
const auth = await load('convex/auth.js'), files = await load('convex/files.ts')
const provider = auth.auth.providers[0].options
function context() {
  const rows = {
    facilities: [{_id:'facility',name:'Local test daycare',ownerUserId:'owner'}],
    users: [{_id:'owner',name:'Owner',email:'owner@example.com',role:'admin',facilityId:'facility'}, {_id:'staff-user',name:'Educator',email:'staff@example.com',role:'staff'}],
    authAccounts: [{_id:'account',provider:'password',providerAccountId:'Legacy@Example.com',userId:'staff-user'}],
    children: [{_id:'child',name:'Child',facilityId:'facility',parentUserId:'first-parent'}],
    employeeProfiles: [{_id:'profile',facilityId:'facility',token:'employee-token',status:'pending',inviteRole:'Educator',inviteName:'Educator',createdAt:Date.now(),expiresAt:Date.now()+86400_000}],
    invites: [{_id:'invite',facilityId:'facility',token:'staff-invite',role:'staff',used:false,expiresAt:Date.now()+86400_000}], educators: [], conversations: [], storedUploads: [],
  }
  let next=0
  const find=id=>Object.values(rows).flat().find(row=>row._id===id)
  const ctx = { rows, events: [], authCalls: [], uid:null, membership:{facilityId:'facility',userId:'owner',user:rows.users[0],facility:rows.facilities[0]}, storage:{
    store:async blob=>{ctx.lastBlob=blob;return 'storage-'+(++next)},delete:async id=>{ctx.deleted=id},
  }, db:{
    get:async id=>find(id)?structuredClone(find(id)):null,
    insert:async(table,data)=>{const id=table+'-'+(++next);(rows[table]||=[]).push({_id:id,...data});return id},
    patch:async(id,data)=>{if(!find(id))throw Error('Missing test row: '+id);Object.assign(find(id),data)},
    delete:async id=>{for(const [name,data] of Object.entries(rows))rows[name]=data.filter(row=>row._id!==id)},
    query:table=>{const filters=[],predicates=[];const field=name=>row=>row[name];const evaluator={field,eq:(a,b)=>row=>(typeof a==='function'?a(row):a)===(typeof b==='function'?b(row):b)};const q={filter(cb){predicates.push(cb(evaluator));return q},take:async n=>(await q.collect()).slice(0,n),withIndex(_name,cb){const m={eq(k,v){filters.push([k,v]);return m}};cb(m);return q},order(){return q},collect:async()=>structuredClone((rows[table]||[]).filter(row=>filters.every(([k,v])=>row[k]===v)&&predicates.every(predicate=>predicate(row)))),first:async()=>{return(await q.collect())[0]||null}};return q},
  }}
  const handler=name=>({authIdentity:users.authIdentity,reserveRecovery:users.reserveRecovery,activeToken:onboarding.activeToken,saveSubmission:onboarding.saveSubmission,registerStoredUpload:files.registerStoredUpload}[name])
  ctx.runQuery=async(name,args)=>handler(name).handler(ctx,args)
  ctx.runMutation=async(name,args)=>ctx.invoke(handler(name),args)
  ctx.invoke=async(fn,args)=>{const before=structuredClone(rows),events=ctx.events.length;try{return await fn.handler(ctx,args)}catch(error){for(const key of Object.keys(rows))delete rows[key];Object.assign(rows,before);ctx.events.length=events;throw error}}
  return ctx
}
const fields = (extra={}) => ({fullName:'Local Educator',preferredName:'',personalEmail:'staff@example.com',documents:[],...extra})
const submission = (extra={}) => ({token:'employee-token',fullName:'Local Educator',preferredName:'',dob:'',address:'',phone:'',personalEmail:'staff@example.com',emergencyName:'',emergencyPhone:'',startDate:'',sin:'',bank:{institution:'',transit:'',account:''},documents:[],consent:true,...extra})

test('normalises new email identities while retaining legacy credential IDs and passwords', async()=>{
  const ctx=context()
  await provider.authorize({email:' legacy@example.com ',password:'correct-password',flow:'signIn'},ctx)
  assert.equal(ctx.authCalls[0][1].account.id,'Legacy@Example.com')
  await provider.authorize({email:' NEW@EXAMPLE.COM ',password:'long-password',flow:'signUp'},ctx)
  assert.equal(ctx.authCalls[1][1].account.id,'new@example.com')
  assert.equal(ctx.authCalls[1][1].profile.emailNormalized,'new@example.com')
  await assert.rejects(provider.authorize({email:'LEGACY@example.com',password:'long-password',flow:'signUp'},ctx),/already uses/)
  await assert.rejects(provider.authorize({email:'new2@example.com',password:'1234567',flow:'signUp'},ctx),/Invalid password/)
})
test('case-colliding legacy accounts are not silently merged or reset as the wrong person',async()=>{
  const ctx=context();ctx.rows.authAccounts.push({_id:'collision',provider:'password',providerAccountId:'legacy@EXAMPLE.com',userId:'other-user'})
  await assert.rejects(provider.authorize({email:'legacy@example.com',password:'x',flow:'signIn'},ctx),/Multiple legacy/)
  await provider.authorize({email:'Legacy@Example.com',password:'x',flow:'signIn'},ctx)
  assert.equal(ctx.authCalls[0][1].account.id,'Legacy@Example.com')
})
test('invalid, consumed, wrong-email and archived-child invitations fail before account creation',async()=>{
  for(const change of ['missing','used','expired','email','child']) {
    const ctx=context(),invite=ctx.rows.invites[0]
    if(change==='missing')ctx.rows.invites=[]
    if(change==='used')invite.used=true
    if(change==='expired')invite.expiresAt=Date.now()-1
    if(change==='email')invite.email='someone-else@example.com'
    if(change==='child'){invite.childId='child';ctx.rows.children[0].archivedAt=Date.now()}
    await assert.rejects(provider.authorize({email:'new@example.com',password:'long-password',flow:'signUp',inviteToken:'staff-invite'},ctx),/invitation/)
    assert.equal(ctx.authCalls.length,0)
  }
})
test('recovery requests use 8-digit expiring codes and account throttles without revealing unknown emails',async()=>{
  const unknown=context();assert.equal(await provider.authorize({email:'unknown@example.com',flow:'reset'},unknown),null);assert.equal(unknown.authCalls.length,0)
  const ctx=context();await provider.authorize({email:'legacy@example.com',flow:'reset'},ctx)
  assert.equal(ctx.provider.maxAge,600);assert.match(await ctx.provider.generateVerificationToken(),/^\d{8}$/)
  assert.equal(ctx.providerArgs.params.email,'Legacy@Example.com')
  await ctx.provider.authorize({email:'Legacy@Example.com'},{providerAccountId:'Legacy@Example.com'})
  await assert.rejects(ctx.provider.authorize({email:'another@example.com'},{providerAccountId:'Legacy@Example.com'}),/Invalid/)
  const before=ctx.authCalls.length;assert.equal(await provider.authorize({email:'legacy@example.com',flow:'reset'},ctx),null);assert.equal(ctx.authCalls.length,before)
})
test('recovery verification updates password only for the verified account and invalidates other sessions',async()=>{
  const ctx=context();ctx.resetResult={userId:'staff-user',sessionId:'new-session'}
  await provider.authorize({email:'legacy@example.com',code:'12345678',newPassword:'replacement-password',flow:'reset-verification'},ctx)
  assert.equal(ctx.authCalls.find(c=>c[0]==='modify')[1].account.id,'Legacy@Example.com')
  assert.deepEqual(ctx.authCalls.find(c=>c[0]==='invalidate')[1],{userId:'staff-user',except:['new-session']})
  ctx.authCalls=[];ctx.resetResult={userId:'wrong-user',sessionId:'wrong-session'}
  await assert.rejects(provider.authorize({email:'legacy@example.com',code:'12345678',newPassword:'replacement-password',flow:'reset-verification'},ctx),/Invalid code/)
  assert.equal(ctx.authCalls.filter(c=>c[0]==='modify').length,0)
})
test('completed, revoked and expired HR tokens cannot mutate or obtain upload URLs',async()=>{
  const ctx=context();await ctx.invoke(onboarding.saveSubmission,{token:'employee-token',fields:fields()})
  await assert.rejects(ctx.invoke(onboarding.saveSubmission,{token:'employee-token',fields:fields({fullName:'Overwrite'})}),/already been submitted/)
  assert.equal(ctx.rows.employeeProfiles[0].fullName,'Local Educator')
  await assert.rejects(onboarding.startUpload.handler(ctx,{token:'employee-token'}),/already been submitted/)
  for(const change of ['revoked','expired']){const c=context();if(change==='revoked')c.rows.employeeProfiles[0].revokedAt=Date.now();else c.rows.employeeProfiles[0].expiresAt=Date.now()-1;assert.equal(await onboarding.info.handler(c,{token:'employee-token'}),null);await assert.rejects(c.invoke(onboarding.saveSubmission,{token:'employee-token',fields:fields()}),/expired|withdrawn/)}
})
test('HR server validation catches malformed identity, dates, payroll and forged document ownership',async()=>{
  const ctx=context()
  for(const extra of [{fullName:''},{personalEmail:'bad'},{dob:'2026-02-31'},{sin:'123'},{bank:{institution:'001',transit:'12',account:'1234567'}}]) await assert.rejects(onboarding.submit.handler(ctx,submission(extra)))
  ctx.rows.storedUploads.push({_id:'upload',storageId:'forged',facilityId:'facility',purpose:'hr',onboardingProfileId:'different-profile'})
  await assert.rejects(ctx.invoke(onboarding.saveSubmission,{token:'employee-token',fields:fields({documents:[{name:'id.pdf',kind:'document',storageId:'forged'}]})}),/not attached/)
  assert.equal(ctx.rows.educators.length,0)
})
test('HR uploads validate bytes and bind stored files to this profile; completed forms reject uploads',async()=>{
  const ctx=context(),bytes=Uint8Array.from([137,80,78,71,13,10,26,10]).buffer
  await onboarding.uploadDocument.handler(ctx,{token:'employee-token',fileName:'id.png',mimeType:'image/png',bytes})
  assert.notDeepEqual(new Uint8Array(await ctx.lastBlob.arrayBuffer()),new Uint8Array(bytes));
  assert.equal(ctx.rows.storedUploads[0].onboardingProfileId,'profile');assert.equal(ctx.rows.storedUploads[0].purpose,'hr')
  await assert.rejects(onboarding.uploadDocument.handler(ctx,{token:'employee-token',fileName:'bad.png',mimeType:'image/png',bytes:new Uint8Array([0,1]).buffer}),/valid JPEG/)
  await assert.rejects(onboarding.uploadDocument.handler(ctx,{token:'employee-token',fileName:'big.png',mimeType:'image/png',bytes:new ArrayBuffer(8*1024*1024+1)}),/8 MiB/)
  await ctx.invoke(onboarding.saveSubmission,{token:'employee-token',fields:fields()})
  await assert.rejects(onboarding.uploadDocument.handler(ctx,{token:'employee-token',fileName:'later.png',mimeType:'image/png',bytes}),/already been submitted/)
})
test('HR-first and login-first onboarding converge on one educator, with replay-safe invitations',async()=>{
  const hr=context();await hr.invoke(onboarding.saveSubmission,{token:'employee-token',fields:fields()})
  const link=hr.rows.invites.find(inv=>inv.educatorId)
  assert.equal(link.email,'staff@example.com');hr.uid='staff-user'
  await hr.invoke(facilities.joinViaToken,{token:link.token});await hr.invoke(facilities.joinViaToken,{token:link.token})
  assert.equal(hr.rows.educators.length,1);assert.equal(hr.rows.educators[0].userId,'staff-user')
  hr.rows.users.push({_id:'other',email:'other@example.com',role:'staff'});hr.uid='other'
  await assert.rejects(hr.invoke(facilities.joinViaToken,{token:link.token}),/email|valid/)
  const login=context();login.uid='staff-user';await login.invoke(facilities.joinViaToken,{token:'staff-invite'})
  await login.invoke(onboarding.saveSubmission,{token:'employee-token',fields:fields()})
  assert.equal(login.rows.educators.length,1);assert.equal(login.rows.employeeProfiles[0].educatorId,login.rows.educators[0]._id)
})
test('an existing staff member without an educator can consume an HR-linked invite without duplicate records',async()=>{
  const ctx=context();ctx.rows.users[1].facilityId='facility';await ctx.invoke(onboarding.saveSubmission,{token:'employee-token',fields:fields()})
  ctx.uid='staff-user';await ctx.invoke(facilities.joinViaToken,{token:ctx.rows.invites.find(i=>i.educatorId).token})
  assert.equal(ctx.rows.educators.length,1);assert.equal(ctx.rows.educators[0].userId,'staff-user')
})
test('correction links preserve original HR submission and educator; archive retains records',async()=>{
  const ctx=context();await ctx.invoke(onboarding.saveSubmission,{token:'employee-token',fields:fields()})
  const original=structuredClone(ctx.rows.employeeProfiles[0]);const {token}=await ctx.invoke(onboarding.reissueLink,{profileId:'profile'})
  assert.equal(ctx.rows.employeeProfiles[0].fullName,original.fullName);assert.ok(ctx.rows.employeeProfiles[0].revokedAt)
  await ctx.invoke(onboarding.saveSubmission,{token,fields:fields({preferredName:'Corrected'})})
  assert.equal(ctx.rows.educators.length,1);assert.equal(ctx.rows.employeeProfiles[1].revision,2)
  await ctx.invoke(onboarding.deleteProfile,{profileId:'profile'});assert.equal(ctx.rows.employeeProfiles.length,2);assert.equal(ctx.rows.employeeProfiles[0].status,'archived')
})
test('child invitations add an additional guardian, preserve primary, and unlink only removes that guardian',async()=>{
  const ctx=context();ctx.rows.users.push({_id:'first-parent',role:'parent',email:'first@example.com',facilityId:'facility'},{_id:'second-parent',role:'parent',email:'second@example.com'})
  ctx.rows.invites.push({_id:'guardian-invite',token:'guardian-link',facilityId:'facility',role:'parent',childId:'child',used:false});ctx.uid='second-parent'
  await ctx.invoke(facilities.joinViaToken,{token:'guardian-link'})
  assert.equal(ctx.rows.children[0].parentUserId,'first-parent');assert.ok(ctx.rows.children[0].guardianUserIds.includes('second-parent'))
  await ctx.invoke(users.unlinkGuardian,{childId:'child',userId:'second-parent'})
  assert.equal(ctx.rows.children[0].parentUserId,'first-parent');assert.equal(ctx.rows.users.find(u=>u._id==='second-parent').accessStatus,'suspended')
  await ctx.invoke(users.linkGuardianByEmail,{childId:'child',email:' SECOND@EXAMPLE.COM '})
  assert.equal(ctx.rows.users.find(u=>u._id==='second-parent').accessStatus,'active')
})
test('unlinking one child does not suspend a parent with another active child',async()=>{
  const ctx=context();ctx.rows.users.push({_id:'first-parent',role:'parent',email:'first@example.com',facilityId:'facility'});ctx.rows.children.push({_id:'sibling',facilityId:'facility',guardianUserIds:['first-parent']})
  await ctx.invoke(users.unlinkGuardian,{childId:'child',userId:'first-parent'})
  assert.notEqual(ctx.rows.users.find(u=>u._id==='first-parent').accessStatus,'suspended')
})
test('edited mobile/desktop entry components and backend modules parse with installed esbuild',async()=>{
  for(const file of ['src/components/Auth.jsx','src/components/EmployeeOnboarding.jsx','src/components/CreateFacility.jsx','src/components/NoFacility.jsx','src/components/Onboarding.jsx','convex/onboarding.ts','convex/auth.js','convex/facilities.ts','convex/users.ts']) await transform(await readFile(root+file,'utf8'),{loader:file.endsWith('.jsx')?'jsx':file.endsWith('.ts')?'ts':'js',logLevel:'silent'})
})

test('unlinked legacy parent invitations and conflicting educator links require owner repair',async()=>{
  const parent=context();parent.rows.invites[0].role='parent'
  assert.equal(await facilities.inviteInfo.handler(parent,{token:'staff-invite'}),null)
  await assert.rejects(provider.authorize({email:'new@example.com',password:'long-password',flow:'signUp',inviteToken:'staff-invite'},parent),/invitation/)
  const staff=context();staff.uid='staff-user';staff.rows.educators.push({_id:'existing',facilityId:'facility',userId:'another-user'});staff.rows.employeeProfiles[0].educatorId='existing';staff.rows.employeeProfiles[0].personalEmail='staff@example.com'
  await assert.rejects(staff.invoke(facilities.joinViaToken,{token:'staff-invite'}),/another account/)
  assert.equal(staff.rows.educators.length,1);assert.equal(staff.rows.invites[0].used,false)
})


test('staff suspension revokes linked HR corrections and portal invites while preserving employment records',async()=>{
  const ctx=context();ctx.uid='staff-user';await ctx.invoke(facilities.joinViaToken,{token:'staff-invite'});await ctx.invoke(onboarding.saveSubmission,{token:'employee-token',fields:fields()})
  const {token}=await ctx.invoke(onboarding.reissueLink,{profileId:'profile'})
  await ctx.invoke(users.setMemberAccess,{id:'staff-user',status:'suspended'})
  assert.equal(await onboarding.info.handler(ctx,{token}),null);assert.ok(ctx.rows.employeeProfiles.every(p=>p.revokedAt));assert.equal(ctx.rows.educators.length,1)
  await assert.rejects(ctx.invoke(onboarding.saveSubmission,{token,fields:fields({personalEmail:'another@example.com'})}),/withdrawn|expired/)
})
