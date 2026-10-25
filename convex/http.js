import { registerPrivateFiles } from './privateFileHttp'
import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { auth } from './auth'
import { chat } from './ai'

const http = httpRouter()

auth.addHttpRoutes(http)

// ── Free public tool: AI lesson-plan generator ─────────────────────────────
// Powers the static /tools/ai-lesson-plan-generator page on the marketing site.
// Free OpenRouter models only; inputs are length-capped so the endpoint can't
// be abused into long expensive generations.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

http.route({
  path: '/tools/lesson-plan',
  method: 'OPTIONS',
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
})

http.route({
  path: '/tools/lesson-plan',
  method: 'POST',
  handler: httpAction(async (_ctx, request) => {
    let body
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: CORS })
    }
    const clip = (s, n) => String(s || '').slice(0, n)
    const ageGroup = clip(body.ageGroup, 40) || '3–5 years'
    const theme = clip(body.theme, 80) || 'seasons and nature'
    const days = Math.min(5, Math.max(1, parseInt(body.days) || 1))
    const domains = clip(body.domains, 120) || 'motor, language, social-emotional, cognitive'
    const setting = clip(body.setting, 60) || 'a licensed group daycare'

    const res = await chat(
      [
        {
          role: 'system',
          content:
            'You are an experienced early-childhood educator who writes practical, play-based lesson plans aligned with early-learning frameworks. Output clean markdown with ## day headings, then for each day: a one-line learning goal, 3–4 activity blocks (with a time, title, materials, and a 1–2 sentence how-to), and one observation prompt for educators. Keep it realistic for a busy classroom — common, cheap materials only.',
        },
        {
          role: 'user',
          content: `Create a ${days}-day lesson plan.\nAge group: ${ageGroup}\nTheme: ${theme}\nDevelopmental focus: ${domains}\nSetting: ${setting}`,
        },
      ],
      days <= 2 ? 700 : 1100,
    )

    if (!res.configured) {
      return new Response(JSON.stringify({ error: 'AI is not configured yet — try again soon.' }), { status: 503, headers: CORS })
    }
    if (res.error || !res.text) {
      return new Response(JSON.stringify({ error: 'The free AI models are busy — please try again in a minute.' }), { status: 502, headers: CORS })
    }
    return new Response(JSON.stringify({ plan: res.text }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }),
})

// ── Stripe webhook ─────────────────────────────────────────────────────────
// Reflects subscription lifecycle into facility.plan so access stays in sync
// with billing. Set the endpoint in the Stripe dashboard to
//   https://<your-convex-site>.convex.site/stripe/webhook
// and put the signing secret in STRIPE_WEBHOOK_SECRET.

export async function verifyStripeSignature(payload, header, secret, now = Date.now()) {
  if (!secret || !header) return false
  const parts = header.split(',').map(value => value.trim().split('='))
  const timestamp = parts.find(([key]) => key === 't')?.[1]
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value)
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  for (const signature of signatures) {
    if (!/^[a-f0-9]{64}$/i.test(signature || '')) continue
    const bytes = Uint8Array.from(signature.match(/.{2}/g), pair => parseInt(pair, 16))
    if (await crypto.subtle.verify('HMAC', key, bytes, enc.encode(`${timestamp}.${payload}`))) return true
  }
  return false
}

http.route({
  path: '/stripe/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const payload = await request.text()
    const sig = request.headers.get('stripe-signature')
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) return new Response('Webhook is not configured', { status: 503 })
    const ok = await verifyStripeSignature(payload, sig, secret)
    if (!ok) return new Response('Bad signature', { status: 400 })

    let event
    try {
      event = JSON.parse(payload)
    } catch {
      return new Response('Bad payload', { status: 400 })
    }

    try {
      await ctx.runMutation(internal.billing.handleStripeEvent, {
        type: event.type,
        data: event.data,
        eventId: event.id,
        accountId: event.account,
      })
    } catch (e) {
      // Stripe retries transient failures; successful event IDs are deduplicated.
      return new Response('Webhook processing failed', { status: 500 })
    }
    return new Response('ok', { status: 200 })
  }),
})

// ── Public childcare directory: live statuses for the static /childcare boards ──
// The marketing pages on mitten.care fetch this cross-origin to overlay live,
// owner-set statuses on the crawlable baseline. Read-only, cached briefly.
const CORS_GET = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

http.route({
  path: '/directory',
  method: 'OPTIONS',
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_GET })),
})

http.route({
  path: '/directory',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const area = (new URL(request.url).searchParams.get('area') || '').slice(0, 60).toLowerCase()
    const listings = area ? await ctx.runQuery(internal.directory.publicByArea, { area }) : []
    return new Response(JSON.stringify({ area, listings }), {
      status: 200,
      headers: { ...CORS_GET, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    })
  }),
})

// ── Website inquiry capture (director CRM add-on) ──────────────────────────
// The mitten.care/api/book-tour function (and a facility's contact form) POST a
// lead here so the same submission that emails the daycare also lands in their
// director CRM, routed to the facility by its slug. Best-effort — always 200 so
// the caller's email flow never fails on a CRM hiccup.
http.route({
  path: '/inquiries',
  method: 'OPTIONS',
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
})

http.route({
  path: '/inquiries',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let body
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const clip = (s, n) => (s == null || s === '' ? undefined : String(s).slice(0, n))
    const slug = String(body.facilitySlug || body.slug || '').trim().toLowerCase().slice(0, 60)
    const name = String(body.name || '').trim().slice(0, 120)
    if (!slug || !name) {
      return new Response(JSON.stringify({ ok: false, error: 'facilitySlug and name are required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    let res = { ok: false }
    try {
      res = await ctx.runMutation(internal.inquiries.createFromWeb, {
        facilitySlug: slug,
        source: clip(body.source, 40) || 'contact-form',
        reason: clip(body.reason, 40),
        name,
        email: clip(body.email, 200),
        phone: clip(body.phone, 40),
        childAge: clip(body.age || body.childAge, 40),
        preferredSlot: clip(body.slot || body.preferredSlot, 80),
        message: clip(body.message, 2000),
      })
    } catch (e) {
      res = { ok: false, error: 'capture-failed' }
    }
    return new Response(JSON.stringify(res), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }),
})

registerPrivateFiles(http)

export default http
