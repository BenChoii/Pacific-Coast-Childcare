import { useMemo } from 'react'
import { motion } from 'framer-motion'

/* Atelier metric: mono label, small accent icon, big editorial serif number. */
export function StatCard({ icon: Icon, label, value, sub, gradient = 'from-brand-400 to-brand-600', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="card p-5 transition-shadow duration-300 hover:shadow-playful sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="eyebrow pt-1">{label}</span>
        {Icon && (
          <span className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white`}>
            <Icon size={15} strokeWidth={2.4} />
          </span>
        )}
      </div>
      <div className="serif-num mt-3 text-[2.1rem] leading-none text-slate-800 sm:text-[2.6rem]">{value}</div>
      {sub && <div className="mt-2 text-xs font-semibold text-slate-400">{sub}</div>}
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

/* Knit-world empty state — a spot illustration from /cinema/spots/ doing the
   talking, so a brand-new facility's blankest screens feel warm, not broken. */
export function KnitEmpty({ image, title, hint, action, size = 'h-36 w-36' }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <motion.img
        src={image} alt=""
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={`${size} rounded-[2rem] object-cover shadow-card`}
      />
      <h3 className="mt-5 text-xl text-slate-800">{title}</h3>
      {hint && <p className="mt-1.5 max-w-sm text-sm font-semibold leading-relaxed text-slate-400">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* One-shot yarn confetti burst. Render inside a `relative overflow-hidden`
   container; unmount (or key-remount) to fire again. Pure CSS-transform
   animation — cheap, no canvas, no deps. */
const YARN_COLORS = ['#0E74C1', '#F2C6CC', '#BFD8E6', '#E8B84C', '#7c5cbf', '#7FB6A4']
export function YarnConfetti({ count = 24 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: 4 + Math.random() * 92,
        delay: Math.random() * 0.5,
        duration: 1.5 + Math.random() * 1.1,
        drift: (Math.random() - 0.5) * 70,
        spin: (Math.random() - 0.5) * 540,
        color: YARN_COLORS[i % YARN_COLORS.length],
        round: Math.random() > 0.5,
      })),
    [count],
  )
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: '-12%', x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '112%', x: p.drift, rotate: p.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.3, 0.1, 0.6, 1] }}
          className={`absolute top-0 ${p.round ? 'h-2 w-2 rounded-full' : 'h-3 w-1.5 rounded-full'}`}
          style={{ left: `${p.left}%`, backgroundColor: p.color }}
        />
      ))}
    </div>
  )
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
