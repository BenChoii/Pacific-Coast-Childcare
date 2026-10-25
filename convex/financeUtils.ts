// Currency is persisted in the existing dollar fields for API compatibility,
// but every calculation crosses this integer-cent boundary exactly once.
export function cents(value: number, label = 'Amount') {
  if (!Number.isFinite(value) || Math.abs(value) > 10_000_000) throw new Error(`${label} must be a finite amount within the supported limit.`)
  return Math.round((value + Math.sign(value || 1) * Number.EPSILON) * 100)
}
export function dollars(value: number) { return value / 100 }
export function validDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
export function localDate(now = Date.now(), zone = 'America/Vancouver') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function nextDate(day: string, delta = 1) {
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + delta); return date.toISOString().slice(0, 10)
}
export function dateRange(start: string, end: string) {
  if (!validDate(start) || !validDate(end) || start > end || Date.parse(end) - Date.parse(start) > 366 * 86_400_000) throw new Error('Choose a valid date range of no more than one year.')
}
export function monthBounds(period: string, fallback = localDate()) {
  let month = /^\d{4}-\d{2}(?:-\d{2})?$/.test(period) ? period.slice(0, 7) : ''
  if (!month) {
    const match = period.trim().match(/^([A-Za-z]+)\s+(\d{4})$/)
    const names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const i = match ? names.indexOf(match[1].slice(0, 3).toLowerCase()) : -1
    if (match && i >= 0) month = `${match[2]}-${String(i + 1).padStart(2, '0')}`
  }
  const start = `${month || fallback.slice(0, 7)}-01`
  if (!validDate(start)) throw new Error('Choose a valid invoice month.')
  const next = new Date(`${start}T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1); next.setUTCDate(0)
  return { start, end: next.toISOString().slice(0, 10) }
}
export function dayStart(day: string, zone = 'America/Vancouver') {
  if (!validDate(day)) throw new Error('Choose a valid date.')
  const target = Date.parse(`${day}T00:00:00Z`)
  let guess = target
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(formatter.formatToParts(guess).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]))
    const displayed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    const corrected = target - (displayed - guess)
    if (corrected === guess) break
    guess = corrected
  }
  return guess
}
export function weekStart(day: string) { const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); return nextDate(day, -((weekday + 6) % 7)) }
export function sessionSeconds(sessions: any[], start: number, end: number, now = Date.now(), closedOnly = false) {
  return sessions.reduce((sum, row) => {
    if (closedOnly && row.endedAt === undefined) return sum
    const finish = Math.min(row.endedAt ?? now, end, now)
    return sum + Math.max(0, finish - Math.max(row.startedAt, start)) / 1000
  }, 0)
}

// Only our own application may receive payment callbacks.
export function paymentOrigin(requested: string) {
  const configured = process.env.SITE_URL || 'https://mitten.care'
  const url = new URL(requested)
  const trusted = new URL(configured).origin
  if (url.origin !== trusted && url.origin !== 'https://mitten.care' && url.origin !== 'https://www.mitten.care' && !(process.env.NODE_ENV === 'development' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Invalid payment return address.')
  return url.origin
}
