import { motion } from 'framer-motion'
import { Bell, Moon, ShieldCheck, HelpCircle, LogOut, ChevronRight, Globe, Star } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { BRAND } from '../brand.js'
import { SectionHeader, Card } from '../components/ui.jsx'
import AvatarUpload from '../components/AvatarUpload.jsx'

const roleLabel = { parent: 'Parent', staff: 'Lead Educator', admin: 'Academy Director' }
const roleGradient = { parent: 'from-blush-300 to-blush-500', staff: 'from-brand-400 to-brand-600', admin: 'from-sky-400 to-brand-500' }
const roleEmoji = { parent: '👨‍👩‍👧', staff: '🧑‍🏫', admin: '🏫' }
const fallbackName = { parent: 'Jordan Rivera', staff: 'Ms. Dana', admin: 'Sam Carter' }

const settings = [
  { icon: Bell, label: 'Notifications', value: 'On', tone: 'text-brand-500' },
  { icon: Moon, label: 'Appearance', value: 'Light', tone: 'text-grape-500' },
  { icon: Globe, label: 'Language', value: 'English', tone: 'text-mint-500' },
  { icon: ShieldCheck, label: 'Privacy & security', value: '', tone: 'text-sky-500' },
  { icon: HelpCircle, label: 'Help & support', value: '', tone: 'text-coral-500' },
]

export default function Me() {
  const { role, viewer, isAuthenticated, logout, setMyAvatar } = useApp()
  const name = isAuthenticated && viewer?.name ? viewer.name : fallbackName[role]
  const sub = isAuthenticated && viewer?.email ? viewer.email : roleLabel[role]

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Account" title="Me" />

      <Card className="aurora relative overflow-hidden">
        <div className={`blob blob-a -right-10 -top-10 h-40 w-40 bg-gradient-to-br ${roleGradient[role]} opacity-30`} />
        <div className="blob blob-b -bottom-12 -left-8 h-36 w-36 bg-blush-300/50" />
        <div className="relative flex items-center gap-4">
          <div className="rounded-[1.6rem] bg-white/70 p-1 shadow-md backdrop-blur">
            {isAuthenticated ? (
              <AvatarUpload src={viewer?.imageUrl} fallback={roleEmoji[role]} size="h-16 w-16" gradient={roleGradient[role]} onUpload={setMyAvatar} />
            ) : (
              <div className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${roleGradient[role]} text-3xl`}>{roleEmoji[role]}</div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-2xl text-slate-800">{name}</h2>
            <p className="truncate text-sm font-semibold text-slate-500">{sub}</p>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-line bg-white/80 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-600 backdrop-blur">
              <Star size={11} /> {roleLabel[role]}
            </span>
          </div>
        </div>
      </Card>

      <Card className="p-2">
        {settings.map((s, i) => (
          <motion.button
            key={s.label}
            whileTap={{ scale: 0.985 }}
            className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-slate-50 ${
              i !== settings.length - 1 ? 'border-b border-line/70' : ''
            }`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 ${s.tone}`}>
              <s.icon size={18} />
            </span>
            <span className="flex-1 font-bold text-slate-700">{s.label}</span>
            {s.value && <span className="text-sm font-semibold text-slate-400">{s.value}</span>}
            <ChevronRight size={18} className="text-slate-300" />
          </motion.button>
        ))}
      </Card>

      <motion.button whileTap={{ scale: 0.97 }} onClick={logout} className="btn-ghost w-full text-coral-600">
        <LogOut size={18} /> {isAuthenticated ? 'Sign out' : 'Leave demo'}
      </motion.button>

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
        {BRAND.name} · v1.0
      </p>
      <p className="text-center text-[11px] font-semibold text-slate-400">
        <a href="/terms" className="hover:text-brand-600">Terms</a>
        <span className="mx-2 text-slate-300">·</span>
        <a href="/privacy" className="hover:text-brand-600">Privacy</a>
      </p>
    </div>
  )
}
