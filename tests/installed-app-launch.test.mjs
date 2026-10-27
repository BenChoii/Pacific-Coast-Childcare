import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

// Exercise the actual entrypoint and Login component. Only external UI,
// transport and provider boundaries are replaced. No backend or saved tokens
// are accessed, and these tests do not claim a physical iPhone session test.
const root = new URL('../', import.meta.url).pathname
const react = `
  const make=(type,props,...children)=>({type,props:{...props,...(children.length?{children:children.length===1?children[0]:children}:{})}});
  export const createElement=make, StrictMode='StrictMode', Suspense='Suspense';
  export const lazy=loader=>({loader});
  export const useState=value=>[typeof value==='function'?value():value,()=>{}];
  export default {createElement,StrictMode};
`
const modules = {
  react,
  jsx: `export const jsx=(type,props)=>({type,props:props||{}}),jsxs=jsx,Fragment='Fragment';`,
  dom: `export default {createRoot(){return {render(tree){globalThis.__launch.tree=tree}}}};`,
  convex: `export class ConvexReactClient{constructor(address){globalThis.__launch.clients.push(address)}};export const useQuery=()=>({name:'Synthetic daycare'});`,
  authProvider: `export const ConvexAuthProvider='ConvexAuthProvider';`,
  context: `export const AppProvider='AppProvider',useApp=()=>({enterRole(){}});`,
  brand: `export const isMitten=true,BRAND={short:'Mitten'};export const applyBrandHead=value=>{globalThis.__launch.brand=value};`,
  App: `export default 'App';`,
  Sales: `export default 'Sales';`,
  Legal: `export default 'Legal';`,
  EmployeeOnboarding: `export default 'EmployeeOnboarding';`,
  Auth: `export default 'Auth';`,
  BrandLockup: `export default 'BrandLockup';`,
  motion: `export const motion=new Proxy({}, {get:(_,name)=>'motion.'+name});`,
  icons: `export const Heart='Heart',GraduationCap='GraduationCap',Building2='Building2',ArrowRight='ArrowRight',LogIn='LogIn',Sparkles='Sparkles',Loader2='Loader2';`,
  api: `export const api={facilities:{bySlug:'bySlug'}};`,
  css: '',
}
async function bundle(entry) {
  const output = await build({
    entryPoints: [root + entry], bundle: true, write: false, format: 'esm', platform: 'node',
    jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env.VITE_CONVEX_URL': '"https://unit.convex.cloud"' },
    plugins: [{ name: 'isolated-launch-ui', setup(b) {
      const aliases = [
        [/^react$/, 'react'], [/^react\/jsx-runtime$/, 'jsx'], [/^react-dom\/client$/, 'dom'],
        [/^convex\/react$/, 'convex'], [/^@convex-dev\/auth\/react$/, 'authProvider'],
        [/context\/AppContext\.jsx$/, 'context'], [/(^|\/)brand\.js$/, 'brand'],
        [/^\.\/App\.jsx$/, 'App'], [/components\/Sales\.jsx$/, 'Sales'],
        [/components\/Legal\.jsx$/, 'Legal'], [/components\/EmployeeOnboarding\.jsx$/, 'EmployeeOnboarding'],
        [/^\.\/Auth\.jsx$/, 'Auth'], [/BrandLockup\.jsx$/, 'BrandLockup'],
        [/^framer-motion$/, 'motion'], [/^lucide-react$/, 'icons'],
        [/_generated\/api$/, 'api'], [/\.css$/, 'css'],
      ]
      for (const [filter, path] of aliases) b.onResolve({ filter }, () => ({ path, namespace: 'launch-fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'launch-fixture' }, args => ({ contents: modules[args.path], loader: 'js' }))
    } }],
  })
  return output.outputFiles[0].text
}
const mainCode = await bundle('src/main.jsx'), loginCode = await bundle('src/components/Login.jsx')
let serial = 0
const importCode = code => import('data:text/javascript;base64,' + Buffer.from(code + `\n// isolated execution ${++serial}`).toString('base64'))
function environment(path = '/', mode = 'browser', search = '') {
  globalThis.__launch = { clients: [], tree: null, brand: null }
  globalThis.document = { getElementById: id => ({ id }) }
  globalThis.window = {
    location: { pathname: path, search, assign() {} },
    navigator: { standalone: mode === 'ios' },
    matchMedia: query => ({ matches: mode === 'standalone' && query === '(display-mode: standalone)' }),
  }
}
async function flatten(node, out = []) {
  if (!node || typeof node !== 'object') return out
  let type = node.type
  if (type?.loader) type = (await type.loader()).default
  out.push({ type, props: node.props || {} })
  for (const child of [node.props?.children].flat(Infinity)) await flatten(child, out)
  return out
}
async function boot(path, mode = 'browser', search = '') {
  environment(path, mode, search)
  await importCode(mainCode)
  return { nodes: await flatten(__launch.tree), clients: __launch.clients, brand: __launch.brand }
}
async function login(path, mode = 'browser', search = '') {
  environment(path, mode, search)
  const { default: Login } = await importCode(loginCode)
  return Login()
}
const types = result => result.nodes.map(node => node.type)

test('ordinary Safari root boots the sales page without mounting a workspace or auth client', async () => {
  const result = await boot('/', 'browser')
  assert.ok(types(result).includes('Sales'))
  assert.ok(!types(result).includes('ConvexAuthProvider'))
  assert.ok(!types(result).includes('AppProvider'))
  assert.deepEqual(result.clients, [])
  assert.equal(result.brand, 'sales')
})

test('iPhone and standard installed root launches mount the provider that can restore a saved session', async () => {
  for (const mode of ['ios', 'standalone']) {
    for (const path of ['/', '/app']) {
      const result = await boot(path, mode)
      assert.ok(types(result).includes('ConvexAuthProvider'), `${mode} ${path}`)
      assert.ok(types(result).includes('AppProvider'), `${mode} ${path}`)
      assert.ok(types(result).includes('App'), `${mode} ${path}`)
      assert.ok(!types(result).includes('Sales'))
      assert.deepEqual(result.clients, ['https://unit.convex.cloud'])
      assert.equal(result.brand, 'app')
    }
  }
})

test('an installed launch without a session goes directly to sign-in with no landing-page Back control', async () => {
  for (const mode of ['ios', 'standalone']) {
    for (const path of ['/', '/app', '/login', '/portal', '/onboarding']) {
      const tree = await login(path, mode)
      assert.equal(tree.type, 'Auth', `${mode} ${path}`)
      assert.deepEqual(tree.props.intent, { kind: 'default' })
      assert.equal(tree.props.onBack, undefined)
    }
  }
})

test('ordinary portal sign-in retains its navigation while the public app demo door remains available', async () => {
  const portal = await login('/portal', 'browser')
  assert.equal(portal.type, 'Auth')
  assert.equal(typeof portal.props.onBack, 'function')
  const demo = await login('/app', 'browser')
  assert.notEqual(demo.type, 'Auth')
  assert.equal(typeof demo.type, 'function')
})

test('installed signup and family invitations keep their requested account intent', async () => {
  const signup = await login('/signup', 'ios')
  assert.equal(signup.type, 'Auth')
  assert.deepEqual(signup.props.intent, { kind: 'owner' })
  const invitation = await login('/join', 'ios', '?t=synthetic-invite')
  assert.equal(invitation.type, 'Auth')
  assert.deepEqual(invitation.props.intent, { kind: 'join', token: 'synthetic-invite' })
  const daycare = await login('/sunshine-daycare', 'ios', '?token=synthetic-family')
  assert.equal(daycare.props.slug, 'sunshine-daycare')
  assert.equal(daycare.props.token, 'synthetic-family')
})

test('installed employee onboarding mounts its own authenticated form rather than the dashboard', async () => {
  const result = await boot('/onboard', 'ios', '?token=synthetic-employee')
  assert.ok(types(result).includes('ConvexAuthProvider'))
  assert.ok(!types(result).includes('AppProvider'))
  assert.ok(!types(result).includes('App'))
  assert.equal(result.nodes.find(node => node.type === 'EmployeeOnboarding').props.token, 'synthetic-employee')
})

test('explicit marketing and legal destinations keep their own screens inside an installed app', async () => {
  for (const path of ['/partners', '/whitelabel', '/sell', '/for-childcare']) {
    const result = await boot(path, 'ios')
    assert.ok(types(result).includes('Sales'), path)
    assert.ok(!types(result).includes('ConvexAuthProvider'), path)
  }
  for (const [path, page] of [['/privacy', 'privacy'], ['/terms', 'terms']]) {
    const result = await boot(path, 'ios')
    assert.equal(result.nodes.find(node => node.type === 'Legal').props.page, page)
    assert.ok(!types(result).includes('App'))
  }
})

test('root payment returns mount the app and retain reconciliation parameters in both browser modes', async () => {
  for (const mode of ['browser', 'ios']) {
    for (const query of ['?stripe=success&session_id=synthetic-session', '?billing=success&session_id=synthetic-session']) {
      const result = await boot('/', mode, query)
      assert.ok(types(result).includes('App'))
      assert.ok(types(result).includes('ConvexAuthProvider'))
      assert.equal(window.location.search, query)
    }
  }
})
