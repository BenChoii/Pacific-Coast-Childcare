import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Baby, Users, Share2, Compass, ArrowRight, ArrowLeft, Check, Copy,
  Loader2, Home, MessageCircle, Image, CalendarDays, BookOpen, CreditCard, ClipboardList,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import BrandLockup from './BrandLockup.jsx'
import { YarnConfetti } from './ui.jsx'

const origin = () => window.location.origin

const FEATURES = [
  { icon: Home, title: 'Dashboard', where: 'Home', desc: 'Your daily overview — who’s in, revenue, attendance at a glance.' },
  { icon: Baby, title: 'Children & enrollment', where: 'Account → Children', desc: 'Add and manage every child. Your bill adjusts automatically.' },
  { icon: ClipboardList, title: 'Attendance', where: 'Educators’ Home / Attendance', desc: 'Check kids in & out; parents see it live.' },
  { icon: Image, title: 'Photos & moments', where: 'Photos', desc: 'Share the day’s magic — parents get a private feed.' },
  { icon: MessageCircle, title: 'Messaging', where: 'Messages', desc: 'Two-way chat with every family, all in one place.' },
  { icon: BookOpen, title: 'Lesson plans & training', where: 'Curriculum', desc: 'Build time-based plans and share staff training links.' },
  { icon: Share2, title: 'Family links', where: 'Account → Family links', desc: 'Invite parents & staff with one shareable link.' },
  { icon: CreditCard, title: 'Plan & billing', where: 'Account → Plan', desc: 'See your plan, usage and manage your card.' },
]

export default function Onboarding() {
  const { facility, enrollChild, generateInvite, completeOnboarding, pushToast } = useApp()
  const [step, setStep] = useState(0)
  const [celebrating, setCelebrating] = useState(false)
  const steps = ['welcome', 'child', 'team', 'families', 'tour']
  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))
  // Send-off moment first, then flip onboarded → the dashboard appears under it.
  const finish = async () => {
    setCelebrating(true)
    await new Promise((r) => setTimeout(r, 1900))
    await completeOnboarding()
  }

  if (celebrating) {
    return (
      <div className="aurora relative flex min-h-screen items-center justify-center overflow-hidden px-5">
        <YarnConfetti count={40} />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="relative flex flex-col items-center text-center"
        >
          <img src="/cinema/spots/confetti.webp" alt="" className="h-44 w-44 rounded-[2.5rem] object-cover shadow-playful" />
          <h1 className="mt-6 text-4xl text-brand-700">You’re all set! 🧶</h1>
          <p className="mt-2 max-w-sm text-sm font-semibold text-slate-500">
            {facility?.name || 'Your daycare'} is open for its first day on Mitten. Your families are going to love this.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="aurora min-h-screen px-5 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <BrandLockup variant="nav" />
          <button onClick={finish} className="text-xs font-bold text-slate-400 hover:text-brand-600">Skip setup →</button>
        </div>

        {/* progress */}
        <div className="mb-6 flex gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition ${i <= step ? 'bg-brand-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        <AnimatePresence initial={false}>
          <motion.div
            key={steps[step]}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-4xl border border-line bg-white/90 p-7 shadow-playful backdrop-blur"
          >
            {steps[step] === 'welcome' && <Welcome facility={facility} onNext={next} />}
            {steps[step] === 'child' && <AddChildStep enrollChild={enrollChild} onNext={next} onBack={back} />}
            {steps[step] === 'team' && <InviteStep role="staff" title="Invite your team" icon={Users} generateInvite={generateInvite} pushToast={pushToast} onNext={next} onBack={back} />}
            {steps[step] === 'families' && <InviteStep role="parent" title="Invite your families" icon={Share2} generateInvite={generateInvite} pushToast={pushToast} facility={facility} onNext={next} onBack={back} />}
            {steps[step] === 'tour' && <Tour onFinish={finish} onBack={back} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function Welcome({ facility, onNext }) {
  return (
    <div className="text-center">
      <motion.img
        src="/cinema/spots/welcome.webp" alt=""
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
        className="mx-auto mb-4 h-32 w-32 rounded-[2rem] object-cover shadow-card"
      />
      <p className="eyebrow">Welcome to Mitten</p>
      <h1 className="mt-1 text-3xl text-brand-700">{facility?.name || 'Your daycare'} is live 🎉</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-relaxed text-slate-500">
        Let’s get you set up in a couple of minutes — add a child, invite your team and families,
        and we’ll show you where everything lives. You’re free for up to 5 children.
      </p>
      <button onClick={onNext} className="btn-primary mx-auto mt-6"><ArrowRight size={16} /> Let’s go</button>
    </div>
  )
}

function AddChildStep({ enrollChild, onNext, onBack }) {
  const [form, setForm] = useState({ first: '', last: '', age: '3 yrs', room: 'Preschool', parent: '' })
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)
  const add = async (e) => {
    e.preventDefault()
    if (!form.first.trim()) return
    setBusy(true)
    try {
      const res = await enrollChild({
        first: form.first.trim(),
        name: `${form.first.trim()} ${form.last.trim()}`.trim(),
        age: form.age, room: form.room, emoji: '🐬', color: 'from-brand-400 to-brand-600',
        parent: form.parent.trim() || 'Parent', allergies: [],
      })
      if (res?.ok || res?.billingSkipped) { setAdded(true); setForm({ first: '', last: '', age: '3 yrs', room: 'Preschool', parent: '' }) }
    } finally { setBusy(false) }
  }
  return (
    <div className="relative">
      {/* the first child is a moment — let it land */}
      {added && <YarnConfetti count={18} />}
      <StepHead icon={Baby} eyebrow="Step 1" title="Add your first child" />
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className="input" placeholder="First name" value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} />
        <input className="input" placeholder="Last name" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} />
        <input className="input" placeholder="Age" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        <input className="input" placeholder="Room (e.g. Preschool)" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
        <input className="input sm:col-span-2" placeholder="Parent / guardian name" value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} />
        <button type="submit" disabled={busy} className="btn-ghost sm:col-span-2">
          {busy ? <Loader2 size={16} className="animate-spin" /> : added ? <><Check size={16} /> Added — add another?</> : <>Add child</>}
        </button>
      </form>
      <p className="mt-3 text-xs font-semibold text-slate-400">You can add the rest later in Account → Children.</p>
      <StepNav onBack={onBack} onNext={onNext} nextLabel={added ? 'Next' : 'I’ll do this later'} />
    </div>
  )
}

function InviteStep({ role, title, icon, generateInvite, pushToast, facility, onNext, onBack }) {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const make = async () => {
    setBusy(true)
    try {
      const r = await generateInvite(role)
      setLink(`${origin()}/join?t=${r.token}`)
    } finally { setBusy(false) }
  }
  const copy = (t) => { navigator.clipboard?.writeText(t); setCopied(true); pushToast('Link copied 📋', { emoji: '📋', tone: 'mint' }); setTimeout(() => setCopied(false), 1600) }
  const Icon = icon
  return (
    <div>
      <StepHead icon={Icon} eyebrow={role === 'staff' ? 'Step 2' : 'Step 3'} title={title} />
      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
        {role === 'staff'
          ? 'Generate a link and send it to each educator. They create an account and land straight in your classroom tools.'
          : 'Send this link to parents. They sign up and immediately follow their child’s day.'}
      </p>
      {!link ? (
        <button onClick={make} disabled={busy} className="btn-primary mt-4">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <><Share2 size={16} /> Create invite link</>}
        </button>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-slate-50 p-2 pl-4">
          <span className="flex-1 truncate font-mono text-sm font-semibold text-slate-600">{link}</span>
          <button onClick={() => copy(link)} className="btn-primary !py-2 text-sm">{copied ? <Check size={15} /> : <Copy size={15} />} Copy</button>
        </div>
      )}
      {role === 'parent' && facility && (
        <p className="mt-3 text-xs font-semibold text-slate-400">
          Tip: returning families can always sign in at <span className="font-mono">{origin().replace(/^https?:\/\//, '')}/{facility.slug}</span>
        </p>
      )}
      <StepNav onBack={onBack} onNext={onNext} nextLabel="Next" />
    </div>
  )
}

function Tour({ onFinish, onBack }) {
  const [busy, setBusy] = useState(false)
  const done = async () => { setBusy(true); await onFinish() }
  return (
    <div>
      <StepHead icon={Compass} eyebrow="Step 4" title="Here’s where everything lives" />
      <div className="mt-4 space-y-2.5">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><f.icon size={17} /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-slate-800">{f.title}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500">{f.where}</span>
              </div>
              <p className="text-xs font-semibold leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost !py-2.5"><ArrowLeft size={16} /> Back</button>
        <button onClick={done} disabled={busy} className="btn-primary">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <>Open my dashboard <ArrowRight size={16} /></>}
        </button>
      </div>
    </div>
  )
}

function StepHead({ icon: Icon, eyebrow, title }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md"><Icon size={20} /></span>
      <div><p className="eyebrow">{eyebrow}</p><h1 className="text-2xl text-brand-700">{title}</h1></div>
    </div>
  )
}

function StepNav({ onBack, onNext, nextLabel }) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <button onClick={onBack} className="btn-ghost !py-2.5"><ArrowLeft size={16} /> Back</button>
      <button onClick={onNext} className="btn-primary">{nextLabel} <ArrowRight size={16} /></button>
    </div>
  )
}
