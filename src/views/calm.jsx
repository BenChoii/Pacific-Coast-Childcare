import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Wind, Play, Pause, X, Clock, Sparkles, Check, RotateCcw } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, Card } from '../components/ui.jsx'

// ── The exercise library ────────────────────────────────────────────────────
// Each phase: label shown to the class, seconds, and the scale the breathing
// orb animates to (grow = inhale, shrink = exhale, hold = stay).
const EXERCISES = [
  {
    id: 'balloon', name: 'Balloon Belly', emoji: '🎈', ages: '2–6',
    when: 'Big-feelings reset', gradient: 'from-coral-400 to-blush-500', orb: 'from-coral-300 to-blush-400',
    tagline: 'Hands on tummies — blow up the balloon, then let it float down.',
    phases: [
      { label: 'Blow up your balloon belly…', emoji: '🎈', secs: 4, scale: 1.45 },
      { label: 'Let the air float out sloooowly…', emoji: '😮‍💨', secs: 5, scale: 0.8 },
    ],
  },
  {
    id: 'bunny', name: 'Bunny Breaths', emoji: '🐰', ages: '2–5',
    when: 'Morning circle wake-up', gradient: 'from-blush-400 to-grape-500', orb: 'from-blush-300 to-grape-400',
    tagline: 'Three quick bunny sniffs, one long happy sigh. Wiggly noses welcome.',
    phases: [
      { label: 'Sniff!', emoji: '🐰', secs: 1, scale: 1.15 },
      { label: 'Sniff!', emoji: '🐰', secs: 1, scale: 1.3 },
      { label: 'Sniff!', emoji: '🐰', secs: 1, scale: 1.45 },
      { label: 'Big bunny sigh ahhhh…', emoji: '🌿', secs: 4, scale: 0.8 },
    ],
  },
  {
    id: 'snake', name: 'Snake Breath', emoji: '🐍', ages: '3–7',
    when: 'After recess', gradient: 'from-mint-400 to-brand-500', orb: 'from-mint-300 to-sky-300',
    tagline: 'Breathe in through the nose, hiss it all the way out like a sneaky snake.',
    phases: [
      { label: 'Breathe in through your nose…', emoji: '👃', secs: 4, scale: 1.45 },
      { label: 'Hisssssss it out…', emoji: '🐍', secs: 7, scale: 0.8 },
    ],
  },
  {
    id: 'flower', name: 'Flower & Candle', emoji: '🌸', ages: '2–6',
    when: 'Transition time', gradient: 'from-sunshine-400 to-coral-500', orb: 'from-sunshine-300 to-coral-300',
    tagline: 'Smell the flower in one hand… blow out the candle in the other.',
    phases: [
      { label: 'Smell the pretty flower…', emoji: '🌸', secs: 4, scale: 1.45 },
      { label: 'Blow out the candle — gently!', emoji: '🕯️', secs: 5, scale: 0.8 },
    ],
  },
  {
    id: 'starfish', name: 'Starfish Trace', emoji: '⭐', ages: '3–8',
    when: 'Quiet corner, one-on-one', gradient: 'from-sky-400 to-grape-500', orb: 'from-sky-300 to-grape-300',
    tagline: 'Hold up one hand like a starfish, trace each finger — up breathes in, down breathes out.',
    phases: [
      { label: 'Trace UP a finger — breathe in…', emoji: '☝️', secs: 3, scale: 1.4 },
      { label: 'Trace DOWN — breathe out…', emoji: '👇', secs: 3, scale: 0.82 },
    ],
  },
  {
    id: 'box', name: 'Square Breathing', emoji: '📦', ages: '5–12',
    when: 'School-agers & staff too', gradient: 'from-brand-400 to-grape-600', orb: 'from-brand-300 to-grape-400',
    tagline: 'Draw a square in the air: in, hold, out, hold. The classic, kid-sized.',
    phases: [
      { label: 'Breathe in — up the side…', emoji: '⬆️', secs: 4, scale: 1.45 },
      { label: 'Hold — across the top…', emoji: '➡️', secs: 4, scale: 1.45 },
      { label: 'Breathe out — down the side…', emoji: '⬇️', secs: 4, scale: 0.8 },
      { label: 'Hold — across the bottom…', emoji: '⬅️', secs: 4, scale: 0.8 },
    ],
  },
  {
    id: 'ocean', name: 'Ocean Waves', emoji: '🌊', ages: '3–8',
    when: 'Before nap · wind-down', gradient: 'from-sky-400 to-brand-600', orb: 'from-sky-300 to-brand-300',
    tagline: 'The wave rises as you breathe in… and rolls softly onto the sand as you breathe out.',
    phases: [
      { label: 'The wave rises… breathe in…', emoji: '🌊', secs: 4, scale: 1.45 },
      { label: 'It rolls onto the sand… breathe out…', emoji: '🏖️', secs: 6, scale: 0.8 },
    ],
  },
]

const DURATIONS = [1, 2, 3, 5]

/* ── Session player ───────────────────────────────────────────────────────── */
function Player({ ex, minutes, onExit }) {
  const { addActivity, viewer, pushToast } = useApp()
  const total = minutes * 60
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(total)
  const [running, setRunning] = useState(true)
  const [done, setDone] = useState(false)
  const loggedRef = useRef(false)
  const phase = ex.phases[phaseIdx]
  const cycleSecs = ex.phases.reduce((s, p) => s + p.secs, 0)

  // countdown
  useEffect(() => {
    if (!running || done) return
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [running, done])

  // finish
  useEffect(() => {
    if (secondsLeft === 0 && !done) setDone(true)
  }, [secondsLeft, done])

  // phase machine
  useEffect(() => {
    if (!running || done) return
    const t = setTimeout(() => setPhaseIdx((p) => (p + 1) % ex.phases.length), phase.secs * 1000)
    return () => clearTimeout(t)
  }, [phaseIdx, running, done]) // eslint-disable-line react-hooks/exhaustive-deps

  // log once on completion (best-effort)
  useEffect(() => {
    if (!done || loggedRef.current) return
    loggedRef.current = true
    try {
      addActivity({
        type: 'activity',
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        title: `🫧 Calm Corner · ${ex.name}`,
        detail: `${minutes} minute${minutes === 1 ? '' : 's'} of guided ${ex.name} breathing with the class ${ex.emoji}`,
        by: viewer?.name || 'Educator',
      })
      pushToast('Calm session logged to the daily feed', { emoji: '🫧', tone: 'mint' })
    } catch { /* demo / unauthenticated — fine */ }
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const mm = String(Math.floor(secondsLeft / 60))
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative flex min-h-[34rem] flex-col items-center justify-between overflow-hidden rounded-4xl bg-gradient-to-br ${ex.gradient} p-6 text-center text-white shadow-playful`}
    >
      <div className="blob blob-a left-[-4rem] top-[-3rem] h-64 w-64 bg-white/15" />
      <div className="blob blob-b bottom-[-4rem] right-[-3rem] h-72 w-72 bg-white/10" />

      {/* top bar */}
      <div className="relative flex w-full items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider backdrop-blur">
          {ex.emoji} {ex.name}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-mono text-sm font-bold backdrop-blur">
          <Clock size={13} /> {mm}:{ss}
        </span>
      </div>

      {/* breathing orb */}
      {!done ? (
        <div className="relative flex flex-col items-center">
          <div className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
            <motion.div
              animate={{ scale: phase.scale * 1.12 }}
              transition={{ duration: phase.secs, ease: 'easeInOut' }}
              className="absolute h-44 w-44 rounded-full bg-white/10 sm:h-52 sm:w-52"
            />
            <motion.div
              animate={{ scale: phase.scale }}
              transition={{ duration: phase.secs, ease: 'easeInOut' }}
              className={`absolute h-44 w-44 rounded-full bg-gradient-to-br ${ex.orb} shadow-2xl sm:h-52 sm:w-52`}
            />
            <motion.span
              key={phaseIdx}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative text-6xl drop-shadow"
            >
              {phase.emoji}
            </motion.span>
          </div>
          <motion.p
            key={`label-${phaseIdx}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 min-h-[2.2rem] font-display text-2xl sm:text-3xl"
          >
            {phase.label}
          </motion.p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
            one cycle ≈ {cycleSecs}s · keep going together
          </p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative flex flex-col items-center gap-3">
          <motion.span animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-7xl">{ex.emoji}</motion.span>
          <h2 className="font-display text-4xl">Beautiful breathing! ✨</h2>
          <p className="max-w-xs text-sm font-semibold text-white/85">
            {minutes} calm minute{minutes === 1 ? '' : 's'} together. Notice how the room feels now.
          </p>
        </motion.div>
      )}

      {/* controls */}
      <div className="relative flex items-center gap-3">
        {!done ? (
          <>
            <button onClick={() => setRunning((r) => !r)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-700 shadow-lg transition active:scale-90">
              {running ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
            </button>
            <button onClick={onExit} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition active:scale-90">
              <X size={18} />
            </button>
          </>
        ) : (
          <>
            <button onClick={onExit} className="btn bg-white text-brand-700"><Check size={16} /> Done</button>
            <button
              onClick={() => { setSecondsLeft(total); setPhaseIdx(0); setDone(false); setRunning(true); loggedRef.current = false }}
              className="btn bg-white/20 text-white backdrop-blur"
            >
              <RotateCcw size={15} /> Again
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

/* ── Library ──────────────────────────────────────────────────────────────── */
export function CalmCorner() {
  const [active, setActive] = useState(null) // { ex, minutes }
  const [minutes, setMinutes] = useState(2)

  if (active) return <Player ex={active.ex} minutes={active.minutes} onExit={() => setActive(null)} />

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Calm Corner"
        title="Breathing with the kids 🫧"
        subtitle="Guided, screen-led breathwork — pick an exercise, set the length, breathe together"
      />

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><Clock size={15} className="text-brand-500" /> Session length</span>
        <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
          {DURATIONS.map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={`rounded-xl px-4 py-1.5 text-sm font-bold transition ${minutes === m ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
            >
              {m} min
            </button>
          ))}
        </div>
        <span className="ml-auto hidden items-center gap-1.5 text-xs font-semibold text-slate-400 sm:inline-flex">
          <Sparkles size={13} className="text-grape-500" /> Completed sessions post to the family feed
        </span>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXERCISES.map((ex, i) => (
          <motion.button
            key={ex.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActive({ ex, minutes })}
            className="card feature-glow group flex flex-col p-5 text-left transition-all hover:-translate-y-1 hover:shadow-playful"
          >
            <div className="flex items-start justify-between">
              <motion.span whileHover={{ rotate: [0, -8, 8, 0] }} className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${ex.gradient} text-3xl shadow-md`}>
                {ex.emoji}
              </motion.span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500">ages {ex.ages}</span>
            </div>
            <h3 className="mt-3 text-xl text-slate-800">{ex.name}</h3>
            <p className="mt-1 flex-1 text-sm font-medium leading-relaxed text-slate-500">{ex.tagline}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-brand-500">{ex.when}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                <Play size={12} /> {minutes} min
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      <Card className="flex gap-3 p-4">
        <span className="text-xl">💡</span>
        <p className="text-sm font-medium leading-relaxed text-slate-500">
          <strong className="text-slate-700">Educator tip:</strong> sit where everyone can see the screen, breathe audibly yourself
          (kids copy what they hear), and keep first sessions to 1–2 minutes. The orb grows — everyone breathes in.
          It shrinks — everyone breathes out. That's the whole magic.
        </p>
      </Card>
    </div>
  )
}
