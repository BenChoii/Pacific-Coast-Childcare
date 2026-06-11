// Lightweight, router-free entry detection. One deployment serves the Mitten
// sales site, the live demo, owner self-serve signup, and per-facility parent
// join links — all distinguished by pathname.

export const SALES_ROUTES = ['/partners', '/whitelabel', '/sell', '/for-childcare']
export const APP_ROUTES = ['/app', '/demo', '/portal']
export const LEGAL_ROUTES = ['/terms', '/privacy']
const RESERVED = new Set([...SALES_ROUTES, ...APP_ROUTES, ...LEGAL_ROUTES, '/signup', '/join', '/onboard', '/login', '/onboarding', '/resources', '/guides', '/tools', '/', ''])

export function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

// What is this URL asking for?
//   { kind: 'owner' }                 → /signup (create a daycare)
//   { kind: 'join', token }           → /join?t=… (invited parent/staff)
//   { kind: 'slug', slug, token }     → /<daycare> (facility landing)
//   { kind: 'normal' }                → /app, /demo, default
export function getEntry() {
  const path = currentPath()
  const params = new URLSearchParams(window.location.search)
  const token = params.get('t') || params.get('token') || ''
  if (path === '/signup') return { kind: 'owner' }
  if (path === '/join') return { kind: 'join', token }
  if (path === '/onboard') return { kind: 'onboard', token }
  const m = path.match(/^\/([a-z0-9][a-z0-9-]{1,40})$/)
  if (m && !RESERVED.has(path)) return { kind: 'slug', slug: m[1], token }
  return { kind: 'normal' }
}

// Does this path belong to the app (vs the sales site)?
export function isAppPath() {
  const path = currentPath()
  if (SALES_ROUTES.includes(path)) return false
  const e = getEntry()
  return APP_ROUTES.includes(path) || e.kind !== 'normal'
}
