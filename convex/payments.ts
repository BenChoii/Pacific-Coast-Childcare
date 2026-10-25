import { action } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { connectKey } from './connect'
import { localDate, paymentOrigin } from './financeUtils'

// A stored attempt binds amount, account and Stripe idempotency key before any
// network request. The webhook completes payments even if the browser closes.
export const createCheckoutSession = action({
  args: { id: v.string(), origin: v.string() },
  handler: async (ctx, { id, origin }): Promise<{ configured: boolean; url?: string; error?: string }> => {
    if (!process.env.STRIPE_SECRET_KEY) return { configured: false }
    try {
      const base = paymentOrigin(origin)
      const attempt: any = await ctx.runMutation(internal.invoices.beginCheckout, { id })
      if (attempt.checkoutUrl) return { configured: true, url: attempt.checkoutUrl }
      const account = attempt.stripeAccountId
      const body = new URLSearchParams({
        mode: 'payment', success_url: `${base}/app?stripe=success&inv=${encodeURIComponent(id)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/app?stripe=cancel`,
        'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': attempt.currency,
        'line_items[0][price_data][unit_amount]': String(attempt.amountCents),
        'line_items[0][price_data][product_data][name]': `Tuition — ${attempt.period}`,
        'line_items[0][price_data][product_data][description]': attempt.facilityName || 'Childcare tuition',
        'metadata[invId]': id, 'metadata[attemptId]': attempt.attemptId,
        expires_at: String(Math.floor(attempt.createdAt / 1000) + 60 * 60),
      })
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST', headers: {
          Authorization: `Bearer ${account ? connectKey() : process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `tuition-${attempt.attemptId}`,
          ...(account ? { 'Stripe-Account': account } : {}),
        }, body: body.toString(),
      })
      if (!response.ok) return { configured: true, error: 'Payment checkout could not be opened. Please try again or contact the director.' }
      const session = await response.json()
      if (!session.id || !session.url) throw new Error('Payment checkout was incomplete.')
      await ctx.runMutation(internal.invoices.attachAttempt, { attemptId: attempt.attemptId, sessionId: session.id, url: session.url })
      return { configured: true, url: session.url }
    } catch (error) { return { configured: true, error: error instanceof Error ? error.message : 'Could not open payment checkout.' } }
  },
})
export const confirmCheckout = action({
  args: { sessionId: v.string(), invId: v.optional(v.string()) },
  handler: async (ctx, { sessionId, invId }): Promise<{ ok: boolean; invId?: string }> => {
    if (!process.env.STRIPE_SECRET_KEY) return { ok: false }
    try {
      const attempt: any = await ctx.runMutation(internal.invoices.attemptForSession, { sessionId, invId })
      const account = attempt.stripeAccountId
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${account ? connectKey() : process.env.STRIPE_SECRET_KEY}`, ...(account ? { 'Stripe-Account': account } : {}) },
      })
      if (!response.ok) return { ok: false }
      const session = await response.json()
      if (session.mode !== 'payment' || session.payment_status !== 'paid' || session.metadata?.invId !== attempt.invId) return { ok: false }
      await ctx.runMutation(internal.invoices.recordVerifiedPayment, {
        id: attempt.invId, sessionId, amountCents: session.amount_total, currency: session.currency,
        accountId: account, paidOn: localDate(),
      })
      return { ok: true, invId: attempt.invId }
    } catch { return { ok: false } }
  },
})
