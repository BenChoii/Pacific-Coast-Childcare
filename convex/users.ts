import { query, mutation, internalQuery, internalMutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { requireAdmin, requireFacility, childBelongsToParent } from './lib'
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
      hasActiveChildren: user.role !== 'parent' || children.some((child) => !child.archivedAt && childBelongsToParent(child, userId)),
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
      children: children.filter((child) => !child.archivedAt && childBelongsToParent(child, member._id)).map((child) => ({ id: child._id, name: child.name, room: child.room })),
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
    if (status === 'suspended') {
      if (member.joinedViaInviteId) {
        const invite = await ctx.db.get(member.joinedViaInviteId)
        if (invite?.facilityId === facilityId) await ctx.db.patch(invite._id, { used: true })
      }
      if (member.role === 'staff') {
        const educators = await ctx.db.query('educators').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
        const educatorIds = new Set(educators.filter(e => e.userId === id).map(e => e._id))
        const profiles = await ctx.db.query('employeeProfiles').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
        const email = member.email?.trim().toLowerCase()
        for (const profile of profiles.filter(p => (p.educatorId && educatorIds.has(p.educatorId)) || (email && p.personalEmail?.trim().toLowerCase() === email))) {
          await ctx.db.patch(profile._id, { revokedAt: Date.now() })
          if (profile.loginInviteId) await ctx.db.patch(profile.loginInviteId, { used: true })
        }
        const invites = await ctx.db.query('invites').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
        for (const invite of invites.filter(inv => !inv.used && inv.role === 'staff' && ((inv.educatorId && educatorIds.has(inv.educatorId)) || (email && inv.email?.trim().toLowerCase() === email)))) await ctx.db.patch(invite._id, { used: true })
      }
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

// Preserve legacy case-sensitive credential IDs while normalising new accounts.
// This query is internal: public callers never receive an account directory.
export const authIdentity = internalQuery({
  args: { email: v.string(), exactEmail: v.string(), flow: v.string(), inviteToken: v.optional(v.string()) },
  handler: async (ctx, { email, exactEmail, flow, inviteToken }) => {
    const accounts = await ctx.db.query('authAccounts').withIndex('providerAndAccountId', q => q.eq('provider', 'password')).collect()
    const matches = accounts.filter(a => a.providerAccountId.trim().toLowerCase() === email)
    if (flow === 'signUp') {
      if (inviteToken) {
        const invite = await ctx.db.query('invites').withIndex('by_token', q => q.eq('token', inviteToken)).first()
        if (!invite || invite.used || (invite.role !== 'parent' && !invite.expiresAt) || (invite.expiresAt && invite.expiresAt <= Date.now()) || (invite.email && invite.email.trim().toLowerCase() !== email) || (invite.role === 'parent' && !invite.childId)) throw new Error('This invitation is no longer valid for this email.')
        if (invite.childId) { const child = await ctx.db.get(invite.childId); if (!child || child.archivedAt || child.facilityId !== invite.facilityId) throw new Error('This child invitation is no longer active.') }
      }
      if (matches.length) throw new Error('An account already uses this email. Sign in or reset your password.')
      return { accountEmail: email, userId: null }
    }
    const exact = matches.filter(a => a.providerAccountId === exactEmail)
    const account = matches.length === 1 ? matches[0] : exact.length === 1 ? exact[0] : null
    if (matches.length > 1 && !account) throw new Error('Multiple legacy accounts use this email. Sign in using the exact email originally registered, or contact support.')
    return { accountEmail: account?.providerAccountId || email, userId: account?.userId || null }
  },
})

export const reserveRecovery = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId)
    if (!user) return { allowed: false }
    const now = Date.now(), sameWindow = now - (user.recoveryWindowStartedAt || 0) < 3_600_000
    if (now - (user.recoveryRequestedAt || 0) < 60_000 || (sameWindow && (user.recoveryWindowCount || 0) >= 5)) return { allowed: false }
    await ctx.db.patch(userId, { recoveryRequestedAt: now, recoveryWindowStartedAt: sameWindow ? user.recoveryWindowStartedAt : now, recoveryWindowCount: sameWindow ? (user.recoveryWindowCount || 0) + 1 : 1 })
    return { allowed: true }
  },
})

async function attachGuardian(ctx: MutationCtx, childId: Id<'children'>, guardianId: Id<'users'>) {
  const { facilityId, userId } = await requireAdmin(ctx)
  const child = await ctx.db.get(childId), guardian = await ctx.db.get(guardianId)
  if (!child || child.archivedAt || child.facilityId !== facilityId) throw new Error('Active child not found.')
  if (!guardian || guardian.role !== 'parent' || (guardian.facilityId && guardian.facilityId !== facilityId)) throw new Error('Choose a parent account in this daycare.')
  if (guardian.accessStatus === 'suspended' && !guardian.accessReason?.startsWith('child-released:')) throw new Error('Restore this parent account before linking a child.')
  const guardianUserIds = [...new Set([...(child.guardianUserIds || []), guardianId])]
  await ctx.db.patch(childId, { parentUserId: child.parentUserId || guardianId, guardianUserIds })
  await ctx.db.patch(guardianId, { facilityId, accessStatus: 'active', accessReason: undefined })
  const threads = await ctx.db.query('conversations').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
  if (!threads.some(t => t.parentUserId === guardianId)) await ctx.db.insert('conversations', { facilityId, parentUserId: guardianId, name: guardian.name || 'Family', role: 'Parent', emoji: '👪', online: false, unread: 0, order: threads.length })
  await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'guardian_linked', summary: 'A parent account was linked to a child’s enrolment.' })
  return { ok: true }
}
export const linkGuardian = mutation({ args: { childId: v.id('children'), userId: v.id('users') }, handler: async (ctx, { childId, userId }) => attachGuardian(ctx, childId, userId) })
export const linkGuardianByEmail = mutation({
  args: { childId: v.id('children'), email: v.string() },
  handler: async (ctx, { childId, email }) => {
    await requireAdmin(ctx)
    const normalized = email.trim().toLowerCase()
    const users = (await ctx.db.query('users').collect()).filter(u => u.email?.trim().toLowerCase() === normalized)
    if (users.length !== 1) throw new Error('A unique existing parent account was not found. Send a child-linked invitation instead, or contact support for duplicate accounts.')
    return await attachGuardian(ctx, childId, users[0]._id)
  },
})
export const unlinkGuardian = mutation({
  args: { childId: v.id('children'), userId: v.id('users') },
  handler: async (ctx, { childId, userId: guardianId }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const child = await ctx.db.get(childId), guardian = await ctx.db.get(guardianId)
    if (!child || child.facilityId !== facilityId || !guardian || guardian.facilityId !== facilityId || guardian.role !== 'parent') throw new Error('Parent or child not found.')
    const remaining = [...new Set([...(child.parentUserId ? [child.parentUserId] : []), ...(child.guardianUserIds || [])].filter(id => id !== guardianId))]
    await ctx.db.patch(childId, { parentUserId: remaining[0], guardianUserIds: remaining })
    const children = await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const hasOther = children.some(c => c._id !== childId && !c.archivedAt && childBelongsToParent(c, guardianId))
    if (!hasOther && guardian.accessStatus !== 'suspended') await ctx.db.patch(guardianId, { accessStatus: 'suspended', accessReason: `child-released:${childId}`, accessChangedAt: Date.now(), accessChangedBy: userId })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'guardian_unlinked', summary: 'A parent account was removed from a child’s enrolment. Other enrolled children remain linked.' })
    return { ok: true }
  },
})
