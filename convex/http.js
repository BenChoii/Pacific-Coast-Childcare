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

function hex(buf) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function verifyStripeSignature(payload, header, secret) {
  if (!secret) return true // not configured → accept (use only in dev)
  if (!header) return false
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')))
  const t = parts.t
  const v1 = parts.v1
  if (!t || !v1) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`))
  return hex(mac) === v1
}

http.route({
  path: '/stripe/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const payload = await request.text()
    const sig = request.headers.get('stripe-signature')
    const secret = process.env.STRIPE_WEBHOOK_SECRET
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
      })
    } catch (e) {
      // Acknowledge anyway so Stripe doesn't hammer retries on a logic bug.
      return new Response('handled-with-error', { status: 200 })
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

export default http
