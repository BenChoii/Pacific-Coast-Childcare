import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { resolveFacilityId, requireAdmin, requireStaff, childBelongsToParent } from './lib'
import { getAuthUserId } from '@convex-dev/auth/server'
import { recordOwnerEvent } from './notifications'
import { checkedDate, localDate, cleanText, facilityChildren } from './workflowUtils'
import { queuePlanNotifications } from './familyNotifications'

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function weekday(date: string) { return days[new Date(`${date}T12:00:00Z`).getUTCDay()] }
function addDays(date: string, n: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
function weekStart(date: string) { const n = new Date(`${date}T12:00:00Z`).getUTCDay(); return addDays(date, -(n === 0 ? 6 : n - 1)) }
async function selectPlan(ctx: any, fid: any, args: any, facility: any) {
  const plans = await ctx.db.query('lessonPlans').withIndex('by_facility', (q: any) => q.eq('facilityId', fid)).collect()
  const date = checkedDate(args.startDate, facility)
  const room = args.room?.trim() || plans.find((p: any) => p.startDate && p.startDate <= date && p.endDate >= date)?.room || plans[0]?.room || 'Main Room'
  const dated = plans.filter((p: any) => p.room === room && p.startDate && p.startDate <= date && p.endDate >= date).sort((a: any,b: any) => b.startDate.localeCompare(a.startDate))
  return { plan: dated[0] || plans.find((p: any) => p.room === room && !p.startDate), room, date }
}
export const plan = query({
  args: { room: v.optional(v.string()), startDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return { room: args.room || 'Main Room', week: '', theme: '' }
    const uid = await getAuthUserId(ctx), user = uid ? await ctx.db.get(uid) : null
    if (user?.role === 'parent') return { room: 'Main Room', week: '', theme: '' }
    const { plan: p, room } = await selectPlan(ctx, fid, args, await ctx.db.get(fid))
    return p ? { id: p._id, week: p.week, theme: p.theme, room: p.room, startDate: p.startDate, endDate: p.endDate, template: !p.startDate } : { room, week: '', theme: '' }
  },
})
export const blocks = query({
  args: { room: v.optional(v.string()), startDate: v.optional(v.string()), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx), user = uid ? await ctx.db.get(uid) : null
    if (user?.role === 'parent') return []
    const { room, date } = await selectPlan(ctx, fid, { ...args, startDate: args.startDate || args.date }, await ctx.db.get(fid))
    const start = weekStart(date), end = addDays(start, 6)
    if (args.date) checkedDate(args.date)
    const rows = await ctx.db.query('lessonBlocks').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
    const dated = rows.filter(b => b.room === room && b.date && (args.date ? b.date === args.date : b.date >= start && b.date <= end))
    const templates = rows.filter(b => b.room === room && !b.date && (!args.date || b.day === weekday(args.date)) && !dated.some(d => d.sourceBlockId === b._id))
    return [...dated, ...templates].sort((a,b) => (a.date || a.day).localeCompare(b.date || b.day) || a.order - b.order)
      .map(({ _id, _creationTime, facilityId, ...b }) => ({ id: _id, ...b, status: b.date ? b.status : 'planned', doneChildren: b.date ? b.doneChildren : [], doneChildIds: b.date ? b.doneChildIds || [] : [], template: !b.date }))
  },
})
export const setTheme = mutation({
  args: { week: v.string(), theme: v.string(), room: v.optional(v.string()), startDate: v.optional(v.string()), endDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { facilityId, facility, userId } = await requireAdmin(ctx)
    const startDate = args.startDate ? checkedDate(args.startDate, facility) : weekStart(localDate(Date.now(), facility))
    const endDate = args.endDate ? checkedDate(args.endDate, facility) : addDays(startDate, 6)
    if (endDate < startDate || endDate > addDays(startDate, 31)) throw new Error('Use a lesson date range of up to 32 days.')
    const room = cleanText(args.room || 'Main Room', 'Room', 100, true)
    const all = await ctx.db.query('lessonPlans').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const p = all.find(p => p.room === room && p.startDate === startDate)
    const fields = { room, week: cleanText(args.week, 'Week label', 160, true), theme: cleanText(args.theme, 'Theme', 300, true), startDate, endDate, updatedAt: Date.now() }
    let id = p?._id
    if (id) await ctx.db.patch(id, fields)
    else id = await ctx.db.insert('lessonPlans', { facilityId, ...fields })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'working_lesson_plan_updated', summary: `Updated ${room}'s working lesson plan for ${startDate} to ${endDate}.` })
    return id
  },
})
const blockFields = { time: v.string(), title: v.string(), detail: v.string(), program: v.string(), materials: v.array(v.string()), objectives: v.array(v.string()) }
function cleanBlock(fields: any) {
  if (fields.materials.length > 40 || fields.objectives.length > 40) throw new Error('Use up to 40 materials and objectives.')
  return { time: cleanText(fields.time, 'Time', 40, true), title: cleanText(fields.title, 'Lesson title', 200, true), detail: cleanText(fields.detail, 'Lesson detail', 10000), program: cleanText(fields.program, 'Programme', 100, true), materials: fields.materials.map((x: string) => cleanText(x, 'Material', 300, true)), objectives: fields.objectives.map((x: string) => cleanText(x, 'Objective', 500, true)) }
}
export const addBlock = mutation({
  args: { day: v.string(), ...blockFields, room: v.optional(v.string()), planId: v.optional(v.id('lessonPlans')), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { facilityId, facility } = await requireAdmin(ctx)
    if (!days.includes(args.day)) throw new Error('Choose a valid weekday, including Saturday or Sunday.')
    const selected = await selectPlan(ctx, facilityId, { room: args.room, startDate: args.date }, facility)
    const p = args.planId ? await ctx.db.get(args.planId) : selected.plan
    if (p && p.facilityId !== facilityId) throw new Error('Lesson plan not found.')
    const room = cleanText(args.room || p?.room || selected.room, 'Room', 100, true)
    if (p && p.room !== room) throw new Error('Choose a plan for the same classroom.')
    const start = p?.startDate || weekStart(localDate(Date.now(), facility))
    const date = args.date ? checkedDate(args.date, facility) : addDays(start, (days.indexOf(args.day) + 6) % 7)
    if (weekday(date) !== args.day || (p?.startDate && (date < p.startDate || date > p.endDate))) throw new Error('Lesson date must match the weekday and plan period.')
    const all = await ctx.db.query('lessonBlocks').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const order = all.filter(b => b.room === room && b.date === date).length
    return await ctx.db.insert('lessonBlocks', { facilityId, room, planId: p?._id, date, day: args.day, ...cleanBlock(args), order, status: 'planned', doneChildren: [], doneChildIds: [] })
  },
})
export const updateBlock = mutation({
  args: { id: v.id('lessonBlocks'), ...blockFields },
  handler: async (ctx, { id, ...fields }) => {
    const { facilityId } = await requireAdmin(ctx)
    const block = await ctx.db.get(id)
    if (!block || block.facilityId !== facilityId) throw new Error('Lesson not found.')
    await ctx.db.patch(id, cleanBlock(fields))
  },
})
export const deleteBlock = mutation({
  args: { id: v.id('lessonBlocks') },
  handler: async (ctx, { id }) => {
    const { facilityId } = await requireAdmin(ctx)
    const block = await ctx.db.get(id)
    if (!block || block.facilityId !== facilityId) throw new Error('Lesson not found.')
    await ctx.db.delete(id)
  },
})
async function occurrence(ctx: any, block: any, requestedDate: string | undefined, facility: any, user: any) {
  const date = checkedDate(requestedDate || block.date, facility)
  if (date > localDate(Date.now(), facility)) throw new Error('Record lesson completion on the day it happens.')
  if (date !== localDate(Date.now(), facility) && user?.role !== 'admin') throw new Error('Ask the director to correct historical lesson completion.')
  if (block.date && block.date !== date) throw new Error('Choose the lesson scheduled for that date.')
  if (weekday(date) !== block.day) throw new Error('Choose a date matching the lesson weekday.')
  if (block.date) return block
  const rows = await ctx.db.query('lessonBlocks').withIndex('by_facility', (q: any) => q.eq('facilityId', block.facilityId)).collect()
  const existing = rows.find((b: any) => b.sourceBlockId === block._id && b.date === date)
  if (existing) return existing
  const { _id, _creationTime, ...template } = block
  const fields = { ...template, date, sourceBlockId: _id, status: 'planned', doneChildren: [], doneChildIds: [] }
  const id = await ctx.db.insert('lessonBlocks', fields)
  return { _id: id, ...fields }
}
export const setStatus = mutation({
  args: { id: v.id('lessonBlocks'), status: v.string(), date: v.optional(v.string()) },
  handler: async (ctx, { id, status, date }) => {
    const { facilityId, facility, user } = await requireStaff(ctx)
    const block = await ctx.db.get(id)
    if (!block || block.facilityId !== facilityId) throw new Error('Lesson not found.')
    if (!['planned', 'active', 'done'].includes(status)) throw new Error('Invalid lesson status.')
    const target = await occurrence(ctx, block, date, facility, user)
    await ctx.db.patch(target._id, { status })
    return target._id
  },
})
export const toggleChild = mutation({
  args: { id: v.id('lessonBlocks'), child: v.optional(v.string()), childId: v.optional(v.id('children')), date: v.optional(v.string()) },
  handler: async (ctx, { id, child, childId, date }) => {
    const { facilityId, facility, user } = await requireStaff(ctx)
    const block = await ctx.db.get(id)
    if (!block || block.facilityId !== facilityId) throw new Error('Lesson not found.')
    const kids = await facilityChildren(ctx, facilityId)
    const matches = kids.filter(k => !k.archivedAt && (childId ? k._id === childId : k.name === child))
    if (matches.length !== 1) throw new Error('Choose one child by their enrolment record.')
    const selected = matches[0]
    if (block.room !== 'All rooms' && selected.room !== block.room) throw new Error('Choose a child enrolled in this classroom.')
    const b = await occurrence(ctx, block, date, facility, user)
    const ids = b.doneChildIds || []
    const next = ids.includes(selected._id) ? ids.filter((x: any) => x !== selected._id) : [...ids, selected._id]
    await ctx.db.patch(b._id, { doneChildIds: next, doneChildren: next.map((id: any) => kids.find(k => k._id === id)?.name).filter(Boolean) })
    return b._id
  },
})
// Family-facing plans are separate published snapshots, never educator completion records.
const parentFields = {
  title: v.string(), period: v.union(v.literal('day'), v.literal('week'), v.literal('month')),
  kind: v.optional(v.union(v.literal('learning'), v.literal('schedule'))),
  startDate: v.string(), endDate: v.string(), room: v.optional(v.string()),
  overview: v.string(), activities: v.string(), goals: v.string(),
  attachments: v.optional(v.array(v.object({ storageId: v.id('_storage'), name: v.string(), mimeType: v.string(), size: v.number() }))),
  agenda: v.optional(v.array(v.object({ startTime: v.string(), endTime: v.string(), title: v.string(), location: v.optional(v.string()), detail: v.optional(v.string()), weekdays: v.optional(v.array(v.string())) }))),
}
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s
const familyFileTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
export function validateFamilyAgenda(rows: any[]) {
  if (rows.length > 50) throw new Error('Keep one class schedule to 50 time blocks.')
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const result = rows.map(row => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.endTime) || row.endTime <= row.startTime) throw new Error('Choose valid start and end times, with the end later on the same day.')
    if (row.weekdays && (!row.weekdays.length || row.weekdays.some((day: string) => !weekdays.includes(day)))) throw new Error('Choose one or more valid weekdays for each time block.')
    return { startTime: row.startTime, endTime: row.endTime, title: cleanText(row.title, 'Activity title', 160, true),
      location: row.location ? cleanText(row.location, 'Location', 100) : undefined,
      detail: row.detail ? cleanText(row.detail, 'Activity notes', 1500) : undefined,
      weekdays: row.weekdays ? weekdays.filter(day => row.weekdays.includes(day)) : undefined }
  })
  for (const day of weekdays) {
    const occurrences = result.filter(row => !row.weekdays || row.weekdays.includes(day)).sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (let i = 1; i < occurrences.length; i++) if (occurrences[i].startTime < occurrences[i - 1].endTime) throw new Error(`Schedule times overlap on ${day}. Adjust the time blocks before saving.`)
  }
  return result
}
async function familyAttachments(ctx: any, rows: any[], facilityId: any, userId: any, retainedIds = new Set<string>()) {
  if (rows.length > 5 || new Set(rows.map(row => row.storageId)).size !== rows.length) throw new Error('Attach up to five different photos or PDF files.')
  const result = []
  for (const row of rows) {
    const upload = await ctx.db.query('storedUploads').withIndex('by_storage', (q: any) => q.eq('storageId', row.storageId)).first()
    if (!upload || upload.facilityId !== facilityId || upload.purpose !== 'learning-plan' || (!retainedIds.has(row.storageId) && upload.uploadedBy !== userId)) throw new Error('Upload this schedule or learning-plan file from your own account before attaching it.')
    if (!familyFileTypes.includes(upload.mimeType) || !Number.isInteger(upload.size) || upload.size < 1 || upload.size > 8 * 1024 * 1024) throw new Error('Use photos or PDF files of up to 8 MB each.')
    if (row.mimeType !== upload.mimeType || row.size !== upload.size) throw new Error('This file’s details changed. Remove it and upload it again.')
    if (ctx.db.system && !await ctx.db.system.get(row.storageId)) throw new Error('This file is no longer available. Remove it and upload it again.')
    const name = cleanText(String(row.name || '').replace(/[\u0000-\u001f\u007f]/g, ''), 'File name', 160, true)
    result.push({ storageId: row.storageId, name, mimeType: upload.mimeType, size: upload.size })
  }
  return result
}

export const familyPlans = query({
  args: { childId: v.optional(v.id('children')) },
  handler: async (ctx, { childId }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    let rooms: Set<string> | null = null
    if (user?.role === 'parent') {
      const kids = await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
      const mine = kids.filter(k => childBelongsToParent(k, uid) && !k.archivedAt)
      if (childId && !mine.some(k => k._id === childId)) return []
      const selected = childId ? mine.filter(k => k._id === childId) : mine
      if (!selected.length) return []
      rooms = new Set(selected.map(k => k.room).filter(room => room && room !== 'Unassigned'))
    }
    const rows = await ctx.db.query('parentPlans').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
    return rows.filter(r => (user?.role === 'admin' || r.status === 'published') && (!rooms || !r.room || rooms.has(r.room)))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map(({ _id, facilityId, createdBy, ...r }) => ({ id: _id, ...r, attachments: user ? r.attachments || [] : [] }))
  },
})

export const saveFamilyPlan = mutation({
  args: { id: v.optional(v.id('parentPlans')), ...parentFields },
  handler: async (ctx, { id, ...args }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const prior = id ? await ctx.db.get(id) : null
    if (id && (!prior || prior.facilityId !== facilityId)) throw new Error('Plan not found.')
    if (!args.title.trim() || args.title.length > 160) throw new Error('Add a title of up to 160 characters.')
    if (!validDate(args.startDate) || !validDate(args.endDate) || args.endDate < args.startDate) throw new Error('Choose a valid date range.')
    if (args.period === 'day' && args.startDate !== args.endDate) throw new Error('A daily schedule or plan uses one calendar date.')
    if ([args.overview, args.activities, args.goals].some(s => s.length > 15000) || (args.room?.length ?? 0) > 100) throw new Error('Please shorten the plan.')
    const retainedIds = new Set<string>((prior?.attachments || []).map(row => row.storageId))
    const attachments = await familyAttachments(ctx, args.attachments ?? prior?.attachments ?? [], facilityId, userId, retainedIds)
    const agenda = validateFamilyAgenda(args.agenda ?? prior?.agenda ?? [])
    const data = { ...args, attachments, agenda, kind: args.kind || prior?.kind || 'learning', title: args.title.trim(), room: args.room?.trim() || undefined, updatedAt: Date.now() }
    if (id) {
      // Saving edits returns the plan to draft; publishing is an explicit step.
      await ctx.db.patch(id, { ...data, status: 'draft' })
      if (prior?.status === 'published') await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'lesson-plan.updated', summary: `Updated published family plan ${args.title.trim()} and returned it to draft for review before republication.` })
    } else id = await ctx.db.insert('parentPlans', { ...data, facilityId, status: 'draft', createdBy: userId, createdAt: Date.now() })
    return id
  },
})

export const publishFamilyPlan = mutation({
  args: { id: v.id('parentPlans'), published: v.boolean() },
  handler: async (ctx, { id, published }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const p = await ctx.db.get(id)
    if (!p || p.facilityId !== facilityId) throw new Error('Plan not found.')
    if (published && !p.overview.trim() && !p.activities.trim() && !p.attachments?.length && !p.agenda?.length) throw new Error('Add an overview or activities, or attach a schedule or learning plan before publishing.')
    if (published) { await familyAttachments(ctx, p.attachments || [], facilityId, userId, new Set((p.attachments || []).map(row => row.storageId))); validateFamilyAgenda(p.agenda || []) }
    if ((p.status === 'published') === published) return { queued: 0, recorded: 0, skipped: 0 }
    const now = Date.now()
    await ctx.db.patch(id, { status: published ? 'published' : 'draft', publishedAt: published ? now : p.publishedAt, updatedAt: now })
    const delivery = published && p.attachments?.length ? await queuePlanNotifications(ctx, { ...p, status: 'published', publishedAt: now, updatedAt: now }) : { queued: 0, recorded: 0, skipped: 0 }
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: published ? 'lesson-plan.published' : 'lesson-plan.unpublished', summary: `${published ? 'Published' : 'Unpublished'} ${p.period === 'day' ? 'daily' : p.period === 'week' ? 'weekly' : 'monthly'} family ${p.kind === 'schedule' ? 'schedule' : 'plan'}: ${p.title} (${p.startDate} to ${p.endDate}).` })
    return delivery
  },
})

export const removeFamilyPlan = mutation({
  args: { id: v.id('parentPlans') },
  handler: async (ctx, { id }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const p = await ctx.db.get(id)
    if (!p || p.facilityId !== facilityId) throw new Error('Plan not found.')
    await ctx.db.delete(id)
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'lesson-plan.removed', summary: `Removed family learning plan ${p.title} (${p.startDate} to ${p.endDate}).` })
  },
})
