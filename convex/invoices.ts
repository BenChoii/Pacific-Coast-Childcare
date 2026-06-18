import { query, mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireFacility } from './lib'
import { subsidyReductionItems } from './subsidies'

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
      if (!k.parentUserId) continue
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
    const items = [...args.items]

    if (args.includeExtras && args.parentUserId) {
      const kids = await ctx.db
        .query('children')
        .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
        .collect()
      const myKids = kids.filter((k: any) => k.parentUserId === args.parentUserId)
      for (const kid of myKids) {
        const charges = await ctx.db
          .query('extraCharges')
          .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
          .collect()
        for (const c of charges.filter((c: any) => c.childId === kid._id && c.status === 'logged')) {
          items.push({ label: `${c.serviceName} — ${kid.name} (${c.date})`, amt: Math.round(c.amountCents / 100) })
          await ctx.db.patch(c._id, { status: 'billed' })
        }
        const subs = await ctx.db
          .query('planSubscriptions')
          .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
          .collect()
        for (const s of subs.filter((s: any) => s.childId === kid._id && s.active)) {
          items.push({ label: `${s.serviceName} (monthly plan) — ${kid.name}`, amt: Math.round(s.monthlyCents / 100) })
        }
        for (const it of await subsidyReductionItems(ctx, kid._id, kid.name)) items.push(it)
      }
    }

    const amount = items.reduce((sum, it) => sum + it.amt, 0)
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
    return { invId, amount }
  },
})

// Parent says "I've sent the e-Transfer" → processing until the director confirms.
export const markEtransferSent = mutation({
  args: { id: v.string(), ref: v.optional(v.string()) },
  handler: async (ctx, { id, ref }) => {
    const uid = await getAuthUserId(ctx)
    if (!uid) throw new Error('Sign in first.')
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc || doc.status === 'paid') return
    const facility = await ctx.db.get(doc.facilityId)
    if (!facility?.isDemo && doc.parentUserId && doc.parentUserId !== uid) throw new Error('Not your invoice.')
    await ctx.db.patch(doc._id, { status: 'processing', method: 'etransfer', etransferRef: ref || doc.invId })
  },
})

// Director confirms money arrived (e-transfer hit the bank, cash, cheque…).
export const confirmPaid = mutation({
  args: { id: v.string(), method: v.optional(v.string()) },
  handler: async (ctx, { id, method }) => {
    const { facilityId } = await requireAdmin(ctx)
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc || doc.facilityId !== facilityId) return
    await ctx.db.patch(doc._id, { status: 'paid', paidOn: todayLabel(), method: method || doc.method || 'manual' })
  },
})

export const voidInvoice = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireAdmin(ctx)
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc || doc.facilityId !== facilityId || doc.status === 'paid') return
    await ctx.db.patch(doc._id, { status: 'void' })
  },
})

// Legacy demo path + Stripe success fallback: mark an invoice paid by card.
export const pay = mutation({
  args: { id: v.string(), paidOn: v.string() },
  handler: async (ctx, { id, paidOn }) => {
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc) return
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
    const now = new Date()
    const period = `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`
    const due = `${MONTHS[now.getUTCMonth()]} 15, ${now.getUTCFullYear()}`
    let created = 0

    for (const f of facilities) {
      if (f.isDemo || !f.autoInvoice) continue
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
        if (!k.parentUserId) continue
        const key = String(k.parentUserId)
        if (!byParent.has(key)) byParent.set(key, [])
        byParent.get(key)!.push(k)
      }

      for (const [parentKey, family] of byParent) {
        // skip if this family already has an invoice for this period
        if (existing.some((d: any) => d.period === period && String(d.parentUserId) === parentKey)) continue
        const items: { label: string; amt: number }[] = []
        for (const kid of family) {
          if (kid.monthlyTuition > 0) items.push({ label: `Tuition — ${kid.name}`, amt: kid.monthlyTuition })
          for (const s of subs.filter((s: any) => s.childId === kid._id && s.active)) {
            items.push({ label: `${s.serviceName} (monthly plan) — ${kid.name}`, amt: Math.round(s.monthlyCents / 100) })
          }
          for (const c of charges.filter((c: any) => c.childId === kid._id && c.status === 'logged')) {
            items.push({ label: `${c.serviceName} — ${kid.name} (${c.date})`, amt: Math.round(c.amountCents / 100) })
            await ctx.db.patch(c._id, { status: 'billed' })
          }
          for (const it of await subsidyReductionItems(ctx, kid._id, kid.name)) items.push(it)
        }
        const amount = items.reduce((s, it) => s + it.amt, 0)
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
        created++
      }
    }
    return { created }
  },
})
