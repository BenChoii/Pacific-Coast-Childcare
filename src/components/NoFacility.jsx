import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, LogOut, ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import BrandLockup from './BrandLockup.jsx'

// Shown when a parent/educator is signed in but not yet attached to a daycare.
// They can paste the invite link their daycare sent them.
export default function NoFacility() {
  const { joinFacility, logout, pushToast } = useApp()
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
      pushToast('You’re in! Welcome 👋', { emoji: '🎉', tone: 'mint' })
    } catch {
      setBusy(false)
      setError('That link didn’t work. Ask your daycare for a fresh invite link.')
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
          daycare sent you, and you’ll see your child’s day right away.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <input
            className="input"
            placeholder="Paste your invite link…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          {error && <p className="rounded-xl bg-coral-400/15 px-3 py-2 text-sm font-semibold text-coral-600">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <>Join <ArrowRight size={16} /></>}
          </button>
        </form>
        <button onClick={logout} className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-coral-500">
          <LogOut size={14} /> Sign out
        </button>
      </motion.div>
    </div>
  )
}
