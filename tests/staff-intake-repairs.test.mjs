import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
globalThis.window={location:{origin:'https://local.invalid'}}
const root=new URL('../',import.meta.url).pathname
async function load(file){
 const source=await readFile(root+file,'utf8')
 const icons=source.match(/import\s*{([^}]+)}\s*from 'lucide-react'/s)[1].split(',').map(x=>x.trim()).filter(Boolean)
 const fixtures={
  react:`export const useState=x=>globalThis.__MITTEN_UI_TEST__.state(x),useRef=x=>globalThis.__MITTEN_UI_TEST__.ref(x),useEffect=()=>{};`,
  motion:`export const motion=new Proxy({},{get:(_,key)=>key}),AnimatePresence='fragment';`,
  convex:`export const useMutation=name=>args=>globalThis.__MITTEN_UI_TEST__.mutate(name,args);`,
  api:`export const api={roster:{setChildStatus:'setChildStatus'},children:{updateProfile:'updateProfile'},educators:{ensureSelf:'ensureSelf'}};`,
  schedule:`export default 'class-schedule-panel';`,
  app:`export const useApp=()=>globalThis.__MITTEN_UI_TEST__.app;`,
  ui:`export const StatCard='card',Card='card',SectionHeader='heading',Pill='pill',Avatar='avatar',ListSkeleton='skeleton',HomeSkeleton='skeleton',Skeleton='skeleton',YarnConfetti='confetti';`,
  icons:icons.map(name=>`export const ${name}='${name}';`).join('\n'),
 }
 const result=await build({entryPoints:[root+file],bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent',jsxFactory:'globalThis.__MITTEN_UI_TEST__.h',jsxFragment:'globalThis.__MITTEN_UI_TEST__.fragment',plugins:[{name:'local-ui-boundaries',setup(b){
  for(const [filter,path] of [[/^react$/,'react'],[/^framer-motion$/,'motion'],[/^convex\/react$/,'convex'],[/_generated\/api$/,'api'],[/context\/AppContext.jsx$/,'app'],[/components\/ui.jsx$/,'ui'],[/components\/ClassSchedulePanel.jsx$/,'schedule'],[/^lucide-react$/,'icons']])b.onResolve({filter},()=>({path,namespace:'fixture'}))
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:fixtures[args.path],loader:'js'}))
 }}]})
 return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const staff=await load('src/views/staff.jsx'), intake=await load('src/views/intake.jsx')
function harness(Component,app={},mutations={}){
 const ui={cursor:0,hooks:[],toasts:[],calls:[],app:{roster:[],childrenList:[],educators:[],facility:{id:'facility',timezone:'America/Vancouver'},viewer:{id:'staff',name:'Actual Educator'},isAuthenticated:true,loading:false,pushToast:(...args)=>ui.toasts.push(args),...app},
  state(initial){const n=this.cursor++;if(!(n in this.hooks))this.hooks[n]=typeof initial==='function'?initial():initial;return[this.hooks[n],value=>{this.hooks[n]=typeof value==='function'?value(this.hooks[n]):value}]},
  ref(initial){const n=this.cursor++;return this.hooks[n]||=( {current:initial} )},
  h:(type,props,...children)=>({type,props:{...(props||{}),children}}),fragment:'fragment',
  async mutate(name,args){this.calls.push({name,args});return await mutations[name]?.(args)},
  render(){globalThis.__MITTEN_UI_TEST__=this;this.cursor=0;this.tree=Component();return this.tree},
 }
 ui.render();return ui
}
function nodes(node){if(!node||typeof node!=='object')return[];return[node,...(node.props?.children||[]).flat(Infinity).flatMap(nodes)]}
function text(node){if(node==null||typeof node==='boolean')return'';if(typeof node!=='object')return String(node);return(node.props?.children||[]).flat(Infinity).map(text).join(' ')}
function button(ui,label){const result=nodes(ui.tree).find(node=>node.type==='button'&&text(node).includes(label));assert.ok(result,'button: '+label);return result}
function input(ui,placeholder){const result=nodes(ui.tree).find(node=>node.type==='input'&&node.props.placeholder===placeholder);assert.ok(result,'input: '+placeholder);return result}
const change=(node,value)=>node.props.onChange({target:{value}})

test('attendance uses child identity without a legacy roster ID and only reports success after persistence',async()=>{
 let complete;const pending=new Promise(resolve=>complete=resolve)
 const ui=harness(staff.Attendance,{roster:[{childId:'child',name:'Same Name',status:'checked-out',time:'—'}]},{setChildStatus:()=>pending})
 const action=button(ui,'In').props.onClick();assert.equal(ui.toasts.length,0);assert.deepEqual(ui.calls[0],{name:'setChildStatus',args:{childId:'child',status:'checked-in'}})
 ui.render();assert.equal(button(ui,'Saving').props.disabled,true)
 complete({ok:true});await action;assert.equal(ui.toasts.length,1)
})
test('attendance handles nap checkout and preserves a visible error after failed save',async()=>{
 const ui=harness(staff.Attendance,{roster:[{childId:'child',name:'Child',status:'napping',time:'1:00 PM'}]},{setChildStatus:async()=>{throw Error('offline')}})
 await button(ui,'Out').props.onClick();ui.render()
 assert.equal(ui.calls[0].args.status,'checked-out');assert.equal(ui.toasts.length,0);assert.match(text(ui.tree),/could not be saved/)
})
test('staff home room filter actually filters children, and incidents opens incident reports',async()=>{
 const targets=[];const ui=harness(staff.StaffHome,{roster:[{childId:'a',name:'Child Alpha',room:'Room A',status:'checked-out'},{childId:'b',name:'Child Beta',room:'Room B',status:'checked-out'}],setView:view=>targets.push(view)})
 const pill=nodes(ui.tree).find(node=>typeof node.type==='function'&&node.type.name==='RoomPills');assert.ok(pill)
 pill.props.onChange('Room B');ui.render();assert.match(text(ui.tree),/Child Beta/);assert.doesNotMatch(text(ui.tree),/Child Alpha/)
 await button(ui,'Incident').props.onClick();assert.deepEqual(targets,['incidents']);assert.doesNotMatch(text(ui.tree),/ratio 1:8|Navigators Room|7:30a/)
})
test('real staff clock cannot fall back to another educator by name or first record',async()=>{
 const outer=harness(staff.StaffHome,{educators:[{id:'other-educator',name:'Actual Educator',userId:'someone-else'}]})
 const node=nodes(outer.tree).find(node=>typeof node.type==='function'&&node.type.name==='ClockCard');assert.ok(node)
 const clock=harness(node.type,outer.app);assert.match(text(clock.tree),/needs to be linked/);assert.equal(nodes(clock.tree).some(node=>node.type==='button'&&text(node).includes('Clock In')),false)
})
test('daily log passes observed nap minutes/mood and date; blank AI notes are disabled',async()=>{
 const entries=[];const ui=harness(staff.LogActivity,{childrenList:[{id:'child',name:'Child',room:'Room'}],addActivity:async entry=>entries.push(entry),draftNote:async()=>{throw Error('must not be called')}})
 assert.equal(button(ui,'Draft with AI').props.disabled,true)
 await button(ui,'Child').props.onClick();ui.render();await button(ui,'Rest').props.onClick();ui.render()
 change(nodes(ui.tree).find(node=>node.type==='input'&&node.props.type==='number'),'45');ui.render()
 await button(ui,'Post update').props.onClick();assert.equal(entries[0].durationMinutes,45);assert.match(entries[0].date,/^\d{4}-\d{2}-\d{2}$/);assert.equal(entries[0].time,undefined)
 ui.render();await button(ui,'Note').props.onClick();ui.render();await button(ui,'Fussy').props.onClick();ui.render();change(nodes(ui.tree).find(node=>node.type==='textarea'),'Needed a quiet cuddle after outdoor play.');ui.render();await button(ui,'Post update').props.onClick();assert.match(entries[1].mood,/Fussy/)
})
test('intake persists exact created child ID and care fields; retry never creates a second same-named child',async()=>{
 let enrollments=0, saves=0;const invites=[]
 const ui=harness(intake.IntakeDesk,{role:'admin',childrenList:[{id:'old-child',name:'Same Child'}],enrollChild:async()=>{enrollments++;return{ok:true,childId:'new-child'}},generateInvite:async(...args)=>{invites.push(args);return{token:'family-token'}}},{updateProfile:async()=>{if(++saves===1)throw Error('offline');return{ok:true}}})
 await button(ui,'Type it in manually').props.onClick();ui.render()
 for(const [placeholder,value] of [['First name *','Same'],['Last name','Child'],['Parent name','Parent'],['Parent phone','6045550100'],['Parent email for this invitation *',' PARENT@EXAMPLE.COM '],['Name','Emergency Person'],['Phone','6045550101']]){change(input(ui,placeholder),value);ui.render()}
 change(nodes(ui.tree).find(node=>node.type==='input'&&node.props.type==='date'),'2022-04-01');ui.render();change(nodes(ui.tree).find(node=>node.type==='textarea'),'Comfort blanket at rest time');ui.render()
 await button(ui,'Enrol Same').props.onClick();ui.render();assert.match(text(ui.tree),/already created/);assert.equal(enrollments,1)
 await button(ui,'Finish care details').props.onClick();ui.render();assert.equal(enrollments,1)
 assert.equal(ui.calls[0].args.id,'new-child');assert.equal(ui.calls[0].args.dateOfBirth,'2022-04-01');assert.equal(ui.calls[0].args.emergencyContacts.length,2);assert.equal(ui.calls[0].args.careInstructions,'Comfort blanket at rest time')
 assert.deepEqual(invites[0],['parent','Parent','new-child','parent@example.com']);assert.match(text(ui.tree),/is enrolled/);assert.match(text(ui.tree),/No invitation email has been sent/)
})
test('real staff intake clearly requires director review and offers no enrollment action',async()=>{
 const ui=harness(intake.IntakeDesk,{role:'staff'});assert.match(text(ui.tree),/director can enrol/);assert.equal(nodes(ui.tree).some(node=>node.type==='button'&&text(node).includes('Enrol')),false)
})
