import { action, internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { monthlyCents, requireFacility, FREE_LIMIT } from './lib'
import { paymentOrigin, localDate } from './financeUtils'
import { applyVerifiedPayment } from './invoices'
import { recordOwnerEvent } from './notifications'

// ── Internal: the billing state the actions need (with auth identity) ──────
export const state = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { facilityId, facility, user } = await requireFacility(ctx)
    if (user.role !== 'admin') throw new Error('Directors only.')
    const kids = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .collect()
    return {
      facilityId,
      name: facility.name,
      slug: facility.slug,
      email: user.email ?? undefined,
      stripeCustomerId: facility.stripeCustomerId ?? null,
      stripeSubscriptionId: facility.stripeSubscriptionId ?? null,
      hasCard: !!facility.hasCard,
      plan: facility.plan,
      freeLimit: facility.freeLimit ?? FREE_LIMIT,
      childCount: kids.filter(k => !k.archivedAt).length,
    }
  },
})

// Patch a facility's Stripe / plan fields (called from actions + webhook).
export const setStripe = internalMutation({
  args: {
    facilityId: v.id('facilities'),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    hasCard: v.optional(v.boolean()),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, { facilityId, ...patch }) => {
    const clean: any = {}
    for (const [k, val] of Object.entries(patch)) if (val !== undefined) clean[k] = val
    await ctx.db.patch(facilityId, clean)
    await recordOwnerEvent(ctx, { facilityId, type: 'billing_updated', summary: 'The daycare billing settings were updated.' })
  },
})

// Webhook: a subscription changed state at Stripe → reflect plan locally.
export const applySubscriptionStatus = internalMutation({
  args: { subscriptionId: v.string(), status: v.string() },
  handler: async (ctx, { subscriptionId, status }) => {
    const f = await ctx.db
      .query('facilities')
      .withIndex('by_subscription', (q) => q.eq('stripeSubscriptionId', subscriptionId))
      .first()
    if (!f) return
    const plan =
      status === 'active' || status === 'trialing'
        ? 'active'
        : status === 'past_due' || status === 'unpaid'
          ? 'past_due'
          : status === 'canceled'
            ? 'canceled'
            : f.plan
    await ctx.db.patch(f._id, { plan })
    if (f.plan !== plan) await recordOwnerEvent(ctx, { facilityId: f._id, type: 'billing_status_changed', summary: 'The daycare subscription status changed.' })
  },
})

// ── Stripe REST helpers ────────────────────────────────────────────────────────
function form(obj: Record<string, string | number>) {
  const b = new URLSearchParams()
  for (const [k, val] of Object.entries(obj)) b.set(k, String(val))
  return b.toString()
}
async function stripe(key: string, path: string, body?: Record<string, string | number>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? form(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || `Stripe ${res.status}`)
  return json
}

// Build a subscription Checkout session for a given billable child count.
async function makeCheckout(key: string, st: any, count: number, origin: string) {
  origin = paymentOrigin(origin)
  const qty = Math.max(1, monthlyCents(count, st.freeLimit)) // 1-cent units → total = qty cents
  const params: Record<string, string | number> = {
    mode: 'subscription',
    'line_items[0][price_data][currency]': 'cad',
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][unit_amount]': 1,
    'line_items[0][price_data][product_data][name]': `Mitten — ${st.name}`,
    'line_items[0][price_data][product_data][description]':
      'Monthly subscription · billed per enrolled child · Mitten is an OKTD.ca company — your card statement will show OKTD.CA',
    'line_items[0][quantity]': qty,
    success_url: `${origin}/app?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/app?billing=cancel`,
    client_reference_id: st.facilityId,
    'metadata[facilityId]': st.facilityId,
    'subscription_data[metadata][facilityId]': st.facilityId,
    allow_promotion_codes: 'true',
  }
  if (st.stripeCustomerId) params.customer = st.stripeCustomerId
  else if (st.email) params.customer_email = st.email
  const session = await stripe(key, 'checkout/sessions', params)
  return session.url as string
}

// Push the current roster size onto the live subscription's quantity. If the
// facility drops to / below the free limit we don't try to bill them — we mark
// the subscription to cancel at period end (they keep access through the month
// they paid for; if they re-cross the free limit before then we un-cancel).
async function syncSubscription(key: string, st: any, count: number) {
  if (!st.stripeSubscriptionId) return
  const sub = await stripe(key, `subscriptions/${st.stripeSubscriptionId}`)
  const itemId = sub?.items?.data?.[0]?.id
  if (!itemId) return
  const cents = monthlyCents(count, st.freeLimit)
  if (cents === 0) {
    // Below billable threshold — let the current period play out, no renewals.
    await stripe(key, `subscriptions/${st.stripeSubscriptionId}`, { cancel_at_period_end: 'true' })
    return
  }
  // Billable — set quantity and (in case they were previously cancelled) un-cancel.
  await stripe(key, `subscription_items/${itemId}`, {
    quantity: cents,
    proration_behavior: 'create_prorations',
  })
  if (sub?.cancel_at_period_end) {
    await stripe(key, `subscriptions/${st.stripeSubscriptionId}`, { cancel_at_period_end: 'false' })
  }
}

// ── Public actions ───────────────────────────────────────────────────────────

// Enroll a child. Free under the limit; at the limit, requires a card on file
// (returns a Checkout URL). With a card, it adds + auto-adjusts the bill.
export const addChild = action({
  args: {
    first: v.string(),
    name: v.string(),
    age: v.string(),
    room: v.string(),
    emoji: v.string(),
    color: v.string(),
    parent: v.string(),
    allergies: v.array(v.string()),
    monthlyTuition: v.optional(v.number()),
    origin: v.string(),
  },
  handler: async (ctx, { origin, ...child }): Promise<{ ok?: boolean; childId?: Id<'children'>; billingSkipped?: boolean; needsBilling?: boolean; url?: string }> => {
    const st = await ctx.runQuery(internal.billing.state, {})
    const key = process.env.STRIPE_SECRET_KEY
    const willCount = st.childCount + 1
    const willBill = willCount > st.freeLimit
    // Needs a fresh Checkout: either they never set up billing, OR their last
    // subscription has been fully cancelled (not just scheduled to cancel).
    const needsNewBilling = !st.hasCard || st.plan === 'canceled'

    if (willBill && needsNewBilling) {
      if (!key) {
        // Stripe not configured yet — let them through so the app stays usable.
        const inserted = await ctx.runMutation(internal.children.insert, { facilityId: st.facilityId, ...child })
        return { ok: true, childId: inserted.childId, billingSkipped: true }
      }
      const url = await makeCheckout(key, st, willCount, origin)
      return { needsBilling: true, url }
    }

    const { count, childId } = await ctx.runMutation(internal.children.insert, { facilityId: st.facilityId, ...child })
    if (willBill && key && st.stripeSubscriptionId) {
      try {
        await syncSubscription(key, st, count)
      } catch (e) {
        // Non-fatal: child is enrolled; quantity reconciles on next change.
      }
    }
    return { ok: true, childId }
  },
})

// Re-sync the live subscription quantity with the actual roster (after removals).
export const syncQuantity = action({
  args: {},
  handler: async (ctx) => {
    const st = await ctx.runQuery(internal.billing.state, {})
    const key = process.env.STRIPE_SECRET_KEY
    if (!key || !st.stripeSubscriptionId) return { ok: false }
    await syncSubscription(key, st, st.childCount)
    return { ok: true }
  },
})

// Start (or update) billing — collects a card via Checkout. Used by the
// "Set up billing" button and when the free limit is reached.
export const startCheckout = action({
  args: { origin: v.string() },
  handler: async (ctx, { origin }) => {
    const st = await ctx.runQuery(internal.billing.state, {})
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return { configured: false }
    if (st.stripeSubscriptionId && st.plan !== 'canceled') return { configured: true, error: 'Billing is already set up. Use Manage billing to change the existing subscription.' }
    const url = await makeCheckout(key, st, Math.max(st.childCount, st.freeLimit + 1), origin)
    return { configured: true, url }
  },
})

// Open the Stripe billing portal (manage card / cancel).
export const billingPortal = action({
  args: { origin: v.string() },
  handler: async (ctx, { origin }) => {
    const st = await ctx.runQuery(internal.billing.state, {})
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return { configured: false }
    if (!st.stripeCustomerId) return { configured: true, error: 'No billing account yet.' }
    const session = await stripe(key, 'billing_portal/sessions', {
      customer: st.stripeCustomerId,
      return_url: `${paymentOrigin(origin)}/app`,
    })
    return { configured: true, url: session.url }
  },
})

// Mark a facility's plan active (used by confirm-on-return + webhook).
export const activate = internalMutation({
  args: {
    facilityId: v.id('facilities'),
    customerId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, { facilityId, customerId, subscriptionId }) => {
    await ctx.db.patch(facilityId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      hasCard: true,
      plan: 'active',
    })
    await recordOwnerEvent(ctx, { facilityId, type: 'billing_activated', summary: 'The daycare subscription was activated.' })
  },
})

// Confirm a Checkout session on redirect back (deterministic activation, so we
// don't depend on the webhook winning the race). The webhook remains the backup
// and handles later events (renewals, failures, cancellations).
export const confirmSubscription = action({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return { ok: false }
    try {
      const st = await ctx.runQuery(internal.billing.state, {})
      const session = await stripe(key, `checkout/sessions/${encodeURIComponent(sessionId)}`)
      const complete = session?.mode === 'subscription' && session?.status === 'complete' && ['paid', 'no_payment_required'].includes(session?.payment_status)
      const facilityId = session?.metadata?.facilityId || session?.client_reference_id
      if (complete && facilityId === st.facilityId && session.subscription) {
        await ctx.runMutation(internal.billing.activate, {
          facilityId,
          customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
          subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
        })
        return { ok: true }
      }
      return { ok: false }
    } catch {
      return { ok: false }
    }
  },
})

// Webhook entry point used by http.js after the event is verified.
export const handleStripeEvent = internalMutation({
  args: { type: v.string(), data: v.any(), eventId: v.string(), accountId: v.optional(v.string()) },
  handler: async (ctx, { type, data, eventId, accountId }) => {
    if (!eventId) throw new Error('Missing Stripe event id.')
    const seen = await ctx.db.query('stripeWebhookEvents').withIndex('by_event', q => q.eq('eventId', eventId)).first()
    if (seen) return

    const obj = data?.object ?? {}
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(type) && obj.mode === 'payment' && obj.payment_status === 'paid' && obj.metadata?.invId) {
      await applyVerifiedPayment(ctx, { id: obj.metadata.invId, sessionId: obj.id, amountCents: obj.amount_total, currency: obj.currency, accountId, paidOn: localDate() })
    } else if (type === 'checkout.session.expired' && obj.mode === 'payment') {
      const attempt = await ctx.db.query('paymentAttempts').withIndex('by_session', q => q.eq('stripeSessionId', obj.id)).first()
      if (attempt && attempt.status !== 'paid') await ctx.db.patch(attempt._id, { status: 'expired', updatedAt: Date.now() })
    } else if (type === 'checkout.session.completed' && obj.mode === 'subscription' && obj.status === 'complete' && obj.subscription) {
      const reference = obj.metadata?.facilityId || obj.client_reference_id
      const facilityId = typeof reference === 'string' ? ctx.db.normalizeId('facilities', reference) : null
      if (facilityId && !accountId) {
        const facility = await ctx.db.get(facilityId)
        if (!facility) throw new Error('Billing facility not found.')
        await ctx.db.patch(facilityId, {
          stripeCustomerId: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id,
          stripeSubscriptionId: typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id,
          hasCard: true,
          plan: 'active',
        })
        if (facility.plan !== 'active') await recordOwnerEvent(ctx, { facilityId, type: 'billing_activated', summary: 'The daycare subscription was activated.' })
      }
    } else if (type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
      const subId = obj.id
      const status = type === 'customer.subscription.deleted' ? 'canceled' : obj.status
      const f = await ctx.db
        .query('facilities')
        .withIndex('by_subscription', (q) => q.eq('stripeSubscriptionId', subId))
        .first()
      if (f) {
        const plan =
          status === 'active' || status === 'trialing'
            ? 'active'
            : status === 'past_due' || status === 'unpaid'
              ? 'past_due'
              : status === 'canceled'
                ? 'canceled'
                : f.plan
        await ctx.db.patch(f._id, { plan })
        if (f.plan !== plan) await recordOwnerEvent(ctx, { facilityId: f._id, type: 'billing_status_changed', summary: 'The daycare subscription status changed.' })
      }
    } else if (type === 'invoice.payment_failed') {
      const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id
      if (subId) {
        const f = await ctx.db
          .query('facilities')
          .withIndex('by_subscription', (q) => q.eq('stripeSubscriptionId', subId))
          .first()
        if (f) {
          await ctx.db.patch(f._id, { plan: 'past_due' })
          if (f.plan !== 'past_due') await recordOwnerEvent(ctx, { facilityId: f._id, type: 'billing_payment_failed', summary: 'The daycare subscription payment failed. Review billing.' })
        }
      }
    }
    await ctx.db.insert('stripeWebhookEvents', { eventId, type, createdAt: Date.now() })
  },
})
