import { query, mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireFacility } from './lib'

// Director CRM. Leads flow in from the daycare's own website (book-a-tour /
// contact form via the /inquiries HTTP endpoint), the public directory, or are
// added by hand, and move through a pipeline: new → contacted → toured →
// enrolled / lost. Staff + directors see them; parents never do. Paid add-on,
// but gated in the UI/demo (see facilities.current.addons).

const STATUSES = ['new', 'contacted', 'toured', 'enrolled', 'lost']

async function staffFacility(ctx: any) {
  const { facilityId, user } = await requireFacility(ctx)
  if (user.role === 'parent') throw new Error('Only staff can manage inquiries.')
  return { facilityId, user }
}

async function ownInquiry(ctx: any, id: any) {
  const { facilityId, user } = await staffFacility(ctx)
  const row = await ctx.db.get(id)
  if (!row || row.facilityId !== facilityId) throw new Error('Not your inquiry.')
  return { row, facilityId, user }
}

// Every active inquiry for the facility, newest first (staff/admin only).
export const listByFacility = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    if (me && me.role === 'parent') return []
    const rows = await ctx.db
      .query('inquiries')
      .withIndex('by_facility_created', (q) => q.eq('facilityId', fid))
      .collect()
    return rows
      .filter((r) => !r.archivedAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({ ...r, id: r._id }))
  },
})

// Pipeline counts for the board header.
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const empty = { new: 0, contacted: 0, toured: 0, enrolled: 0, lost: 0, total: 0 }
    const fid = await resolveFacilityId(ctx)
    if (!fid) return empty
    const uid = await getAuthUserId(ctx)
    const me = uid ? await ctx.db.get(uid) : null
    if (me && me.role === 'parent') return empty
    const rows = (await ctx.db.query('inquiries').withIndex('by_facility', (q) => q.eq('facilityId', fid)).collect()).filter((r) => !r.archivedAt)
    const by = (s: string) => rows.filter((r) => r.status === s).length
    return { new: by('new'), contacted: by('contacted'), toured: by('toured'), enrolled: by('enrolled'), lost: by('lost'), total: rows.length }
  },
})

// Director adds a lead by hand (walk-in, phone call, referral…).
export const addManual = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    childAge: v.optional(v.string()),
    reason: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { facilityId } = await staffFacility(ctx)
    const now = Date.now()
    return await ctx.db.insert('inquiries', {
      facilityId,
      source: 'manual',
      reason: args.reason,
      name: args.name.trim() || 'New lead',
      email: args.email,
      phone: args.phone,
      childAge: args.childAge,
      message: args.message,
      status: 'new',
      notes: [],
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const setStatus = mutation({
  args: { id: v.id('inquiries'), status: v.string() },
  handler: async (ctx, { id, status }) => {
    if (!STATUSES.includes(status)) throw new Error('Unknown status.')
    await ownInquiry(ctx, id)
    await ctx.db.patch(id, { status, updatedAt: Date.now() })
  },
})

export const setFollowUp = mutation({
  args: { id: v.id('inquiries'), followUpAt: v.union(v.number(), v.null()) },
  handler: async (ctx, { id, followUpAt }) => {
    await ownInquiry(ctx, id)
    await ctx.db.patch(id, { followUpAt: followUpAt === null ? undefined : followUpAt, updatedAt: Date.now() })
  },
})

export const addNote = mutation({
  args: { id: v.id('inquiries'), text: v.string() },
  handler: async (ctx, { id, text }) => {
    const { row, user } = await ownInquiry(ctx, id)
    const notes = [...(row.notes || []), { at: Date.now(), text: text.trim(), by: user.name || 'Staff' }]
    await ctx.db.patch(id, { notes, updatedAt: Date.now() })
  },
})

export const archive = mutation({
  args: { id: v.id('inquiries') },
  handler: async (ctx, { id }) => {
    await ownInquiry(ctx, id)
    await ctx.db.patch(id, { archivedAt: Date.now(), updatedAt: Date.now() })
  },
})

// Public capture from a facility's website, routed to the facility by its slug.
// Called by the mitten.care/api/book-tour Vercel function (and contact form).
export const createFromWeb = internalMutation({
  args: {
    facilitySlug: v.string(),
    source: v.optional(v.string()),
    reason: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    childAge: v.optional(v.string()),
    preferredSlot: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const facility = await ctx.db
      .query('facilities')
      .withIndex('by_slug', (q) => q.eq('slug', args.facilitySlug))
      .first()
    if (!facility) return { ok: false, reason: 'facility-not-found' }
    const now = Date.now()
    await ctx.db.insert('inquiries', {
      facilityId: facility._id,
      source: args.source || 'contact-form',
      reason: args.reason,
      name: (args.name || 'Website inquiry').trim(),
      email: args.email,
      phone: args.phone,
      childAge: args.childAge,
      preferredSlot: args.preferredSlot,
      message: args.message,
      status: 'new',
      notes: [],
      createdAt: now,
      updatedAt: now,
    })
    return { ok: true }
  },
})
