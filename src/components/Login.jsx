import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from 'convex/react'
import { Heart, GraduationCap, Building2, ArrowRight, LogIn, Sparkles, Loader2 } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { BRAND } from '../brand.js'
import { getEntry } from '../routes.js'
import BrandLockup from './BrandLockup.jsx'
import Auth from './Auth.jsx'

const roles = [
  { id: 'parent', title: 'Parent', desc: 'Follow your child’s day in real time — moments, learning, messages & tuition.', icon: Heart, gradient: 'from-blush-300 to-blush-500' },
  { id: 'staff', title: 'Educator', desc: 'Log learning & care, check children in, share moments and chat with families.', icon: GraduationCap, gradient: 'from-brand-400 to-brand-600' },
  { id: 'admin', title: 'Director', desc: 'Run enrolment, billing, staffing and reporting from one calm dashboard.', icon: Building2, gradient: 'from-sky-400 to-brand-500' },
]

const go = (path) => () => window.location.assign(path)

function Blob({ className, anim, delay = 0 }) {
  return (
    <motion.div
      className={`pointer-events-none absolute rounded-full blur-2xl ${className}`}
      animate={anim}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  )
}

export default function Login() {
  const entry = getEntry()
  if (entry.kind === 'owner') return <Auth intent={{ kind: 'owner' }} onBack={go('/app')} />
  if (entry.kind === 'join') return <Auth intent={{ kind: 'join', token: entry.token }} onBack={go('/app')} />
  if (entry.kind === 'slug') return <SlugLanding slug={entry.slug} token={entry.token} />
  return <DefaultLanding />
}

// A parent landing on mitten.care/<their-daycare>
function SlugLanding({ slug, token }) {
  const facility = useQuery(api.facilities.bySlug, { slug })
  const [showAuth, setShowAuth] = useState(false)

  if (token) return <Auth intent={{ kind: 'join', token }} onBack={go('/app')} />
  if (showAuth) return <Auth intent={{ kind: 'default' }} onBack={() => setShowAuth(false)} />

  return (
    <div className="aurora relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-14">
      <Blob className="left-[-5rem] top-16 h-72 w-72 bg-blush-200/60" anim={{ y: [0, -20, 0] }} />
      <Blob className="right-[-3rem] top-28 h-80 w-80 bg-sky-300/50" anim={{ y: [0, 18, 0] }} delay={2} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md rounded-4xl border border-line bg-white/90 p-8 text-center shadow-playful backdrop-blur"
      >
        <div className="mb-6 flex justify-center"><BrandLockup variant="nav" /></div>
        {facility === undefined ? (
          <Loader2 className="mx-auto animate-spin text-brand-400" />
        ) : facility === null ? (
          <>
            <h1 className="text-2xl text-brand-700">We couldn’t find that daycare</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">Double-check the link your daycare sent you.</p>
            <a href="/" className="btn-ghost mt-6 inline-flex">Go to {BRAND.short}</a>
          </>
        ) : (
          <>
            <p className="eyebrow">Family portal</p>
            <h1 className="mt-1 text-3xl text-brand-700">{facility.name}</h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">
              Sign in to follow your child’s day — moments, learning, messages and tuition.
            </p>
            <button onClick={() => setShowAuth(true)} className="btn-primary mt-6 w-full">
              <LogIn size={18} /> Families sign in
            </button>
            <p className="mt-4 text-xs font-medium text-slate-400">
              New here? Ask {facility.name} for their invite link to create your account.
            </p>
          </>
        )}
      </motion.div>
    </div>
  )
}

function DefaultLanding() {
  const { enterRole } = useApp()
  const [mode, setMode] = useState('landing')

  if (mode === 'auth') return <Auth intent={{ kind: 'default' }} onBack={() => setMode('landing')} />

  return (
    <div className="aurora relative min-h-screen overflow-hidden">
      <Blob className="left-[-5rem] top-16 h-72 w-72 bg-blush-200/60" anim={{ y: [0, -20, 0] }} />
      <Blob className="right-[-3rem] top-28 h-80 w-80 bg-sky-300/50" anim={{ y: [0, 18, 0] }} delay={2} />
      <Blob className="bottom-[-6rem] left-1/3 h-72 w-72 bg-blush-100" anim={{ y: [0, -14, 0] }} delay={4} />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-14">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <BrandLockup variant="hero" />
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="eyebrow">
          Run a daycare? Bring it online in minutes.
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-3 max-w-3xl text-center text-5xl leading-[1.05] text-brand-700 sm:text-6xl"
        >
          Your daycare’s own app,
          <br />
          <span className="italic text-brand-500">free to start.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.24 }}
          className="mt-5 max-w-xl text-center text-base font-medium leading-relaxed text-slate-500"
        >
          Attendance, daily learning reports, photos, messaging, lesson plans and tuition —
          one calm place for your families and educators. Free for up to 5 children.
        </motion.p>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.34 }} className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <button onClick={go('/signup')} className="btn-primary px-7 py-3 text-base">
            <Sparkles size={18} /> Start your daycare free
          </button>
          <button onClick={() => setMode('auth')} className="btn-ghost px-6 py-3 text-base">
            <LogIn size={18} /> Sign in
          </button>
        </motion.div>

        <p className="eyebrow mt-12">Or explore the live demo</p>

        <div className="mt-4 grid w-full gap-5 sm:grid-cols-3">
          {roles.map((r, i) => (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              whileHover={{ y: -6 }}
              onClick={() => enterRole(r.id)}
              className="group relative overflow-hidden rounded-3xl border border-line bg-white/85 p-6 text-left shadow-card backdrop-blur transition-shadow hover:shadow-playful"
            >
              <span className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${r.gradient} text-white shadow-md`}>
                <r.icon size={22} strokeWidth={2} />
              </span>
              <p className="eyebrow mb-1.5">Explore as</p>
              <h3 className="text-2xl text-brand-700">{r.title}</h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{r.desc}</p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                Enter demo
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </div>
            </motion.button>
          ))}
        </div>

        <p className="mt-10 text-center font-mono text-[10.5px] uppercase tracking-[0.16em] text-slate-400">
          Live demo · choose a role to explore · no password needed
        </p>
        <a href="/partners" className="mt-3 text-center text-xs font-bold text-brand-500 transition hover:text-brand-700">
          See everything {BRAND.short} can do →
        </a>
      </div>
    </div>
  )
}
