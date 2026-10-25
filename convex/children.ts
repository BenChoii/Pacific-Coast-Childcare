import { query, mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { getAuthUserId } from '@convex-dev/auth/server'
import { resolveFacilityId, requireAdmin, requireFacility, childBelongsToParent } from './lib'
import { attendanceForDate, summarizeAttendance, closeAttendanceForEnrolmentChange } from './roster'
import { checkedDate, localDate, cleanText, authorizedChild, dateWindow } from './workflowUtils'
import { assertOwnedUpload } from './files'
import { recordOwnerEvent } from './notifications'

function guardianIdsOf(child: {parentUserId?: Id<'users'>; guardianUserIds?: Id<'users'>[]}) {
  return [...new Set([child.parentUserId, ...(child.guardianUserIds || [])].filter((id): id is Id<'users'> => id !== undefined))]
}

export const list = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date: requestedDate }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const docs = await ctx.db
      .query('children')
      .withIndex('by_facility', (q) => q.eq('facilityId', fid))
      .collect()
    const facility = await ctx.db.get(fid)
    const date = checkedDate(requestedDate, facility)
    const states = await attendanceForDate(ctx, fid, date)
    const window = dateWindow(date, facility)
    const explicitActivities = await ctx.db.query('activities').withIndex('by_facility_date', q => q.eq('facilityId', fid).eq('date', date)).collect()
    const legacyActivities = await ctx.db.query('activities').withIndex('by_facility', q => q.eq('facilityId', fid)).filter(q => q.and(q.gte(q.field('_creationTime'), window.start), q.lt(q.field('_creationTime'), window.end))).collect()
    const dayActivities = [...new Map([...explicitActivities, ...legacyActivities].map(a => [a._id, a])).values()].filter(a => (a.date || localDate(a.occurredAt || a._creationTime, facility)) === date)
    const explicitPhotos = await ctx.db.query('photos').withIndex('by_facility_created', q => q.eq('facilityId', fid).gte('createdAt', window.start).lt('createdAt', window.end)).collect()
    const legacyPhotos = await ctx.db.query('photos').withIndex('by_facility', q => q.eq('facilityId', fid)).filter(q => q.and(q.gte(q.field('_creationTime'), window.start), q.lt(q.field('_creationTime'), window.end))).collect()
    const dayPhotos = [...new Map([...explicitPhotos, ...legacyPhotos].map(p => [p._id, p])).values()]
    const out = []
    const uid = await getAuthUserId(ctx)
    const member = uid ? await ctx.db.get(uid) : null
    for (const d of docs.filter((child) => !child.archivedAt && (member?.role !== 'parent' || childBelongsToParent(child, uid)))) {
      const { _id, _creationTime, facilityId, order, imageId, ...rest } = d
      const state = states.get(_id) || (facility?.isDemo && !requestedDate ? { status: d.status, checkInTime: d.checkInTime, attendanceDate: date } : summarizeAttendance([], date))
      const uniqueName = docs.filter(c => c.name === d.name).length === 1
      const activities = dayActivities.filter(a => a.childId === _id || (!a.childId && uniqueName && a.childName === d.name))
      const naps = activities.filter(a => a.type === 'nap')
      const recordedNaps = naps.filter(a => typeof a.durationMinutes === 'number')
      const mood = activities.filter(a => a.mood).sort((a,b) => (b.occurredAt || b._creationTime) - (a.occurredAt || a._creationTime))[0]?.mood || null
      const photoCount = dayPhotos.filter(p => p.childId === _id && localDate(p.createdAt || p._creationTime, facility) === date).length
      const careSummary = { date, mealCount: activities.filter(a => a.type === 'meal').length, napMinutes: recordedNaps.length ? recordedNaps.reduce((n,a) => n + (a.durationMinutes || 0), 0) : null, photoCount, mood }
      out.push({ id: _id, ...rest, ...state, mood: facility?.isDemo ? d.mood : mood, napMinutes: facility?.isDemo ? d.napMinutes : careSummary.napMinutes, photosToday: facility?.isDemo ? d.photosToday : photoCount, careSummary, imageId: imageId || undefined, imageUrl: facility?.isDemo && imageId ? await ctx.storage.getUrl(imageId) : null })
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
  const membership = await requireAdmin(ctx)
  const { facilityId, userId } = membership
  const child = await ctx.db.get(id)
  if (!child || child.facilityId !== facilityId) throw new Error('Child not found.')
  if (child.archivedAt) return { ok: true }
  await closeAttendanceForEnrolmentChange(ctx, membership, child)
  await ctx.db.patch(id, { archivedAt: Date.now(), releasedBy: userId, status: 'released' })
  const roster = await ctx.db.query('roster').withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId)).collect()
  const matchingChildren = await ctx.db.query('children').withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId)).collect()
  for (const row of roster) {
    if (row.childId === id || (!row.childId && row.name === child.name && matchingChildren.filter((c: any) => c.name === child.name).length === 1)) await ctx.db.patch(row._id, { childId: id, status: 'released', time: '—' })
  }
  // Expire linked invitations so a released enrolment cannot be rejoined.
  const invites = await ctx.db.query('invites').withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId)).collect()
  for (const invite of invites) if (invite.childId === id) await ctx.db.patch(invite._id, { used: true })
  const guardianIds = guardianIdsOf(child)
  const siblings = await ctx.db.query('children').withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId)).collect()
  for (const guardianId of guardianIds) {
    const parent = await ctx.db.get(guardianId)
    if (parent?.facilityId === facilityId && parent.role === 'parent' && parent.accessStatus !== 'suspended' && !siblings.some((c: any) => c._id !== id && !c.archivedAt && childBelongsToParent(c, guardianId))) {
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
    const membership = await requireAdmin(ctx)
    const { facilityId, userId } = membership
    const child = await ctx.db.get(id)
    if (!child || child.facilityId !== facilityId) throw new Error('Child not found.')
    if (!child.archivedAt) return { ok: true }
    // Also repair an enrolment archived by an older client that did not close
    // its current-day attendance; append only, never rewrite prior events.
    await closeAttendanceForEnrolmentChange(ctx, membership, child)
    await ctx.db.patch(id, { archivedAt: undefined, releasedBy: undefined, status: 'checked-out' })
    const roster = await ctx.db.query('roster').withIndex('by_facility', (q) => q.eq('facilityId', facilityId)).collect()
    for (const row of roster) if (row.childId === id) await ctx.db.patch(row._id, { status: 'checked-out', time: '—' })
    for (const guardianId of guardianIdsOf(child)) {
      const parent = await ctx.db.get(guardianId)
      if (parent?.facilityId === facilityId && parent.role === 'parent' && parent.accessStatus === 'suspended' && parent.accessReason?.startsWith('child-released:')) {
        await ctx.db.patch(parent._id, { accessStatus: 'active', accessReason: 'enrolment-restored', accessChangedAt: Date.now(), accessChangedBy: userId })
      }
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
    if (!Number.isFinite(monthlyTuition) || monthlyTuition < 0 || monthlyTuition > 100000) throw new Error('Enter a valid non-negative monthly tuition.')
    await ctx.db.patch(id, { monthlyTuition: Math.round(monthlyTuition * 100) / 100 })
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
    if (!user || user.accessStatus === 'suspended' || !child || child.archivedAt || child.facilityId !== user.facilityId || !childBelongsToParent(child, uid)) {
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

const contact = v.object({ name: v.string(), relationship: v.string(), phone: v.string() })
function contacts(rows: any[], label: string) {
  if (rows.length > 12) throw new Error(`Keep ${label} to 12 contacts.`)
  return rows.map(c => ({ name: cleanText(c.name, 'Contact name', 160, true), relationship: cleanText(c.relationship, 'Relationship', 80, true), phone: cleanText(c.phone, 'Contact phone', 60, true) }))
}
export const updateProfile = mutation({
  args: {
    id: v.id('children'), name: v.optional(v.string()), age: v.optional(v.string()), room: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()), allergies: v.optional(v.array(v.string())), careInstructions: v.optional(v.string()),
    emergencyContacts: v.optional(v.array(contact)), authorizedPickups: v.optional(v.array(contact)),
  },
  handler: async (ctx, { id, ...fields }) => {
    const { facilityId, userId, facility } = await requireAdmin(ctx)
    const child = await authorizedChild(ctx, id, facilityId)
    const patch: any = {}
    if (fields.name !== undefined) { patch.name = cleanText(fields.name, 'Child name', 160, true); patch.first = patch.name.split(/\s+/)[0] }
    if (fields.age !== undefined) patch.age = cleanText(fields.age, 'Age', 60, true)
    if (fields.room !== undefined) patch.room = cleanText(fields.room, 'Room', 100, true)
    if (fields.dateOfBirth !== undefined) {
      if (fields.dateOfBirth && (checkedDate(fields.dateOfBirth, facility) > localDate(Date.now(), facility))) throw new Error('Date of birth cannot be in the future.')
      patch.dateOfBirth = fields.dateOfBirth || undefined
    }
    if (fields.allergies !== undefined) {
      if (fields.allergies.length > 30) throw new Error('Use up to 30 allergy/care alerts.')
      patch.allergies = fields.allergies.map(a => cleanText(a, 'Allergy', 300, true))
    }
    if (fields.careInstructions !== undefined) patch.careInstructions = cleanText(fields.careInstructions, 'Care instructions', 10000)
    if (fields.emergencyContacts !== undefined) patch.emergencyContacts = contacts(fields.emergencyContacts, 'emergency contacts')
    if (fields.authorizedPickups !== undefined) patch.authorizedPickups = contacts(fields.authorizedPickups, 'authorized pickups')
    await ctx.db.patch(id, patch)
    if (patch.name) {
      const rows = await ctx.db.query('roster').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
      for (const row of rows) if (row.childId === id) await ctx.db.patch(row._id, { name: patch.name })
    }
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'child_profile_updated', summary: `${patch.name || child.name}'s care profile was updated.` })
    return { ok: true }
  },
})

export const documents = query({
  args: { childId: v.id('children') },
  handler: async (ctx, { childId }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx), user = uid ? await ctx.db.get(uid) : null
    if (!uid) return []
    await authorizedChild(ctx, childId, fid, user, uid)
    const rows = await ctx.db.query('childDocuments').withIndex('by_child', q => q.eq('childId', childId)).collect()
    // Private files are served through an authenticated download endpoint, never getUrl.
    return rows.filter(r => r.facilityId === fid).map(({ _id, facilityId, createdBy, reviewedBy, ...row }) => ({ id: _id, ...row }))
  },
})
export const saveDocument = mutation({
  args: { id: v.optional(v.id('childDocuments')), childId: v.id('children'), label: v.string(), status: v.union(v.literal('requested'), v.literal('received'), v.literal('reviewed')), notes: v.optional(v.string()), storageId: v.optional(v.id('_storage')) },
  handler: async (ctx, { id, childId, label, status, notes, storageId }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const child = await authorizedChild(ctx, childId, facilityId)
    const existing = id ? await ctx.db.get(id) : null
    if (id && (!existing || existing.facilityId !== facilityId || existing.childId !== childId)) throw new Error('Document not found.')
    const file = storageId || existing?.storageId
    if (storageId && storageId !== existing?.storageId) await assertOwnedUpload(ctx, storageId, facilityId, userId, ['child-document'])
    if (status !== 'requested' && !file) throw new Error('Attach the document before marking it received or reviewed.')
    const data = { label: cleanText(label, 'Document label', 160, true), status, notes: notes === undefined ? existing?.notes : cleanText(notes, 'Document notes', 5000), storageId: file, reviewedAt: status === 'reviewed' ? Date.now() : undefined, reviewedBy: status === 'reviewed' ? userId : undefined, updatedAt: Date.now() }
    if (id) await ctx.db.patch(id, data)
    else id = await ctx.db.insert('childDocuments', { ...data, facilityId, childId, createdBy: userId, createdAt: Date.now() })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'child_document_updated', summary: `${child.name}'s ${data.label} document is ${status}.` })
    return id
  },
})
export const submitDocument = mutation({
  args: { id: v.id('childDocuments'), storageId: v.id('_storage') },
  handler: async (ctx, { id, storageId }) => {
    const { facilityId, userId, user } = await requireFacility(ctx)
    const document = await ctx.db.get(id)
    if (!document || document.facilityId !== facilityId) throw new Error('Document not found.')
    const child = await authorizedChild(ctx, document.childId, facilityId, user, userId)
    await assertOwnedUpload(ctx, storageId, facilityId, userId, ['child-document'])
    await ctx.db.patch(id, { storageId, status: 'received', updatedAt: Date.now(), reviewedAt: undefined, reviewedBy: undefined })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'child_document_submitted', summary: `${child.name}'s ${document.label} document is ready for review.` })
    return { ok: true }
  },
})
export const removeDocument = mutation({
  args: { id: v.id('childDocuments') },
  handler: async (ctx, { id }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const document = await ctx.db.get(id)
    if (!document || document.facilityId !== facilityId) throw new Error('Document not found.')
    await ctx.db.delete(id)
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'child_document_removed', summary: `Removed the ${document.label} care-document entry.` })
    return { ok: true }
  },
})
