import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireFacility } from './lib'

const TYPES = ['ccfri', 'accb', 'cwelcc', 'other']
const STATUSES = ['tracking', 'applied', 'approved', 'expired']
export const TYPE_LABEL: Record<string, string> = {
  ccfri: 'CCFRI fee reduction',
  accb: 'Affordable Child Care Benefit',
  cwelcc: '$10-a-day (CWELCC)',
  other: 'Subsidy',
}

async function requireAdmin(ctx: any) {
  const f = await requireFacility(ctx)
  if (f.user.role !== 'admin') throw new Error('Only the director can manage subsidies.')
  return f
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  const t = Date.parse(dateStr)
  if (Number.isNaN(t)) return null
  return Math.round((t - Date.now()) / 86400000)
}

// Plain helper (NOT a Convex function) — invoices.ts imports this to net approved
// subsidies off a child's bill as transparent negative line items.
export async function subsidyReductionItems(ctx: any, childId: any, childName: string) {
  const subs = await ctx.db
    .query('subsidies')
    .withIndex('by_child', (q: any) => q.eq('childId', childId))
    .collect()
  const items: { label: string; amt: number }[] = []
  for (const s of subs) {
    if (s.status !== 'approved') continue
    if (s.applyToInvoices === false) continue
    const amt = Math.round(s.monthlyAmount || 0)
    if (amt <= 0) continue
    items.push({ label: `${TYPE_LABEL[s.type] || 'Subsidy'} — ${childName}`, amt: -amt })
  }
  return items
}

// All subsidies for the facility (admin/staff), or just the parent's own children's.
export const listByFacility = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    const kids = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const kidById = new Map(kids.map((k: any) => [String(k._id), k]))
    const subs = await ctx.db
      .query('subsidies')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const isParent = me && me.role === 'parent'
    return subs
      .filter((s: any) => {
        if (!isParent) return true
        const kid: any = kidById.get(String(s.childId))
        return kid && kid.parentUserId === uid
      })
      .map((s: any) => {
        const kid: any = kidById.get(String(s.childId))
        const d = daysUntil(s.expiryDate)
        return {
          id: s._id,
          childId: s.childId,
          childName: kid?.name || 'Child',
          type: s.type,
          typeLabel: TYPE_LABEL[s.type] || 'Subsidy',
          status: s.status,
          monthlyAmount: s.monthlyAmount || 0,
          startDate: s.startDate || '',
          expiryDate: s.expiryDate || '',
          reference: s.reference || '',
          notes: s.notes || '',
          applyToInvoices: s.applyToInvoices !== false,
          daysToExpiry: d,
          expiringSoon: s.status === 'approved' && d !== null && d <= 45 && d >= 0,
          expired: d !== null && d < 0,
        }
      })
      .sort((a, b) => a.childName.localeCompare(b.childName))
  },
})

// Director-only renewal radar: approved subsidies expiring within 45 days or lapsed.
export const expiringSoon = query({
  args: {},
  handler: async (ctx) => {
    const { facilityId, user } = await requireFacility(ctx)
    if (user.role !== 'admin') return []
    const kids = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .collect()
    const kidById = new Map(kids.map((k: any) => [String(k._id), k]))
    const subs = await ctx.db
      .query('subsidies')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .collect()
    return subs
      .map((s: any) => ({ s, d: daysUntil(s.expiryDate) }))
      .filter(({ s, d }: any) => s.status === 'approved' && d !== null && d <= 45)
      .map(({ s, d }: any) => ({
        id: s._id,
        childName: (kidById.get(String(s.childId)) as any)?.name || 'Child',
        typeLabel: TYPE_LABEL[s.type] || 'Subsidy',
        expiryDate: s.expiryDate,
        daysToExpiry: d,
        expired: d < 0,
      }))
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
  },
})

// Director adds or edits a subsidy record for a child.
export const upsert = mutation({
  args: {
    id: v.optional(v.id('subsidies')),
    childId: v.id('children'),
    type: v.string(),
    status: v.string(),
    monthlyAmount: v.optional(v.number()),
    startDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    applyToInvoices: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { facilityId } = await requireAdmin(ctx)
    if (!TYPES.includes(args.type)) throw new Error('Unknown subsidy type.')
    if (!STATUSES.includes(args.status)) throw new Error('Unknown status.')
    const kid = await ctx.db.get(args.childId)
    if (!kid || (kid as any).facilityId !== facilityId) throw new Error('Child not in your facility.')
    const fields = {
      facilityId,
      childId: args.childId,
      type: args.type,
      status: args.status,
      monthlyAmount: args.monthlyAmount ?? 0,
      startDate: args.startDate,
      expiryDate: args.expiryDate,
      reference: args.reference,
      notes: args.notes,
      applyToInvoices: args.applyToInvoices ?? true,
      updatedAt: Date.now(),
    }
    if (args.id) {
      const existing = await ctx.db.get(args.id)
      if (!existing || (existing as any).facilityId !== facilityId) throw new Error('Not your subsidy record.')
      await ctx.db.patch(args.id, fields)
      return args.id
    }
    return await ctx.db.insert('subsidies', { ...fields, createdAt: Date.now() })
  },
})

export const remove = mutation({
  args: { id: v.id('subsidies') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireAdmin(ctx)
    const existing = await ctx.db.get(id)
    if (!existing || (existing as any).facilityId !== facilityId) return
    await ctx.db.delete(id)
  },
})
