import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreHorizontal } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'

// Floating, blurred bottom dock for mobile (<lg). Desktop keeps the sidebar.
export default function BottomDock({ nav }) {
  const { view, setView, conversations } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)
  const unread = conversations.reduce((n, c) => n + c.unread, 0)

  const dockItems = nav.filter((n) => n.dock)
  const moreItems = nav.filter((n) => !n.dock)
  const moreActive = moreItems.some((n) => n.id === view) && !moreOpen

  const go = (id) => {
    setView(id)
    setMoreOpen(false)
  }

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="glass-bar mx-auto flex max-w-md items-stretch rounded-[28px] border border-white/50 px-1.5 py-1.5 shadow-[0_8px_32px_-8px_rgba(14,78,128,0.28),inset_0_0.5px_0_rgba(255,255,255,0.8)]">
          {dockItems.map((item) => (
            <Tab
              key={item.id}
              item={item}
              active={view === item.id}
              badge={item.id === 'messages' ? unread : 0}
              onClick={() => go(item.id)}
            />
          ))}
          {moreItems.length > 0 && (
            <Tab
              item={{ label: 'More', icon: MoreHorizontal }}
              active={moreActive}
              onClick={() => setMoreOpen(true)}
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white p-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl"
            >
              <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />
              <p className="eyebrow mb-3">More</p>
              <div className="grid grid-cols-3 gap-3">
                {moreItems.map((item) => {
                  const active = view === item.id
                  return (
                    <motion.button
                      key={item.id}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => go(item.id)}
                      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition ${
                        active ? 'border-brand-300 bg-brand-50' : 'border-line bg-white'
                      }`}
                    >
                      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${active ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <item.icon size={20} />
                      </span>
                      <span className="text-xs font-bold text-slate-600">{item.label}</span>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

function Tab({ item, active, badge = 0, onClick }) {
  return (
    <button onClick={onClick} className="relative flex flex-1 flex-col items-center gap-0.5 py-1">
      <motion.span whileTap={{ scale: 0.82 }} className="relative flex h-9 w-14 items-center justify-center">
        {active && (
          <motion.span
            layoutId="dock-blob"
            transition={{ type: 'spring', stiffness: 520, damping: 36 }}
            className="absolute inset-0 rounded-2xl bg-brand-50"
          />
        )}
        <item.icon
          size={21}
          strokeWidth={active ? 2.6 : 2}
          className={`relative z-10 transition-colors ${active ? 'text-brand-600' : 'text-slate-400'}`}
        />
        {badge > 0 && (
          <span className="absolute right-1.5 top-0 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-500 px-1 text-[9px] font-extrabold text-white ring-2 ring-white">
            {badge}
          </span>
        )}
      </motion.span>
      <span className={`text-[10px] font-bold transition-colors ${active ? 'text-brand-600' : 'text-slate-400'}`}>
        {item.label}
      </span>
    </button>
  )
}
