import {
  Home, ListChecks, Image, MessageCircle, CalendarDays, CreditCard, Baby,
  ClipboardList, BookOpen, LogIn, Users, Sprout, Wallet, DoorOpen, BarChart3, User,
  TrendingUp, UsersRound, GraduationCap, Settings, Sparkles, BookHeart, Banknote, Wind, ScanLine, PiggyBank, ReceiptText, Landmark, Inbox,
} from 'lucide-react'
import { motion } from 'framer-motion'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { useApp } from './context/AppContext.jsx'
import { getEntry } from './routes.js'
import Login from './components/Login.jsx'
import Shell from './components/Shell.jsx'
import Toasts from './components/Toasts.jsx'
import BrandLockup from './components/BrandLockup.jsx'
import CreateFacility from './components/CreateFacility.jsx'
import NoFacility from './components/NoFacility.jsx'
import Onboarding from './components/Onboarding.jsx'
import Messages from './views/Messages.jsx'
import Photos from './views/Photos.jsx'
import Me from './views/Me.jsx'
import { Account } from './views/account.jsx'
import { ParentHome, ParentTimeline, ParentCalendar, ParentBilling, ParentProfile } from './views/parent.jsx'
import { StaffHome, Attendance, LogActivity } from './views/staff.jsx'
import { AdminHome, Enrollment, AdminBilling, Rooms, Reports } from './views/admin.jsx'
import { Profitability, Families, EducatorsAdmin } from './views/director.jsx'
import { EducatorLessons, DirectorCurriculum } from './views/lessons.jsx'
import { MilestoneTracker, MemoryBook } from './views/milestones.jsx'
import { Payroll } from './views/payroll.jsx'
import { CalmCorner } from './views/calm.jsx'
import { IntakeDesk } from './views/intake.jsx'
import { FinanceStudio, ExtrasLogger } from './views/finance.jsx'
import { InvoicingStudio } from './views/invoicing.jsx'
import { SubsidiesStudio } from './views/subsidies.jsx'
import { Crm } from './views/crm.jsx'
import { BookkeepingStudio } from './views/bookkeeping.jsx'

function Loader() {
  return (
    <div className="aurora relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden">
      <div className="blob blob-a left-[-5rem] top-[-3rem] h-72 w-72 bg-sky-300/60" />
      <div className="blob blob-b bottom-[-4rem] right-[-4rem] h-80 w-80 bg-blush-300/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: [1, 1.04, 1] }}
        transition={{ opacity: { duration: 0.4 }, scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }}
        className="relative"
      >
        <BrandLockup variant="hero" />
      </motion.div>
      <div className="relative h-1.5 w-44 overflow-hidden rounded-full bg-white/70">
        <div className="sweep-bar h-full w-2/5 rounded-full bg-gradient-to-r from-brand-400 via-sky-400 to-brand-400" />
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="eyebrow relative">
        Setting up your day…
      </motion.p>
    </div>
  )
}

// Shown when a signed-in user lands on /signup or an invite link.
function AlreadySignedIn({ viewer, facility, joining }) {
  const { logout } = useApp()
  const first = (viewer?.name || 'there').split(' ')[0]
  return (
    <div className="aurora relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="blob blob-a left-[-5rem] top-[-3rem] h-72 w-72 bg-sky-300/60" />
      <div className="blob blob-b bottom-[-4rem] right-[-4rem] h-80 w-80 bg-blush-300/60" />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-md rounded-4xl border border-white/70 bg-white/80 p-8 text-center shadow-playful backdrop-blur-xl"
      >
        <div className="mx-auto mb-5 flex justify-center"><BrandLockup variant="nav" /></div>
        <p className="eyebrow">Already signed in</p>
        <h1 className="mt-1 text-3xl text-brand-700">Welcome back, {first} 👋</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
          You're signed in{facility?.name ? <> to <strong>{facility.name}</strong></> : null}.
          {joining ? ' To accept this invite with a different account, sign out first.' : ' To create a separate daycare, sign out first.'}
        </p>
        <div className="mt-6 space-y-2.5">
          <button onClick={() => { window.location.href = '/app' }} className="btn-primary w-full py-3">Open my portal</button>
          <button onClick={logout} className="btn-ghost w-full py-3">
            Sign out &amp; {joining ? 'accept the invite' : 'start a new daycare'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function App() {
  const { role, view, conversations, authResolving, isAuthenticated, viewer, facility, claimArea } = useApp()

  if (authResolving) return <Loader />
  if (!role) return <Login />

  // ── Tenant gate (signed-in users) ──
  if (isAuthenticated && viewer) {
    if (viewer.hasFacility === false) {
      return viewer.role === 'admin' ? <CreateFacility /> : <NoFacility />
    }
    // Has a facility — wait for it to resolve, then onboard new owners.
    if (facility === null) return <Loader />
    // A daycare claiming its directory listing skips the full onboarding wizard —
    // they just want to set their status. Saving it counts as onboarding.
    if (facility && !facility.isDemo && !facility.onboarded && facility.isOwner && !claimArea) return <Onboarding />
  }

  // A signed-in user clicking "Start free" (/signup) or an invite link must get
  // a clear choice — not a silent hop into their existing portal. But someone
  // who JUST signed in/up on this very screen goes straight to their portal.
  const entry = getEntry()
  // A returning owner clicking a "claim your listing" link (/signup?claim=<area>)
  // should land in their portal (→ Account · Public listing), not the
  // "create a separate daycare" wall. claimArea persists past the URL rewrite.
  const claiming = !!claimArea
  if (isAuthenticated && viewer && (entry.kind === 'owner' || entry.kind === 'join')) {
    if (sessionStorage.getItem('cubby_fresh_auth')) {
      sessionStorage.removeItem('cubby_fresh_auth')
      window.history.replaceState(null, '', '/app')
    } else if (facility?.onboarded && !facility?.isDemo && !(claiming && entry.kind === 'owner')) {
      return <AlreadySignedIn viewer={viewer} facility={facility} joining={entry.kind === 'join'} />
    }
  }

  const unread = conversations.reduce((n, c) => n + c.unread, 0)

  const navConfig = {
    parent: [
      { id: 'home', label: 'Home', icon: Home, render: ParentHome, dock: true },
      { id: 'timeline', label: 'Daily Log', icon: ListChecks, render: ParentTimeline, dock: true },
      { id: 'messages', label: 'Messages', icon: MessageCircle, render: Messages, badge: unread || null, dock: true },
      { id: 'photos', label: 'Photos', icon: Image, render: () => <Photos /> },
      { id: 'memories', label: 'Memory Book', icon: BookHeart, render: MemoryBook },
      { id: 'calendar', label: 'Calendar', icon: CalendarDays, render: ParentCalendar },
      { id: 'billing', label: 'Billing', icon: CreditCard, render: ParentBilling },
      { id: 'profile', label: 'Child Profile', icon: Baby, render: ParentProfile },
      { id: 'me', label: 'Me', icon: User, render: Me, dock: true },
    ],
    staff: [
      { id: 'home', label: 'Home', icon: Home, render: StaffHome, dock: true },
      { id: 'attendance', label: 'Attendance', icon: LogIn, render: Attendance, dock: true },
      { id: 'messages', label: 'Messages', icon: MessageCircle, render: Messages, badge: unread || null, dock: true },
      { id: 'log', label: 'Log Activity', icon: ClipboardList, render: LogActivity },
      { id: 'extras', label: 'Extras', icon: ReceiptText, render: ExtrasLogger },
      { id: 'photos', label: 'Photos', icon: Image, render: () => <Photos canPost /> },
      { id: 'milestones', label: 'Milestones', icon: Sparkles, render: MilestoneTracker },
      { id: 'calm', label: 'Calm Corner', icon: Wind, render: CalmCorner },
      { id: 'intake', label: 'Intake', icon: ScanLine, render: IntakeDesk },
      { id: 'lesson', label: 'Lesson Plans', icon: BookOpen, render: EducatorLessons },
      { id: 'me', label: 'Me', icon: User, render: Me, dock: true },
    ],
    admin: [
      { id: 'home', label: 'Dashboard', icon: Home, render: AdminHome, dock: true },
      { id: 'account', label: 'Account', icon: Settings, render: Account, dock: true },
      { id: 'finance', label: 'Finance', icon: PiggyBank, render: FinanceStudio },
      { id: 'invoices', label: 'Invoices', icon: ReceiptText, render: InvoicingStudio },
      { id: 'subsidies', label: 'Subsidies', icon: Landmark, render: SubsidiesStudio },
      { id: 'profit', label: 'Profitability', icon: TrendingUp, render: Profitability },
      { id: 'books', label: 'Bookkeeping', icon: BookOpen, render: BookkeepingStudio },
      { id: 'families', label: 'Families', icon: UsersRound, render: Families, dock: true },
      { id: 'inquiries', label: 'Inquiries', icon: Inbox, render: Crm },
      { id: 'photos', label: 'Photos', icon: Image, render: () => <Photos canPost /> },
      { id: 'messages', label: 'Messages', icon: MessageCircle, render: Messages, badge: unread || null },
      { id: 'curriculum', label: 'Curriculum', icon: GraduationCap, render: DirectorCurriculum },
      { id: 'milestones', label: 'Milestones', icon: Sparkles, render: MilestoneTracker },
      { id: 'calm', label: 'Calm Corner', icon: Wind, render: CalmCorner },
      { id: 'staff', label: 'Educators', icon: Users, render: EducatorsAdmin },
      { id: 'payroll', label: 'Payroll', icon: Banknote, render: Payroll },
      { id: 'intake', label: 'Intake', icon: ScanLine, render: IntakeDesk },
      { id: 'enrollment', label: 'Enrollment', icon: Sprout, render: Enrollment },
      { id: 'billing', label: 'Tuition', icon: Wallet, render: AdminBilling },
      { id: 'rooms', label: 'Rooms', icon: DoorOpen, render: Rooms },
      { id: 'reports', label: 'Reports', icon: BarChart3, render: Reports },
      { id: 'me', label: 'Me', icon: User, render: Me, dock: true },
    ],
  }

  // Hide the paid director add-ons (CRM, bookkeeping) unless this facility has
  // them (the demo gets them so the sales tour can show them off). Keeps every
  // other daycare from seeing an upgrade CTA before billing is wired.
  const nav = (navConfig[role] || []).filter((item) => {
    if (item.id === 'inquiries') return !!facility?.addons?.crm
    if (item.id === 'books') return !!facility?.addons?.bookkeeping
    return true
  })
  const active = nav.find((n) => n.id === view) || nav[0]
  const View = active.render

  return (
    <>
      <Shell nav={nav}>
        {/* Native-feel page transition: keyed remount — each page settles in with
            a refined fade + slide + whisper of scale on every navigation, and its
            cards cascade behind it. AnimatePresence (exit/cross-fade) is avoided:
            in this app's StrictMode it leaves exiting pages mounted (they pile up). */}
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <ErrorBoundary resetKey={active.id}>
            <View />
          </ErrorBoundary>
        </motion.div>
      </Shell>
      <Toasts />
    </>
  )
}
