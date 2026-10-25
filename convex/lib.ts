import { getAuthUserId } from '@convex-dev/auth/server'
import type {Doc,Id,TableNames} from './_generated/dataModel'

// Guardian access stays centralized so every family surface uses the same rule.
export function childBelongsToParent(child: any, userId: any) {
  return !!userId && !child?.archivedAt && (child?.parentUserId === userId || (child?.guardianUserIds || []).includes(userId))
}

// ── Tenant resolution ────────────────────────────────────────────────────
// Every data query/mutation derives its facility from the signed-in user.
// Unauthenticated callers (the public /app + /demo experience) fall back to
// the seeded demo facility, so the client never has to pass a facilityId and
// can never read another tenant's data.

export async function getDemoFacilityId(ctx: any):Promise<Id<'facilities'>|null> {
  const demo = await ctx.db
    .query('facilities')
    .withIndex('by_slug', (q: any) => q.eq('slug', 'demo'))
    .first()
  return demo?._id ?? null
}

// The facility the current request should read/write. Authed user's facility,
// else the demo facility. Returns null only if the demo hasn't been seeded.
export async function resolveFacilityId(ctx: any):Promise<Id<'facilities'>|null> {
  const uid = await getAuthUserId(ctx)
  if (!uid) return await getDemoFacilityId(ctx)
  const user = await ctx.db.get(uid)
  // A signed-in account never falls through to a demo or another workspace.
  if (!user?.facilityId || user.accessStatus === 'suspended') return null
  const facility = await ctx.db.get(user.facilityId)
  if (!facility) return null
  if (user.role === 'parent') {
    const children = await ctx.db.query('children').withIndex('by_facility', (q: any) => q.eq('facilityId', user.facilityId)).collect()
    if (!children.some((child: any) => childBelongsToParent(child, uid))) return null
  }
  return user.facilityId
}

// Membership and roles are checked server-side, including for already-issued
// sessions. Suspending a member immediately removes their data access.
export async function requireFacility(ctx: any):Promise<{userId:Id<'users'>,user:Doc<'users'>,facilityId:Id<'facilities'>,facility:Doc<'facilities'>}> {
  const uid = await getAuthUserId(ctx)
  if (!uid) throw new Error('Not authenticated')
  const user = await ctx.db.get(uid)
  if (user?.accessStatus === 'suspended') throw new Error('Your daycare access has ended. Contact the owner.')
  if (!user?.facilityId) throw new Error('You are not part of a facility yet.')
  const facility = await ctx.db.get(user.facilityId)
  if (!facility) throw new Error('Facility not found.')
  return { userId: uid, user, facilityId: user.facilityId, facility }
}

export async function requireAdmin(ctx: any) {
  const membership = await requireFacility(ctx)
  if (membership.user.role !== 'admin') throw new Error('Only the owner/director can do this.')
  return membership
}

// The public demo remains interactive, but only within its own seeded tenant.
export async function requireStaff(ctx: any) {
  const uid = await getAuthUserId(ctx)
  if (!uid) {
    const facilityId = await getDemoFacilityId(ctx)
    const facility = facilityId ? await ctx.db.get(facilityId) : null
    if (!facilityId || !facility?.isDemo) throw new Error('Not authenticated')
    return { userId: null, user: null, facilityId, facility }
  }
  const membership = await requireFacility(ctx)
  if (!['admin', 'staff'].includes(membership.user.role || '')) throw new Error('Educator or director access required.')
  return membership
}

export async function requireRecord<T extends TableNames>(ctx: any, id: Id<T>, facilityId: Id<'facilities'>):Promise<Doc<T>> {
  const record = await ctx.db.get(id)
  if (!record || record.facilityId !== facilityId) throw new Error('Not found')
  return record as Doc<T>
}

// ── Pricing engine ───────────────────────────────────────────────────────
// Mirrors the public sales calculator in src/components/Sales.jsx. Keep in sync.
// Model: free for the first FREE_LIMIT children (free while ramping up), then a
// flat BASE_PRICE at the first billable child, plus PER_CHILD for each child
// beyond that. No volume discount, no separate floor — simple and linear.
//   ≤ FREE_LIMIT (5)  → free
//   6th child         → $20  (BASE_PRICE)
//   each child after  → +$2  (PER_CHILD)   e.g. 10→$28, 20→$48, 100→$208
export const FREE_LIMIT = 5 // children free before billing begins
export const BASE_PRICE = 20 // CAD/mo at the first billable child (FREE_LIMIT + 1)
export const PER_CHILD = 2 // CAD/mo added per child beyond the first billable one

// Monthly charge in CAD cents for a roster of `kids` children.
export function monthlyCents(kids: number, freeLimit: number = FREE_LIMIT) {
  if (kids <= freeLimit) return 0
  const dollars = BASE_PRICE + (kids - (freeLimit + 1)) * PER_CHILD
  return Math.round(dollars * 100)
}

// A plain-English/number summary of a facility's billing position.
export function billingSummary(childCount: number, freeLimit: number = FREE_LIMIT) {
  const cents = monthlyCents(childCount, freeLimit)
  return {
    childCount,
    freeLimit,
    billable: childCount > freeLimit,
    monthlyCents: cents,
    monthly: cents / 100,
    remainingFree: Math.max(0, freeLimit - childCount),
  }
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'daycare'
  )
}

export function randomToken() {
  // URL-safe token for invite links.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
