import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { CalendarDays, Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { Card, SectionHeader, Pill } from '../components/ui.jsx'
import { dayKey } from '../lib/careData.js'

export function localDateLabel(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}
export function CalendarEntry({ event, actions }) {
  const closed = event.kind !== 'event'
  return <Card className={closed ? 'border-coral-200 bg-coral-50/40' : ''}>
    <div className="flex items-start justify-between gap-3">
      <div><div className="mb-2"><Pill className={closed ? 'bg-coral-100 text-coral-700' : 'bg-brand-100 text-brand-700'}>{closed ? 'Closed · do not attend' : 'Event'}</Pill></div>
        <h3 className="text-xl text-slate-800">{event.title}</h3>
        <p className="mt-1 text-sm font-bold text-slate-700">{localDateLabel(event.startDate)}{event.endDate !== event.startDate ? ` – ${localDateLabel(event.endDate)}` : ''}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{event.room || 'All rooms'}</p>
      </div>{actions}
    </div>
    {event.description && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{event.description}</p>}
  </Card>
}
const blank = { title: '', startDate: '', endDate: '', kind: 'closure', description: '', room: '' }
export function MonthCalendar({events=[],attendanceDays}) {
  const {facility}=useApp()
  const today=dayKey(Date.now(),facility?.timezone)
  const [month,setMonth]=useState(today.slice(0,7)),[selected,setSelected]=useState(today)
  const first=new Date(month+'-01T12:00:00Z')
  const length=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate()
  const offset=(first.getUTCDay()+6)%7
  const labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const changeMonth=step=>{const date=new Date(first);date.setUTCMonth(date.getUTCMonth()+step);setMonth(date.toISOString().slice(0,7))}
  const selectedEvents=events.filter(event=>event.startDate<=selected&&event.endDate>=selected)
  return <Card><div className="mb-4 flex items-center justify-between gap-2"><button className="btn-ghost !px-3" aria-label="Previous month" onClick={()=>changeMonth(-1)}>←</button><h3 className="text-center text-xl">{first.toLocaleDateString('en-CA',{month:'long',year:'numeric',timeZone:'UTC'})}</h3><button className="btn-ghost !px-3" aria-label="Next month" onClick={()=>changeMonth(1)}>→</button></div><div className="grid grid-cols-7 gap-1 text-center">{labels.map(label=><span key={label} className="pb-2 text-[11px] font-bold text-slate-500">{label}</span>)}{Array.from({length:offset},(_,index)=><span key={'empty'+index}/>)}{Array.from({length},(_,index)=>{
    const date=month+'-'+String(index+1).padStart(2,'0'),matches=events.filter(event=>event.startDate<=date&&event.endDate>=date),closed=matches.some(event=>event.kind!=='event'),regular=attendanceDays?.includes(labels[(offset+index)%7])
    return <button key={date} aria-label={`${date}${closed?', closure':''}${regular?', regular attendance day':''}${matches.length?', '+matches.map(e=>e.title).join(', '):''}`} aria-pressed={date===selected} onClick={()=>setSelected(date)} className={`flex min-h-[54px] min-w-0 flex-col items-center justify-center rounded-xl border px-0.5 py-2 text-sm ${date===selected?'ring-2 ring-brand-500':''} ${closed?'border-coral-200 bg-coral-50 text-coral-700':regular?'border-mint-200 bg-mint-50 text-mint-800':'border-line bg-white text-slate-600'}`}><strong className={date===today?'underline underline-offset-4':''}>{index+1}</strong>{closed?<span className="text-[9px] font-bold">Closed</span>:matches.length>0?<span className="text-[9px] font-bold text-brand-600">Event</span>:regular?<span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-mint-500"/>:null}</button>
  })}</div><p className="mt-3 text-xs text-slate-500">Red: closure · Blue: event{attendanceDays?' · Green: regular attendance':''}. Select a day for details.</p><div className="mt-4 border-t border-line pt-4"><h4 className="font-bold">{localDateLabel(selected)}</h4>{selectedEvents.length?selectedEvents.map(event=><div key={event.id} className="mt-2 text-sm"><strong>{event.kind==='event'?'Event: ':'Closed: '}{event.title}</strong>{event.room&&<span> · {event.room}</span>}{event.description&&<p className="mt-1 whitespace-pre-wrap text-slate-500">{event.description}</p>}</div>):<p className="mt-2 text-sm text-slate-500">No event or closure has been posted for this day. Follow your child’s regular attendance agreement.</p>}</div></Card>
}
export function DirectorCalendar() {
  const events = useQuery(api.calendar.list, {})
  const save = useMutation(api.calendar.save)
  const remove = useMutation(api.calendar.remove)
  const { pushToast,facility } = useApp()
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = key => e => setForm({ ...form, [key]: e.target.value })
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await save({ ...(form.id ? { id: form.id } : {}), title: form.title, startDate: form.startDate, endDate: form.endDate || form.startDate, kind: form.kind, description: form.description, room: form.room || undefined })
      setForm(null); pushToast('Calendar updated for families', { emoji: '📅', tone: 'mint' })
    } catch (err) { setError(err.message || 'Could not save this date.') } finally { setBusy(false) }
  }
  const erase = async event => {
    if (!window.confirm(`Remove “${event.title}” from the family calendar?`)) return
    try { await remove({ id: event.id }); pushToast('Calendar entry removed', { emoji: '📅' }) }
    catch (err) { setError(err.message || 'Could not remove this entry.') }
  }
  const today = dayKey(Date.now(),facility?.timezone)
  const [showPast, setShowPast] = useState(false)
  const visible = (events || []).filter(e => showPast || e.endDate >= today)
  return <div className="space-y-5">
    <SectionHeader eyebrow="Family communication" title="Calendar & closures" subtitle="Set the dates families need to know, including holidays and days the daycare is closed." action={<button onClick={() => { setForm({ ...blank }); setError('') }} className="btn-primary"><Plus size={16} /> Add date</button>} />
    {error && <p role="alert" className="rounded-xl bg-coral-50 p-3 text-sm text-coral-700">{error}</p>}
    {events && <MonthCalendar events={events}/>}
    {form && <Card><form className="space-y-3" onSubmit={submit}>
      <div className="flex justify-between"><h3 className="text-xl">{form.id ? 'Edit calendar date' : 'New calendar date'}</h3><button type="button" onClick={() => setForm(null)} aria-label="Close calendar editor"><X size={18} /></button></div>
      <label className="block text-sm font-semibold">Title<input className="input mt-1" required maxLength={160} value={form.title} onChange={set('title')} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Start date<input className="input mt-1" type="date" required value={form.startDate} onChange={set('startDate')} /></label><label className="text-sm font-semibold">End date<input className="input mt-1" type="date" min={form.startDate} value={form.endDate} onChange={set('endDate')} /><span className="text-xs text-slate-400">Leave empty for a single day.</span></label></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Type<select className="input mt-1" value={form.kind} onChange={set('kind')}><option value="closure">Daycare closure</option><option value="holiday">Holiday · closed</option><option value="event">Family / program event</option></select></label><label className="text-sm font-semibold">Room<input className="input mt-1" maxLength={100} value={form.room} onChange={set('room')} placeholder="Leave empty for all rooms" /></label></div>
      <label className="block text-sm font-semibold">Details for parents<textarea className="input mt-1" rows={3} maxLength={5000} value={form.description} onChange={set('description')} /></label>
      <button className="btn-primary" disabled={busy}><Save size={16} />{busy ? 'Saving…' : 'Save to family calendar'}</button>
    </form></Card>}
    <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} />Show past dates</label>
    {events === undefined ? <p className="text-sm text-slate-500">Loading calendar…</p> : !visible.length ? <Card><CalendarDays className="mb-2 text-brand-500" /><p className="text-sm text-slate-600">No {showPast ? '' : 'upcoming '}dates yet. Add a closure, holiday or event for families.</p></Card> : <div className="grid gap-3">{visible.map(event => <CalendarEntry key={event.id} event={event} actions={<div className="flex gap-1"><button aria-label={`Edit ${event.title}`} onClick={() => { setForm({ ...blank, ...event, room: event.room || '' }); setError('') }} className="rounded-lg p-2 text-brand-600"><Pencil size={16} /></button><button aria-label={`Remove ${event.title}`} onClick={() => erase(event)} className="rounded-lg p-2 text-coral-600"><Trash2 size={16} /></button></div>} />)}</div>}
  </div>
}
