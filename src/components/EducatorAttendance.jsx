import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Clock, LogIn, LogOut, ChevronRight, ArrowLeft, Plus, Pencil, Users } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { Card, SectionHeader, Pill, Avatar, StatCard } from './ui.jsx'
import AvatarUpload from './AvatarUpload.jsx'
import { attendanceDay, educatorTodaySeconds, recordedDuration, shiftInputTimestamp, shiftInputValue } from '../lib/staffAttendance.js'

function useAttendanceTick() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  return now
}

function messageFor(error, fallback) {
  if (typeof error?.data === 'string') return error.data
  const message = String(error?.message || '')
  return message && !message.includes('Request ID') && !message.includes('Server Error') ? message : fallback
}

export function EducatorClockButton({ educator, className = '' }) {
  const setClock = useMutation(api.educators.setClock)
  const { pushToast, facility } = useApp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const live = educator.status === 'in'
  const disabled = busy || educator.canClock === false || (educator.accessStatus === 'suspended' && !live) || facility?.isDemo
  const save = async () => {
    if (disabled) return
    setBusy(true); setError('')
    try {
      await setClock({ id: educator.id, status: live ? 'out' : 'in' })
      pushToast(`${educator.name} clocked ${live ? 'out' : 'in'}.`, { emoji: '⏰' })
    } catch (e) { setError(messageFor(e, 'The attendance entry could not be saved. Please try again.')) }
    finally { setBusy(false) }
  }
  return <div className={className}>
    <button type="button" onClick={save} disabled={disabled} className={live ? 'btn-ghost !text-coral-600' : 'btn-primary'} aria-label={`${live ? 'Clock out' : 'Clock in'} ${educator.name}`}>
      {live ? <LogOut size={17} /> : <LogIn size={17} />}{busy ? 'Saving…' : live ? 'Clock out' : 'Clock in'}
    </button>
    {educator.accessStatus === 'suspended' && <p className="mt-2 text-xs text-coral-600">{live ? 'This account is suspended. Close the existing shift with Clock out.' : 'Restore this account’s access before clocking in.'}</p>}
    {error && <p role="alert" className="mt-2 max-w-sm text-sm font-semibold text-coral-700">{error}</p>}
  </div>
}

export function MyEducatorAttendance({ now }) {
  const { educators, educatorsLoading, viewer, facility, isAuthenticated } = useApp()
  const ensureSelf = useMutation(api.educators.ensureSelf)
  const ownRecords = educators.filter(e => e.isCurrentUser || (viewer?.id && e.userId === viewer.id))
  const me = ownRecords.length === 1 ? ownRecords[0] : null
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [selected, setSelected] = useState('')
  const setup = async (args = {}) => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await ensureSelf(args)
      if (result.needsLink) { setCandidates(result.candidates || []); return }
      setCandidates(null)
    } catch (e) { setError(messageFor(e, 'Your attendance record could not be set up. Please try again.')) }
    finally { setBusy(false) }
  }
  if (!isAuthenticated || facility?.isDemo) return null
  if (educatorsLoading) return <Card><p role="status" className="text-sm text-slate-500">Loading your time clock…</p></Card>
  if (ownRecords.length > 1) return <Card><h3 className="text-xl text-slate-800">Review my attendance records</h3><p role="alert" className="mt-2 text-sm text-coral-700">More than one team record is linked to your account. Review the account links below, or ask support to help, before recording your next shift.</p></Card>
  return <Card>
    <h3 className="text-xl text-slate-800">My attendance</h3>
    {me ? <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
      <div><p className="font-bold text-slate-700">{me.name} <span className="font-normal text-slate-500">· {me.room || 'Unassigned'}</span></p><p className="mt-1 text-sm text-slate-500">{me.status === 'in' ? 'Clocked in' : 'Clocked out'} · {recordedDuration(educatorTodaySeconds(me, now))} today</p></div>
      <EducatorClockButton educator={me} />
    </div> : <>
      <p className="mt-2 text-sm text-slate-500">Directors can record their own shifts here. Link your existing team record or create your own attendance record.</p>
      {!candidates && <button type="button" onClick={() => setup()} disabled={busy} className="btn-primary mt-4">{busy ? 'Loading…' : 'Set up my attendance'}</button>}
      {candidates && <div className="mt-4 rounded-2xl border border-line p-4">
        <label className="block text-sm font-bold text-slate-700">My existing team record<select className="input mt-2" value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose your own record</option>{candidates.map(e => <option key={e.id} value={e.id}>{e.name} · {e.role} · {e.room || 'Unassigned'}</option>)}</select></label>
        <p className="mt-2 text-xs text-slate-500">Link only your own record. This connects its attendance and time clock to your sign-in.</p>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-primary" disabled={busy || !selected} onClick={() => setup({ educatorId: selected })}>{busy ? 'Saving…' : 'Link my existing record'}</button><button type="button" className="btn-ghost" disabled={busy} onClick={() => setup({ createNew: true })}>Create my own director record</button></div>
      </div>}
    </>}
    {error && <p role="alert" className="mt-3 text-sm font-semibold text-coral-700">{error}</p>}
  </Card>
}

export function EducatorTeam({ children }) {
  const { educators, facility } = useApp()
  const [selectedId, setSelectedId] = useState(null)
  const [roomFilter, setRoomFilter] = useState('all')
  const now = useAttendanceTick()
  const selected = educators.find(e => e.id === selectedId)
  if (selected) return <EducatorAttendanceDetail key={selected.id} educator={selected} now={now} onBack={() => setSelectedId(null)} />
  const active = educators.filter(e => e.accessStatus !== 'suspended')
  const rooms = [...new Set(educators.map(e => e.room || 'Unassigned'))].sort()
  const visible = educators.filter(e => roomFilter === 'all' || (e.room || 'Unassigned') === roomFilter)
  return <div className="space-y-5">
    <SectionHeader eyebrow="Team" title="Educator attendance" subtitle="Record your own shifts, manage attendance and assign classrooms" />
    <MyEducatorAttendance now={now} />
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <StatCard icon={Users} label="Open shifts" value={educators.filter(e => e.status === 'in').length} gradient="from-mint-400 to-mint-500" />
      <StatCard icon={Clock} label="Team hours today" value={(educators.reduce((total, e) => total + educatorTodaySeconds(e, now), 0) / 3600).toFixed(1)} gradient="from-brand-400 to-brand-600" />
      <StatCard icon={Users} label="Unassigned" value={active.filter(e => !e.room || e.room === 'Unassigned').length} sub="Active records without a classroom" gradient="from-grape-400 to-grape-600" />
    </div>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl text-slate-800">Team attendance & classrooms</h3><p className="mt-1 text-sm text-slate-500">Open a record for classroom assignment, account linking and dated shift history.</p></div><label className="text-sm font-semibold text-slate-600">Classroom<select className="input mt-1 min-w-44" value={roomFilter} onChange={e => setRoomFilter(e.target.value)}><option value="all">All classrooms</option>{rooms.map(room => <option key={room}>{room}</option>)}</select></label></div>
    <Card className="p-0">
      {!visible.length && <p className="p-5 text-sm text-slate-500">No team records in this classroom.</p>}
      {visible.map((e, i) => <div key={e.id} className={`flex flex-wrap items-center gap-3 p-4 ${i ? 'border-t border-line' : ''}`}>
        <button type="button" onClick={() => setSelectedId(e.id)} className="flex min-w-0 w-full items-center gap-3 text-left sm:w-auto sm:flex-1" aria-label={`Manage ${e.name}`}>
          <Avatar emoji={e.emoji} gradient="from-brand-400 to-grape-500" src={e.imageUrl} />
          <div className="min-w-0 flex-1"><p className="truncate font-extrabold text-slate-700">{e.name}{e.isCurrentUser ? ' (you)' : ''}</p><p className="text-xs font-semibold text-slate-500">{e.role} · {e.room || 'Unassigned'}</p><p className="mt-1 text-xs text-slate-500">{recordedDuration(educatorTodaySeconds(e, now))} today · {(Number(e.hoursWeek) || 0).toFixed(1)}h recorded this week</p></div><ChevronRight size={18} className="shrink-0 text-slate-400" />
        </button>
        <Pill className={e.accessStatus === 'suspended' ? 'bg-coral-50 text-coral-700' : e.status === 'in' ? 'bg-mint-400/15 text-mint-600' : 'bg-slate-100 text-slate-500'}>{e.accessStatus === 'suspended' ? 'Account suspended' : e.status === 'in' ? 'Clocked in' : 'Clocked out'}</Pill>
        <EducatorClockButton educator={e} />
      </div>)}
    </Card>
    {facility?.isDemo && <p className="text-sm text-slate-500">Sign in to manage real educator attendance.</p>}
    {children}
  </div>
}

function weekBeginning(day) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return date.toISOString().slice(0, 10)
}

export function EducatorAttendanceDetail({ educator: e, now, onBack }) {
  const { facility, childrenList, educators, viewer, isAuthenticated, setEducatorPhoto, pushToast } = useApp()
  const zone = facility?.timezone || 'America/Vancouver'
  const today = attendanceDay(now, zone)
  const live = isAuthenticated && !facility?.isDemo
  const canManage = live && viewer?.role === 'admin'
  const [from, setFrom] = useState(() => weekBeginning(today))
  const [through, setThrough] = useState(today)
  const rangeDays = (Date.parse(`${through}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 + 1
  const validRange = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(through) && from <= through && rangeDays >= 1 && rangeDays <= 93 && through <= today
  const history = useQuery(api.educators.attendance, live && validRange ? { educatorId: e.id, startDate: from, endDate: through } : 'skip')
  const members = useQuery(api.users.listMembers, live && viewer?.role === 'admin' ? {} : 'skip')
  const assignRoom = useMutation(api.educators.assignRoom)
  const linkAccount = useMutation(api.educators.linkAccount)
  const saveShift = useMutation(api.educators.saveShift)
  const [room, setRoom] = useState(e.room || 'Unassigned')
  const [account, setAccount] = useState(e.userId || '')
  const [linkConfirm, setLinkConfirm] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [errorScope, setErrorScope] = useState('room')
  const [shift, setShift] = useState(null)
  useEffect(() => { setRoom(e.room || 'Unassigned') }, [e.room])
  useEffect(() => { setAccount(e.userId || ''); setLinkConfirm(false) }, [e.userId])
  const rooms = [...new Set(['Unassigned', ...educators.map(row => row.room), ...(childrenList || []).map(row => row.room), ...(history?.rooms || [])].filter(Boolean))].sort()
  const availableAccounts = (members || []).filter(m => ['admin', 'staff'].includes(m.role) && m.accessStatus !== 'suspended' && (!educators.some(row => row.userId === m.id && row.id !== e.id)))
  const save = async (kind) => {
    if (busy) return
    setBusy(kind); setError(''); setErrorScope(kind)
    try {
      if (!canManage) throw new Error('Only the owner or director can make this change.')
      if (kind === 'room') { await assignRoom({ id: e.id, room: room.trim() || 'Unassigned' }); pushToast('Classroom assignment saved.') }
      else if (kind === 'account') { await linkAccount({ id: e.id, ...(account ? { userId: account } : {}) }); setLinkConfirm(false); pushToast(account ? 'Team account linked.' : 'Team account unlinked.') }
      else {
        // Keep untouched punch seconds/milliseconds when the form displays minutes.
        const startedAt = shift.start === shift.originalStartInput && Number.isFinite(shift.originalStartedAt) ? shift.originalStartedAt : shiftInputTimestamp(shift.start, zone)
        const endedAt = shift.end === shift.originalEndInput && Number.isFinite(shift.originalEndedAt) ? shift.originalEndedAt : shiftInputTimestamp(shift.end, zone)
        if (endedAt <= startedAt) throw new Error('Clock-out must be after clock-in.')
        await saveShift({ educatorId: e.id, ...(shift.id ? { id: shift.id } : {}), startedAt, endedAt, reason: shift.reason.trim() })
        setShift(null); pushToast('Shift saved. Recorded hours updated.')
      }
    } catch (err) { setError(messageFor(err, 'This change could not be saved. Check the dates and try again.')) }
    finally { setBusy('') }
  }
  const format = timestamp => new Date(timestamp).toLocaleString('en-CA', { timeZone: zone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return <div className="space-y-5">
    <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-500"><ArrowLeft size={17} /> Back to educators</button>
    <Card>
      <div className="flex flex-wrap items-center gap-4"><AvatarUpload src={e.imageUrl} fallback={e.emoji} size="h-16 w-16" gradient="from-brand-300 to-grape-400" onUpload={file => setEducatorPhoto(e.id, file)} /><div className="min-w-0 flex-1"><h2 className="text-3xl text-slate-800">{e.name}</h2><p className="text-sm text-slate-500">{e.role} · {e.room || 'Unassigned'}</p><p className="mt-1 text-sm font-bold text-slate-600">{e.status === 'in' ? 'Clocked in' : 'Clocked out'} · {recordedDuration(educatorTodaySeconds(e, now))} today</p></div><EducatorClockButton educator={e} /></div>
      <p className="mt-4 text-xs text-slate-500">Attendance times use {zone}. A clock entry records attendance; it does not confirm a staffing ratio.</p>
    </Card>
    {error && errorScope === 'room' && <p role="alert" className="rounded-2xl bg-coral-50 p-4 text-sm font-semibold text-coral-700">{error}</p>}
    <Card><h3 className="text-xl text-slate-800">Classroom assignment</h3><p className="mt-2 text-sm text-slate-500">Choose an existing classroom or enter the exact name of a new classroom.</p><div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-bold text-slate-600">Classroom<input list="educator-room-options" className="input mt-1" maxLength={100} disabled={!canManage || e.accessStatus === 'suspended'} value={room} onChange={event => setRoom(event.target.value)} /><datalist id="educator-room-options">{rooms.map(name => <option key={name} value={name} />)}</datalist></label><button type="button" disabled={!canManage || e.accessStatus === 'suspended' || !!busy || room.trim() === (e.room || 'Unassigned')} onClick={() => save('room')} className="btn-primary">{busy === 'room' ? 'Saving…' : 'Save classroom'}</button><button type="button" disabled={!canManage || e.accessStatus === 'suspended' || !!busy || e.room === 'Unassigned'} onClick={() => { setRoom('Unassigned') }} className="btn-ghost">Choose unassigned</button></div></Card>
    {viewer?.role === 'admin' && <Card><h3 className="text-xl text-slate-800">Sign-in account</h3><p className="mt-2 text-sm text-slate-500">Link the correct account so this person can use their own time clock. Invite a new educator through Account if they have no sign-in yet.</p><label className="mt-4 block text-sm font-bold text-slate-600">Team account<select className="input mt-1" value={account} onChange={event => { setAccount(event.target.value); setLinkConfirm(false) }}><option value="">No linked account</option>{availableAccounts.map(m => <option key={m.id} value={m.id}>{m.name || m.email} · {m.email}</option>)}</select></label><button type="button" className="btn-ghost mt-3" disabled={!live || !!busy || account === (e.userId || '')} onClick={() => { setLinkConfirm(true); setError('') }}>Review account link</button>{linkConfirm && <div className="mt-3 rounded-2xl border border-brand-200 bg-brand-50 p-4"><p className="text-sm text-slate-700">{account ? 'Confirm this is the person whose attendance belongs to this record. The chosen account will see this time clock and its recorded shifts.' : 'Unlinking removes this record from the person’s own time clock. Their login access and attendance history remain unchanged.'}</p>{error && errorScope === 'account' && <p role="alert" className="mt-3 text-sm font-semibold text-coral-700">{error}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!!busy} className="btn-primary" onClick={() => save('account')}>{busy === 'account' ? 'Saving…' : account ? 'Confirm account link' : 'Confirm unlink'}</button><button type="button" disabled={!!busy} className="btn-ghost" onClick={() => setLinkConfirm(false)}>Cancel</button></div></div>}</Card>}
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl text-slate-800">Recorded shifts</h3><p className="mt-2 text-sm text-slate-500">Review dates before using these hours for payroll.</p></div><button type="button" disabled={!canManage || !!busy} className="btn-primary" onClick={() => { setShift({ start: '', end: '', reason: '' }); setError('') }}><Plus size={16} /> Record a past shift</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-slate-600">From<input type="date" className="input mt-1" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="text-sm font-bold text-slate-600">Through<input type="date" className="input mt-1" max={today} value={through} onChange={event => setThrough(event.target.value)} /></label></div>
      {!validRange && <p role="alert" className="mt-3 text-sm text-coral-700">Choose up to 93 days, ending on or before today, with From on or before Through.</p>}
      {!live ? <p className="mt-4 text-sm text-slate-500">Sign in to review recorded shifts.</p> : !validRange ? null : history === undefined ? <p role="status" className="mt-4 text-sm text-slate-500">Loading shifts…</p> : <>
        <p className="mt-4 text-sm font-bold text-brand-700">{(Number(history?.totalHours) || 0).toFixed(2)} recorded hours in this range</p>
        <div className="mt-3 divide-y divide-line">{(history?.sessions || []).map(row => <div key={row.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-700">{format(row.startedAt)} to {row.endedAt ? format(row.endedAt) : 'Still clocked in'}</p><p className="mt-1 text-xs text-slate-500">{recordedDuration((Math.min(row.endedAt || now, now) - row.startedAt) / 1000)}{row.source === 'manual' ? ' · Recorded by a director' : ''}{row.correctionCount ? ` · ${row.correctionCount} correction(s)` : ''}</p></div>{row.endedAt && viewer?.role === 'admin' && <button type="button" className="btn-ghost !px-3 !py-2" disabled={!!busy} onClick={() => { setShift({ id: row.id, start: shiftInputValue(row.startedAt, zone), end: shiftInputValue(row.endedAt, zone), originalStartInput: shiftInputValue(row.startedAt, zone), originalEndInput: shiftInputValue(row.endedAt, zone), originalStartedAt: row.startedAt, originalEndedAt: row.endedAt, reason: '' }); setError('') }}><Pencil size={14} /> Correct</button>}</div>)}</div>
        {!history?.sessions?.length && <p className="mt-4 text-sm text-slate-500">No shifts have been recorded for these dates.</p>}
      </>}
      {shift && <form className="mt-5 rounded-2xl border border-line p-4" onSubmit={async event => { event.preventDefault(); await save('shift') }}><h4 className="font-bold text-slate-700">{shift.id ? 'Correct this closed shift' : 'Record a past shift'}</h4><p className="mt-1 text-xs text-slate-500">Enter the actual worked times in {zone}. Open shifts must be clocked out first.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-600">Clock-in<input type="datetime-local" required className="input mt-1" value={shift.start} onChange={event => setShift(current => ({ ...current, start: event.target.value }))} /></label><label className="text-sm font-semibold text-slate-600">Clock-out<input type="datetime-local" required className="input mt-1" value={shift.end} onChange={event => setShift(current => ({ ...current, end: event.target.value }))} /></label></div><label className="mt-3 block text-sm font-semibold text-slate-600">Reason for this entry or correction<textarea required minLength={3} maxLength={300} className="input mt-1" rows={2} value={shift.reason} onChange={event => setShift(current => ({ ...current, reason: event.target.value }))} placeholder="Explain the missed punch or correction" /></label>{error && errorScope === 'shift' && <p role="alert" className="mt-3 text-sm font-semibold text-coral-700">{error}</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="submit" disabled={!!busy || !shift.start || !shift.end || shift.reason.trim().length < 3} className="btn-primary">{busy === 'shift' ? 'Saving…' : 'Save shift'}</button><button type="button" disabled={!!busy} className="btn-ghost" onClick={() => { setShift(null); setError('') }}>Cancel</button></div></form>}
    </Card>
  </div>
}
