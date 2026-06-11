import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import {
  resolveFacilityId,
  requireFacility,
  billingSummary,
  slugify,
  randomToken,
  FREE_LIMIT,
} from './lib'

// ── Read the current facility (the workspace the user is looking at) ──────
export const current = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return null
    const f = await ctx.db.get(fid)
    if (!f) return null
    const kids = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const uid = await getAuthUserId(ctx)
    return {
      id: f._id,
      name: f.name,
      slug: f.slug,
      plan: f.plan,
      isDemo: !!f.isDemo,
      onboarded: !!f.onboardedAt,
      hasCard: !!f.hasCard,
      isOwner: !!uid && f.ownerUserId === uid,
      // invoicing & payments profile
      logoUrl: f.logoId ? await ctx.storage.getUrl(f.logoId) : null,
      address: f.address,
      phone: f.phone,
      billingEmail: f.billingEmail,
      etransferEmail: f.etransferEmail,
      gstNumber: f.gstNumber,
      invoiceFooter: f.invoiceFooter,
      autoInvoice: !!f.autoInvoice,
      connectReady: !!f.stripeAccountReady,
      connectStarted: !!f.stripeAccountId,
      ...billingSummary(kids.length, f.freeLimit ?? FREE_LIMIT),
    }
  },
})

// Director edits the invoicing business profile (Account → Invoicing & payments).
export const updateBillingProfile = mutation({
  args: {
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    etransferEmail: v.optional(v.string()),
    gstNumber: v.optional(v.string()),
    invoiceFooter: v.optional(v.string()),
    autoInvoice: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user, facilityId } = await requireFacility(ctx)
    if (user.role !== 'admin') throw new Error('Directors only.')
    const patch: any = {}
    for (const k of ['address', 'phone', 'billingEmail', 'etransferEmail', 'gstNumber', 'invoiceFooter', 'autoInvoice'] as const) {
      if (args[k] !== undefined) patch[k] = args[k]
    }
    await ctx.db.patch(facilityId, patch)
  },
})

// Director uploads the daycare's logo (storage id from files.generateUploadUrl).
export const setLogo = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    const { user, facilityId } = await requireFacility(ctx)
    if (user.role !== 'admin') throw new Error('Directors only.')
    await ctx.db.patch(facilityId, { logoId: storageId })
  },
})

// Public lookup for the join landing page (mitten.care/<slug>).
export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const f = await ctx.db.query('facilities').withIndex('by_slug', (q) => q.eq('slug', slug)).first()
    if (!f) return null
    return { id: f._id, name: f.name, slug: f.slug }
  },
})

// Public lookup of an invite token → which facility + role it grants.
export const inviteInfo = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const inv = await ctx.db.query('invites').withIndex('by_token', (q) => q.eq('token', token)).first()
    if (!inv) return null
    const f = await ctx.db.get(inv.facilityId)
    if (!f) return null
    return { facilityName: f.name, slug: f.slug, role: inv.role }
  },
})

// ── Create a facility (owner self-serve signup) ───────────────────────────
export const createForCurrentUser = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const uid = await getAuthUserId(ctx)
    if (!uid) throw new Error('Sign in first')
    const user = await ctx.db.get(uid)
    if (user?.facilityId) {
      const existing = await ctx.db.get(user.facilityId)
      return { id: user.facilityId, slug: existing?.slug }
    }
    // Unique slug.
    let base = slugify(name)
    let slug = base
    let n = 2
    while (await ctx.db.query('facilities').withIndex('by_slug', (q) => q.eq('slug', slug)).first()) {
      slug = `${base}-${n++}`
    }
    const fid = await ctx.db.insert('facilities', {
      name: name.trim() || 'My Daycare',
      slug,
      ownerUserId: uid,
      plan: 'free',
      freeLimit: FREE_LIMIT,
      hasCard: false,
      isDemo: false,
      createdAt: Date.now(),
    })
    await ctx.db.patch(uid, { facilityId: fid, role: 'admin' })
    return { id: fid, slug }
  },
})

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const { facilityId } = await requireFacility(ctx)
    await ctx.db.patch(facilityId, { onboardedAt: Date.now() })
  },
})

// ── Invites (shareable parent / staff join links) ─────────────────────────
export const generateInvite = mutation({
  args: { role: v.string(), label: v.optional(v.string()), childId: v.optional(v.id('children')) },
  handler: async (ctx, { role, label, childId }) => {
    const { facilityId } = await requireFacility(ctx)
    if (!['parent', 'staff', 'admin'].includes(role)) throw new Error('Bad role')
    if (childId) {
      const child = await ctx.db.get(childId)
      if (!child || child.facilityId !== facilityId) throw new Error('Child not found')
    }
    const token = randomToken()
    await ctx.db.insert('invites', {
      facilityId,
      role,
      token,
      label,
      childId,
      used: false,
      createdAt: Date.now(),
    })
    return { token }
  },
})

export const listInvites = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('invites')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    return docs.map((d) => ({ id: d._id, role: d.role, token: d.token, label: d.label ?? '' }))
  },
})

export const revokeInvite = mutation({
  args: { id: v.id('invites') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireFacility(ctx)
    const inv = await ctx.db.get(id)
    if (inv && inv.facilityId === facilityId) await ctx.db.delete(id)
  },
})

// Join a facility via an invite token (called right after the invitee signs up).
export const joinViaToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const uid = await getAuthUserId(ctx)
    if (!uid) throw new Error('Sign in first')
    const inv = await ctx.db.query('invites').withIndex('by_token', (q) => q.eq('token', token)).first()
    if (!inv) throw new Error('This invite link is no longer valid.')
    await ctx.db.patch(uid, { facilityId: inv.facilityId, role: inv.role })
    const user = await ctx.db.get(uid)
    const fid = inv.facilityId

    // An invited educator becomes a real staff record (clock-in + director roster).
    if (inv.role === 'staff') {
      const existing = await ctx.db
        .query('educators')
        .withIndex('by_facility', (q) => q.eq('facilityId', fid))
        .collect()
      if (!existing.some((e) => e.userId === uid)) {
        await ctx.db.insert('educators', {
          facilityId: fid,
          userId: uid,
          name: user?.name || 'Educator',
          role: 'Educator',
          room: 'Main Room',
          emoji: '🧑‍🏫',
          hireDate: 'New',
          certifications: [],
          status: 'out',
          todaySeconds: 0,
          punches: [],
          hoursWeek: 0,
          hoursTarget: 38,
          pto: '0 days',
          order: existing.length,
        })
      }
    }

    // A child-linked parent invite connects the family automatically — the
    // parent never browses the roster, they land already claimed to their kid.
    if (inv.role === 'parent' && inv.childId) {
      const child = await ctx.db.get(inv.childId)
      if (child && child.facilityId === fid && (!child.parentUserId || child.parentUserId === uid)) {
        await ctx.db.patch(inv.childId, { parentUserId: uid })
      }
    }

    // An invited parent gets a family↔staff message thread so both sides can chat.
    if (inv.role === 'parent') {
      const convos = await ctx.db
        .query('conversations')
        .withIndex('by_facility', (q) => q.eq('facilityId', fid))
        .collect()
      if (!convos.some((c) => c.parentUserId === uid)) {
        await ctx.db.insert('conversations', {
          facilityId: fid,
          parentUserId: uid,
          name: user?.name || 'Family',
          role: 'Parent',
          emoji: '👪',
          online: false,
          unread: 0,
          order: convos.length,
        })
      }
    }

    const f = await ctx.db.get(fid)
    return { ok: true, slug: f?.slug, role: inv.role }
  },
})
