import { LogOut, Bell, Search } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { BRAND } from '../brand.js'
import BrandLockup from './BrandLockup.jsx'
import BottomDock from './BottomDock.jsx'

const roleMeta = {
  parent: { label: 'Parent', emoji: '👨‍👩‍👧', name: 'Jordan Rivera', sub: 'Mia & Leo’s parent', gradient: 'from-blush-300 to-blush-500' },
  staff: { label: 'Educator', emoji: '🧑‍🏫', name: 'Ms. Dana', sub: 'Lead Educator · Navigators', gradient: 'from-brand-400 to-brand-600' },
  admin: { label: 'Director', emoji: '🏫', name: 'Sam Carter', sub: 'Academy Director', gradient: 'from-sky-400 to-brand-500' },
}

export default function Shell({ nav, children }) {
  const { role, view, setView, logout, isAuthenticated, viewer, facility } = useApp()
  const meta = roleMeta[role]
  const displayName = isAuthenticated && viewer?.name ? viewer.name : meta.name
  const displaySub = isAuthenticated && viewer?.email ? viewer.email : meta.sub
  const current = nav.find((n) => n.id === view)

  return (
    <div className="flex min-h-screen bg-tint">
      {/* Sidebar — desktop only */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col gap-6 border-r border-line bg-gradient-to-b from-white to-tint p-5 lg:flex">
        <Brand />
        <nav className="flex flex-col gap-1.5">
          {nav.map((item) => {
            const active = item.id === view
            return (
              <button key={item.id} onClick={() => setView(item.id)} className={`nav-item ${active ? 'nav-item-active' : ''}`}>
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
        <div className="mt-auto">
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
            <div className="hidden items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 md:flex">
              <Search size={16} className="text-slate-400" />
              <input placeholder="Search…" className="w-32 bg-transparent text-sm font-semibold text-slate-600 outline-none placeholder:text-slate-400" />
            </div>
            <button className="relative rounded-2xl border border-line bg-white p-2.5 text-slate-500 transition active:scale-90 hover:bg-slate-50">
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-coral-500 ring-2 ring-white" />
            </button>
            <div className={`flex items-center gap-2 rounded-2xl bg-gradient-to-br ${meta.gradient} p-1 pr-3 text-white shadow-md`}>
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-white/25 text-base">
                {viewer?.imageUrl ? <img src={viewer.imageUrl} alt="" className="h-full w-full object-cover" /> : meta.emoji}
              </span>
              <span className="hidden text-sm font-extrabold sm:block">{displayName.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6 lg:py-8 lg:pb-10 2xl:max-w-7xl">{children}</main>
      </div>

      {/* Mobile dock */}
      <BottomDock nav={nav} />
    </div>
  )
}

function Brand() {
  return <BrandLockup variant="nav" />
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
