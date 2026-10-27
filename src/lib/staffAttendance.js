export function attendanceDay(timestamp = Date.now(), timeZone = 'America/Vancouver') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp))
  const get = type => parts.find(part => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function shiftInputValue(timestamp, timeZone = 'America/Vancouver') {
  if (!Number.isFinite(timestamp)) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp))
  const get = type => parts.find(part => part.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

// datetime-local has no zone. Resolve it against the daycare's zone rather
// than the phone's zone, and refuse ambiguous/skipped daylight-saving times.
export function shiftInputTimestamp(value, timeZone = 'America/Vancouver') {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) throw new Error('Enter a complete shift date and time.')
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const desired = Date.UTC(year, month - 1, day, hour, minute)
  const roundTrip = new Date(desired)
  if (year < 2000 || year > 2200 || roundTrip.getUTCFullYear() !== year || roundTrip.getUTCMonth() !== month - 1 || roundTrip.getUTCDate() !== day || hour > 23 || minute > 59) throw new Error('Enter a valid shift date and time.')
  const offsets = new Set([-86400000, 0, 86400000].map(delta => {
    const sample = desired + delta
    const local = shiftInputValue(sample, timeZone)
    const p = local.match(/^(\d+)-(\d+)-(\d+)T(\d+):(\d+)$/).slice(1).map(Number)
    return Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4]) - sample
  }))
  const candidates = [...offsets].map(offset => desired - offset).filter(timestamp => shiftInputValue(timestamp, timeZone) === value)
  if (candidates.length !== 1) throw new Error('This time is skipped or repeated during daylight saving. Choose an unambiguous local time.')
  return candidates[0]
}

export function recordedDuration(seconds = 0) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(total / 3600)}h ${Math.floor(total % 3600 / 60)}m`
}

export function educatorTodaySeconds(educator, now = Date.now()) {
  return (Number(educator.todaySeconds) || 0) + (educator.status === 'in' && Number.isFinite(educator.clockInAt) ? Math.max(0, now - educator.clockInAt) / 1000 : 0)
}
