// The product is Mitten (mitten.care) — the app always wears Mitten branding
// (logo, wordmark, title, favicon). "Pacific Coast Childcare Academy" survives
// only as the demo facility's *name* (facility.name), shown in the workspace
// header, never as the app logo. (Was hostname-gated; forced on so logged-in
// users always see the Mitten mark regardless of which URL they open.)
export const isMitten = true

export const BRAND = isMitten
  ? {
      mitten: true,
      name: 'Mitten',
      short: 'Mitten',
      tagline: 'Childcare, warmly handled',
      mark: '/brand/mitten-mark.svg',
    }
  : {
      mitten: false,
      name: 'Pacific Coast Childcare Academy',
      short: 'Pacific Coast',
      tagline: 'A world of learning, closer to home',
      logo: '/brand/logo.png',
    }

// Set the tab title + favicon for the current context ('app' | 'sales').
export function applyBrandHead(context) {
  if (!BRAND.mitten) return
  document.title =
    context === 'sales'
      ? 'Mitten · Private, whitelabel childcare apps'
      : 'Mitten · Family & Educator Portal'
  let link = document.querySelector("link[rel~='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/svg+xml'
  link.href = BRAND.mark
}
