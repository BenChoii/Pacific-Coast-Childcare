import { action, internalQuery, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import { requireFacility } from './lib'

// ── Stripe Connect (Express) ─────────────────────────────────────────────────
// Each daycare gets its OWN Stripe account: card payments are direct charges on
// the connected account, so the money settles to the daycare's bank, their name
// shows on the parent's statement, and Checkout wears their branding (set in
// their Stripe dashboard). Mitten takes no cut (no application_fee).

const API = 'https://api.stripe.com/v1'

function form(data: Record<string, string>) {
  const b = new URLSearchParams()
  for (const [k, val] of Object.entries(data)) b.set(k, val)
  return b.toString()
}

async function stripe(key: string, path: string, body?: Record<string, string>, account?: string) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(account ? { 'Stripe-Account': account } : {}),
    },
    ...(body ? { body: form(body) } : {}),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || `Stripe ${path} failed`)
  return json
}

export const myFacility = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { facility, user } = await requireFacility(ctx)
    if (user.role !== 'admin') throw new Error('Directors only.')
    return {
      id: facility._id,
      name: facility.name,
      billingEmail: facility.billingEmail,
      stripeAccountId: facility.stripeAccountId,
      isDemo: !!facility.isDemo,
    }
  },
})

export const saveAccount = internalMutation({
  args: { facilityId: v.id('facilities'), accountId: v.optional(v.string()), ready: v.optional(v.boolean()) },
  handler: async (ctx, { facilityId, accountId, ready }) => {
    const patch: any = {}
    if (accountId !== undefined) patch.stripeAccountId = accountId
    if (ready !== undefined) patch.stripeAccountReady = ready
    await ctx.db.patch(facilityId, patch)
  },
})

// Director taps "Set up card payments" → Express account + hosted onboarding link.
export const createOnboardingLink = action({
  args: { origin: v.string() },
  handler: async (ctx, { origin }): Promise<{ configured: boolean; url?: string; error?: string }> => {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return { configured: false }
    const fac: any = await ctx.runQuery(internal.connect.myFacility, {})
    if (fac.isDemo) return { configured: true, error: 'Connect is disabled on the demo facility.' }

    let accountId = fac.stripeAccountId
    if (!accountId) {
      const acct = await stripe(key, '/accounts', {
        type: 'express',
        country: 'CA',
        ...(fac.billingEmail ? { email: fac.billingEmail } : {}),
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
        'business_profile[name]': fac.name,
      })
      accountId = acct.id
      await ctx.runMutation(internal.connect.saveAccount, { facilityId: fac.id, accountId })
    }

    const link = await stripe(key, '/account_links', {
      account: accountId,
      refresh_url: `${origin}/app?connect=refresh`,
      return_url: `${origin}/app?connect=return`,
      type: 'account_onboarding',
    })
    return { configured: true, url: link.url }
  },
})

// Called after the return redirect (and from the Account screen) to sync status.
export const refreshStatus = action({
  args: {},
  handler: async (ctx): Promise<{ configured: boolean; ready?: boolean; detailsSubmitted?: boolean }> => {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return { configured: false }
    const fac: any = await ctx.runQuery(internal.connect.myFacility, {})
    if (!fac.stripeAccountId) return { configured: true, ready: false }
    const acct = await stripe(key, `/accounts/${fac.stripeAccountId}`)
    const ready = !!acct.charges_enabled
    await ctx.runMutation(internal.connect.saveAccount, { facilityId: fac.id, ready })
    return { configured: true, ready, detailsSubmitted: !!acct.details_submitted }
  },
})

// Facility payment context for an invoice (used by payments.createCheckoutSession).
export const facilityForInvoice = internalQuery({
  args: { invId: v.string() },
  handler: async (ctx, { invId }) => {
    const inv = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', invId)).first()
    if (!inv) return null
    const f = await ctx.db.get(inv.facilityId)
    if (!f) return null
    return {
      name: f.name,
      stripeAccountId: f.stripeAccountId,
      stripeAccountReady: !!f.stripeAccountReady,
    }
  },
})
