import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConvexReactClient } from 'convex/react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import App from './App.jsx'
import Sales from './components/Sales.jsx'
import Legal from './components/Legal.jsx'
import EmployeeOnboarding from './components/EmployeeOnboarding.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { isMitten, applyBrandHead } from './brand.js'
import { SALES_ROUTES, LEGAL_ROUTES, isAppPath, currentPath, getEntry } from './routes.js'
import './index.css'

// Routing without a router. Two "products" share one deployment:
//   • The Mitten app (the actual portal) — needs Convex. Serves the demo, owner
//     self-serve signup (/signup), invited parent joins (/join, /<daycare>),
//     and every facility's private workspace.
//   • The Mitten whitelabel sales page — no backend.
//
// Sales routes always show Sales; app routes always show the app. The root (/)
// depends on the domain: the Mitten domain leads with the sales pitch; every
// other domain leads with the portal.
const path = currentPath()
const entry = getEntry()

let mode
if (LEGAL_ROUTES.includes(path)) mode = 'legal'
else if (entry.kind === 'onboard') mode = 'onboard'
else if (SALES_ROUTES.includes(path)) mode = 'sales'
else if (isAppPath()) mode = 'app'
else if (isMitten) mode = 'sales'
else mode = 'app'

applyBrandHead(mode === 'app' ? 'app' : 'sales')

const root = ReactDOM.createRoot(document.getElementById('root'))

if (mode === 'legal') {
  root.render(
    <React.StrictMode>
      <Legal page={path === '/privacy' ? 'privacy' : 'terms'} />
    </React.StrictMode>,
  )
} else if (mode === 'sales') {
  root.render(
    <React.StrictMode>
      <Sales />
    </React.StrictMode>,
  )
} else if (mode === 'onboard') {
  const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
  root.render(
    <React.StrictMode>
      <ConvexAuthProvider client={convex}>
        <EmployeeOnboarding token={entry.token} />
      </ConvexAuthProvider>
    </React.StrictMode>,
  )
} else {
  const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
  root.render(
    <React.StrictMode>
      <ConvexAuthProvider client={convex}>
        <AppProvider>
          <App />
        </AppProvider>
      </ConvexAuthProvider>
    </React.StrictMode>,
  )
}
