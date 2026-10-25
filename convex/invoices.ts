import { query, mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireFacility } from './lib'
import { subsidyReductionItems } from './subsidies'
import { cents, dollars, localDate, monthBounds } from './financeUtils'
import { recordOwnerEvent } from './notifications'

async function requireAdmin(ctx: any) {
  const f = await requireFacility(ctx)
  if (f.user.role !== 'admin') throw new Error('Only the director can manage invoices.')
  return f
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function todayLabel() {
  const d = new Date()
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}
function newInvId() {
  const d = new Date()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `INV-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}-${rand}`
}

function publicShape(doc: any) {
  const { _id, _creationTime, facilityId, invId, order, parentUserId, stripeSessionId, stripeAccountId, ...rest } = doc
  return { id: invId, mine: false, ...rest }
}

// Parents see ONLY their own invoices (or the demo facility's seeded, untargeted
// rows). Staff/admin see everything for the facility.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    const facility = await ctx.db.get(fid)
    if (me?.role === 'staff') return []
    const docs = await ctx.db
      .query('invoices')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const visible =
      me && me.role === 'parent' && !facility?.isDemo
        ? docs.filter((d) => d.parentUserId === uid)
        : me && me.role === 'parent'
          ? docs.filter((d) => !d.parentUserId || d.parentUserId === uid)
          : docs
    return visible
      .filter((d) => d.status !== 'void')
      .sort((a, b) => b.order - a.order)
      .map((d) => ({ ...publicShape(d), mine: !!uid && d.parentUserId === uid }))
  },
})

// Single invoice by its public invId (Stripe Checkout + the printable document).
export const getOne = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc) return null
    const fid = await resolveFacilityId(ctx)
    if (!fid || doc.facilityId !== fid) return null
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    if (user && (user.role === 'staff' || (user.role === 'parent' && doc.parentUserId !== uid))) return null
    return publicShape(doc)
  },
})

// Families with a claimed parent account — the director's bill-to picker.
export const families = query({
  args: {},
  handler: async (ctx) => {
    const { facilityId, user } = await requireFacility(ctx)
    if (user.role !== 'admin') return []
    const kids = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .collect()
    const byParent = new Map<string, any>()
    for (const k of kids) {
      if (!k.parentUserId || k.archivedAt) continue
      const key = String(k.parentUserId)
      if (!byParent.has(key)) {
        const parent = await ctx.db.get(k.parentUserId)
        byParent.set(key, { parentUserId: k.parentUserId, parentName: (parent as any)?.name || 'Parent', kids: [] })
      }
      byParent.get(key).kids.push({ id: k._id, name: k.name, monthlyTuition: (k as any).monthlyTuition || 0 })
    }
    return [...byParent.values()]
  },
})

// Director issues an invoice to one family. Pass includeExtras to sweep that
// family's unbilled extras + monthly plans into line items (extras get marked
// billed so the Finance banner clears).
export const create = mutation({
  args: {
    parentUserId: v.optional(v.id('users')),
    billTo: v.string(),
    childName: v.optional(v.string()),
    period: v.string(),
    due: v.string(),
    items: v.array(v.object({ label: v.string(), amt: v.number() })),
    includeExtras: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { facilityId } = await requireAdmin(ctx)
    if (args.parentUserId) { const parent = await ctx.db.get(args.parentUserId); if (!parent || parent.facilityId !== facilityId || parent.role !== 'parent') throw new Error('Family not found.') }
    if (!args.billTo.trim() || !args.period.trim() || !args.due.trim()) throw new Error('Family, period and due date are required.')
    const facility = await ctx.db.get(facilityId)
    const range = monthBounds(args.period, localDate(Date.now(), facility?.timezone))
    const items = args.items.map(item => { if (!item.label.trim()) throw new Error('Each invoice item needs a label.'); return { label: item.label.trim(), amt: dollars(cents(item.amt)) } })
    const consumed: any[] = []

    if (args.includeExtras && args.parentUserId) {
      const kids = await ctx.db
        .query('children')
        .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
        .collect()
      const myKids = kids.filter((k: any) => !k.archivedAt && k.parentUserId === args.parentUserId)
      for (const kid of myKids) {
        const charges = await ctx.db
          .query('extraCharges')
          .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
          .collect()
        for (const c of charges.filter((c: any) => c.childId === kid._id && (c.status === 'unbilled' || c.status === 'logged') && localDate(c.createdAt, facility?.timezone) <= range.end)) {
          items.push({ label: `${c.serviceName} — ${kid.name} (${localDate(c.createdAt, facility?.timezone)})`, amt: dollars(cents(c.amount)) })
          consumed.push(c._id)
        }
        const subs = await ctx.db
          .query('planSubscriptions')
          .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
          .collect()
        for (const s of subs.filter((s: any) => s.childId === kid._id && s.active)) {
          items.push({ label: `${s.serviceName} (monthly plan) — ${kid.name}`, amt: dollars(cents(s.monthlyAmount)) })
        }
        for (const it of await subsidyReductionItems(ctx, kid._id, kid.name, range)) items.push(it)
      }
    }

    const amount = dollars(items.reduce((sum, it) => sum + cents(it.amt), 0))
    if (amount <= 0) throw new Error('Invoice has no amount.')
    const last = await ctx.db
      .query('invoices')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .collect()
    const invId = newInvId()
    await ctx.db.insert('invoices', {
      facilityId,
      invId,
      period: args.period,
      amount,
      status: 'due',
      due: args.due,
      items,
      order: Math.max(0, ...last.map((d: any) => d.order)) + 1,
      parentUserId: args.parentUserId,
      billTo: args.billTo,
      childName: args.childName,
      notes: args.notes,
    })
    for (const chargeId of consumed) await ctx.db.patch(chargeId, { status: 'billed' })
    await recordOwnerEvent(ctx, { facilityId, type: 'invoice_created', summary: `Invoice ${invId} was issued.` })
    return { invId, amount }
  },
})

// Parent says "I've sent the e-Transfer" → processing until the director confirms.
export const markEtransferSent = mutation({
  args: { id: v.string(), ref: v.optional(v.string()) },
  handler: async (ctx, { id, ref }) => {
    const { userId: uid, facilityId: fid } = await requireFacility(ctx)
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc || doc.facilityId !== fid || ['paid', 'void'].includes(doc.status)) return
    const facility = await ctx.db.get(doc.facilityId)
    if (!facility?.isDemo && doc.parentUserId !== uid) throw new Error('Not your invoice.')
    await ctx.db.patch(doc._id, { status: 'processing', method: 'etransfer', etransferRef: ref || doc.invId })
    await recordOwnerEvent(ctx, { facilityId: fid, actorId: uid, type: 'payment_reported', summary: `A family reported an e-transfer for ${id}.` })
  },
})

// Director confirms money arrived (e-transfer hit the bank, cash, cheque…).
export const confirmPaid = mutation({
  args: { id: v.string(), method: v.optional(v.string()) },
  handler: async (ctx, { id, method }) => {
    const { facilityId } = await requireAdmin(ctx)
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc || doc.facilityId !== facilityId || doc.status === 'void') throw new Error('Invoice cannot be paid.')
    if (doc.status === 'paid') return
    await ctx.db.patch(doc._id, { status: 'paid', paidOn: todayLabel(), method: method || doc.method || 'manual' })
    await recordOwnerEvent(ctx, { facilityId, type: 'payment_confirmed', summary: `Payment for ${id} was confirmed by the director.` })
  },
})

export const voidInvoice = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireAdmin(ctx)
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc || doc.facilityId !== facilityId || ['paid', 'void'].includes(doc.status)) return
    await ctx.db.patch(doc._id, { status: 'void' })
    await recordOwnerEvent(ctx, { facilityId, type: 'invoice_voided', summary: `Invoice ${id} was voided.` })
  },
})

// Legacy demo path + Stripe success fallback: mark an invoice paid by card.
export const pay = mutation({
  args: { id: v.string(), paidOn: v.string() },
  handler: async (ctx, { id, paidOn }) => {
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc) return
    const fid = await resolveFacilityId(ctx)
    const facility = fid ? await ctx.db.get(fid) : null
    if (!facility?.isDemo || doc.facilityId !== fid) throw new Error('Real payments must be verified by the payment service or director.')
    await ctx.db.patch(doc._id, { status: 'paid', paidOn, method: doc.method || 'card' })
  },
})

// Stamp Stripe session details on an invoice (called by payments.createCheckoutSession).
export const attachSession = internalMutation({
  args: { id: v.string(), sessionId: v.string(), accountId: v.optional(v.string()) },
  handler: async (ctx, { id, sessionId, accountId }) => {
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc) return
    await ctx.db.patch(doc._id, { stripeSessionId: sessionId, stripeAccountId: accountId, method: 'card' })
  },
})

export const getSession = internalMutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc) return null
    return { sessionId: doc.stripeSessionId, accountId: doc.stripeAccountId, status: doc.status }
  },
})

// ── Monthly auto-invoicing (cron, 1st of the month) ─────────────────────────
// For every real facility with autoInvoice on: one invoice per family =
// tuition for each of their children + active plans + unbilled extras.
export const generateMonthly = internalMutation({
  args: {},
  handler: async (ctx) => {
    const facilities = await ctx.db.query('facilities').collect()
    let created = 0

    for (const f of facilities) {
      if (f.isDemo || !f.autoInvoice) continue
      const day = localDate(Date.now(), f.timezone)
      const range = monthBounds(day)
      const period = `${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`
      const due = `${MONTHS[Number(day.slice(5, 7)) - 1]} 15, ${day.slice(0, 4)}`
      const kids = await ctx.db
        .query('children')
        .withIndex('by_facility', (q) => q.eq('facilityId', f._id))
        .collect()
      const existing = await ctx.db
        .query('invoices')
        .withIndex('by_facility', (q) => q.eq('facilityId', f._id))
        .collect()
      const charges = await ctx.db
        .query('extraCharges')
        .withIndex('by_facility', (q) => q.eq('facilityId', f._id))
        .collect()
      const subs = await ctx.db
        .query('planSubscriptions')
        .withIndex('by_facility', (q) => q.eq('facilityId', f._id))
        .collect()

      // group billable children by claiming parent
      const byParent = new Map<string, any[]>()
      for (const k of kids) {
        if (!k.parentUserId || k.archivedAt) continue
        const key = String(k.parentUserId)
        if (!byParent.has(key)) byParent.set(key, [])
        byParent.get(key)!.push(k)
      }

      for (const [parentKey, family] of byParent) {
        // skip if this family already has an invoice for this period
        if (existing.some((d: any) => d.period === period && String(d.parentUserId) === parentKey)) continue
        const items: { label: string; amt: number }[] = []
        const consumed: any[] = []
        for (const kid of family) {
          if (kid.monthlyTuition > 0) items.push({ label: `Tuition — ${kid.name}`, amt: dollars(cents(kid.monthlyTuition)) })
          for (const s of subs.filter((s: any) => s.childId === kid._id && s.active)) {
            items.push({ label: `${s.serviceName} (monthly plan) — ${kid.name}`, amt: dollars(cents(s.monthlyAmount)) })
          }
          for (const c of charges.filter((c: any) => c.childId === kid._id && (c.status === 'unbilled' || c.status === 'logged') && localDate(c.createdAt, f.timezone) <= range.end)) {
            items.push({ label: `${c.serviceName} — ${kid.name} (${localDate(c.createdAt, f.timezone)})`, amt: dollars(cents(c.amount)) })
            consumed.push(c._id)
          }
          for (const it of await subsidyReductionItems(ctx, kid._id, kid.name, range)) items.push(it)
        }
        const amount = dollars(items.reduce((s, it) => s + cents(it.amt), 0))
        if (amount <= 0) continue
        const parent = await ctx.db.get(family[0].parentUserId)
        await ctx.db.insert('invoices', {
          facilityId: f._id,
          invId: newInvId(),
          period,
          amount,
          status: 'due',
          due,
          items,
          order: Math.max(0, ...existing.map((d: any) => d.order)) + 1 + created,
          parentUserId: family[0].parentUserId,
          billTo: (parent as any)?.name || family.map((k) => k.name).join(' & ') + ' family',
          childName: family.map((k) => k.name).join(', '),
        })
        for (const chargeId of consumed) await ctx.db.patch(chargeId, { status: 'billed' })
        await recordOwnerEvent(ctx, { facilityId: f._id, type: 'invoice_created', summary: `Monthly tuition invoice was issued for ${period}.` })
        created++
      }
    }
    return { created }
  },
})

// Reserve a stable payment attempt before contacting Stripe. Concurrent calls
// reuse the same idempotency key and never create competing Checkout charges.
export const beginCheckout = internalMutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const { facilityId, userId, user, facility } = await requireFacility(ctx)
    const invoice = await ctx.db.query('invoices').withIndex('by_invId', q => q.eq('invId', id)).first()
    if (!invoice || invoice.facilityId !== facilityId || !['admin', 'parent'].includes(user.role || '') || (user.role === 'parent' && invoice.parentUserId !== userId)) throw new Error('Invoice not found.')
    if (facility.isDemo) throw new Error('Demo invoices cannot be charged.')
    if (!['due', 'overdue'].includes(invoice.status)) throw new Error('This invoice is already paid, awaiting confirmation, or canceled.')
    const amountCents = cents(invoice.amount)
    if (amountCents <= 0) throw new Error('Invoice has no payable amount.')
    const attempts = await ctx.db.query('paymentAttempts').withIndex('by_invoice', q => q.eq('invoiceId', invoice._id)).collect()
    const prior = attempts.find(a => ((a.status === 'creating' && a.createdAt > Date.now() - 5 * 60 * 1000) || (a.status === 'open' && a.createdAt > Date.now() - 60 * 60 * 1000)) && a.amountCents === amountCents)
    if (prior) return { ...prior, attemptId: prior._id, period: invoice.period, facilityName: facility.name }
    const accountId = facility.stripeAccountReady ? facility.stripeAccountId : undefined
    const now = Date.now()
    const values = { facilityId, invoiceId: invoice._id, invId: id, amountCents, currency: 'cad', status: 'creating', createdAt: now, updatedAt: now, stripeAccountId: accountId }
    const attemptId = await ctx.db.insert('paymentAttempts', values)
    return { ...values, attemptId, period: invoice.period, facilityName: facility.name }
  },
})
export const attachAttempt = internalMutation({
  args: { attemptId: v.id('paymentAttempts'), sessionId: v.string(), url: v.string() },
  handler: async (ctx, { attemptId, sessionId, url }) => {
    const attempt = await ctx.db.get(attemptId)
    if (!attempt) throw new Error('Payment attempt not found.')
    if (attempt.stripeSessionId && attempt.stripeSessionId !== sessionId) throw new Error('Payment session conflict.')
    await ctx.db.patch(attemptId, { stripeSessionId: sessionId, checkoutUrl: url, status: attempt.status === 'paid' ? 'paid' : 'open', updatedAt: Date.now() })
    await ctx.db.patch(attempt.invoiceId, { stripeSessionId: sessionId, stripeAccountId: attempt.stripeAccountId, method: 'card' })
  },
})
export const attemptForSession = internalMutation({
  args: { sessionId: v.string(), invId: v.optional(v.string()) },
  handler: async (ctx, { sessionId, invId }) => {
    const { facilityId, userId, user } = await requireFacility(ctx)
    const attempt = await ctx.db.query('paymentAttempts').withIndex('by_session', q => q.eq('stripeSessionId', sessionId)).first()
    const invoice = attempt ? await ctx.db.get(attempt.invoiceId) : invId ? await ctx.db.query('invoices').withIndex('by_invId', q => q.eq('invId', invId)).first() : null
    if (!invoice || invoice.facilityId !== facilityId || (invId && invoice.invId !== invId) || !['admin', 'parent'].includes(user.role || '') || (user.role === 'parent' && invoice.parentUserId !== userId)) throw new Error('Invoice not found.')
    if (!attempt && invoice.stripeSessionId !== sessionId) throw new Error('Unknown payment session.')
    return attempt || { invId: invoice.invId, stripeAccountId: invoice.stripeAccountId, amountCents: cents(invoice.amount), currency: 'cad' }
  },
})
export async function applyVerifiedPayment(ctx: any, input: { id: string; sessionId: string; paidOn: string; amountCents: number; currency: string; accountId?: string }) {
  const invoice = await ctx.db.query('invoices').withIndex('by_invId', (q: any) => q.eq('invId', input.id)).first()
  const attempt = await ctx.db.query('paymentAttempts').withIndex('by_session', (q: any) => q.eq('stripeSessionId', input.sessionId)).first()
  if (!invoice || (attempt ? attempt.invoiceId !== invoice._id : invoice.stripeSessionId !== input.sessionId)) throw new Error('Payment session does not match this invoice.')
  const expected = attempt || { amountCents: cents(invoice.amount), currency: 'cad', stripeAccountId: invoice.stripeAccountId }
  if (input.amountCents !== expected.amountCents || input.currency.toLowerCase() !== expected.currency || (input.accountId || '') !== (expected.stripeAccountId || '')) throw new Error('Payment amount, currency or account does not match.')
  if (attempt?.status === 'paid') return
  if (attempt) await ctx.db.patch(attempt._id, { status: 'paid', paidAt: Date.now(), updatedAt: Date.now() })
  if (invoice.status === 'paid' || invoice.status === 'void') {
    await recordOwnerEvent(ctx, { facilityId: invoice.facilityId, type: 'payment_review_required', summary: `A card payment for ${input.id} requires review because the invoice is ${invoice.status}.` })
    return
  }
  await ctx.db.patch(invoice._id, { status: 'paid', paidOn: input.paidOn, method: 'card' })
  await recordOwnerEvent(ctx, { facilityId: invoice.facilityId, type: 'payment_confirmed', summary: `Card payment for ${input.id} was verified.` })
}
export const recordVerifiedPayment = internalMutation({
  args: { id: v.string(), sessionId: v.string(), paidOn: v.string(), amountCents: v.number(), currency: v.string(), accountId: v.optional(v.string()) },
  handler: applyVerifiedPayment,
})
