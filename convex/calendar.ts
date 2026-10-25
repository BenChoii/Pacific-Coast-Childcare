import { query, mutation, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { childBelongsToParent, requireAdmin, resolveFacilityId } from './lib'
import { recordOwnerEvent } from './notifications'

const fields = {
  title: v.string(), startDate: v.string(), endDate: v.string(),
  kind: v.union(v.literal('closure'), v.literal('holiday'), v.literal('event')),
  description: v.string(), room: v.optional(v.string()),
}
const dateOK = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s
function validate(args: any) {
  if (!args.title.trim() || args.title.length > 160) throw new Error('Add a title of up to 160 characters.')
  if (!dateOK(args.startDate) || !dateOK(args.endDate) || args.endDate < args.startDate) throw new Error('Choose a valid date range.')
  if (args.description.length > 5000 || (args.room?.length ?? 0) > 100) throw new Error('Please shorten the details.')
}


export const list = query({
  args: { childId: v.optional(v.id('children')) },
  handler: async (ctx, { childId }) => {
    const fid = await resolveFacilityId(ctx)
    if (!fid) return []
    const uid = await getAuthUserId(ctx)
    const user = uid ? await ctx.db.get(uid) : null
    let rooms: Set<string> | null = null
    if (user?.role === 'parent') {
      const kids = await ctx.db.query('children').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
      const mine = kids.filter(k => childBelongsToParent(k, uid))
      if (childId && !mine.some(k => k._id === childId)) return []
      const selected = childId ? mine.filter(k => k._id === childId) : mine
      if (!selected.length) return []
      rooms = new Set(selected.map(k => k.room))
    }
    const rows = await ctx.db.query('calendarEvents').withIndex('by_facility', q => q.eq('facilityId', fid)).collect()
    return rows.filter(r => !rooms || !r.room || rooms.has(r.room))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map(({ _id, title, startDate, endDate, kind, description, room }) => ({ id: _id, title, startDate, endDate, kind, description, room }))
  },
})

export const save = mutation({
  args: { id: v.optional(v.id('calendarEvents')), ...fields },
  handler: async (ctx, { id, ...args }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    validate(args)
    const data = { ...args, title: args.title.trim(), description: args.description.trim(), room: args.room?.trim() || undefined, updatedAt: Date.now() }
    if (id) {
      const row = await ctx.db.get(id)
      if (!row || row.facilityId !== facilityId) throw new Error('Calendar entry not found.')
      await ctx.db.patch(id, data)
    } else id = await ctx.db.insert('calendarEvents', { ...data, facilityId, createdBy: userId, createdAt: Date.now() })
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'calendar.updated', summary: `${args.kind === 'event' ? 'Event' : 'Closure/holiday'} ${args.title.trim()} saved for ${args.startDate} to ${args.endDate}${args.room ? ` (${args.room})` : ' (all rooms)'}.` })
    return id
  },
})

export const remove = mutation({
  args: { id: v.id('calendarEvents') },
  handler: async (ctx, { id }) => {
    const { facilityId, userId } = await requireAdmin(ctx)
    const row = await ctx.db.get(id)
    if (!row || row.facilityId !== facilityId) throw new Error('Calendar entry not found.')
    await ctx.db.delete(id)
    await recordOwnerEvent(ctx, { facilityId, actorId: userId, type: 'calendar.removed', summary: `Calendar entry ${row.title} (${row.startDate} to ${row.endDate}) removed.` })
  },
})

// Owner-supplied PCCA 2026–2027 calendar, imported only into the explicitly identified facility.
// Existing source keys are never overwritten, so later owner edits survive repeat imports.
export const importPccaCalendar = internalMutation({
  args: { facilityId: v.id('facilities') },
  handler: async (ctx, { facilityId }) => {
    const facility = await ctx.db.get(facilityId)
    if (facilityId !== 'md71dthy9rnqejp2msa0sjd0sx88whxq' || !facility || facility.slug !== 'pacific-coast-childcare-academy' || !facility.ownerUserId) throw new Error('Expected the Pacific Coast Childcare facility with its owner.')
    const dates = [
      ['2026-09-07', 'Labour Day'], ['2026-09-30', 'National Day for Truth and Reconciliation'],
      ['2026-10-12', 'Thanksgiving'], ['2026-10-31', 'Halloween'], ['2026-11-11', 'Remembrance Day'],
      ['2026-12-24', 'Christmas Eve'], ['2026-12-25', 'Christmas Day'], ['2027-01-01', "New Year's Day"],
      ['2027-02-15', 'Family Day'], ['2027-03-26', 'Good Friday'], ['2027-03-29', 'Easter Monday'],
      ['2027-05-24', 'Victoria Day'], ['2027-07-01', 'Canada Day'], ['2027-08-02', 'BC Day'],
    ]
    const existing = await ctx.db.query('calendarEvents').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const keys = new Set(existing.map(r => r.sourceKey))
    let inserted = 0
    for (const [startDate, title] of dates) {
      const sourceKey = `pcca-calendar-2026-2027:${startDate}`
      if (keys.has(sourceKey)) continue
      await ctx.db.insert('calendarEvents', { facilityId, title, startDate, endDate: startDate, kind: 'closure',
        description: 'Daycare closed. From the PCCA 2026–2027 calendar supplied by the owner.', sourceKey,
        createdBy: facility.ownerUserId, createdAt: Date.now(), updatedAt: Date.now() })
      inserted++
    }
    const sourceKey = 'pcca-calendar-2026-2027:2027-08-20'
    if (!keys.has(sourceKey)) {
      await ctx.db.insert('calendarEvents', { facilityId, title: 'Annual summer party · proposed', startDate: '2027-08-20', endDate: '2027-08-20', kind: 'event',
        description: 'Proposed date. Details will be released 60 days before the event. This is not a daycare closure.', sourceKey,
        createdBy: facility.ownerUserId, createdAt: Date.now(), updatedAt: Date.now() })
      inserted++
    }
    const recognitionKey = 'pcca-teacher-planning-2026-2027:2026-10-21'
    if (!keys.has(recognitionKey)) {
      await ctx.db.insert('calendarEvents', { facilityId, title: 'ECE Appreciation Day', startDate: '2026-10-21', endDate: '2026-10-21', kind: 'event',
        description: 'A recognition day from the teacher planning calendar. This is not a daycare closure.', sourceKey: recognitionKey,
        createdBy: facility.ownerUserId, createdAt: Date.now(), updatedAt: Date.now() })
      inserted++
    }
    const planKey = 'pcca-teacher-planning-2026-2027:october-focus'
    const plans = await ctx.db.query('parentPlans').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    let plansInserted = 0
    if (!plans.some(p => p.sourceKey === planKey)) {
      await ctx.db.insert('parentPlans', { facilityId, title: 'Gratitude & belonging', period: 'month', startDate: '2026-10-01', endDate: '2026-10-31',
        overview: 'October monthly focus: Gratitude & belonging.', activities: 'Make a gratitude tree; invite children to notice kind actions.', goals: '',
        status: 'published', publishedAt: Date.now(), sourceKey: planKey, createdBy: facility.ownerUserId, createdAt: Date.now(), updatedAt: Date.now() })
      plansInserted++
    }
    if (inserted || plansInserted) await recordOwnerEvent(ctx, { facilityId, actorId: facility.ownerUserId, type: 'calendar.imported', summary: `Imported the owner-supplied 2026–2027 PCCA calendar: ${inserted} dates and ${plansInserted} monthly family learning plan. Holiday closures and non-closure recognition/events are marked separately.` })
    return { inserted, alreadyImported: dates.length + 2 - inserted, plansInserted }
  },
})
