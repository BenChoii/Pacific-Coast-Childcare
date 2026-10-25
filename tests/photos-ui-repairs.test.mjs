import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Actual Photos component with isolated hook/query/media adapters. These test
// state/error/resource behavior; browser focus/layout remains a separate check.
const root=fileURLToPath(new URL('../',import.meta.url))
const icons=['Heart','Download','Camera','Users','Baby','Loader2','X','ImagePlus','RefreshCw','Expand']
const output=await build({entryPoints:[root+'src/views/Photos.jsx'],bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',logLevel:'silent',plugins:[{name:'photo-hooks',setup(b){
 b.onResolve({filter:/^react$|^react\/jsx-runtime$|^convex\/react$|^framer-motion$|^lucide-react$|\/convex\/_generated\/api$|\/context\/AppContext\.jsx$|\/lib\/useProtectedMedia\.js$|\/components\/ui\.jsx$/},a=>({path:a.path,namespace:'hooks'}))
 b.onLoad({filter:/.*/,namespace:'hooks'},({path})=>({contents:
 path==='react'?`const slot=init=>{const h=globalThis.__photoHooks,i=h.cursor++;if(!(i in h.slots))h.slots[i]=init();return h.slots[i]};export const useState=init=>{const s=slot(()=>({value:typeof init==='function'?init():init}));return[s.value,next=>{const value=typeof next==='function'?next(s.value):next;if(!Object.is(value,s.value)){s.value=value;globalThis.__photoHooks.dirty=true}}]},useRef=value=>slot(()=>({current:value})),useEffect=(fn,deps)=>{const s=slot(()=>({}));if(!s.deps||deps.some((v,i)=>!Object.is(v,s.deps[i])))globalThis.__photoHooks.effects.push(()=>{s.cleanup?.();s.cleanup=fn()});s.deps=deps};`:
 path==='react/jsx-runtime'?'export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment="fragment";':
 path==='convex/react'?'export const useQuery=(ref,args)=>{globalThis.__photoHooks.queries.push([ref,args]);return args===\'skip\'?undefined:globalThis.__photoHooks.page};':
 path==='framer-motion'?'export const motion=new Proxy({},{get:(_,tag)=>"motion-"+tag});':
 path==='lucide-react'?`export const ${icons.map(n=>`${n}='icon-${n}'`).join(',')};`:
 path.endsWith('/api')?'export const api={photos:{list:"photos.list"}};':
 path.includes('AppContext')?'export const useApp=()=>globalThis.__photoHooks.app;':
 path.includes('useProtectedMedia')?'export const useProtectedMedia=rows=>rows.map(row=>({...row,...globalThis.__photoHooks.media[row.id]}));':
 'export const SectionHeader="section-header",Card="card",KnitEmpty="empty";'
 }))
}}]})
const {default:Photos}=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`)
function fixture({page=[],canPost=true,app={}}={}){
 const previous=globalThis.__photoHooks
 const h=globalThis.__photoHooks={cursor:0,slots:[],effects:[],queries:[],media:{},dirty:false,page,app:{photos:[],viewer:{id:'owner'},facility:{id:'facility',isDemo:false},childrenList:[{id:'kid',name:'A Child',first:'A',room:'Cubs'}],pushToast:()=>{},postPhoto:async()=>{},likePhoto:async()=>({liked:true}),...app}}
 const render=()=>{globalThis.__photoHooks=h;let loops=0;do{h.dirty=false;h.cursor=0;h.effects=[];h.tree=Photos({canPost});for(const effect of h.effects)effect();assert.ok(++loops<10,'Component effects should settle')}while(h.dirty);return h.tree}
 const cleanup=()=>{for(const slot of h.slots)slot?.cleanup?.();globalThis.__photoHooks=previous}
 render();return{h,render,cleanup}
}
function nodes(tree){if(tree==null||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...Object.values(tree.props||{}).flatMap(nodes)]}
function text(tree){if(tree==null)return'';if(typeof tree==='string'||typeof tree==='number')return String(tree);if(Array.isArray(tree))return tree.map(text).join(' ');return text(tree.props?.children)}
const find=(f,p)=>nodes(f.h.tree).find(p)
const button=(f,label)=>find(f,n=>n.type==='button'&&text(n).trim()===label)

test('Photos preserves a composer draft across query updates and failed save; preview URLs revoke on replace/reset/unmount',async()=>{
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL;let next=0;const revoked=[]
 URL.createObjectURL=()=>`blob:preview-${++next}`;URL.revokeObjectURL=url=>revoked.push(url)
 const f=fixture({app:{postPhoto:async()=>{throw Error('network')}}})
 try{
  button(f,'Post photo').props.onClick();f.render()
  const choose=()=>find(f,n=>n.type==='input'&&n.props['aria-label']==='Choose a photo')
  choose().props.onChange({target:{files:[{type:'image/png',size:100,name:'first.png'}],value:'first'}});f.render()
  find(f,n=>n.type==='textarea').props.onChange({target:{value:'Learning with friends'}})
  find(f,n=>n.type==='select').props.onChange({target:{value:'Cubs'}});f.render()
  f.h.page=[{id:'new',caption:'A new query result',likes:0,liked:false,emoji:'📸'}];f.render()
  assert.equal(find(f,n=>n.type==='textarea').props.value,'Learning with friends')
  assert.equal(find(f,n=>n.type==='img'&&n.props.alt?.startsWith('Selected')).props.src,'blob:preview-1')
  await button(f,'Share photo').props.onClick();f.render();assert.match(text(f.h.tree),/could not be shared/)
  assert.equal(find(f,n=>n.type==='textarea').props.value,'Learning with friends');assert.deepEqual(revoked,[])
  choose().props.onChange({target:{files:[{type:'image/png',size:100,name:'second.png'}],value:'second'}});f.render();assert.deepEqual(revoked,['blob:preview-1'])
  button(f,'Discard draft').props.onClick();f.render();assert.deepEqual(revoked,['blob:preview-1','blob:preview-2'])
  button(f,'Post photo').props.onClick();f.render();choose().props.onChange({target:{files:[{type:'image/png',size:100}],value:'third'}});f.render()
 }finally{f.cleanup();URL.createObjectURL=create;URL.revokeObjectURL=revoke}
 assert.deepEqual(revoked,['blob:preview-1','blob:preview-2','blob:preview-3'])
})
test('Photos distinguishes pending media from failed media and exposes an actual retry action',()=>{
 const f=fixture({canPost:false});f.h.page=undefined;f.render()
 try{
  assert.match(text(f.h.tree),/Loading shared photos/)
  f.h.page=[{id:'image',caption:'Art',imageId:'storage',likes:0,liked:false}];f.h.media.image={imageLoading:true};f.render()
  assert.ok(find(f,n=>n.props?.['aria-label']==='Loading photo'))
  let retried=0;f.h.media.image={imageLoading:false,imageError:true,retryImage:()=>retried++};f.render()
  assert.match(text(f.h.tree),/Photo could not load/);button(f,'Retry photo').props.onClick();assert.equal(retried,1)
 }finally{f.cleanup()}
})
test('a failed reaction remains unchanged and successful reaction is applied only after acknowledgement',async()=>{
 const f=fixture({page:[{id:'image',caption:'Blocks',imageUrl:'blob:photo',likes:2,liked:false}],app:{likePhoto:async()=>{throw Error('network')}}})
 const react=()=>find(f,n=>n.type==='button'&&/reaction to Blocks/.test(n.props['aria-label']||''))
 try{
  await react().props.onClick();f.render();assert.match(text(f.h.tree),/reaction could not be saved/);assert.equal(react().props['aria-pressed'],false)
  let resolve;f.h.app.likePhoto=()=>new Promise(r=>resolve=r);f.render();const pending=react().props.onClick();f.render();assert.equal(react().props.disabled,true);assert.equal(react().props['aria-pressed'],false)
  resolve({liked:true});await pending;f.render();assert.equal(react().props['aria-pressed'],true);assert.match(text(react()),/3/)
 }finally{f.cleanup()}
})
test('the photo route uses stable component types so a context update does not remount its composer',async()=>{
 const app=await readFile(root+'src/App.jsx','utf8')
 assert.doesNotMatch(app,/render:\s*\(\)\s*=>\s*<Photos\b/)
 assert.match(app,/render:\s*Photos\b/);assert.match(app,/render:\s*PostPhotos\b/)
})
