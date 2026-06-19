import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Moon, UserX, Scale, QrCode, LogIn, LogOut, Smile, Apple, BookOpen,
  Camera, MessageCircle, Plus, Check, Sparkles, ClipboardList, Clock, Utensils, Bandage, CalendarDays, Loader2,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { StatCard, Card, SectionHeader, Pill, Avatar, ListSkeleton, HomeSkeleton, Skeleton, YarnConfetti } from '../components/ui.jsx'
import {
  lessonPlan, ACTIVITY_TYPES, quickMeals, quickMoods, diaperOptions, rooms,
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
  { label: 'Incident', icon: Bandage, grad: 'from-blush-400 to-blush-600', go: 'log' },
  { label: 'Photo', icon: Camera, grad: 'from-sunshine-400 to-sunshine-500', go: 'photos' },
]

export function StaffHome() {
  const { roster, setView, setAttendance, pushToast, loading, viewer } = useApp()
  const present = roster.filter((r) => r.status === 'checked-in' || r.status === 'napping').length
  const absent = roster.filter((r) => r.status === 'absent').length
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  // Educators often go by "Ms./Mr. <First>" — greet with the actual first name,
  // not the title, so it never reads "Hi, Ms.".
  const nameParts = (viewer?.name || 'Ms. Dana').trim().split(/\s+/)
  const firstName = /^(ms|mr|mrs|mx|dr|miss)\.?$/i.test(nameParts[0]) && nameParts[1] ? nameParts[1] : nameParts[0]

  const apply = (r, status, label, emoji, tone) => {
    setAttendance(r.id, status)
    pushToast(`${r.name.split(' ')[0]} ${label} — family notified`, { emoji, tone })
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

      <RoomPills />

      {/* Today's schedule */}
      <Card className="!p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-800">
            <CalendarDays size={18} className="text-brand-500" /> Today’s Schedule
          </h3>
          <button onClick={() => setView('lesson')} className="text-sm font-bold text-brand-600">Full schedule</button>
        </div>
        <div className="flex items-stretch gap-3 rounded-2xl bg-tint p-3">
          <div className="flex flex-col items-center justify-center px-1 font-mono text-[11px] uppercase tracking-wide text-slate-400">
            <span className="text-slate-700">7:30a</span>
            <span>–</span>
            <span className="text-slate-700">4:00p</span>
          </div>
          <div className="w-1 rounded-full bg-brand-400" />
          <div className="flex-1">
            <div className="flex items-center gap-2 font-extrabold text-slate-700">
              Navigators Room <span className="pill bg-brand-100 text-brand-700">Home</span>
            </div>
            <div className="text-sm font-semibold text-slate-400">Lead Educator · ratio 1:8 ✓</div>
          </div>
        </div>
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
          {roster.map((r) => {
            const ring =
              r.status === 'absent' ? 'ring-slate-200' :
              r.status === 'checked-out' ? 'ring-coral-400' :
              r.status === 'napping' ? 'ring-grape-400' : 'ring-mint-400'
            return (
              <div key={r.id} className="flex w-14 shrink-0 flex-col items-center gap-1">
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
            {roster.map((r, i) => {
              const s = statusMeta[r.status]
              const inRoom = r.status === 'checked-in' || r.status === 'napping'
              return (
                <motion.div
                  key={r.id}
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
                            ? `Checked out at ${r.time}`
                            : <span className="text-mint-500">● Checked in at {r.time}</span>}
                      </div>
                    </div>
                    <Pill className={s.class}>{s.label}</Pill>
                  </div>
                  <div className="mt-3 flex gap-2 pl-1.5">
                    {inRoom ? (
                      <>
                        <motion.button whileTap={{ scale: 0.96 }} onClick={() => apply(r, 'absent', 'marked absent', '📋', 'coral')} className="btn-ghost flex-1 !py-2 text-sm !text-coral-600">
                          <UserX size={15} /> Mark Absent
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.96 }} onClick={() => apply(r, 'checked-out', 'checked out', '👋', 'coral')} className="btn flex-1 !py-2 text-sm bg-sunshine-400/20 text-amber-600">
                          <LogOut size={15} /> Check Out
                        </motion.button>
                      </>
                    ) : (
                      <motion.button whileTap={{ scale: 0.96 }} onClick={() => apply(r, 'checked-in', 'checked in', '✅', 'mint')} className="btn-primary flex-1 !py-2 text-sm">
                        <LogIn size={15} /> Check In
                      </motion.button>
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
  const { educators, clockEducator, pushToast, viewer } = useApp()
  const me =
    educators.find((e) => viewer?.id && e.userId === viewer.id) ||
    educators.find((e) => viewer?.name && e.name === viewer.name) ||
    educators[0]
  const [now, setNow] = useState(Date.now())
  const [justIn, setJustIn] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!me) return <Skeleton className="h-[88px] rounded-4xl" />

  const clockedIn = me.status === 'in'
  const sec = me.todaySeconds + (clockedIn && me.clockInAt ? (now - me.clockInAt) / 1000 : 0)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)

  const toggle = () => {
    clockEducator(me.id)
    pushToast(clockedIn ? 'Clocked out — timesheet updated' : 'Clocked in — have a great shift!', {
      emoji: clockedIn ? '👋' : '⏰',
      tone: clockedIn ? 'coral' : 'mint',
    })
    // a little shower of yarn to start the shift
    if (!clockedIn) { setJustIn(Date.now()); setTimeout(() => setJustIn(0), 2200) }
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
          className={clockedIn ? 'btn-ghost !text-coral-600' : 'btn-primary'}
        >
          {clockedIn ? 'Clock Out' : 'Clock In'}
        </motion.button>
      </div>
    </motion.div>
  )
}

function RoomPills() {
  const [active, setActive] = useState('Navigators')
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {rooms.map((rm) => {
        const isActive = rm.name === active
        const isHome = rm.name === 'Navigators'
        return (
          <motion.button
            key={rm.name}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActive(rm.name)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition ${
              isActive ? 'border-transparent bg-brand-600 text-white shadow-md' : 'border-line bg-white text-slate-600'
            }`}
          >
            {rm.name}
            {isHome && <span className={`text-xs ${isActive ? 'text-white/80' : 'text-slate-400'}`}>(Home)</span>}
          </motion.button>
        )
      })}
    </div>
  )
}

/* ---------------- Attendance ---------------- */
export function Attendance() {
  const { roster, toggleAttendance, pushToast } = useApp()
  const present = roster.filter((r) => r.status === 'checked-in' || r.status === 'napping').length

  const handleToggle = (r) => {
    toggleAttendance(r.id)
    const goingOut = r.status === 'checked-in'
    pushToast(`${r.name.split(' ')[0]} checked ${goingOut ? 'out' : 'in'} — parent notified`, {
      emoji: goingOut ? '👋' : '✅',
      tone: goingOut ? 'coral' : 'mint',
    })
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Attendance ✅" subtitle="One-tap check-in · parents notified instantly" />

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Card className="flex items-center gap-4 bg-gradient-to-br from-brand-50 to-grape-400/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md">
            <Users size={26} />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-800">{present}<span className="text-lg text-slate-400"> / {roster.length}</span></div>
            <div className="text-sm font-bold text-slate-400">Children present right now</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <QrCode size={36} />
          </div>
          <div>
            <div className="font-extrabold text-slate-800">Kiosk QR</div>
            <div className="text-xs font-semibold text-slate-400">Parents scan to<br />self check-in</div>
          </div>
        </Card>
      </div>

      <Card className="p-0">
        {roster.map((r, i) => {
          const s = statusMeta[r.status]
          const canToggle = r.status === 'checked-in' || r.status === 'checked-out'
          return (
            <motion.div
              key={r.id}
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
                <div className="text-xs font-bold text-slate-400">{r.time !== '—' ? `Since ${r.time}` : 'Not in today'} · {r.mood}</div>
              </div>
              <Pill className={`${s.class} hidden sm:inline-flex`}>{s.label}</Pill>
              {canToggle && (
                <button
                  onClick={() => handleToggle(r)}
                  className={r.status === 'checked-in' ? 'btn-ghost !py-2 text-sm' : 'btn-primary !py-2 text-sm'}
                >
                  {r.status === 'checked-in' ? <><LogOut size={15} /> Out</> : <><LogIn size={15} /> In</>}
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
  const { roster, addActivity, pushToast, viewer, draftNote } = useApp()
  const by = viewer?.name || 'Ms. Dana'
  const kids = roster.filter((r) => r.status !== 'absent')
  const [child, setChild] = useState(kids[0]?.name || '')
  const [type, setType] = useState('meal')
  const [detail, setDetail] = useState('')
  const [amount, setAmount] = useState(quickMeals[0])
  const [aiBusy, setAiBusy] = useState(false)

  const draftWithAI = async () => {
    if (!child) { pushToast('Pick a child first.', { emoji: '🧒', tone: 'coral' }); return }
    setAiBusy(true)
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

  const submit = () => {
    const meta = ACTIVITY_TYPES[type]
    addActivity({
      type,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      title: `${meta.label}${child ? ` · ${child.split(' ')[0]}` : ''}`,
      detail: detail || `${meta.label} logged`,
      amount: amountOptions ? amount : undefined,
      by,
    })
    pushToast(`${meta.label} logged for ${child.split(' ')[0]} — family notified`, { emoji: meta.emoji, tone: 'mint' })
    setDetail('')
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Log activity 📝" subtitle="Updates post to families in real time" />

      <Card className="space-y-5">
        {/* Child picker */}
        <div>
          <Label>Child</Label>
          <div className="flex flex-wrap gap-2">
            {kids.map((k) => (
              <button
                key={k.id}
                onClick={() => setChild(k.name)}
                className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 transition ${
                  child === k.name ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="text-lg">{k.emoji}</span>
                <span className="text-sm font-bold text-slate-700">{k.name.split(' ')[0]}</span>
                {child === k.name && <Check size={15} className="text-brand-600" />}
              </button>
            ))}
          </div>
        </div>

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
              disabled={aiBusy}
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

        <button onClick={submit} disabled={!child} className="btn-primary w-full">
          <Plus size={18} /> Post update to {child ? child.split(' ')[0] + "'s" : ''} family
        </button>
      </Card>
    </div>
  )
}

function Label({ children }) {
  return <p className="mb-2 text-sm font-extrabold text-slate-600">{children}</p>
}

/* ---------------- Lesson Plan ---------------- */
export function LessonPlan() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Lesson plans 📚" subtitle={`${lessonPlan.week} · ${lessonPlan.theme}`} />
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
