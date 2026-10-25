import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from 'convex/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { Mail, Lock, User, ArrowRight, ArrowLeft, Loader2, Heart, GraduationCap, Building2, Home, Check, ShieldCheck, Camera, Banknote, Eye, EyeOff } from 'lucide-react'
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

  const [flow, setFlow] = useState(() => new URLSearchParams(window.location.search).get('reset') === '1' ? 'reset' : isOwner || isJoin ? 'signUp' : 'signIn')
  const [name, setName] = useState('')
  const [facilityName, setFacilityName] = useState('')
  // Prefill from a handoff link (e.g. the Pacific Coast site's Parent Portal →
  // mitten.care/portal?email=…). The password is always entered here, on Mitten's
  // own secure origin — never collected on a partner marketing domain.
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('email') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('parent')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isSignUp = flow === 'signUp'
  const isReset = flow === 'reset' || flow === 'reset-verification'
  const verifyingReset = flow === 'reset-verification'
  useEffect(() => { if (inviteInfo?.email) setEmail(inviteInfo.email) }, [inviteInfo?.email])
  const switchFlow = (value) => { setFlow(value); setError(''); setNotice(''); setPassword(''); setCode('') }
  const submit = async (e) => {
    e.preventDefault()
    setError(''); setNotice('')
    if (isSignUp && isJoin && !inviteInfo) { setError('This invitation is unavailable. Ask your daycare for a new link.'); return }
    if (verifyingReset && !/^\d{8}$/.test(code)) { setError('Enter the 8-digit code from your email.'); return }
    setBusy(true)
    try {
      if (flow === 'reset') {
        await signIn('password', { email: email.trim(), flow: 'reset' })
        setNotice('If an account uses that email, a recovery code has been sent. Check your inbox and spam folder. The code expires in 10 minutes.')
        setFlow('reset-verification'); setBusy(false)
        return
      }
      if (!isReset && isOwner && isSignUp) {sessionStorage.setItem('cubby_pending_facility', facilityName.trim());sessionStorage.setItem('cubby_pending_facility_email',email.trim().toLowerCase())}
      if (isJoin && intent.token && inviteInfo) sessionStorage.setItem('cubby_pending_join', intent.token)
      sessionStorage.setItem('cubby_fresh_auth', '1')
      if (verifyingReset) {
        await signIn('password', { email: email.trim(), code, newPassword: password, flow: 'reset-verification' })
      } else {
        const r = isOwner ? (isSignUp ? 'admin' : role) : isJoin ? inviteRole : role
        await signIn('password', { email: email.trim(), password, name, role: r, flow, ...(isJoin && isSignUp ? { inviteToken: intent.token } : {}) })
      }
      // Membership creation waits for authenticated context; failures there
      // remain visible and retryable in the workspace gate.
    } catch (err) {
      // Clear only the handoff written by this attempt. A failed generic
      // sign-in must not discard a previously saved invitation/setup retry.
      if (!isReset) try {
        if (isOwner && isSignUp){sessionStorage.removeItem('cubby_pending_facility');sessionStorage.removeItem('cubby_pending_facility_email')}
        if (isJoin && inviteInfo) sessionStorage.removeItem('cubby_pending_join')
      } catch {}
      setBusy(false)
      const message = String(err?.message || '')
      setError(
        message.includes('Multiple legacy') ? 'Multiple older accounts use this email. Enter the exact email originally registered, or contact support.'
          : message.includes('already uses this email') ? 'An account already uses this email. Choose Sign in or Forgot password.'
          : message.includes('suspended') || message.includes('access has ended') ? 'Your daycare access is inactive. Contact the owner to restore access.'
          : isReset ? verifyingReset ? 'The code is invalid or expired. Check the email and code, or request a new code.' : 'The recovery email could not be sent. Please try again later.'
          : message.toLowerCase().includes('invit') ? 'That invitation is no longer valid for this email. Ask your daycare for a new link.'
          : isSignUp ? 'Could not create that account. Check your email and use a password of at least 8 characters.'
          : 'Sign in failed. Check your email and password, or reset your password.',
      )
    }
  }
  const heading = isReset ? verifyingReset ? 'Choose a new password' : 'Reset your password'
    : isOwner ? isSignUp ? 'Start your daycare on Mitten' : 'Welcome back'
      : isJoin ? `Join ${inviteInfo?.facilityName || 'your daycare'}`
        : isSignUp ? 'Create your account' : 'Sign in to your portal'
  const eyebrow = isReset ? 'Secure account recovery' : isOwner ? isSignUp ? 'Free for up to 5 children' : 'Owner sign in'
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
              <img src="/brand/mitten-mark.svg" alt="" className="h-10 w-10 rounded-2xl bg-white/90 p-1.5" />
              <span className="font-display text-3xl">Mitten</span>
            </div>
            <h2 className="mt-8 font-display text-4xl leading-[1.1]">
              {isJoin ? <>Your daycare is<br />waiting for you.</> : <>Your whole daycare,<br />in one calm app.</>}
            </h2>
            <motion.img
              src="/cinema/spots/welcome.webp" alt=""
              initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.25, duration: 0.45 }}
              className="mt-6 h-28 w-28 rounded-[1.75rem] border-2 border-white/40 object-cover shadow-lg"
            />
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
              disabled={busy}
              onClick={() => switchFlow(t.id)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${flow === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isJoin && inviteInfo === undefined && <p role="status" className="mt-4 text-sm text-slate-500">Checking your invitation…</p>}
        {isJoin && inviteInfo === null && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">This invitation has been used, expired or withdrawn. Ask your daycare for a new link. You can still sign in to an existing account.</p>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{notice}</p>}
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
            <input type="email" className="input pl-10" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" readOnly={busy || verifyingReset} />
          </Field>

          {verifyingReset && <Field icon={ShieldCheck} label="8-digit recovery code"><input className="input pl-10" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required /></Field>}
          {flow !== 'reset' && <div><Field icon={Lock} label={verifyingReset ? 'New password' : 'Password'}>
            <input type={showPassword ? 'text' : 'password'} className="input pl-10 pr-12" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isSignUp || verifyingReset ? 8 : undefined} autoComplete={isSignUp || verifyingReset ? 'new-password' : 'current-password'} />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </Field>{(isSignUp || verifyingReset) && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}</div>}

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
            <p role="alert" className="rounded-xl bg-coral-400/15 px-3 py-2 text-sm font-semibold text-coral-600">{error}</p>
          )}

          <button type="submit" disabled={busy || (isSignUp && isJoin && !inviteInfo)} className="btn-primary w-full">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <>{isReset ? verifyingReset ? 'Save password and sign in' : 'Email recovery code' : isSignUp ? (isOwner ? 'Create my daycare' : 'Create account') : 'Sign in'} <ArrowRight size={16} /></>}
          </button>
        </form>
        {flow === 'signIn' && <button type="button" disabled={busy} onClick={() => switchFlow('reset')} className="mt-4 text-sm font-semibold text-brand-600">Forgot password?</button>}
        {isReset && <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-brand-600">
          <button type="button" disabled={busy} onClick={() => switchFlow('signIn')}>Back to sign in</button>
          {verifyingReset && <button type="button" disabled={busy} onClick={() => switchFlow('reset')}>Request a new code</button>}
        </div>}

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
