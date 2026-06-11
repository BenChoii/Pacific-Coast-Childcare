import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireFacility } from './lib'

// Parents see only their own children's milestones; educators/directors see all.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    const isParent = me?.role === 'parent'

    let myChildIds = null
    if (isParent && uid) {
      const kids = await ctx.db
        .query('children')
        .withIndex('by_facility', (q) => q.eq('facilityId', fid))
        .collect()
      myChildIds = new Set(kids.filter((c) => c.parentUserId === uid).map((c) => c._id))
    }

    const docs = await ctx.db
      .query('milestones')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()

    return docs
      .filter((m) => (myChildIds ? myChildIds.has(m.childId) : true))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ _id, _creationTime, facilityId, ...rest }) => ({ id: _id, ...rest }))
  },
})

export const add = mutation({
  args: {
    childId: v.id('children'),
    domain: v.string(),
    label: v.string(),
    status: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { childId, domain, label, status, note }) => {
    const { facilityId, user } = await requireFacility(ctx)
    const child = await ctx.db.get(childId)
    if (!child || child.facilityId !== facilityId) throw new Error('Child not found')
    return await ctx.db.insert('milestones', {
      facilityId,
      childId,
      childName: child.name,
      domain,
      label,
      status,
      note: note || undefined,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      by: user?.name || 'Educator',
      createdAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id('milestones') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireFacility(ctx)
    const m = await ctx.db.get(id)
    if (m && m.facilityId === facilityId) await ctx.db.delete(id)
  },
})
