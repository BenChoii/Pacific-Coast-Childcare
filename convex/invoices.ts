import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId } from './lib'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('invoices')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    return docs.map(({ _id, _creationTime, facilityId, invId, order, ...rest }) => ({ id: invId, ...rest }))
  },
})

// Single invoice by its public invId (used by the Stripe Checkout action).
export const getOne = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc) return null
    const { _id, _creationTime, facilityId, invId, order, ...rest } = doc
    return { id: invId, ...rest }
  },
})

export const pay = mutation({
  args: { id: v.string(), paidOn: v.string() },
  handler: async (ctx, { id, paidOn }) => {
    const doc = await ctx.db.query('invoices').withIndex('by_invId', (q) => q.eq('invId', id)).first()
    if (!doc) return
    await ctx.db.patch(doc._id, { status: 'paid', paidOn })
  },
})
