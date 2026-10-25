import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireFacility } from './lib'
import { cents, dollars, validDate } from './financeUtils'
import { recordOwnerEvent } from './notifications'
import { assertOwnedUpload } from './files'

// Director bookkeeping. Upload receipts/invoices (Convex file storage), tag each
// with vendor / date / amount / GST-HST / CRA category, file them, and export a
// pack for the accountant. Manual entry first; AI extraction (OpenRouter vision)
// will pre-fill these fields later. Paid add-on (see facilities.current.addons).

async function staffFacility(ctx: any) {
  const { facilityId, user } = await requireFacility(ctx)
  if (user.role !== 'admin') throw new Error('Only the director can manage bookkeeping.')
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
    const { facilityId, user } = await staffFacility(ctx)
    if (args.storageId) await assertOwnedUpload(ctx, args.storageId, facilityId, user._id, ['bookkeeping'])
    if (args.docDate && !validDate(args.docDate)) throw new Error('Choose a valid document date.')
    if (args.amount !== undefined) args.amount = dollars(cents(args.amount))
    if (args.taxAmount !== undefined) args.taxAmount = dollars(cents(args.taxAmount, 'Tax'))
    const now = Date.now()
    const id = await ctx.db.insert('bookkeepingDocs', {
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
    await recordOwnerEvent(ctx, { facilityId, type: 'bookkeeping_document_added', summary: 'A bookkeeping document was added.' })
    return id
  },
})

export const listByFacility = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, { includeArchived }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    if (!me || me.role !== 'admin') return []
    const rows = await ctx.db
      .query('bookkeepingDocs')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const withUrls = await Promise.all(
      rows.filter(r => includeArchived || !r.archivedAt).map(async (r) => ({ ...r, id: r._id, hasFile: !!r.storageId, fileUrl: null })),
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
    clearFields: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { facilityId } = await ownDoc(ctx, args.id)
    if (args.docDate && !validDate(args.docDate)) throw new Error('Choose a valid document date.')
    if (args.amount !== undefined) args.amount = dollars(cents(args.amount))
    if (args.taxAmount !== undefined) args.taxAmount = dollars(cents(args.taxAmount, 'Tax'))
    const { id, clearFields, ...rest } = args
    const patch: any = { updatedAt: Date.now() }
    for (const [k, val] of Object.entries(rest)) if (val !== undefined) patch[k] = val
    const nullableFields = ['vendor', 'docDate', 'amount', 'taxAmount', 'category', 'notes']
    for (const key of clearFields || []) { if (!nullableFields.includes(key)) throw new Error('This document field cannot be cleared.'); patch[key] = undefined }
    await ctx.db.patch(id, patch)
    await recordOwnerEvent(ctx, { facilityId, type: 'bookkeeping_document_updated', summary: 'A bookkeeping document was updated.' })
  },
})

export const remove = mutation({
  args: { id: v.id('bookkeepingDocs') },
  handler: async (ctx, { id }) => {
    const { row, facilityId } = await ownDoc(ctx, id)
    if (row.archivedAt) return
    await ctx.db.patch(id, { archivedAt: Date.now(), updatedAt: Date.now() })
    await recordOwnerEvent(ctx, { facilityId, type: 'bookkeeping_document_archived', summary: 'A bookkeeping document was archived. Its records were preserved.' })
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
    if (!me || me.role !== 'admin') return empty
    const rows = await ctx.db.query('bookkeepingDocs').withIndex('by_facility', (q) => q.eq('facilityId', fid)).collect()
    let expense = 0, income = 0, tax = 0, unreviewed = 0
    const cat: Record<string, number> = {}
    const active = rows.filter(row => !row.archivedAt)
    for (const r of active) {
      const amt = cents(r.amount || 0)
      if (r.direction === 'income') income += amt
      else expense += amt
      tax += cents(r.taxAmount || 0)
      if (r.status !== 'filed') unreviewed++
      if (r.direction !== 'income') {
        const c = r.category || 'Uncategorized'
        cat[c] = (cat[c] || 0) + amt
      }
    }
    const byCategory = Object.entries(cat).map(([category, total]) => ({ category, total: dollars(total) })).sort((a, b) => b.total - a.total)
    return { total: dollars(expense + income), expense: dollars(expense), income: dollars(income), tax: dollars(tax), byCategory, count: active.length, unreviewed }
  },
})
