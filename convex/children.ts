import { query, mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireAdmin } from './lib'
import { recordOwnerEvent } from './notifications'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const out = []
    const uid = await getAuthUserId(ctx)
    const member = uid ? await ctx.db.get(uid) : null
    for (const d of docs.filter((child) => !child.archivedAt && (member?.role !== 'parent' || child.parentUserId === uid))) {
      const { _id, _creationTime, facilityId, order, imageId, ...rest } = d
      out.push({ id: _id, ...rest, imageUrl: imageId ? await ctx.storage.getUrl(imageId) : null })
    }
    return out
  },
})

// How many children the current facility has enrolled (drives the free tier).
export const count = query({
  args: {},
  handler: async (ctx) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return 0
    const docs = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    return docs.filter((child) => !child.archivedAt).length
  },
})

// Internal insert used by the billing.addChild orchestration action and seed.
export const insert = internalMutation({
  args: {
    facilityId: v.id('facilities'),
    first: v.string(),
    name: v.string(),
    age: v.string(),
    room: v.string(),
    emoji: v.string(),
    color: v.string(),
    parent: v.string(),
    allergies: v.array(v.string()),
    monthlyTuition: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', args.facilityId))
      .collect()
    const order = all.length ? Math.max(...all.map((c) => c.order)) + 1 : 0
    const childId = await ctx.db.insert('children', {
      ...args,
      status: 'checked-out',
      checkInTime: '—',
      mood: '—',
      napMinutes: 0,
      photosToday: 0,
      order,
    })
    // Mirror onto the attendance roster so educators see them immediately.
    await ctx.db.insert('roster', {
      facilityId: args.facilityId,
      childId,
      name: args.name,
      emoji: args.emoji,
      status: 'checked-out',
      time: '—',
      mood: '—',
      order,
    })
    await recordOwnerEvent(ctx, { facilityId: args.facilityId, type: 'child_enrolled', summary: `${args.name} was enrolled in ${args.room}.` })
    return { childId, count: all.filter((child) => !child.archivedAt).length + 1 }
  },
})

async function releaseChild(ctx: any, id: any) {
  const { facilityId, userId } = await requireAdmin(ctx)
  const child = await ctx.db.get(id)
  if (!child || child.facilityId !== facilityId) throw new Error('Child not found.')
  if (child.archivedAt) return { ok: true }
  await ctx.db.patch(id, { archivedAt: Date.now(), releasedBy: userId, status: 'released' })
  const roster = await ctx.db.query('roster').withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId)).collect()
  const matchingChildren = await ctx.db.query('children').withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId)).collect()
  for (const row of roster) {
    if (row.childId === id || (!row.childId && row.name === child.name && matchingChildren.filter((c: any) => c.name === child.name).length === 1)) await ctx.db.patch(row._id, { childId: id, status: 'released', time: '—' })
  }
  // Expire linked invitations so a released enrolment cannot be rejoined.
  const invites = await ctx.db.query('invites').withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId)).collect()
  for (const invite of invites) if (invite.childId === id) await ctx.db.patch(invite._id, { used: true })
  if (child.parentUserId) {
    const siblings = await ctx.db.query('children').withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId)).collect()
    const parent = await ctx.db.get(child.parentUserId)
    if (parent?.facilityId === facilityId && parent.role === 'parent' && parent.accessStatus !== 'suspended' && !siblings.some((c: any) => c._id !== id && !c.archivedAt && c.parentUserId === child.parentUserId)) {
      await ctx.db.patch(parent._id, { accessStatus: 'suspended', accessChangedAt: Date.now(), accessChangedBy: userId, accessReason: `child-released:${id}` })
    }
  }
  await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'child_released', summary: `${child.name}'s enrolment was released. Care records were retained.` })
  return { ok: true }
}

export const release = mutation({ args: { id: v.id('children') }, handler: async (ctx, { id }) => releaseChild(ctx, id) })
// Compatibility for the existing Account action; never destroy care records.
export const remove = mutation({ args: { id: v.id('children') }, handler: async (ctx, { id }) => releaseChild(ctx, id) })

export const archived = query({
  args: {},
  handler: async (ctx) => {
    const { facilityId } = await requireAdmin(ctx)
    const children = await ctx.db.query('children').withIndex('by_facility', (q) => q.eq('facilityId', facilityId)).collect()
    return children.filter((child) => !!child.archivedAt).map(({ _id, _creationTime, facilityId, imageId, ...rest }) => ({ id: _id, ...rest }))
  },
})

export const restore = mutation({
  args: { id: v.id('children') },
  handler: async (ctx, { id }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const child = await ctx.db.get(id)
    if (!child || child.facilityId !== facilityId) throw new Error('Child not found.')
    if (!child.archivedAt) return { ok: true }
    await ctx.db.patch(id, { archivedAt: undefined, releasedBy: undefined, status: 'checked-out' })
    const roster = await ctx.db.query('roster').withIndex('by_facility', (q) => q.eq('facilityId', facilityId)).collect()
    for (const row of roster) if (row.childId === id) await ctx.db.patch(row._id, { status: 'checked-out', time: '—' })
    const parent = child.parentUserId ? await ctx.db.get(child.parentUserId) : null
    if (parent?.facilityId === facilityId && parent.accessStatus === 'suspended' && parent.accessReason?.startsWith('child-released:')) {
      await ctx.db.patch(parent._id, { accessStatus: 'active', accessReason: 'enrolment-restored', accessChangedAt: Date.now(), accessChangedBy: userId })
    }
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'child_restored', summary: `${child.name}'s enrolment was restored.` })
    return { ok: true }
  },
})

export const assignRoom = mutation({
  args: { id: v.id('children'), room: v.string() },
  handler: async (ctx, { id, room }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const child = await ctx.db.get(id)
    if (!child || child.facilityId !== facilityId || child.archivedAt) throw new Error('Active child not found.')
    const nextRoom = room.trim() || 'Unassigned'
    await ctx.db.patch(id, { room: nextRoom })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'child_class_changed', summary: `${child.name}'s class changed to ${nextRoom}.` })
    return { ok: true }
  },
})

// Director sets a child's monthly tuition (powers real revenue analytics).
export const setTuition = mutation({
  args: { id: v.id('children'), monthlyTuition: v.number() },
  handler: async (ctx, { id, monthlyTuition }) => {
    const { facilityId } = await requireAdmin(ctx)
    const child = await ctx.db.get(id)
    if (!child || child.facilityId !== facilityId) throw new Error('Not found')
    await ctx.db.patch(id, { monthlyTuition })
  },
})

// A signed-in parent claims their child from the facility roster, linking the
// child record to their account so the parent app shows their real child.
export const claim = mutation({
  args: { id: v.id('children') },
  handler: async (ctx, { id }) => {
    const uid = await getAuthUserId(ctx)
    if (!uid) throw new Error('Sign in first')
    const child = await ctx.db.get(id)
    const user = await ctx.db.get(uid)
    if (!user || user.accessStatus === 'suspended' || !child || child.archivedAt || child.facilityId !== user.facilityId || child.parentUserId !== uid) {
      throw new Error('Ask the director for an invitation linked to your child.')
    }
    return { ok: true }
  },
})

export const setEnrollmentDays = mutation({
  args: { id: v.id('children'), days: v.array(v.string()) },
  handler: async (ctx, { id, days }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const child = await ctx.db.get(id)
    if (!child || child.facilityId !== facilityId || child.archivedAt) throw new Error('Active child not found.')
    const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    if (days.some((day) => !validDays.includes(day))) throw new Error('Choose valid weekdays.')
    const enrollmentDays = validDays.filter((day) => days.includes(day))
    await ctx.db.patch(id, { enrollmentDays })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'child_schedule_changed', summary: `${child.name}'s attendance days were updated.` })
    return { ok: true }
  },
})
