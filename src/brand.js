// The product is Cubby — the app always wears Cubby branding (logo, wordmark,
// title, favicon). "Pacific Coast Childcare Academy" survives only as the demo
// facility's *name* (facility.name), shown in the workspace header, never as
// the app logo. (Was hostname-gated; forced on so logged-in users always see
// the Cubby mark regardless of which vercel URL they open.)
export const isCubby = true

export const BRAND = isCubby
  ? {
      cubby: true,
      name: 'Cubby',
      short: 'Cubby',
      tagline: 'Childcare, beautifully connected',
      mark: '/brand/cubby-mark.svg',
    }
  : {
      cubby: false,
      name: 'Pacific Coast Childcare Academy',
      short: 'Pacific Coast',
      tagline: 'A world of learning, closer to home',
      logo: '/brand/logo.png',
    }

// Set the tab title + favicon for the current context ('app' | 'sales').
export function applyBrandHead(context) {
  if (!BRAND.cubby) return
  document.title =
    context === 'sales'
      ? 'Cubby · Private, whitelabel childcare apps'
      : 'Cubby · Family & Educator Portal'
  let link = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/svg+xml'
  link.href = BRAND.mark
}
