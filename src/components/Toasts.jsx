import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

const tones = {
  brand: 'from-brand-400 to-brand-600',
  mint: 'from-mint-400 to-mint-500',
  grape: 'from-grape-400 to-grape-600',
  coral: 'from-coral-400 to-coral-600',
}

export default function Toasts() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white p-3 pr-2 shadow-playful ring-1 ring-slate-100"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tones[t.tone] || tones.brand} text-lg`}>
              {t.emoji}
            </div>
            <p className="flex-1 text-sm font-bold text-slate-700">{t.message}</p>
            <button onClick={() => dismissToast(t.id)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
