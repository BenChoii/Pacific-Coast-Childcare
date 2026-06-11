import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { Mail, Lock, User, ArrowRight, ArrowLeft, Loader2, Heart, GraduationCap, Building2, Home, Check, ShieldCheck, Camera, Banknote } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import BrandLockup from './BrandLockup.jsx'

const roleOptions = [
  { id: 'parent', label: 'Parent', icon: Heart, gradient: 'from-blush-300 to-blush-500' },
  { id: 'staff', label: 'Educator', icon: GraduationCap, gradient: 'from-brand-400 to-brand-600' },
  { id: 'admin', label: 'Director', icon: Building2, gradient: 'from-sky-400 to-brand-500' },
]

// `intent` shapes the form:
//   { kind: 'owner' }            → create a daycare (owner signup)
//   { kind: 'join', token }      → invited parent/educator joins a facility
//   { kind: 'default' }          → generic sign in / create account
export default function Auth({ onBack, intent = { kind: 'default' } }) {
  const { signIn } = useAuthActions()
  const isOwner = intent.kind === 'owner'
  const isJoin = intent.kind === 'join'

  const inviteInfo = useQuery(api.facilities.inviteInfo, isJoin && intent.token ? { token: intent.token } : 'skip')
  const inviteRole = inviteInfo?.role || 'parent'

  const [flow, setFlow] = useState(isOwner || isJoin ? 'signUp' : 'signIn')
  const [name, setName] = useState('')
  const [facilityName, setFacilityName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('parent')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isSignUp = flow === 'signUp'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      // Stash the follow-up action and let it run from an effect once auth has
      // fully propagated — calling it inline right after signIn races the token.
      if (isOwner && isSignUp) sessionStorage.setItem('cubby_pending_facility', facilityName)
      if (isJoin && intent.token) sessionStorage.setItem('cubby_pending_join', intent.token)
      // Mark this as a fresh sign-in so App routes to the portal instead of
      // showing the "already signed in" interstitial on /signup or /join.
      sessionStorage.setItem('cubby_fresh_auth', '1')
      const r = isOwner ? (isSignUp ? 'admin' : role) : isJoin ? inviteRole : role
      await signIn('password', { email, password, name, role: r, flow })
      // Success → ConvexAuthProvider flips auth state and App re-renders; the
      // AppProvider effect picks up the pending facility/join.
    } catch (err) {
      try { sessionStorage.removeItem('cubby_pending_facility'); sessionStorage.removeItem('cubby_pending_join') } catch {}
      setBusy(false)
      const msg = String(err?.message || '')
      setError(
        msg.includes('invite')
          ? 'That invite link is no longer valid. Ask your daycare for a fresh link.'
          : isSignUp
            ? 'Could not create that account. Try a different email or a longer password.'
            : 'Sign in failed. Check your email and password.',
      )
    }
  }

  const heading = isOwner
    ? isSignUp ? 'Start your daycare on Cubby' : 'Welcome back'
    : isJoin
      ? `Join ${inviteInfo?.facilityName || 'your daycare'}`
      : isSignUp ? 'Create your account' : 'Sign in to your portal'
  const eyebrow = isOwner
    ? isSignUp ? 'Free for up to 5 children' : 'Owner sign in'
    : isJoin ? `You're invited as a ${inviteRole === 'staff' ? 'educator' : inviteRole}` : isSignUp ? 'Create your account' : 'Welcome back'

  return (
    <div className="aurora relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-6">
      <div className="blob blob-a left-[-6rem] top-[-4rem] h-80 w-80 bg-sky-300/60" />
      <div className="blob blob-b bottom-[-5rem] right-[-5rem] h-96 w-96 bg-blush-300/60" />

      <div className="relative grid w-full max-w-4xl items-stretch gap-0 overflow-hidden rounded-[2rem] shadow-playful lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel — desktop only */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-grape-600 p-9 text-white lg:flex"
        >
          <div className="blob blob-a right-[-4rem] top-[-3rem] h-56 w-56 bg-white/20" />
          <div className="blob blob-b bottom-[-4rem] left-[-3rem] h-64 w-64 bg-sky-300/30" />
          <div className="relative">
            <div className="flex items-center gap-2.5">
              <img src="/brand/cubby-mark.svg" alt="" className="h-10 w-10 rounded-2xl bg-white/90 p-1.5" />
              <span className="font-display text-3xl">Cubby</span>
            </div>
            <h2 className="mt-8 font-display text-4xl leading-[1.1]">
              {isJoin ? <>Your daycare is<br />waiting for you.</> : <>Your whole daycare,<br />in one calm app.</>}
            </h2>
          </div>
          <div className="relative space-y-3.5">
            {[
              [Camera, 'Daily photos & reports families love'],
              [Heart, 'Milestones, messaging & memory books'],
              [Banknote, 'Billing, analytics & payroll prep'],
              [ShieldCheck, 'Your data — never sold, never shared'],
            ].map(([Icon, t], i) => (
              <motion.div
                key={t}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.12 }}
                className="flex items-center gap-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur"><Icon size={15} /></span>
                <span className="text-sm font-semibold text-white/90">{t}</span>
              </motion.div>
            ))}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
              Free for up to 5 children · no card
            </motion.p>
          </div>
        </motion.div>

        {/* Form panel */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-white/90 p-7 backdrop-blur-xl sm:p-9"
        >
        {onBack && (
          <button onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-brand-600">
            <ArrowLeft size={16} /> Back
          </button>
        )}

        <div className="mb-6"><BrandLockup variant="nav" /></div>

        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-3xl text-brand-700">{heading}</h1>

        {/* Flow toggle */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
          {[
            { id: 'signIn', label: 'Sign in' },
            { id: 'signUp', label: isOwner ? 'Create daycare' : 'Create account' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setFlow(t.id); setError('') }}
              className={`rounded-xl py-2 text-sm font-semibold transition ${flow === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {isSignUp && isOwner && (
            <Field icon={Home} label="Daycare name">
              <input className="input pl-10" placeholder="Sunshine Family Daycare" value={facilityName} onChange={(e) => setFacilityName(e.target.value)} required />
            </Field>
          )}

          {isSignUp && (
            <Field icon={User} label="Your full name">
              <input className="input pl-10" placeholder="Jordan Rivera" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          )}

          <Field icon={Mail} label="Email">
            <input type="email" className="input pl-10" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>

          <Field icon={Lock} label="Password">
            <input type="password" className="input pl-10" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </Field>

          {/* Role picker only for the generic flow */}
          {isSignUp && intent.kind === 'default' && (
            <div>
              <p className="eyebrow mb-2">I am a…</p>
              <div className="grid grid-cols-3 gap-2">
                {roleOptions.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 transition ${role === r.id ? 'border-brand-400 bg-brand-50' : 'border-line bg-white hover:border-slate-300'}`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${r.gradient} text-white`}>
                      <r.icon size={16} />
                    </span>
                    <span className="text-xs font-bold text-slate-600">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-coral-400/15 px-3 py-2 text-sm font-semibold text-coral-600">{error}</p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <>{isSignUp ? (isOwner ? 'Create my daycare' : 'Create account') : 'Sign in'} <ArrowRight size={16} /></>}
          </button>
        </form>

        {isOwner && isSignUp && (
          <p className="mt-4 text-center text-xs font-medium leading-relaxed text-slate-400">
            Free while you have 5 or fewer children. Add a 6th and we’ll collect a card —
            then it’s just $20/mo + $2 per child after, a fraction of the big platforms. Cancel anytime.
          </p>
        )}
        </motion.div>
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, children }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block">{label}</span>
      <span className="relative block">
        <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        {children}
      </span>
    </label>
  )
}
