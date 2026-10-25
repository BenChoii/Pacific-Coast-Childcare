import { query, mutation, internalQuery } from './_generated/server'
import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { requireAdmin, requireFacility } from './lib'
import { recordOwnerEvent } from './notifications'

// The currently signed-in user (or null in demo / signed-out mode).
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null
    const user = await ctx.db.get(userId)
    if (!user) return null
    const children = user.facilityId && user.role === 'parent' ? await ctx.db.query('children').withIndex('by_facility', (q) => q.eq('facilityId', user.facilityId!)).collect() : []
    return {
      id: user._id,
      name: user.name ?? '',
      email: user.email ?? '',
      role: user.role ?? 'parent',
      facilityId: user.facilityId ?? null,
      hasFacility: !!user.facilityId,
      accessStatus: user.accessStatus || 'active',
      accessReason: user.accessReason,
      hasActiveChildren: user.role !== 'parent' || children.some((child) => !child.archivedAt && child.parentUserId === userId),
      imageUrl: user.imageId ? await ctx.storage.getUrl(user.imageId) : null,
    }
  },
})

// Director-only membership management. Deactivation preserves the account and
// care records while every server entry point stops accepting its membership.
export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    const { userId, facilityId, facility } = await requireAdmin(ctx)
    const members = await ctx.db.query('users').withIndex('by_facility', (q) => q.eq('facilityId', facilityId)).collect()
    const children = await ctx.db.query('children').withIndex('by_facility', (q) => q.eq('facilityId', facilityId)).collect()
    const educators = await ctx.db.query('educators').withIndex('by_facility', (q) => q.eq('facilityId', facilityId)).collect()
    return members.map((member) => ({
      id: member._id, name: member.name || 'Member', email: member.email || '', role: member.role || 'parent',
      accessStatus: member.accessStatus || 'active', accessReason: member.accessReason,
      isOwner: member._id === facility.ownerUserId, isCurrentUser: member._id === userId,
      children: children.filter((child) => !child.archivedAt && child.parentUserId === member._id).map((child) => ({ id: child._id, name: child.name, room: child.room })),
      educatorId: educators.find((educator) => educator.userId === member._id)?._id,
    }))
  },
})

export const setMemberAccess = mutation({
  args: { id: v.id('users'), status: v.union(v.literal('active'), v.literal('suspended')) },
  handler: async (ctx, { id, status }) => {
    const { userId, facilityId, facility } = await requireAdmin(ctx)
    const member = await ctx.db.get(id)
    if (!member || member.facilityId !== facilityId) throw new Error('Member not found.')
    if (id === userId || id === facility.ownerUserId) throw new Error('The owner and your own account cannot be suspended here.')
    if ((member.accessStatus || 'active') === status) return { ok: true }
    await ctx.db.patch(id, { accessStatus: status, accessChangedAt: Date.now(), accessChangedBy: userId, accessReason: 'director' })
    if (status === 'suspended' && member.joinedViaInviteId) {
      const invite = await ctx.db.get(member.joinedViaInviteId)
      if (invite?.facilityId === facilityId) await ctx.db.patch(invite._id, { used: true })
    }
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'member_access_changed', summary: `${member.name || 'Member'}: ${status === 'active' ? 'daycare access restored' : 'daycare access suspended'}.` })
    return { ok: true }
  },
})

// Actions use this authenticated query rather than trying to read DB state
// directly. It carries the same suspension checks as queries and mutations.
export const actionMembership = internalQuery({
  args: { staffOnly: v.optional(v.boolean()) },
  handler: async (ctx, { staffOnly }) => {
    const membership = await requireFacility(ctx)
    if (staffOnly && !['admin', 'staff'].includes(membership.user.role || '')) throw new Error('Educator or director access required.')
    return { facilityId: membership.facilityId, role: membership.user.role }
  },
})
