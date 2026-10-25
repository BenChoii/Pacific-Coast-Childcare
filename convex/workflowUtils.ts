import type {Doc} from './_generated/dataModel'
import { childBelongsToParent } from './lib'

export const DEFAULT_TIMEZONE = 'America/Vancouver'
export function timezone(facility: any) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: facility?.timezone || DEFAULT_TIMEZONE }).format(); return facility?.timezone || DEFAULT_TIMEZONE }
  catch { return DEFAULT_TIMEZONE }
}
export function localDate(at: number = Date.now(), facility?: any) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone(facility), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at)
  const get = (type: string) => parts.find(p => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function displayTime(at: number = Date.now(), facility?: any) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone(facility), hour: 'numeric', minute: '2-digit' }).format(at)
}
export function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
}
export function checkedDate(value?: string, facility?: any) {
  const date = value || localDate(Date.now(), facility)
  if (!validDate(date)) throw new Error('Choose a valid calendar date.')
  return date
}
export function boundedLimit(value: number | undefined, fallback = 100, maximum = 500) {
  if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > maximum)) throw new Error(`Choose a limit between 1 and ${maximum}.`)
  return value ?? fallback
}
export function cleanText(value: string, label: string, max = 1000, required = false) {
  const text = value.trim()
  if ((required && !text) || text.length > max) throw new Error(`${label}${required ? ' is required and' : ''} must be at most ${max} characters.`)
  return text
}
export async function facilityChildren(ctx: any, facilityId: any):Promise<Doc<'children'>[]> {
  return await ctx.db.query('children').withIndex('by_facility', (q: any) => q.eq('facilityId', facilityId)).collect()
}
export function visibleChildren(kids: any[], user: any, uid: any) {
  return kids.filter(child => !child.archivedAt && (user?.role !== 'parent' || childBelongsToParent(child, uid)))
}
export async function authorizedChild(ctx: any, childId: any, facilityId: any, user?: any, uid?: any) {
  const child = await ctx.db.get(childId)
  if (!child || child.archivedAt || child.facilityId !== facilityId || (user?.role === 'parent' && !childBelongsToParent(child, uid))) throw new Error('Active child not found.')
  return child
}
export function relativeTime(createdAt: number, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - createdAt) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
  return new Date(createdAt).toLocaleDateString('en-CA')
}

// UTC bounds for a facility-local date, including 23/25-hour DST days. This
// keeps legacy timestamped records filterable without inventing a UTC day.
export function dateWindow(date: string, facility?: any) {
  if (!validDate(date)) throw new Error('Choose a valid calendar date.')
  const center = Date.parse(`${date}T12:00:00Z`)
  let low = center - 48 * 3600000, high = center + 48 * 3600000
  while (high - low > 1) { const mid = Math.floor((low + high) / 2); if (localDate(mid, facility) < date) low = mid; else high = mid }
  const start = high
  low = start; high = center + 72 * 3600000
  while (high - low > 1) { const mid = Math.floor((low + high) / 2); if (localDate(mid, facility) <= date) low = mid; else high = mid }
  return { start, end: high }
}
