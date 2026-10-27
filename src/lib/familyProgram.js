const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00Z')) && new Date(value + 'T12:00Z').toISOString().slice(0, 10) === value

// Start with server permission-filtered plans. A daily schedule takes priority
// over a learning attachment; within each kind, prefer the child's own class.
export function dashboardProgram(plans = [], { date, room } = {}) {
  if (!validDate(date)) return null
  const applicable = plans.filter(plan => plan.status === 'published' && validDate(plan.startDate) && validDate(plan.endDate) && plan.startDate <= date && date <= plan.endDate && (!plan.room || plan.room === room) && plan.attachments?.length)
  const schedule = plan => plan.kind === 'schedule' || !!plan.agenda?.length
  applicable.sort((a, b) => Number(schedule(b)) - Number(schedule(a)) || Number(!!b.room) - Number(!!a.room) || b.startDate.localeCompare(a.startDate) || (b.publishedAt || b.updatedAt || b.createdAt || 0) - (a.publishedAt || a.updatedAt || a.createdAt || 0) || String(b.id || '').localeCompare(String(a.id || '')))
  return applicable[0] || null
}
