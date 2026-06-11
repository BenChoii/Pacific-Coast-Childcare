import { useState } from 'react'
import { motion } from 'framer-motion'
import { Home, ArrowRight, Loader2, LogOut } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import BrandLockup from './BrandLockup.jsx'

// Shown when an owner is signed in but hasn't created their facility yet
// (e.g. they signed up through the generic flow as a Director).
export default function CreateFacility() {
  const { createFacility, logout } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createFacility(name)
      // viewer.hasFacility flips → the gate moves to onboarding.
    } catch {
      setBusy(false)
      setError('Could not create your daycare. Please try again.')
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
        <p className="eyebrow">One quick step</p>
        <h1 className="mt-1 text-3xl text-brand-700">Name your daycare</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
          This creates your own private workspace. You can change it later.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="eyebrow mb-1.5 block">Daycare name</span>
            <span className="relative block">
              <Home size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input pl-10" placeholder="Sunshine Family Daycare" value={name} onChange={(e) => setName(e.target.value)} required />
            </span>
          </label>
          {error && <p className="rounded-xl bg-coral-400/15 px-3 py-2 text-sm font-semibold text-coral-600">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <>Create my daycare <ArrowRight size={16} /></>}
          </button>
        </form>
        <button onClick={logout} className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-coral-500">
          <LogOut size={14} /> Sign out
        </button>
      </motion.div>
    </div>
  )
}
