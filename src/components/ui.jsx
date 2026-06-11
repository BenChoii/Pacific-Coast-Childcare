import { motion } from 'framer-motion'

export function StatCard({ icon: Icon, label, value, sub, gradient = 'from-brand-400 to-brand-600', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="card relative overflow-hidden p-5 sm:p-6"
    >
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-xl`} />
      <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg sm:h-12 sm:w-12`}>
        <Icon size={20} strokeWidth={2.4} />
      </div>
      <div className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">{value}</div>
      <div className="text-sm font-bold text-slate-500">{label}</div>
      {sub && <div className="mt-1 text-xs font-semibold text-slate-400">{sub}</div>}
    </motion.div>
  )
}

export function SectionHeader({ title, subtitle, eyebrow, action }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="text-2xl leading-tight text-slate-800 sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm font-medium text-slate-400 sm:text-[15px]">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Pill({ children, className = '' }) {
  return <span className={`pill ${className}`}>{children}</span>
}

export function Avatar({ emoji, gradient = 'from-brand-400 to-grape-500', size = 'h-11 w-11', ring = false, src = null }) {
  return (
    <div
      className={`${size} ${ring ? 'ring-4 ring-white' : ''} relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} text-xl shadow-md`}
    >
      {src ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span>{emoji}</span>}
    </div>
  )
}

export function Card({ children, className = '', delay = 0, hover = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`card p-5 ${hover ? 'transition-all hover:-translate-y-1 hover:shadow-playful' : ''} ${className}`}
    >
      {children}
    </motion.div>
  )
}

export function ProgressBar({ value, max = 100, gradient = 'from-brand-400 to-brand-600' }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
      />
    </div>
  )
}

export function EmptyHint({ children }) {
  return <p className="py-6 text-center text-sm font-semibold text-slate-400">{children}</p>
}

// Progressive-loading placeholder. Soft shimmer that matches the surface tone.
export function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-shimmer rounded-2xl ${className}`}
      style={{
        background: 'linear-gradient(100deg, #eef1f4 30%, #f6f8fa 50%, #eef1f4 70%)',
        backgroundSize: '200% 100%',
      }}
    />
  )
}

export function StatGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <Skeleton className="mb-3 h-11 w-11" />
          <Skeleton className="mb-2 h-6 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-36 rounded-4xl" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-3xl" />
        ))}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-3xl" />
        ))}
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="card divide-y divide-line p-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}
