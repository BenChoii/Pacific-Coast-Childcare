import { useEffect, useId, useMemo, useState } from 'react'
import { Clock3, MapPin, Plus, Trash2 } from 'lucide-react'
import { Card, Pill } from './ui.jsx'
import { PlanAttachments } from './PlanAttachments.jsx'
import { SCHEDULE_WEEKDAYS, availableScheduleRooms, classScheduleToday, newScheduleBlock, scheduleAgendaIssues, scheduleDays, scheduleTimeLabel } from '../lib/classSchedule.js'

export function ScheduleAgendaEditor({ value = [], onChange, disabled = false }) {
  const prefix = useId()
  const rows = Array.isArray(value) ? value : []
  const issues = scheduleAgendaIssues(rows)
  const change = (index, key, next) => onChange(rows.map((row, i) => i === index ? { ...row, [key]: next } : row))
  const weekdays = (index, day, checked) => {
    const selected = new Set(scheduleDays(rows[index]))
    if (checked) selected.add(day); else selected.delete(day)
    change(index, 'weekdays', SCHEDULE_WEEKDAYS.filter(name => selected.has(name)))
  }
  return <section className="space-y-3" aria-labelledby={prefix + '-title'}>
    <div><h4 id={prefix + '-title'} className="font-bold text-slate-800">Daily time blocks</h4><p className="mt-1 text-sm text-slate-500">Give each activity a start, end and planned location. Families can see the scheduled activity now and what comes next. Times use the daycare’s timezone. Set weekdays separately for activities that change through the week.</p></div>
    {!rows.length && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No timed activities yet. Add blocks to make this schedule useful throughout the day. An attached photo or PDF can still provide the full program.</p>}
    {rows.map((row, index) => <fieldset key={index} disabled={disabled} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-tint/40 p-4">
      <legend className="px-1 text-sm font-bold text-slate-600">Activity {index + 1}</legend>
      <div className="flex items-start justify-between gap-3"><label className="min-w-0 flex-1 text-sm font-semibold">Activity<input className="input mt-1" value={row.title || ''} maxLength={160} required onChange={event => change(index, 'title', event.target.value)} placeholder="Rest & recharge" /></label><button type="button" disabled={disabled} className="mt-5 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-coral-600 hover:bg-coral-50" aria-label={`Remove activity ${index + 1}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}><Trash2 size={17} /></button></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Starts<input className="input mt-1" type="time" value={row.startTime || ''} required onChange={event => change(index, 'startTime', event.target.value)} /></label><label className="text-sm font-semibold">Ends<input className="input mt-1" type="time" value={row.endTime || ''} required onChange={event => change(index, 'endTime', event.target.value)} /></label></div>
      <label className="block text-sm font-semibold">Planned location<input className="input mt-1" value={row.location || ''} maxLength={100} onChange={event => change(index, 'location', event.target.value)} placeholder="Rest area, classroom or outdoor play area" /></label>
      <fieldset><legend className="text-sm font-semibold">Weekdays</legend><div className="mt-1 flex flex-wrap gap-2">{SCHEDULE_WEEKDAYS.map(day => <label key={day} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm"><input type="checkbox" checked={scheduleDays(row).includes(day)} onChange={event => weekdays(index, day, event.target.checked)} /><span>{day}</span></label>)}</div></fieldset>
      <label className="block text-sm font-semibold">Details for families<textarea className="input mt-1" rows={2} value={row.detail || ''} maxLength={1500} onChange={event => change(index, 'detail', event.target.value)} placeholder="What children will explore, practise or learn" /></label>
    </fieldset>)}
    {issues.length > 0 && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Complete these details before saving</p><ul className="mt-1 list-disc space-y-1 pl-5">{issues.slice(0, 5).map((issue, index) => <li key={index}>{issue}</li>)}{issues.length > 5 && <li>Review the remaining activities for missing or overlapping times.</li>}</ul></div>}
    <button type="button" disabled={disabled || rows.length >= 50} className="btn-ghost" onClick={() => onChange([...rows, newScheduleBlock(rows)])}><Plus size={16} />Add time block</button>
  </section>
}

function ScheduleBlock({ block, room, current = false, preview = false }) {
  return <li className={`min-w-0 rounded-xl border p-3 ${current ? 'border-brand-200 bg-brand-50' : 'border-line bg-white'}`} aria-current={current ? 'step' : undefined}>
    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-slate-700">{scheduleTimeLabel(block.startTime)} – {scheduleTimeLabel(block.endTime)}</span>{current && <Pill className="bg-brand-100 text-brand-700">Scheduled now</Pill>}{preview && <span className="text-xs text-slate-500">{block.weekdays.join(', ')}</span>}</div>
    <h4 className="mt-1 font-bold text-slate-800">{block.title}</h4>
    {(block.location || room) && <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={14} className="shrink-0" />Planned location: {block.location || room}</p>}
    {block.detail && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{block.detail}</p>}
  </li>
}

export function ClassScheduleNow({ plans = [], timeZone = 'America/Vancouver', room, rooms = [], initialRoom, events = [], className = '', preview = false, showTimeline = false, showAttachments = false, now: fixedNow }) {
  const [clock, setClock] = useState(() => fixedNow ?? Date.now())
  const [selectedRoom, setSelectedRoom] = useState(initialRoom || '')
  useEffect(() => { if (initialRoom && initialRoom !== 'Unassigned') setSelectedRoom(current => current || initialRoom) }, [initialRoom])
  useEffect(() => {
    if (fixedNow !== undefined || preview) return
    const interval = setInterval(() => setClock(Date.now()), 30_000)
    const refresh = () => setClock(Date.now())
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh) }
  }, [fixedNow, preview])
  const options = useMemo(() => availableScheduleRooms(plans, rooms), [plans, rooms])
  const explicitRoom = room && room !== 'Unassigned' ? room : undefined
  const chosenRoom = explicitRoom || (options.includes(selectedRoom) ? selectedRoom : undefined)
  const state = classScheduleToday(plans, { now: fixedNow ?? clock, timeZone, room: chosenRoom, events, rooms, preview, showTimeline })
  const staticProgram = preview || state.state === 'planned'
  return <Card className={className}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xl text-slate-800"><Clock3 size={20} className="shrink-0 text-brand-500" />{preview ? 'Schedule preview' : 'Class schedule'}</h3><p className="mt-1 text-sm text-slate-500">{preview ? 'This preview shows the planned blocks. Publish the update for families to see it.' : state.state === 'planned' ? `${state.plan.startDate} through ${state.plan.endDate} · ${state.timeZone}` : `${state.date} · ${state.timeZone}`}</p></div>{state.room && <Pill className="bg-slate-100 text-slate-600">{state.room}</Pill>}</div>
    {!preview && !explicitRoom && options.length > 1 && <label className="mt-4 block text-sm font-semibold">Class<select className="input mt-1" value={selectedRoom} onChange={event => setSelectedRoom(event.target.value)}><option value="">Choose a class</option>{options.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}
    {state.state === 'choose-room' ? <p className="mt-4 text-sm text-slate-500">Choose a class to see its daily plan and any closure that applies.</p> : state.state === 'closed' ? <div className="mt-4 rounded-xl border border-coral-200 bg-coral-50 p-4"><p className="font-bold text-coral-800">Closed today: {state.closure.title}</p><p className="mt-1 text-sm text-coral-700">Do not attend during this closure. The normal class schedule is paused.</p>{state.closure.description && <p className="mt-2 whitespace-pre-wrap text-sm text-coral-700">{state.closure.description}</p>}</div> : <>
      {!preview && state.current && <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-brand-700">Scheduled now</p><h4 className="mt-2 text-xl text-slate-800">{state.current.title}</h4><p className="mt-1 text-sm font-bold text-slate-600">{scheduleTimeLabel(state.current.startTime)} – {scheduleTimeLabel(state.current.endTime)}</p><p className="mt-2 text-sm text-slate-600">Planned location: {state.current.location || state.room || 'Ask your daycare'}</p>{state.next && <p className="mt-3 border-t border-brand-100 pt-3 text-sm text-slate-600"><strong>Up next:</strong> {state.next.title} at {scheduleTimeLabel(state.next.startTime)}</p>}</div>}
      {!preview && !state.current && state.next && <p className="mt-4 rounded-xl bg-tint p-4 text-sm text-slate-700"><strong>Next scheduled activity:</strong> {state.next.title} at {scheduleTimeLabel(state.next.startTime)}. No activity is scheduled for the current time.</p>}
      {!preview && state.state === 'finished' && <p className="mt-4 text-sm text-slate-500">Today’s scheduled activities have finished.</p>}
      {!state.timeline.length && <p className="mt-4 text-sm text-slate-500">{preview ? 'Add time blocks to preview the daily program here.' : state.plan ? 'Your daycare has shared a class program without timed activities. Read the program or attached files for details; an activity for right now cannot be shown yet.' : 'No timed class schedule has been published for today. Your daycare can add one through Curriculum and family updates.'}</p>}
      {!state.timeline.length && state.plan?.overview && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{state.plan.overview}</p>}
      {state.timeline.length > 0 && <div className="mt-5"><h4 className="mb-3 text-sm font-bold text-slate-600">{staticProgram ? 'Planned activities' : 'Today’s timeline'}</h4><ol className="space-y-2">{state.timeline.map((block, index) => <ScheduleBlock key={`${block.startTime}-${index}`} block={block} room={state.room} current={!staticProgram && state.current?.index === block.index} preview={staticProgram} />)}</ol></div>}
      {showAttachments && state.plan?.attachments?.length > 0 && <PlanAttachments attachments={state.plan.attachments} />}
    </>}
    <p className="mt-4 text-xs text-slate-500">This is the planned class program. It does not confirm a child’s actual attendance or live location.</p>
  </Card>
}
