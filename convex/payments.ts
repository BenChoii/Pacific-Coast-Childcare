import { action } from './_generated/server'
import { api, internal } from './_generated/api'
import { v } from 'convex/values'

// Stripe Checkout for tuition. Activates automatically once STRIPE_SECRET_KEY
// is set on the deployment. When the facility has a ready Stripe Connect
// account, the session is a DIRECT CHARGE on that account: the daycare's own
// branding on Checkout, their name on the statement, funds to their bank.
// Until then, callers fall back to the instant-pay demo behaviour.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function todayLabel() {
  const d = new Date()
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

// Create a Stripe Checkout Session for an invoice and return its hosted URL.
export const createCheckoutSession = action({
  args: { id: v.string(), origin: v.string() },
  handler: async (ctx, { id, origin }): Promise<{ configured: boolean; url?: string; error?: string }> => {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return { configured: false }

    const invoice: any = await ctx.runQuery(api.invoices.getOne, { id })
    if (!invoice) return { configured: true, error: 'Invoice not found.' }
    const fac: any = await ctx.runQuery(internal.connect.facilityForInvoice, { invId: id })
    const useAccount = fac?.stripeAccountId && fac.stripeAccountReady ? fac.stripeAccountId : undefined

    const body = new URLSearchParams()
    body.set('mode', 'payment')
    body.set('success_url', `${origin}/?stripe=success&inv=${id}&session_id={CHECKOUT_SESSION_ID}`)
    body.set('cancel_url', `${origin}/?stripe=cancel`)
    body.set('line_items[0][quantity]', '1')
    body.set('line_items[0][price_data][currency]', 'cad')
    body.set('line_items[0][price_data][unit_amount]', String(Math.round(invoice.amount * 100)))
    body.set('line_items[0][price_data][product_data][name]', `Tuition — ${invoice.period}`)
    body.set('line_items[0][price_data][product_data][description]', fac?.name || 'Childcare tuition')
    body.set('metadata[invId]', id)

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(useAccount ? { 'Stripe-Account': useAccount } : {}),
      },
      body: body.toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      return { configured: true, error: `Stripe error: ${text.slice(0, 180)}` }
    }
    const session = await res.json()
    await ctx.runMutation(internal.invoices.attachSession, { id, sessionId: session.id, accountId: useAccount })
    return { configured: true, url: session.url }
  },
})

// After redirect back from Checkout, verify the session really was paid
// (server-side, against Stripe — on the connected account if that's where the
// session lives) before marking the invoice paid.
export const confirmCheckout = action({
  args: { sessionId: v.string(), invId: v.optional(v.string()) },
  handler: async (ctx, { sessionId, invId }): Promise<{ ok: boolean; invId?: string }> => {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return { ok: false }

    let account: string | undefined
    if (invId) {
      const stamp: any = await ctx.runMutation(internal.invoices.getSession, { id: invId })
      if (stamp?.accountId) account = stamp.accountId
    }

    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${key}`, ...(account ? { 'Stripe-Account': account } : {}) },
    })
    if (!res.ok) return { ok: false }

    const session = await res.json()
    const sessionInv = session?.metadata?.invId || invId
    if (session?.payment_status === 'paid' && sessionInv) {
      await ctx.runMutation(api.invoices.pay, { id: sessionInv, paidOn: todayLabel() })
      return { ok: true, invId: sessionInv }
    }
    return { ok: false }
  },
})
