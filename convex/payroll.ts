import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireFacility } from './lib'
import { cents, dollars, dateRange, dayStart, localDate, nextDate, sessionSeconds, weekStart } from './financeUtils'
import { recordOwnerEvent } from './notifications'

// ── Payroll: GROSS-PAY PREP ONLY ───────────────────────────────────────────
// This computes gross pay, overtime, stat-holiday pay and vacation accrual from
// owner-confirmed hours, and saves a run + stubs. It deliberately does NOT
// calculate or remit CPP/EI/income tax, and it never moves money. The owner is
// responsible for deductions + CRA remittance (or hands these stubs to a
// licensed payroll provider). Keep math identical to the client preview in
// src/views/payroll.jsx.

const PERIODS_PER_YEAR: Record<string, number> = { weekly: 52, biweekly: 26, semimonthly: 24 }
const OT_MULTIPLIER = 1.5
const r2 = (n: number) => dollars(cents(n))
function nonnegative(value: number, label: string, max = 10_000_000) { if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`${label} must be a valid nonnegative number.`); return value }

async function requireAdminFacility(ctx: any) {
  const ctxFac = await requireFacility(ctx)
  if (ctxFac.user.role !== 'admin') throw new Error('Only the owner/director can run payroll.')
  return ctxFac
}

// One stub line's gross + vacation from an educator's rate and confirmed hours.
function computeLine(ed: any, input: { regularHours: number; otHours: number; statPay: number }, payPeriod: string) {
  const payType = ed.payType === 'salary' ? 'salary' : 'hourly'
  const rate = Math.max(0, ed.payRate || 0)
  const vacationPct = ed.vacationPct === 6 ? 6 : 4
  const regularHours = Math.max(0, input.regularHours || 0)
  const otHours = Math.max(0, input.otHours || 0)
  const statPay = Math.max(0, input.statPay || 0)
  let gross: number
  if (payType === 'salary') {
    gross = rate / (PERIODS_PER_YEAR[payPeriod] || 26) + statPay
  } else {
    gross = regularHours * rate + otHours * rate * OT_MULTIPLIER + statPay
  }
  gross = r2(gross)
  return {
    educatorId: ed._id,
    name: ed.name,
    role: ed.role,
    payType,
    rate,
    regularHours,
    otHours,
    statPay,
    gross,
    vacationPct,
    vacationAccrued: r2(gross * (vacationPct / 100)),
  }
}

// Pay setup screen: facility pay period + each educator's pay config.
export const settings = query({
  args: {},
  handler: async (ctx) => {
    const { facility, facilityId } = await requireAdminFacility(ctx)
    const educators = await ctx.db
      .query('educators')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .collect()
    const now = Date.now(), zone = facility.timezone || 'America/Vancouver'
    const sessions = await ctx.db.query('clockSessions').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const start = dayStart(weekStart(localDate(now, zone)), zone)
    return {
      payPeriod: facility.payPeriod || 'biweekly',
      educators: educators.map((e) => ({
        _id: e._id,
        name: e.name,
        role: e.role,
        emoji: e.emoji,
        hoursWeek: facility.isDemo && !sessions.length ? e.hoursWeek : sessionSeconds(sessions.filter(row => row.educatorId === e._id), start, now, now) / 3600,
        payType: e.payType ?? null,
        payRate: e.payRate ?? null,
        vacationPct: e.vacationPct ?? null,
      })),
    }
  },
})

export const setPayPeriod = mutation({
  args: { payPeriod: v.string() },
  handler: async (ctx, { payPeriod }) => {
    const { facilityId } = await requireAdminFacility(ctx)
    if (!PERIODS_PER_YEAR[payPeriod]) throw new Error('Invalid pay period')
    await ctx.db.patch(facilityId, { payPeriod })
    await recordOwnerEvent(ctx, { facilityId, type: 'payroll_settings_updated', summary: 'The payroll frequency was updated.' })
  },
})

export const setEducatorPay = mutation({
  args: {
    educatorId: v.id('educators'),
    payType: v.string(),
    payRate: v.number(),
    vacationPct: v.number(),
  },
  handler: async (ctx, { educatorId, payType, payRate, vacationPct }) => {
    const { facilityId } = await requireAdminFacility(ctx)
    const ed = await ctx.db.get(educatorId)
    if (!ed || ed.facilityId !== facilityId) throw new Error('Educator not found.')
    if (payType !== 'hourly' && payType !== 'salary') throw new Error('Invalid pay type')
    await ctx.db.patch(educatorId, {
      payType,
      payRate: r2(nonnegative(payRate, 'Pay rate')),
      vacationPct: vacationPct === 6 ? 6 : 4,
    })
    await recordOwnerEvent(ctx, { facilityId, type: 'educator_pay_updated', summary: 'Educator pay settings were updated.' })
  },
})

// Compute a run from owner-confirmed hours and save it (with per-educator stubs).
export const runPayroll = mutation({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
    note: v.optional(v.string()),
    entries: v.array(
      v.object({
        educatorId: v.id('educators'),
        regularHours: v.number(),
        otHours: v.number(),
        statPay: v.number(),
      }),
    ),
  },
  handler: async (ctx, { periodStart, periodEnd, note, entries }) => {
    const { facility, facilityId, user } = await requireAdminFacility(ctx)
    dateRange(periodStart, periodEnd)
    if (!entries.length || entries.length > 500 || new Set(entries.map(row => row.educatorId)).size !== entries.length) throw new Error('Choose distinct educators for this run.')
    const existing = await ctx.db.query('payRuns').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    if (existing.some(run => run.status !== 'void' && run.periodStart <= periodEnd && run.periodEnd >= periodStart)) throw new Error('An active payroll run already covers some or all of these dates. Void it before replacing it.')
    const payPeriod = facility.payPeriod || 'biweekly'
    const maxHours = (Math.round((Date.parse(periodEnd) - Date.parse(periodStart)) / 86400000) + 1) * 24
    const lines = []
    for (const entry of entries) {
      const ed = await ctx.db.get(entry.educatorId)
      if (!ed || ed.facilityId !== facilityId) throw new Error('Educator not found.')
      nonnegative(entry.regularHours, 'Regular hours', maxHours); nonnegative(entry.otHours, 'Overtime hours', maxHours); nonnegative(entry.statPay, 'Stat pay')
      if (entry.regularHours + entry.otHours > maxHours) throw new Error('Hours exceed the available time in this period.')
      nonnegative(ed.payRate || 0, 'Pay rate')
      if (!ed.payRate) continue // skip anyone without pay set up
      lines.push(computeLine(ed, entry, payPeriod))
    }
    if (lines.length === 0) throw new Error('No educators with pay set up to run.')
    const totalGross = r2(lines.reduce((s, l) => s + l.gross, 0))
    const totalVacation = r2(lines.reduce((s, l) => s + l.vacationAccrued, 0))
    const runId = await ctx.db.insert('payRuns', {
      facilityId,
      periodStart,
      periodEnd,
      payPeriod,
      createdAt: Date.now(),
      createdByName: user.name ?? 'Owner',
      note,
      totalGross,
      totalVacation,
      headcount: lines.length,
      status: 'recorded',
      lines,
    })
    await recordOwnerEvent(ctx, { facilityId, type: 'payroll_recorded', summary: 'A gross-pay preparation run was recorded.' })
    return { runId, totalGross, totalVacation, headcount: lines.length }
  },
})

export const listRuns = query({
  args: { includeVoided: v.optional(v.boolean()) },
  handler: async (ctx, { includeVoided }) => {
    const { facilityId } = await requireAdminFacility(ctx)
    const runs = await ctx.db
      .query('payRuns')
      .withIndex('by_facility', (q) => q.eq('facilityId', facilityId))
      .order('desc')
      .collect()
    return includeVoided ? runs : runs.filter(run => run.status !== 'void')
  },
})

export const getRun = query({
  args: { runId: v.id('payRuns') },
  handler: async (ctx, { runId }) => {
    const { facilityId } = await requireAdminFacility(ctx)
    const run = await ctx.db.get(runId)
    if (!run || run.facilityId !== facilityId) return null
    return run
  },
})

export const deleteRun = mutation({
  args: { runId: v.id('payRuns') },
  handler: async (ctx, { runId }) => {
    const { facilityId } = await requireAdminFacility(ctx)
    const run = await ctx.db.get(runId)
    if (!run || run.facilityId !== facilityId) throw new Error('Run not found.')
    if (run.status === 'void') return
    await ctx.db.patch(runId, { status: 'void', voidedAt: Date.now(), voidReason: 'Voided by director' })
    await recordOwnerEvent(ctx, { facilityId, type: 'payroll_voided', summary: 'A gross-pay preparation run was voided. Its history is preserved.' })
  },
})

// Actual recorded shift hours for the selected inclusive local-date period.
// These are suggestions only; the director confirms regular/OT allocation.
export const hoursForPeriod = query({
  args: { periodStart: v.string(), periodEnd: v.string() },
  handler: async (ctx, { periodStart, periodEnd }) => {
    const { facility, facilityId } = await requireAdminFacility(ctx)
    dateRange(periodStart, periodEnd)
    const zone = facility.timezone || 'America/Vancouver', now = Date.now()
    const start = dayStart(periodStart, zone), end = dayStart(nextDate(periodEnd), zone)
    const sessions = await ctx.db.query('clockSessions').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    const educators = await ctx.db.query('educators').withIndex('by_facility', q => q.eq('facilityId', facilityId)).collect()
    return educators.map(educator => {
      const hours = Math.round(sessionSeconds(sessions.filter(session => session.educatorId === educator._id), start, end, now) / 36) / 100
      return { educatorId: educator._id, hours, regularHours: hours, otHours: 0 }
    })
  },
})
