import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireFacility } from './lib'

// Director bookkeeping. Upload receipts/invoices (Convex file storage), tag each
// with vendor / date / amount / GST-HST / CRA category, file them, and export a
// pack for the accountant. Manual entry first; AI extraction (OpenRouter vision)
// will pre-fill these fields later. Paid add-on (see facilities.current.addons).

async function staffFacility(ctx: any) {
  const { facilityId, user } = await requireFacility(ctx)
  if (user.role === 'parent') throw new Error('Only staff can manage bookkeeping.')
  return { facilityId, user }
}

async function ownDoc(ctx: any, id: any) {
  const { facilityId } = await staffFacility(ctx)
  const row = await ctx.db.get(id)
  if (!row || row.facilityId !== facilityId) throw new Error('Not your document.')
  return { row, facilityId }
}

// Step 1 of an upload: hand the browser a short-lived upload URL.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await staffFacility(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

// Step 2: record the uploaded file (+ any fields the director typed in).
export const add = mutation({
  args: {
    storageId: v.optional(v.id('_storage')),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    kind: v.optional(v.string()),
    direction: v.optional(v.string()),
    vendor: v.optional(v.string()),
    docDate: v.optional(v.string()),
    amount: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { facilityId } = await staffFacility(ctx)
    const now = Date.now()
    return await ctx.db.insert('bookkeepingDocs', {
      facilityId,
      storageId: args.storageId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      kind: args.kind || 'receipt',
      direction: args.direction || 'expense',
      vendor: args.vendor,
      docDate: args.docDate,
      amount: args.amount,
      taxAmount: args.taxAmount,
      category: args.category,
      status: 'unreviewed',
      notes: args.notes,
      aiExtracted: false,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const listByFacility = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    if (me && me.role === 'parent') return []
    const rows = await ctx.db
      .query('bookkeepingDocs')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const withUrls = await Promise.all(
      rows.map(async (r) => ({ ...r, id: r._id, fileUrl: r.storageId ? await ctx.storage.getUrl(r.storageId) : null })),
    )
    return withUrls.sort((a, b) => (b.docDate || '').localeCompare(a.docDate || '') || b.createdAt - a.createdAt)
  },
})

export const update = mutation({
  args: {
    id: v.id('bookkeepingDocs'),
    kind: v.optional(v.string()),
    direction: v.optional(v.string()),
    vendor: v.optional(v.string()),
    docDate: v.optional(v.string()),
    amount: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ownDoc(ctx, args.id)
    const { id, ...rest } = args
    const patch: any = { updatedAt: Date.now() }
    for (const [k, val] of Object.entries(rest)) if (val !== undefined) patch[k] = val
    await ctx.db.patch(id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id('bookkeepingDocs') },
  handler: async (ctx, { id }) => {
    const { row } = await ownDoc(ctx, id)
    if (row.storageId) await ctx.storage.delete(row.storageId)
    await ctx.db.delete(id)
  },
})

// Totals for the dashboard header + accountant export.
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const empty = { total: 0, expense: 0, income: 0, tax: 0, byCategory: [] as any[], count: 0, unreviewed: 0 }
    const fid = await resolveFacilityId(ctx)
    if (!fid) return empty
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    if (me && me.role === 'parent') return empty
    const rows = await ctx.db.query('bookkeepingDocs').withIndex('by_facility', (q) => q.eq('facilityId', fid)).collect()
    let expense = 0, income = 0, tax = 0, unreviewed = 0
    const cat: Record<string, number> = {}
    for (const r of rows) {
      const amt = r.amount || 0
      if (r.direction === 'income') income += amt
      else expense += amt
      tax += r.taxAmount || 0
      if (r.status !== 'filed') unreviewed++
      if (r.direction !== 'income') {
        const c = r.category || 'Uncategorized'
        cat[c] = (cat[c] || 0) + amt
      }
    }
    const byCategory = Object.entries(cat).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total)
    return { total: expense + income, expense, income, tax, byCategory, count: rows.length, unreviewed }
  },
})
