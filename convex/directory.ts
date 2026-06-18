import { query, mutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { requireFacility, resolveFacilityId } from './lib'

// Public childcare-directory listings. A daycare sets its own enrolment status
// for its area; the static /childcare/<area> board fetches the live set through
// the /directory HTTP endpoint and overlays it on the crawlable baseline. The
// richer business profile (programs, payment methods, about…) lives on the
// facility, so it both powers the public listing AND pre-fills the full app.
const STATUSES = ['accepting', 'waitlist', 'full', 'unconfirmed']
const PAYMENT_METHODS = ['e-Transfer', 'Credit/debit card', 'Cheque', 'Cash', 'Pre-authorized debit', 'CCFRI / subsidy']

// Pull the public-facing profile fields off a facility doc.
function publicProfile(f: any) {
  if (!f) return {}
  return {
    programs: f.programs ?? [],
    paymentMethods: f.paymentMethods ?? [],
    about: f.about ?? '',
    agesServed: f.agesServed ?? '',
    website: f.website ?? '',
    phone: f.phone ?? '',
  }
}

// What's my facility's current listing + profile (Account → Public listing).
export const myListing = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return null
    const f = await ctx.db.get(fid)
    const listing = await ctx.db
      .query('directoryListings')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .first()
    return {
      facilityName: f?.name || '',
      isDemo: !!f?.isDemo,
      profile: publicProfile(f),
      listing: listing
        ? {
            area: listing.area,
            name: listing.name,
            status: listing.status,
            spots: listing.spots ?? null,
            visible: listing.visible,
            updatedAt: listing.updatedAt,
          }
        : null,
    }
  },
})

// Owner sets / updates their public listing + business profile.
export const upsertMyListing = mutation({
  args: {
    area: v.string(),
    name: v.string(),
    status: v.string(),
    spots: v.optional(v.number()),
    visible: v.boolean(),
    // Richer profile (all optional) — stored on the facility, reused by the app.
    programs: v.optional(
      v.array(v.object({ name: v.string(), capacity: v.optional(v.number()), opensAt: v.optional(v.string()) })),
    ),
    paymentMethods: v.optional(v.array(v.string())),
    about: v.optional(v.string()),
    agesServed: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, facilityId } = await requireFacility(ctx)
    if (user.role !== 'admin') throw new Error('Directors only.')
    const f = await ctx.db.get(facilityId)
    if (f?.isDemo) throw new Error('The demo workspace can’t publish to the public directory.')
    if (!STATUSES.includes(args.status)) throw new Error('Pick a valid status.')

    const area = args.area.trim().toLowerCase().slice(0, 60)
    const name = (args.name.trim() || f?.name || 'Our daycare').slice(0, 120)
    const spots =
      args.spots != null && args.spots >= 0 ? Math.min(999, Math.floor(args.spots)) : undefined

    // ── Directory listing (the public status row) ──
    const listingPatch = { facilityId, area, name, status: args.status, spots, visible: args.visible, updatedAt: Date.now() }
    const existing = await ctx.db
      .query('directoryListings')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .first()
    if (existing) await ctx.db.patch(existing._id, listingPatch)
    else await ctx.db.insert('directoryListings', listingPatch)

    // ── Business profile (lives on the facility — set once, reused by the app) ──
    const fp: any = {}
    if (args.programs !== undefined) {
      fp.programs = args.programs
        .filter((p) => p && p.name && p.name.trim())
        .slice(0, 8)
        .map((p) => ({
          name: p.name.trim().slice(0, 80),
          capacity: p.capacity != null && p.capacity >= 0 ? Math.min(999, Math.floor(p.capacity)) : undefined,
          opensAt: p.opensAt ? p.opensAt.trim().slice(0, 40) : undefined,
        }))
    }
    if (args.paymentMethods !== undefined) {
      fp.paymentMethods = args.paymentMethods.filter((m) => PAYMENT_METHODS.includes(m)).slice(0, 10)
    }
    if (args.about !== undefined) fp.about = args.about.trim().slice(0, 1000)
    if (args.agesServed !== undefined) fp.agesServed = args.agesServed.trim().slice(0, 60)
    if (args.website !== undefined) fp.website = args.website.trim().slice(0, 200)
    if (args.phone !== undefined) fp.phone = args.phone.trim().slice(0, 40)

    // Claiming + setting a status counts as onboarding (lightweight path).
    if (f && !f.onboardedAt) fp.onboardedAt = Date.now()
    if (Object.keys(fp).length) await ctx.db.patch(facilityId, fp)

    return { ok: true }
  },
})

// Read side for the public HTTP endpoint — visible listings + their profile.
export const publicByArea = internalQuery({
  args: { area: v.string() },
  handler: async (ctx, { area }) => {
    const docs = await ctx.db
      .query('directoryListings')
      .withIndex('by_area', (q) => q.eq('area', area))
      .collect()
    const visible = docs.filter((d) => d.visible)
    const out = []
    for (const d of visible) {
      const f = await ctx.db.get(d.facilityId)
      out.push({
        name: d.name,
        status: d.status,
        spots: d.spots ?? null,
        updatedAt: d.updatedAt,
        ...publicProfile(f),
      })
    }
    return out
  },
})
