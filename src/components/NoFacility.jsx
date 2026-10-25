import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, LogOut, ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import BrandLockup from './BrandLockup.jsx'

// Shown when a parent/educator is signed in but not yet attached to a daycare.
// They can paste the invite link their daycare sent them.
export default function NoFacility() {
  const { joinFacility, logout, membershipError, retryMembership, joiningFacility } = useApp()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    // Accept a full link or a bare token.
    let token = value.trim()
    const m = token.match(/[?&]t(?:oken)?=([a-z0-9]+)/i)
    if (m) token = m[1]
    try {
      await joinFacility(token)
      // Membership is reflected by the dashboard gate after the mutation.
    } catch (error) {
      setBusy(false)
      const message = String(error?.message || '')
      setError(message.includes('email') ? 'Sign in using the email this invitation was addressed to.' : message.includes('another daycare') ? 'This account already belongs to another daycare. Ask the owner for help.' : 'That link didn’t work. Ask your daycare for a fresh, child-linked invite link.')
    }
  }

  return (
    <div className="aurora flex min-h-screen items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-4xl border border-line bg-white/90 p-8 shadow-playful backdrop-blur"
      >
        <div className="mb-6"><BrandLockup variant="nav" /></div>
        <img src="/cinema/spots/lost.webp" alt="" className="h-24 w-24 rounded-3xl object-cover shadow-card" />
        <h1 className="mt-4 text-2xl text-brand-700">Join your daycare</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
          You’re signed in, but not connected to a daycare yet. Paste the invite link your
          daycare sent you. Parent invitations must be linked to an active child. If you are already enrolled, ask the owner to link your existing account.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <input
            className="input"
            placeholder="Paste your invite link…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          {(error || membershipError) && <div role="alert" className="rounded-xl bg-coral-400/15 px-3 py-2 text-sm font-semibold text-coral-600"><p>{error || membershipError}</p>{membershipError && <button type="button" disabled={busy || joiningFacility} onClick={retryMembership} className="mt-2 underline">Retry saved invitation</button>}</div>}
          <button type="submit" disabled={busy || joiningFacility} className="btn-primary w-full">
            {busy || joiningFacility ? <Loader2 size={18} className="animate-spin" /> : <>Join <ArrowRight size={16} /></>}
          </button>
        </form>
        <button onClick={logout} className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-coral-500">
          <LogOut size={14} /> Sign out
        </button>
      </motion.div>
    </div>
  )
}
