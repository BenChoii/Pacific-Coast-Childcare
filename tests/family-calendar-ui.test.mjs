import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// Exercise the real calendar view with only hook, query and display boundaries
// replaced. This catches the former staff-with-no-children dead end and makes
// the selected-child query scope an observable contract.
const root = fileURLToPath(new URL('../', import.meta.url))
const icons = ['Smile','Moon','Apple','Camera','MessageCircle','CalendarDays','CreditCard','Clock','ChevronRight','CheckCircle2','ShieldCheck','FileText','Phone','AlertTriangle','Download','Heart','Loader2','Sparkles','Send']
const output = await build({ stdin: { contents: `export {ParentCalendar,FamilyLearningPlan} from './src/views/parent.jsx'`, resolveDir: root, loader: 'js' }, bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', plugins: [{ name: 'calendar-ui-boundaries', setup(b) {
  b.onResolve({ filter: /^react$|^react\/jsx-runtime$|^convex\/react$|^framer-motion$|^lucide-react$|_generated\/api$|context\/AppContext\.jsx$|lib\/invoiceDoc\.js$|components\/ui\.jsx$|components\/AvatarUpload\.jsx$|\/finance\.jsx$|\/calendar\.jsx$|data\/mockData\.js$|lib\/careData\.js$|components\/PlanAttachments\.jsx$|components\/ClassSchedule\.jsx$|\/care\.jsx$/ }, args => ({ path: args.path, namespace: 'fixture' }))
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents:
    path === 'react' ? `export const useState=initial=>{const h=globalThis.__calendarHooks,i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;return[h.slots[i],value=>{h.slots[i]=typeof value==='function'?value(h.slots[i]):value}]};` :
    path === 'react/jsx-runtime' ? 'export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment="fragment";' :
    path === 'convex/react' ? 'export const useQuery=(api,args)=>{const h=globalThis.__calendarHooks;h.calls.push({api,args});return args==="skip"?undefined:api==="calendar"?h.events:h.plans},useAction=()=>()=>{},useMutation=()=>()=>{};' :
    path === 'framer-motion' ? 'export const motion={div:"motion-div"};' :
    path === 'lucide-react' ? `export const ${icons.map(name=>`${name}='icon-${name}'`).join(',')};` :
    path.endsWith('/api') ? 'export const api={calendar:{list:"calendar"},lessons:{familyPlans:"plans"}};' :
    path.endsWith('AppContext.jsx') ? 'export const useApp=()=>globalThis.__calendarHooks.app;' :
    path.endsWith('/invoiceDoc.js') ? 'export const openInvoicePrint=()=>{};' :
    path.endsWith('/ui.jsx') ? 'export const StatCard="StatCard",Card="Card",SectionHeader="SectionHeader",Pill="Pill",Avatar="Avatar",ProgressBar="ProgressBar",HomeSkeleton="HomeSkeleton",KnitEmpty="KnitEmpty";' :
    path.endsWith('/AvatarUpload.jsx') ? 'export default "AvatarUpload";' :
    path.endsWith('/finance.jsx') ? 'export const ParentExtrasCard="ParentExtrasCard";' :
    path.endsWith('/calendar.jsx') ? 'export const CalendarEntry="CalendarEntry",MonthCalendar="MonthCalendar",localDateLabel=date=>date;' :
    path.endsWith('/mockData.js') ? 'export const ACTIVITY_TYPES=[];' :
    path.endsWith('/careData.js') ? 'export const dayKey=()=>"2026-10-27";' :
    path.endsWith('/PlanAttachments.jsx') ? 'export const PlanAttachments="PlanAttachments";' :
    path.endsWith('/ClassSchedule.jsx') ? 'export const ClassScheduleNow="ClassScheduleNow";' :
    'export const FamilyToday="FamilyToday",FamilyDailyLog="FamilyDailyLog",FamilyProfile="FamilyProfile";'
  }))
} }] })
const components = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree,...Object.values(tree.props||{}).flatMap(nodes)]
const text = tree => tree == null ? '' : typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children)
const plan = (id, room, status='published') => ({id,room,status,title:id,period:'day',startDate:'2026-10-27',endDate:'2026-10-27'})
function fixture(role, app={}) {
  const previous=globalThis.__calendarHooks
  const h=globalThis.__calendarHooks={cursor:0,slots:[],calls:[],events:[{id:'all-closure',startDate:'2026-10-28',endDate:'2026-10-28'},{id:'cubs-event',room:'Cubs',startDate:'2026-10-29',endDate:'2026-10-29'},{id:'owls-event',room:'Owls',startDate:'2026-10-29',endDate:'2026-10-29'}],plans:[plan('all-plan'),plan('cubs-plan','Cubs'),plan('owls-plan','Owls'),plan('draft-secret','Cubs','draft')],app:{role,isAuthenticated:true,viewer:{id:'current',role},facility:{name:'Test daycare',timezone:'America/Vancouver'},educators:[],childrenList:[],...app}}
  h.app.setActiveChildId=id=>{h.app.activeChildId=id}
  const render=()=>{globalThis.__calendarHooks=h;h.cursor=0;h.calls=[];h.tree=components.ParentCalendar();return h.tree}
  render();return{h,render,cleanup:()=>{globalThis.__calendarHooks=previous}}
}
const displayedPlans=f=>nodes(f.h.tree).filter(node=>node.type===components.FamilyLearningPlan).map(node=>node.props.plan.id)

test('staff see their assigned class, global closures and published updates without a parent link',()=>{
  const f=fixture('staff',{educators:[{userId:'current',room:'Cubs'}],childrenList:[{id:'other-child',room:'Owls',parentUserId:'someone-else'}]})
  try {
    assert.deepEqual(f.h.calls,[{api:'calendar',args:{}},{api:'plans',args:{}}])
    assert.doesNotMatch(text(f.h.tree),/will link your child/)
    assert.deepEqual(displayedPlans(f),['all-plan','cubs-plan'])
    const calendar=nodes(f.h.tree).find(node=>node.type==='MonthCalendar')
    assert.deepEqual(calendar.props.events.map(e=>e.id),['all-closure','cubs-event'])
    assert.equal(calendar.props.attendanceDays,undefined)
    const select=nodes(f.h.tree).find(node=>node.type==='select')
    assert.equal(select.props.value,'Cubs')
    select.props.onChange({target:{value:''}});f.render()
    assert.deepEqual(displayedPlans(f),['all-plan','cubs-plan','owls-plan'])
    assert.doesNotMatch(text(f.h.tree),/draft-secret/)
  } finally {f.cleanup()}
})

test('administrators can browse the same published class calendar without a child account',()=>{
  const f=fixture('admin')
  try {
    assert.deepEqual(f.h.calls.map(call=>call.args),[{},{}])
    assert.deepEqual(displayedPlans(f),['all-plan','cubs-plan','owls-plan'])
    assert.ok(nodes(f.h.tree).some(node=>node.type==='MonthCalendar'))
    assert.doesNotMatch(text(f.h.tree),/will link your child/)
  } finally {f.cleanup()}
})

test('a parent without a linked child skips both queries and sees the linking explanation',()=>{
  const f=fixture('parent',{childrenList:[{id:'not-mine',parentUserId:'another-parent',room:'Cubs'}]})
  try {
    assert.deepEqual(f.h.calls.map(call=>call.args),['skip','skip'])
    assert.match(text(f.h.tree),/will link your child/)
    assert.equal(nodes(f.h.tree).some(node=>node.type==='MonthCalendar'),false)
    assert.deepEqual(displayedPlans(f),[])
  } finally {f.cleanup()}
})

test('family child selection scopes both requests and preserves recurring attendance days',()=>{
  const f=fixture('parent',{activeChildId:'child-two',childrenList:[{id:'child-one',first:'Alex',name:'Alex',room:'Cubs',parentUserId:'current',attendanceDays:['Mon']},{id:'child-two',first:'Sam',name:'Sam',room:'Owls',guardianUserIds:['current'],enrollmentDays:['Tue','Thu']}]})
  try {
    assert.deepEqual(f.h.calls.map(call=>call.args),[{childId:'child-two'},{childId:'child-two'}])
    assert.deepEqual(displayedPlans(f),['all-plan','owls-plan'])
    assert.deepEqual(nodes(f.h.tree).find(node=>node.type==='MonthCalendar').props.attendanceDays,['Tue','Thu'])
    nodes(f.h.tree).find(node=>node.type==='select').props.onChange({target:{value:'child-one'}});f.render()
    assert.deepEqual(f.h.calls.map(call=>call.args),[{childId:'child-one'},{childId:'child-one'}])
    assert.deepEqual(displayedPlans(f),['all-plan','cubs-plan'])
  } finally {f.cleanup()}
})

test('draft schedule previews never claim a currently scheduled location',()=>{
  const f=fixture('admin')
  try {
    const draft={...plan('draft','Cubs','draft'),kind:'schedule',agenda:[{startTime:'09:00',endTime:'10:00',title:'Outdoor play'}],attachments:[]}
    const tree=components.FamilyLearningPlan({plan:draft})
    const agenda=nodes(tree).find(node=>node.type==='ClassScheduleNow')
    assert.equal(agenda.props.preview,true)
    assert.equal(agenda.props.showTimeline,true)
    const shared=components.FamilyLearningPlan({plan:{...draft,status:'published'}})
    assert.equal(nodes(shared).find(node=>node.type==='ClassScheduleNow').props.preview,false)
  } finally {f.cleanup()}
})
