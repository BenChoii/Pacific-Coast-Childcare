import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { dayKey } from '../lib/careData.js'
import {
  Users, Moon, UserX, Scale, QrCode, LogIn, LogOut, Smile, Apple, BookOpen,
  Camera, MessageCircle, Plus, Check, Sparkles, ClipboardList, Clock, Utensils, Bandage, CalendarDays, Loader2,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { StatCard, Card, SectionHeader, Pill, Avatar, ListSkeleton, HomeSkeleton, Skeleton, YarnConfetti } from '../components/ui.jsx'
import {
  lessonPlan, ACTIVITY_TYPES, quickMeals, quickMoods, diaperOptions,
} from '../data/mockData.js'

const statusMeta = {
  'checked-in': { label: 'In', class: 'bg-mint-400/15 text-mint-500', dot: 'bg-mint-500' },
  napping: { label: 'Napping', class: 'bg-grape-400/15 text-grape-600', dot: 'bg-grape-500' },
  absent: { label: 'Absent', class: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  'checked-out': { label: 'Out', class: 'bg-coral-400/15 text-coral-600', dot: 'bg-coral-500' },
}

/* ---------------- Staff Home ---------------- */
const TILES = [
  { label: 'Log Activity', icon: ClipboardList, grad: 'from-grape-400 to-grape-600', go: 'log' },
  { label: 'Log Meal', icon: Utensils, grad: 'from-coral-400 to-coral-600', go: 'log' },
  { label: 'Incident', icon: Bandage, grad: 'from-blush-400 to-blush-600', go: 'incidents' },
  { label: 'Photo', icon: Camera, grad: 'from-sunshine-400 to-sunshine-500', go: 'photos' },
]

export function StaffHome() {
  const { roster, setView, setAttendance, pushToast, loading, viewer, facility } = useApp()
  const setChildStatus = useMutation(api.roster.setChildStatus)
  const [activeRoom, setActiveRoom] = useState('All rooms')
  const [busyRows, setBusyRows] = useState({})
  const [error, setError] = useState('')
  const roomNames = [...new Set(roster.map(row => row.room || 'Unassigned'))]
  const visibleRoster = activeRoom === 'All rooms' ? roster : roster.filter(row => (row.room || 'Unassigned') === activeRoom)
  const present = visibleRoster.filter((r) => r.status === 'checked-in' || r.status === 'napping').length
  const absent = visibleRoster.filter((r) => r.status === 'absent').length
  const today = new Date().toLocaleDateString('en-US', { timeZone: facility?.timezone || 'America/Vancouver', weekday: 'long', month: 'short', day: 'numeric' })
  // Educators often go by "Ms./Mr. <First>" — greet with the actual first name,
  // not the title, so it never reads "Hi, Ms.".
  const nameParts = (viewer?.name || 'Educator').trim().split(/\s+/)
  const firstName = /^(ms|mr|mrs|mx|dr|miss)\.?$/i.test(nameParts[0]) && nameParts[1] ? nameParts[1] : nameParts[0]

  const apply = async (r, status, label, emoji, tone) => {
    const key = r.childId || r.id
    if (busyRows[key]) return
    setBusyRows(current => ({ ...current, [key]: true })); setError('')
    try {
      if (r.childId) await setChildStatus({ childId: r.childId, status })
      else await setAttendance(r.id, status)
      pushToast(`${r.name.split(' ')[0]} ${label} — attendance saved`, { emoji, tone })
    } catch { setError('Attendance could not be saved. Check the child’s current status and try again.') }
    finally { setBusyRows(current => ({ ...current, [key]: false })) }
  }


  if (loading && roster.length === 0) return <HomeSkeleton />

  return (
    <div className="space-y-5">
      <div className="pt-1">
        <p className="eyebrow">{today}</p>
        <h2 className="mt-2 text-4xl leading-[1.05] text-slate-800 sm:text-[2.75rem]">Hi, {firstName}</h2>
      </div>

      <ClockCard />

      {/* Colorful quick-action tiles */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
        {TILES.map((t, i) => (
          <motion.button
            key={t.label}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setView(t.go)}
            className="flex flex-col items-center gap-2"
          >
            <span className={`flex aspect-square w-full max-w-[78px] items-center justify-center rounded-3xl bg-gradient-to-br ${t.grad} text-white shadow-lg shadow-brand-600/10`}>
              <t.icon size={26} strokeWidth={2.2} />
            </span>
            <span className="text-center text-[11px] font-bold leading-tight text-slate-600 sm:text-sm">{t.label}</span>
          </motion.button>
        ))}
      </div>

      <RoomPills rooms={roomNames} active={activeRoom} onChange={setActiveRoom} />
      {error && <p role="alert" className="rounded-2xl bg-coral-50 p-3 text-sm font-semibold text-coral-700">{error}</p>}
      <Card className="!p-4">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-800"><BookOpen size={18} className="text-brand-500" /> Your program</h3>
        <p className="mt-2 text-sm text-slate-500">Open your daycare’s lesson plans for classroom activities. Confirm your shift and room assignment with your director.</p>
        <button onClick={() => setView('lesson')} className="btn-ghost mt-3 text-sm">Open lesson plans</button>
      </Card>

      {/* Children */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl text-slate-800">Children</h3>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="inline-flex items-center gap-1.5 text-mint-500"><span className="h-2.5 w-2.5 rounded-full bg-mint-500" />{present}</span>
            <span className="inline-flex items-center gap-1.5 text-slate-400"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />{absent}</span>
          </div>
        </div>

        {/* avatar status row */}
        <div className="-mx-4 mb-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {visibleRoster.map((r) => {
            const ring =
              r.status === 'absent' ? 'ring-slate-200' :
              r.status === 'checked-out' ? 'ring-coral-400' :
              r.status === 'napping' ? 'ring-grape-400' : 'ring-mint-400'
            return (
              <div key={r.childId || r.id} className="flex w-14 shrink-0 flex-col items-center gap-1">
                <div className={`rounded-[18px] p-0.5 ring-2 ${ring} ${r.status === 'absent' ? 'opacity-50' : ''}`}>
                  <Avatar emoji={r.emoji} size="h-12 w-12" gradient="from-brand-300 to-grape-400" />
                </div>
                <span className="w-full truncate text-center text-[11px] font-bold text-slate-500">{r.name.split(' ')[0]}</span>
              </div>
            )
          })}
        </div>

        {loading && roster.length === 0 ? (
          <ListSkeleton rows={4} />
        ) : (
          <div className="space-y-2.5">
            {!visibleRoster.length && <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">No children in this room.</p>}
            {visibleRoster.map((r, i) => {
              const s = statusMeta[r.status] || statusMeta['checked-out']
              const inRoom = r.status === 'checked-in' || r.status === 'napping'
              return (
                <motion.div
                  key={r.childId || r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="card relative overflow-hidden p-3.5"
                >
                  <span className={`absolute left-0 top-0 h-full w-1.5 ${s.dot}`} />
                  <div className="flex items-center gap-3 pl-1.5">
                    <div className="relative">
                      <Avatar emoji={r.emoji} gradient="from-brand-300 to-grape-400" />
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ${s.dot} ring-2 ring-white`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-extrabold text-slate-700">{r.name}</div>
                      <div className="text-xs font-bold text-slate-400">
                        {r.status === 'absent'
                          ? 'Absent today'
                          : r.status === 'checked-out'
                            ? r.time === '—' ? 'Not checked in today' : `Checked out at ${r.time}`
                            : <span className="text-mint-500">● Checked in at {r.checkInTime || r.time}</span>}
                      </div>
                    </div>
                    <Pill className={s.class}>{s.label}</Pill>
                  </div>
                  <div className="mt-3 flex gap-2 pl-1.5">
                    {inRoom ? (
                      <>
                        <motion.button disabled={busyRows[r.childId || r.id]} whileTap={{ scale: 0.96 }} onClick={() => apply(r, 'checked-out', 'checked out', '👋', 'coral')} className="btn flex-1 !py-2 text-sm bg-sunshine-400/20 text-amber-600">
                          <LogOut size={15} /> Check Out
                        </motion.button>
                      </>
                    ) : (
                      <><motion.button disabled={busyRows[r.childId || r.id]} whileTap={{ scale: 0.96 }} onClick={() => apply(r, 'checked-in', 'checked in', '✅', 'mint')} className="btn-primary flex-1 !py-2 text-sm"><LogIn size={15} /> Check In</motion.button>
                      {r.status !== 'absent' && <button disabled={busyRows[r.childId || r.id]} onClick={() => apply(r, 'absent', 'marked absent', '📋', 'coral')} className="btn-ghost flex-1 !py-2 text-sm"><UserX size={15} /> Absent</button>}</>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Live clock card — wired to Convex so the director's Staff view updates too.
function ClockCard() {
  const { educators, clockEducator, pushToast, viewer, isAuthenticated, loading } = useApp()
  const ownRecords = educators.filter(e => viewer?.id && e.userId === viewer.id)
  const me = isAuthenticated ? ownRecords.length === 1 ? ownRecords[0] : null : educators[0]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [justIn, setJustIn] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!me) return loading ? <Skeleton className="h-[88px] rounded-4xl" /> : <Card><p className="font-bold text-slate-700">Your time clock needs to be linked</p><p className="mt-1 text-sm text-slate-500">Ask your director to link your account to one educator record before recording a shift.</p></Card>

  const clockedIn = me.status === 'in'
  const sec = me.todaySeconds + (clockedIn && me.clockInAt ? (now - me.clockInAt) / 1000 : 0)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)

  const toggle = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      await clockEducator(me.id)
      pushToast(clockedIn ? 'Clocked out — timesheet updated' : 'Clocked in — have a great shift!', { emoji: clockedIn ? '👋' : '⏰', tone: clockedIn ? 'coral' : 'mint' })
      if (!clockedIn) { setJustIn(Date.now()); setTimeout(() => setJustIn(0), 2200) }
    } catch { setError('Your clock entry could not be saved. Try again before leaving this screen.') }
    finally { setBusy(false) }
  }


  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="card relative overflow-hidden p-5"
    >
      {justIn > 0 && <YarnConfetti key={justIn} count={16} />}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Clock size={24} /></span>
          <div>
            <p className="eyebrow">{clockedIn ? 'Clocked in' : 'Clocked out'}</p>
            <p className="font-display text-4xl leading-none text-slate-800">{clockedIn ? `${h}h ${m}m` : '—'}</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={toggle}
          disabled={busy}
          className={clockedIn ? 'btn-ghost !text-coral-600' : 'btn-primary'}
        >
          {busy ? 'Saving…' : clockedIn ? 'Clock Out' : 'Clock In'}
        </motion.button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-coral-700">{error}</p>}
    </motion.div>
  )
}

function RoomPills({ rooms, active, onChange }) {
  return <div role="group" aria-label="Filter children by room" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
    {['All rooms', ...rooms].map(room => <button key={room} onClick={() => onChange(room)} aria-pressed={room === active} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${room === active ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-slate-600'}`}>{room}</button>)}
  </div>
}

/* ---------------- Attendance ---------------- */
export function Attendance() {
  const { roster, setAttendance, pushToast } = useApp()
  const setChildStatus = useMutation(api.roster.setChildStatus)
  const [busyRows, setBusyRows] = useState({})
  const [error, setError] = useState('')
  const present = roster.filter((r) => r.status === 'checked-in' || r.status === 'napping').length

  const handleToggle = async (r) => {
    const key = r.childId || r.id
    if (busyRows[key]) return
    setBusyRows(current => ({ ...current, [key]: true })); setError('')
    const goingOut = ['checked-in', 'napping'].includes(r.status)
    const status = goingOut ? 'checked-out' : 'checked-in'
    try {
      if (r.childId) await setChildStatus({ childId: r.childId, status })
      else await setAttendance(r.id, status)
      pushToast(`${r.name.split(' ')[0]} checked ${goingOut ? 'out' : 'in'} — saved to the family portal`, { emoji: goingOut ? '👋' : '✅', tone: goingOut ? 'coral' : 'mint' })
    } catch { setError('The attendance change could not be saved. Please try again.') }
    finally { setBusyRows(current => ({ ...current, [key]: false })) }
  }


  return (
    <div className="space-y-5">
      <SectionHeader title="Attendance ✅" subtitle="Record check-in and check-out in the family portal" />

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Card className="flex items-center gap-4 bg-gradient-to-br from-brand-50 to-grape-400/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
            <Users size={26} />
          </div>
          <div>
            <div className="serif-num text-3xl text-slate-800">{present}<span className="text-lg text-slate-400"> / {roster.length}</span></div>
            <div className="text-sm font-bold text-slate-400">Children present right now</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3"><ClipboardList size={28} className="text-brand-500" /><p className="text-sm text-slate-500">Educators record arrivals and departures here. Confirm each child’s handoff before saving.</p></Card>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-coral-50 p-3 text-sm font-semibold text-coral-700">{error}</p>}
      <Card className="p-0">
        {!roster.length && <p className="p-4 text-sm text-slate-500">No active children are enrolled yet.</p>}
        {roster.map((r, i) => {
          const s = statusMeta[r.status] || statusMeta['checked-out']
          const goingOut = ['checked-in', 'napping'].includes(r.status)
          const canToggle = !!(r.childId || r.id)
          return (
            <motion.div
              key={r.childId || r.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-center gap-3 p-3.5 ${i !== roster.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              <div className="relative">
                <Avatar emoji={r.emoji} gradient="from-brand-300 to-grape-400" />
                <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ${s.dot} ring-2 ring-white`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold text-slate-700">{r.name}</div>
                <div className="text-xs font-bold text-slate-400">{r.time !== '—' ? `${s.label} at ${r.time}` : 'Not checked in today'}{r.mood && r.mood !== '—' ? ` · ${r.mood}` : ''}</div>
              </div>
              <Pill className={`${s.class} hidden sm:inline-flex`}>{s.label}</Pill>
              {canToggle && (
                <button
                  onClick={() => handleToggle(r)}
                  disabled={busyRows[r.childId || r.id]}
                  className={goingOut ? 'btn-ghost !py-2 text-sm' : 'btn-primary !py-2 text-sm'}
                >
                  {busyRows[r.childId || r.id] ? 'Saving…' : goingOut ? <><LogOut size={15} /> Out</> : <><LogIn size={15} /> In</>}
                </button>
              )}
            </motion.div>
          )
        })}
      </Card>
    </div>
  )
}

/* ---------------- Log Activity ---------------- */
export function LogActivity() {
  const { roster, childrenList, addActivity, pushToast, viewer, draftNote, facility } = useApp()
  const by = viewer?.name || 'Educator'
  const kids = childrenList.filter((c) => {
    const row = roster.find((r) => r.childId === c.id) || (childrenList.filter((other) => other.name === c.name).length === 1 ? roster.find((r) => r.name === c.name) : null)
    return row?.status !== 'absent'
  })
  const [childId, setChildId] = useState('')
  const selectedChild = kids.find((c) => c.id === childId)
  const child = selectedChild?.name || ''
  const [type, setType] = useState('meal')
  const [detail, setDetail] = useState('')
  const [amount, setAmount] = useState(quickMeals[0])
  const [aiBusy, setAiBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState('')

  const draftWithAI = async () => {
    if (!child) { pushToast('Pick a child first.', { emoji: '🧒', tone: 'coral' }); return }
    if (!detail.trim()) { setError('Write what actually happened first. AI can help polish your observations.'); return }
    setAiBusy(true); setError('')
    try {
      const r = await draftNote({ childName: child, kind: type, keywords: detail })
      if (r?.text) setDetail(r.text)
      else if (r?.configured === false) pushToast('AI isn’t connected yet.', { emoji: '✨', tone: 'coral' })
      else pushToast('Couldn’t draft right now — try again.', { emoji: '✨', tone: 'coral' })
    } catch {
      pushToast('AI draft failed — try again.', { emoji: '✨', tone: 'coral' })
    } finally { setAiBusy(false) }
  }

  const typeButtons = ['meal', 'nap', 'diaper', 'activity', 'learning', 'note']

  const amountOptions = type === 'meal' ? quickMeals : type === 'diaper' ? diaperOptions : type === 'note' ? quickMoods : null

  const submit = async () => {
    if (!selectedChild || saving) return
    const meta = ACTIVITY_TYPES[type]
    if (type === 'nap' && duration !== '' && (!Number.isFinite(Number(duration)) || Number(duration) < 0 || Number(duration) > 1440)) { setError('Enter nap minutes from 0 to 1,440.'); return }
    setSaving(true); setError('')
    try {
      await addActivity({
        childId: selectedChild.id,
        childName: selectedChild.name,
        type,
        date: dayKey(Date.now(), facility?.timezone || 'America/Vancouver'),
        durationMinutes: type === 'nap' && duration !== '' ? Number(duration) : undefined,
        mood: type === 'note' ? amount : undefined,
        title: `${meta.label} · ${selectedChild.first || child.split(' ')[0]}`,
        detail: detail || `${meta.label} logged`,
        amount: amountOptions ? amount : undefined,
        by,
      })
      pushToast(`${meta.label} saved to ${child.split(' ')[0]}'s family log`, { emoji: meta.emoji, tone: 'mint' })
      setDetail(''); setDuration('')
    } catch {
      setError('The update could not be saved. Your entry is still here. Try again.');
      pushToast('The update could not be saved. Please try again.', { emoji: '📝', tone: 'coral' })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Log activity 📝" subtitle="Updates post to families in real time" />

      <Card className="space-y-5">
        <fieldset disabled={saving || aiBusy} className="min-w-0 space-y-5">
        {/* Child picker */}
        <div>
          <Label>Child</Label>
          <div className="flex flex-wrap gap-2">
            {kids.map((k) => (
              <button
                key={k.id}
                onClick={() => setChildId(k.id)}
                className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 transition ${
                  childId === k.id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-lg">{k.emoji}</span>
                <span className="text-sm font-bold text-slate-700">{k.name} · {k.room || 'Unassigned'}</span>
                {childId === k.id && <Check size={15} className="text-brand-600" />}
              </button>
            ))}
          </div>
        </div>

        {!kids.length && <p className="text-sm text-slate-500">No children are available for a daily update. Check today’s attendance first.</p>}
        {error && <p role="alert" className="rounded-xl bg-coral-50 p-3 text-sm font-semibold text-coral-700">{error}</p>}
        {type === 'nap' && <label className="block text-sm font-semibold text-slate-600">Rest duration (minutes, optional)<input type="number" min="0" max="1440" step="1" value={duration} onChange={e => setDuration(e.target.value)} className="input mt-2" /></label>}
        {/* Type picker */}
        <div>
          <Label>What happened?</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {typeButtons.map((t) => {
              const meta = ACTIVITY_TYPES[t]
              const active = type === t
              return (
                <button
                  key={t}
                  onClick={() => { setType(t); setAmount((t === 'meal' ? quickMeals : t === 'diaper' ? diaperOptions : quickMoods)[0]) }}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition ${
                    active ? 'border-transparent text-white shadow-md ' + meta.color : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xl">{meta.emoji}</span>
                  <span className="text-xs font-bold">{meta.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Amount/mood quick chips */}
        {amountOptions && (
          <div>
            <Label>{type === 'meal' ? 'How much did they eat?' : type === 'diaper' ? 'Diaper' : 'Mood'}</Label>
            <div className="flex flex-wrap gap-2">
              {amountOptions.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmount(a)}
                  className={`pill ${amount === a ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Add a note (optional)</Label>
            <button
              type="button"
              onClick={draftWithAI}
              disabled={aiBusy || saving || !detail.trim() || !selectedChild}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-grape-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Draft with AI
            </button>
          </div>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            placeholder="Jot a keyword or two, then tap ✨ Draft with AI — or write your own."
            className="input resize-none"
          />
        </div>

        <button onClick={submit} disabled={!selectedChild || saving || aiBusy} className="btn-primary w-full">
          <Plus size={18} /> {saving ? 'Saving…' : 'Post update'} to {child ? child.split(' ')[0] + "'s" : ''} family
        </button>
        </fieldset>
      </Card>
    </div>
  )
}

function Label({ children }) {
  return <p className="mb-2 text-sm font-extrabold text-slate-600">{children}</p>
}

/* ---------------- Lesson Plan ---------------- */
export function LessonPlan() {
  const { isAuthenticated, facility, setView } = useApp()
  if (isAuthenticated && !facility?.isDemo) return <Card><h2 className="text-xl text-slate-800">Your daycare’s lesson plans</h2><p className="mt-2 text-sm text-slate-500">Open the current plans prepared by your care team.</p><button onClick={() => setView('lesson')} className="btn-primary mt-4">Open lesson plans</button></Card>
  return (
    <div className="space-y-5">
      <SectionHeader title="Lesson plans 📚" subtitle={`Sample plan · ${lessonPlan.week} · ${lessonPlan.theme}`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lessonPlan.days.map((d, i) => (
          <motion.div
            key={d.day}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-grape-500 font-extrabold text-white">
                {d.day}
              </span>
              <div>
                <div className="text-xs font-bold uppercase text-slate-400">Focus</div>
                <div className="font-extrabold text-slate-800">{d.focus}</div>
              </div>
            </div>
            <ul className="space-y-2">
              {d.activities.map((a) => (
                <li key={a} className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 text-sm font-semibold text-slate-600">
                  <BookOpen size={16} className="mt-0.5 shrink-0 text-brand-500" /> {a}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
