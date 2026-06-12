import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LogOut, Bell, Search, MessageCircle, CreditCard, Sparkles, Image as ImageIcon,
  User, ChevronRight, CornerDownLeft,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { BRAND } from '../brand.js'
import BrandLockup from './BrandLockup.jsx'
import BottomDock from './BottomDock.jsx'

const roleMeta = {
  parent: { label: 'Parent', emoji: '👨‍👩‍👧', name: 'Jordan Rivera', sub: 'Mia & Leo’s parent', gradient: 'from-blush-300 to-blush-500' },
  staff: { label: 'Educator', emoji: '🧑‍🏫', name: 'Ms. Dana', sub: 'Lead Educator · Navigators', gradient: 'from-brand-400 to-brand-600' },
  admin: { label: 'Director', emoji: '🏫', name: 'Sam Carter', sub: 'Academy Director', gradient: 'from-sky-400 to-brand-500' },
}

// Close on outside click or Escape.
function useDismiss(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const key = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', click)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open, onClose])
  return ref
}

export default function Shell({ nav, children }) {
  const { role, view, setView, logout, isAuthenticated, viewer, facility } = useApp()
  const meta = roleMeta[role]
  const displayName = isAuthenticated && viewer?.name ? viewer.name : meta.name
  const displaySub = isAuthenticated && viewer?.email ? viewer.email : meta.sub
  const current = nav.find((n) => n.id === view)

  return (
    <div className="flex min-h-screen bg-tint">
      {/* Sidebar — desktop only. Nav scrolls on its own; brand + user card stay pinned. */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-line bg-gradient-to-b from-white to-tint p-5 lg:flex">
        <div className="pb-5"><BrandLockup variant="nav" /></div>
        <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-3">
          {nav.map((item) => {
            const active = item.id === view
            return (
              <button key={item.id} onClick={() => setView(item.id)} className={`nav-item shrink-0 ${active ? 'nav-item-active' : ''}`}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-gradient-to-br ' + meta.gradient + ' text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>
                  <item.icon size={18} strokeWidth={2.4} />
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-500 px-1.5 text-[11px] font-extrabold text-white">{item.badge}</span>
                ) : null}
              </button>
            )
          })}
        </nav>
        <div className="pt-3">
          <UserCard meta={meta} name={displayName} sub={displaySub} authed={isAuthenticated} onLogout={logout} img={viewer?.imageUrl} />
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-bar hairline-b sticky top-0 z-30 flex items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
          {/* compact logo on mobile */}
          <BrandLockup variant="topbar" className="lg:hidden" />
          <div className="hidden min-w-0 lg:block">
            <h1 className="truncate text-xl text-slate-800">{current?.label || 'Home'}</h1>
            <p className="eyebrow">{facility?.name || BRAND.short} · powered by {BRAND.short}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <HeaderSearch nav={nav} />
            <NotificationsBell />
            <ProfileMenu meta={meta} name={displayName} sub={displaySub} authed={isAuthenticated} onLogout={logout} img={viewer?.imageUrl} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6 lg:py-8 lg:pb-10 2xl:max-w-7xl">{children}</main>
      </div>

      {/* Mobile dock */}
      <BottomDock nav={nav} />
    </div>
  )
}

/* ── Search: pages, children, educators, families — ⌘K to focus ── */
function HeaderSearch({ nav }) {
  const { role, setView, childrenList, educators, conversations, setActiveChildId } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const close = () => { setOpen(false); setQ('') }
  const ref = useDismiss(open, close)

  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus() }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])

  const childView = role === 'admin' ? 'families' : role === 'staff' ? 'attendance' : 'profile'
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    const hit = (s) => (s || '').toLowerCase().includes(needle)
    const out = []
    nav.filter((n) => hit(n.label)).slice(0, 4).forEach((n) =>
      out.push({ key: 'v' + n.id, icon: n.icon, title: n.label, sub: 'Page', go: () => setView(n.id) }))
    childrenList.filter((c) => hit(c.name)).slice(0, 4).forEach((c) =>
      out.push({ key: 'c' + c.id, emoji: c.emoji, img: c.imageUrl, title: c.name, sub: `${c.age || ''}${c.room ? ' · ' + c.room : ''}` || 'Child', go: () => { setActiveChildId?.(c.id); setView(childView) } }))
    if (role !== 'parent') {
      educators.filter((e) => hit(e.name)).slice(0, 3).forEach((e) =>
        out.push({ key: 'e' + e.id, emoji: e.emoji || '🧑‍🏫', img: e.imageUrl, title: e.name, sub: e.title || 'Educator', go: () => setView(role === 'admin' ? 'staff' : 'home') }))
    }
    conversations.filter((c) => hit(c.name)).slice(0, 3).forEach((c) =>
      out.push({ key: 'm' + c.id, emoji: c.emoji || '💬', title: c.name, sub: 'Conversation', go: () => setView('messages') }))
    return out.slice(0, 9)
  }, [q, nav, childrenList, educators, conversations, role])

  const pick = (r) => { r.go(); close(); inputRef.current?.blur() }

  return (
    <div ref={ref} className="relative hidden md:block">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 transition focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100">
        <Search size={16} className="text-slate-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) pick(results[0]) }}
          placeholder="Search…"
          className="w-36 bg-transparent text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400"
        />
        <kbd className="rounded-md border border-line bg-slate-50 px-1.5 font-mono text-[10px] font-bold text-slate-400">⌘K</kbd>
      </div>
      {open && q.trim() && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-3xl border border-line bg-white shadow-playful"
        >
          {results.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm font-semibold text-slate-400">Nothing for “{q.trim()}” — try a name or a page.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto p-2">
              {results.map((r, i) => (
                <button key={r.key} onClick={() => pick(r)} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-brand-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-base text-slate-500">
                    {r.img ? <img src={r.img} alt="" className="h-full w-full object-cover" /> : r.icon ? <r.icon size={17} /> : r.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-slate-700">{r.title}</span>
                    <span className="block truncate text-xs font-semibold text-slate-400">{r.sub}</span>
                  </span>
                  {i === 0 ? <CornerDownLeft size={14} className="shrink-0 text-slate-300" /> : <ChevronRight size={14} className="shrink-0 text-slate-300" />}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

/* ── Notifications: derived live from messages, billing & milestones ── */
function NotificationsBell() {
  const { role, setView, conversations, invoices, milestones, childrenList, photos } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))

  const childName = (id) => childrenList.find((c) => c.id === id)?.first
  const items = useMemo(() => {
    const out = []
    conversations.filter((c) => c.unread > 0).forEach((c) =>
      out.push({ key: 'm' + c.id, icon: MessageCircle, tone: 'bg-brand-50 text-brand-600', title: `${c.name}`, sub: c.messages[c.messages.length - 1]?.text || 'New message', count: c.unread, go: () => setView('messages'), fresh: true }))
    if (role === 'parent') {
      const due = invoices.find((i) => i.status === 'due')
      if (due) out.push({ key: 'inv', icon: CreditCard, tone: 'bg-coral-50 text-coral-500', title: 'Tuition invoice due', sub: due.amount ? `$${due.amount}` : 'Tap to review & pay', go: () => setView('billing'), fresh: true })
    }
    ;(milestones || []).slice(-2).reverse().forEach((m) =>
      out.push({ key: 'ms' + m.id, icon: Sparkles, tone: 'bg-grape-400/15 text-grape-600', title: `Milestone: ${m.label}`, sub: [childName(m.childId), m.date].filter(Boolean).join(' · '), go: () => setView(role === 'parent' ? 'memories' : 'milestones') }))
    const lastPhoto = photos[0]
    if (lastPhoto) out.push({ key: 'ph' + lastPhoto.id, icon: ImageIcon, tone: 'bg-mint-400/15 text-mint-600', title: 'New photo in the feed', sub: lastPhoto.caption || 'Tap to see the latest moments', go: () => setView('photos') })
    return out.slice(0, 8)
  }, [conversations, invoices, milestones, photos, role, childrenList])

  const freshCount = items.filter((i) => i.fresh).reduce((n, i) => n + (i.count || 1), 0)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={freshCount ? `Notifications — ${freshCount} new` : 'Notifications'}
        className="relative rounded-2xl border border-line bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 active:scale-90"
      >
        <Bell size={18} />
        {freshCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-coral-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-white">{freshCount}</span>
        )}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-line bg-white shadow-playful"
        >
          <div className="border-b border-line px-4 py-3 text-sm font-extrabold text-slate-700">Notifications</div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-6 text-center">
              <img src="/cinema/spots/nap.webp" alt="" className="h-20 w-20 rounded-2xl object-cover" />
              <p className="mt-3 text-sm font-extrabold text-slate-700">You’re all caught up</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">New messages, milestones and billing updates land here.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto p-2">
              {items.map((it) => (
                <button key={it.key} onClick={() => { it.go(); setOpen(false) }} className="flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition hover:bg-brand-50">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${it.tone}`}><it.icon size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-slate-700">{it.title}</span>
                    <span className="block truncate text-xs font-semibold text-slate-400">{it.sub}</span>
                  </span>
                  {it.count ? <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-500 px-1.5 text-[11px] font-extrabold text-white">{it.count}</span> : null}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

/* ── Profile chip → menu ── */
function ProfileMenu({ meta, name, sub, authed, onLogout, img }) {
  const { setView } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-2xl bg-gradient-to-br ${meta.gradient} p-1 pr-3 text-white shadow-md transition hover:-translate-y-0.5 active:scale-95`}
      >
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-white/25 text-base">
          {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : meta.emoji}
        </span>
        <span className="hidden text-sm font-extrabold sm:block">{name.split(' ')[0]}</span>
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-3xl border border-line bg-white shadow-playful"
        >
          <div className="border-b border-line px-4 py-3">
            <div className="truncate text-sm font-extrabold text-slate-700">{name}</div>
            <div className="truncate text-xs font-semibold text-slate-400">{sub}</div>
          </div>
          <div className="p-2">
            <button onClick={() => { setView('me'); setOpen(false) }} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left text-sm font-bold text-slate-600 transition hover:bg-brand-50">
              <User size={16} className="text-slate-400" /> My profile
            </button>
            <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left text-sm font-bold text-coral-600 transition hover:bg-coral-50">
              <LogOut size={16} /> {authed ? 'Sign out' : 'Switch role'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function UserCard({ meta, name, sub, authed, onLogout, img }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${meta.gradient} text-lg text-white`}>
          {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : meta.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold text-slate-700">{name}</div>
          <div className="truncate text-xs font-semibold text-slate-400">{sub}</div>
        </div>
      </div>
      <button onClick={onLogout} className="btn-ghost mt-3 w-full !py-2 text-sm">
        <LogOut size={16} /> {authed ? 'Sign out' : 'Switch role'}
      </button>
    </div>
  )
}
