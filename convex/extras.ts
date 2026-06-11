import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireFacility } from './lib'

// ── Extras: incident charges + monthly add-on plans ────────────────────────
// Catalog managed by the director; charges logged by educators/directors the
// moment they happen (late pickup at the door); amounts computed SERVER-side
// from the catalog so a typo can't bill a family $1,500. Parents see only
// their own children's charges and plans.

const r2 = (n: number) => Math.round(n * 100) / 100

async function requireAdmin(ctx: any) {
  const f = await requireFacility(ctx)
  if (f.user.role !== 'admin') throw new Error('Only the director can manage extras.')
  return f
}

// Children claimed by the signed-in parent (for scoping reads).
async function myChildIds(ctx: any, facilityId: any, uid: any) {
  const kids = await ctx.db
    .query('children')
    .withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId))
    .collect()
  return new Set(kids.filter((k: any) => k.parentUserId === uid).map((k: any) => k._id))
}

/* ── Catalog ── */
export const listServices = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('extraServices')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    return docs
      .map((d) => ({ id: d._id, name: d.name, emoji: d.emoji, kind: d.kind, pricing: d.pricing, amount: d.amount, active: d.active }))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'incident' ? -1 : 1))
  },
})

export const addService = mutation({
  args: { name: v.string(), emoji: v.string(), kind: v.string(), pricing: v.string(), amount: v.number() },
  handler: async (ctx, { name, emoji, kind, pricing, amount }) => {
    const { facilityId } = await requireAdmin(ctx)
    if (!['incident', 'plan'].includes(kind)) throw new Error('Bad kind')
    if (!['flat', 'per15', 'monthly'].includes(pricing)) throw new Error('Bad pricing')
    await ctx.db.insert('extraServices', {
      facilityId,
      name: name.trim() || 'Extra service',
      emoji: emoji || '✨',
      kind,
      pricing: kind === 'plan' ? 'monthly' : pricing,
      amount: Math.max(0, r2(amount)),
      active: true,
      createdAt: Date.now(),
    })
  },
})

export const toggleService = mutation({
  args: { id: v.id('extraServices'), active: v.boolean() },
  handler: async (ctx, { id, active }) => {
    const { facilityId } = await requireAdmin(ctx)
    const s = await ctx.db.get(id)
    if (!s || s.facilityId !== facilityId) throw new Error('Not found')
    await ctx.db.patch(id, { active })
  },
})

export const removeService = mutation({
  args: { id: v.id('extraServices') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireAdmin(ctx)
    const s = await ctx.db.get(id)
    if (!s || s.facilityId !== facilityId) throw new Error('Not found')
    await ctx.db.delete(id)
  },
})

/* ── Incident charges ── */
// Educators AND directors can log; amount derives from the catalog.
export const logCharge = mutation({
  args: {
    serviceId: v.id('extraServices'),
    childId: v.optional(v.id('children')),
    childName: v.string(),
    minutes: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { serviceId, childId, childName, minutes, note }) => {
    const { facilityId, user } = await requireFacility(ctx)
    if (user.role === 'parent') throw new Error('Only staff can log charges.')
    const svc = await ctx.db.get(serviceId)
    if (!svc || svc.facilityId !== facilityId || svc.kind !== 'incident') throw new Error('Service not found')
    if (childId) {
      const child = await ctx.db.get(childId)
      if (!child || child.facilityId !== facilityId) throw new Error('Child not found')
    }
    const mins = Math.max(0, Math.round(minutes ?? 0))
    const amount = svc.pricing === 'per15' ? r2((Math.max(1, Math.ceil(mins / 15)) * svc.amount)) : svc.amount
    await ctx.db.insert('extraCharges', {
      facilityId,
      serviceId,
      serviceName: svc.name,
      emoji: svc.emoji,
      childId,
      childName: childName.trim() || 'Child',
      minutes: svc.pricing === 'per15' ? mins : undefined,
      amount,
      note: note?.trim() || undefined,
      by: user.name ?? 'Staff',
      status: 'unbilled',
      createdAt: Date.now(),
    })
    return { amount }
  },
})

export const listCharges = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    const docs = await ctx.db
      .query('extraCharges')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .order('desc')
      .take(400)
    let rows = docs
    if (user?.role === 'parent') {
      const mine = await myChildIds(ctx, fid, uid)
      rows = docs.filter((d) => d.childId && mine.has(d.childId))
    }
    return rows.map((d) => ({
      id: d._id, serviceName: d.serviceName, emoji: d.emoji, childId: d.childId ?? null,
      childName: d.childName, minutes: d.minutes ?? null, amount: d.amount, note: d.note ?? '',
      by: d.by, status: d.status, createdAt: d.createdAt,
    }))
  },
})

export const setChargeStatus = mutation({
  args: { id: v.id('extraCharges'), status: v.string() },
  handler: async (ctx, { id, status }) => {
    const { facilityId } = await requireAdmin(ctx)
    if (!['unbilled', 'billed', 'waived'].includes(status)) throw new Error('Bad status')
    const c = await ctx.db.get(id)
    if (!c || c.facilityId !== facilityId) throw new Error('Not found')
    await ctx.db.patch(id, { status })
  },
})

/* ── Plan subscriptions (monthly add-ons per child) ── */
export const subscribePlan = mutation({
  args: { serviceId: v.id('extraServices'), childId: v.id('children') },
  handler: async (ctx, { serviceId, childId }) => {
    const { facilityId } = await requireAdmin(ctx)
    const svc = await ctx.db.get(serviceId)
    if (!svc || svc.facilityId !== facilityId || svc.kind !== 'plan') throw new Error('Plan not found')
    const child = await ctx.db.get(childId)
    if (!child || child.facilityId !== facilityId) throw new Error('Child not found')
    const existing = await ctx.db
      .query('planSubscriptions')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .collect()
    if (existing.some((s) => s.active && s.serviceId === serviceId && s.childId === childId)) {
      throw new Error(`${child.first} is already on ${svc.name}.`)
    }
    await ctx.db.insert('planSubscriptions', {
      facilityId,
      serviceId,
      serviceName: svc.name,
      emoji: svc.emoji,
      childId,
      childName: child.name,
      monthlyAmount: svc.amount,
      active: true,
      startedAt: Date.now(),
    })
  },
})

export const cancelPlan = mutation({
  args: { id: v.id('planSubscriptions') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireAdmin(ctx)
    const s = await ctx.db.get(id)
    if (!s || s.facilityId !== facilityId) throw new Error('Not found')
    await ctx.db.patch(id, { active: false })
  },
})

export const listSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    const docs = await ctx.db
      .query('planSubscriptions')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    let rows = docs.filter((d) => d.active)
    if (user?.role === 'parent') {
      const mine = await myChildIds(ctx, fid, uid)
      rows = rows.filter((d) => mine.has(d.childId))
    }
    return rows.map((d) => ({
      id: d._id, serviceName: d.serviceName, emoji: d.emoji, childId: d.childId,
      childName: d.childName, monthlyAmount: d.monthlyAmount, startedAt: d.startedAt,
    }))
  },
})
