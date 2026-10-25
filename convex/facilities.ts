import { query, mutation, internalMutation } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import {
  resolveFacilityId,
  requireFacility,
  requireAdmin,
  childBelongsToParent,
  billingSummary,
  slugify,
  randomToken,
  FREE_LIMIT,
} from './lib'
import { recordOwnerEvent } from './notifications'
import { assertOwnedUpload } from './files'

// ── Read the current facility (the workspace the user is looking at) ──────
export const current = query({
  args: {},
  handler: async (ctx) => {
    const uid = await getAuthUserId(ctx)
    const member = uid ? await ctx.db.get(uid) : null
    const fid = member && member.accessStatus !== 'suspended' ? member.facilityId : await resolveFacilityId(ctx)
    if (!fid) return null
    const f = await ctx.db.get(fid)
    if (!f) return null
    const kids = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    return {
      id: f._id,
      name: f.name,
      timezone: f.timezone || 'America/Vancouver',
      ownerEmailMode: f.ownerEmailMode || 'all',
      slug: f.slug,
      plan: f.plan,
      isDemo: !!f.isDemo,
      onboarded: !!f.onboardedAt,
      hasCard: !!f.hasCard,
      isOwner: !!uid && f.ownerUserId === uid,
      // Paid add-ons — demo facilities get them all so the sales demo shows them off.
      addons: {
        crm: !!f.isDemo || !!(f.addons && f.addons.crm),
        bookkeeping: !!f.isDemo || !!(f.addons && f.addons.bookkeeping),
      },
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
      ...billingSummary(kids.filter((child) => !child.archivedAt).length, f.freeLimit ?? FREE_LIMIT),
    }
  },
})

// Admin helper — turn the paid director add-ons (CRM, bookkeeping) on/off for a
// facility by slug. Internal (not in the public client API), so it can only be
// run from the Convex dashboard or `npx convex run … --prod`. Until Stripe wiring
// flips these automatically, this is how a facility gets unlocked after they buy.
//   npx convex run facilities:enableAddonsBySlug '{"slug":"<slug>"}' --prod
export const enableAddonsBySlug = internalMutation({
  args: { slug: v.string(), crm: v.optional(v.boolean()), bookkeeping: v.optional(v.boolean()) },
  handler: async (ctx, { slug, crm, bookkeeping }) => {
    const f = await ctx.db
      .query('facilities')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first()
    if (!f) return { ok: false, error: `No facility with slug "${slug}"` }
    const addons = { ...(f.addons || {}) }
    // No flags given → enable both (the common "they bought the bundle" case).
    if (crm === undefined && bookkeeping === undefined) {
      addons.crm = true
      addons.bookkeeping = true
    } else {
      if (crm !== undefined) addons.crm = crm
      if (bookkeeping !== undefined) addons.bookkeeping = bookkeeping
    }
    await ctx.db.patch(f._id, { addons })
    return { ok: true, facility: f.name, addons }
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
    for(const [key,value] of Object.entries(args)){if(typeof value==='string'&&value.length>(key==='invoiceFooter'?2000:300))throw new Error('Please shorten the billing profile details.')}
    for(const email of [args.billingEmail,args.etransferEmail])if(email&& !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.trim()))throw new Error('Enter a valid billing or e-Transfer email.')
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
    const { user, userId, facility, facilityId } = await requireFacility(ctx)
    if (user.role !== 'admin') throw new Error('Directors only.')
    if(storageId!==facility.logoId)await assertOwnedUpload(ctx,storageId,facilityId,userId,['avatar'])
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
    if (!inv || inv.used || (inv.role !== 'parent' && !inv.expiresAt) || (inv.expiresAt && inv.expiresAt <= Date.now()) || (inv.role === 'parent' && !inv.childId)) return null
    if (inv.childId) { const child = await ctx.db.get(inv.childId); if (!child || child.archivedAt || child.facilityId !== inv.facilityId) return null }
    const f = await ctx.db.get(inv.facilityId)
    if (!f) return null
    return { facilityName: f.name, slug: f.slug, role: inv.role, email: inv.email || null, expiresAt: inv.expiresAt || null }
  },
})

// ── Create a facility (owner self-serve signup) ───────────────────────────
export const createForCurrentUser = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const uid = await getAuthUserId(ctx)
    if (!uid) throw new Error('Sign in first')
    const user = await ctx.db.get(uid)
    if (user?.accessStatus === 'suspended') throw new Error('Contact your daycare owner to restore access.')
    if (user?.facilityId) {
      const existing = await ctx.db.get(user.facilityId)
      return { id: user.facilityId, slug: existing?.slug }
    }
    if (!name.trim() || name.trim().length > 160) throw new Error('Enter a daycare name of up to 160 characters.')
    // Unique slug.
    let base = slugify(name.trim())
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
    const { facilityId, userId, facility } = await requireAdmin(ctx)
    if (facility.onboardedAt) return
    await ctx.db.patch(facilityId, { onboardedAt: Date.now() })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'owner_onboarding_completed', summary: 'The daycare setup was completed.' })
  },
})

// ── Invites (shareable parent / staff join links) ─────────────────────────
export const generateInvite = mutation({
  args: { role: v.string(), label: v.optional(v.string()), childId: v.optional(v.id('children')), email: v.optional(v.string()), educatorId: v.optional(v.id('educators')) },
  handler: async (ctx, { role, label, childId, email, educatorId }) => {
    const { facilityId,userId,facility } = await requireAdmin(ctx)
    if (!['parent', 'staff', 'admin'].includes(role)) throw new Error('Bad role')
    if (childId) {
      const child = await ctx.db.get(childId)
      if (!child || child.facilityId !== facilityId || child.archivedAt) throw new Error('Active child not found')
    }
    if (role === 'parent' && !childId) throw new Error('Choose the child this parent is joining for.')
    if (educatorId) { const educator = await ctx.db.get(educatorId); if (!educator || educator.facilityId !== facilityId) throw new Error('Educator not found.') }
    const normalizedEmail = email?.trim().toLowerCase()
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid invitation email.')
    const token = randomToken()
    await ctx.db.insert('invites', {
      facilityId,
      role,
      token,
      label,
      childId, email: normalizedEmail, educatorId, expiresAt: Date.now() + 7 * 86400_000,
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
    const uid = await getAuthUserId(ctx)
    const member = uid ? await ctx.db.get(uid) : null
    if (member && member.role !== 'admin') return []
    const docs = await ctx.db
      .query('invites')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    return docs.filter((d) => !d.used && (d.role === 'parent' || !!d.expiresAt) && (!d.expiresAt || d.expiresAt > Date.now())).map((d) => ({ id: d._id, role: d.role, token: d.token, label: d.label ?? '', childId: d.childId, email: d.email, expiresAt: d.expiresAt }))
  },
})

export const revokeInvite = mutation({
  args: { id: v.id('invites') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireAdmin(ctx)
    const inv = await ctx.db.get(id)
    if (inv && inv.facilityId === facilityId) await ctx.db.patch(id, { used: true })
  },
})

// Join a facility via an invite token (called right after the invitee signs up).
export const joinViaToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const uid = await getAuthUserId(ctx)
    if (!uid) throw new Error('Sign in first')
    const inv = await ctx.db.query('invites').withIndex('by_token', (q) => q.eq('token', token)).first()
    if (!inv || (!inv.used && inv.role !== 'parent' && !inv.expiresAt) || (inv.expiresAt && inv.expiresAt <= Date.now())) throw new Error('This invite link is no longer valid.')
    const user = await ctx.db.get(uid)
    if (!user || user.accessStatus === 'suspended') throw new Error('Contact your daycare owner to restore access.')
    if (inv.role === 'parent' && !inv.childId) throw new Error('Ask the owner for an invitation linked to your child.')
    if (inv.email && user.email?.trim().toLowerCase() !== inv.email.trim().toLowerCase()) throw new Error('Sign in using the email this invitation was addressed to.')
    if (user.facilityId && user.facilityId !== inv.facilityId) throw new Error('This account already belongs to another daycare.')
    if (inv.used) {
      const child = inv.childId ? await ctx.db.get(inv.childId) : null
      if (user.facilityId === inv.facilityId && (inv.usedBy === uid || (child && !child.archivedAt && childBelongsToParent(child, uid)))) {
        const facility = await ctx.db.get(inv.facilityId)
        return { ok: true, slug: facility?.slug, role: user.role }
      }
      throw new Error('This invite link is no longer valid.')
    }
    if (inv.childId) {
      const child = await ctx.db.get(inv.childId)
      if (!child || child.archivedAt || child.facilityId !== inv.facilityId) throw new Error('Ask the owner for a new invitation for your child.')
    }
    // Existing members cannot use a shared token to change their own role.
    if (user.facilityId && user.role !== inv.role) throw new Error('Ask the owner to manage your existing membership.')
    if (inv.role !== 'staff' && user.facilityId === inv.facilityId && (!inv.childId || childBelongsToParent(await ctx.db.get(inv.childId), uid))) {
      await ctx.db.patch(inv._id, { used: true, usedBy: uid })
      await ctx.db.patch(uid, { joinedViaInviteId: inv._id })
      const facility = await ctx.db.get(inv.facilityId)
      return { ok: true, slug: facility?.slug, role: inv.role }
    }
    await ctx.db.patch(uid, { facilityId: inv.facilityId, role: inv.role, accessStatus: 'active', joinedViaInviteId: inv._id })
    await ctx.db.patch(inv._id, { used: true, usedBy: uid })
    const fid = inv.facilityId

    // HR submissions and account invitations refer to the same educator record.
    if (inv.role === 'staff') {
      const existing = await ctx.db.query('educators').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
      const accountEducators = existing.filter(e => e.userId === uid)
      if (accountEducators.length > 1) throw new Error('This account has duplicate educator records. Ask the owner to repair the records.')
      let educator: Doc<'educators'> | undefined = accountEducators[0]
      if (inv.educatorId) {
        const linked = await ctx.db.get(inv.educatorId)
        if (!linked || linked.facilityId !== fid || (linked.userId && linked.userId !== uid)) throw new Error('Ask the owner to repair this educator invitation.')
        if (educator && educator._id !== linked._id) throw new Error('This account already has a different educator record. Ask the owner to link the records.')
        educator = linked
      }
      if (!educator) {
        const profiles = await ctx.db.query('employeeProfiles').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
        const matches = profiles.filter(p => p.educatorId && p.personalEmail?.trim().toLowerCase() === user.email?.trim().toLowerCase())
        const ids = [...new Set(matches.map(p => p.educatorId))]
        if (ids.length > 1) throw new Error('Several HR records match this email. Ask the owner to link the correct record.')
        if (ids.length === 1) {
          educator = existing.find(e => e._id === ids[0] && (!e.userId || e.userId === uid))
          if (!educator) throw new Error('The matching employee record is linked to another account. Ask the owner to repair it.')
        }
      }
      if (educator) await ctx.db.patch(educator._id, { userId: uid })
      else await ctx.db.insert('educators', { facilityId: fid, userId: uid, name: user.name || 'Educator', role: 'Educator', room: 'Unassigned', emoji: '🧑‍🏫', hireDate: 'New', certifications: [], status: 'out', todaySeconds: 0, punches: [], hoursWeek: 0, hoursTarget: 38, pto: '0 days', order: existing.length })
    }

    // A child-linked parent invite connects the family automatically — the
    // parent never browses the roster, they land already claimed to their kid.
    if (inv.role === 'parent' && inv.childId) {
      const child = await ctx.db.get(inv.childId)
      if (child && !child.archivedAt && child.facilityId === fid) {
        await ctx.db.patch(inv.childId, { parentUserId: child.parentUserId || uid, guardianUserIds: [...new Set([...(child.guardianUserIds || []), uid])] })
        await ctx.db.patch(inv._id, { used: true, usedBy: uid })
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
    await recordOwnerEvent(ctx, { facilityId: fid, actorId: uid, type: 'member_joined', summary: `${user.name || 'A new member'} joined as ${inv.role}.` })
    return { ok: true, slug: f?.slug, role: inv.role }
  },
})
