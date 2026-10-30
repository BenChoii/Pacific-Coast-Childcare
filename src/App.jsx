import {
  Home, ListChecks, Image, MessageCircle, CalendarDays, CreditCard, Baby,
  ClipboardList, BookOpen, LogIn, Users, Sprout, Wallet, DoorOpen, BarChart3, User,
  TrendingUp, UsersRound, GraduationCap, Settings, Sparkles, BookHeart, Banknote, Wind, ScanLine, PiggyBank, ReceiptText, Landmark, Inbox,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {lazy,Suspense} from 'react'
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
const Account=lazy(()=>import('./views/account.jsx').then(module=>({default:module.Account})))
const ParentCalendar=lazy(()=>import('./views/parent.jsx').then(module=>({default:module.ParentCalendar})))
const ParentBilling=lazy(()=>import('./views/parent.jsx').then(module=>({default:module.ParentBilling})))
const StaffHome=lazy(()=>import('./views/staff.jsx').then(module=>({default:module.StaffHome})))
const Attendance=lazy(()=>import('./views/staff.jsx').then(module=>({default:module.Attendance})))
const LogActivity=lazy(()=>import('./views/staff.jsx').then(module=>({default:module.LogActivity})))
const Enrollment=lazy(()=>import('./views/admin.jsx').then(module=>({default:module.Enrollment})))
const AdminBilling=lazy(()=>import('./views/admin.jsx').then(module=>({default:module.AdminBilling})))
const Rooms=lazy(()=>import('./views/admin.jsx').then(module=>({default:module.Rooms})))
const Profitability=lazy(()=>import('./views/director.jsx').then(module=>({default:module.Profitability})))
const Families=lazy(()=>import('./views/director.jsx').then(module=>({default:module.Families})))
const EducatorsAdmin=lazy(()=>import('./views/director.jsx').then(module=>({default:module.EducatorsAdmin})))
const EducatorLessons=lazy(()=>import('./views/lessons.jsx').then(module=>({default:module.EducatorLessons})))
const DirectorCurriculum=lazy(()=>import('./views/lessons.jsx').then(module=>({default:module.DirectorCurriculum})))
const MilestoneTracker=lazy(()=>import('./views/milestones.jsx').then(module=>({default:module.MilestoneTracker})))
const MemoryBook=lazy(()=>import('./views/milestones.jsx').then(module=>({default:module.MemoryBook})))
const Payroll=lazy(()=>import('./views/payroll.jsx').then(module=>({default:module.Payroll})))
const CalmCorner=lazy(()=>import('./views/calm.jsx').then(module=>({default:module.CalmCorner})))
const IntakeDesk=lazy(()=>import('./views/intake.jsx').then(module=>({default:module.IntakeDesk})))
const FinanceStudio=lazy(()=>import('./views/finance.jsx').then(module=>({default:module.FinanceStudio})))
const ExtrasLogger=lazy(()=>import('./views/finance.jsx').then(module=>({default:module.ExtrasLogger})))
const InvoicingStudio=lazy(()=>import('./views/invoicing.jsx').then(module=>({default:module.InvoicingStudio})))
const SubsidiesStudio=lazy(()=>import('./views/subsidies.jsx').then(module=>({default:module.SubsidiesStudio})))
const DirectorCalendar=lazy(()=>import('./views/calendar.jsx').then(module=>({default:module.DirectorCalendar})))
import OwnerActivity from './views/owner-activity.jsx'
const Crm=lazy(()=>import('./views/crm.jsx').then(module=>({default:module.Crm})))
const BookkeepingStudio=lazy(()=>import('./views/bookkeeping.jsx').then(module=>({default:module.BookkeepingStudio})))
import { FamilyToday, FamilyDailyLog, FamilyProfile, Incidents } from './views/care.jsx'
import { DirectorToday, WorkingReports } from './views/today.jsx'

function PostPhotos(){return <Photos canPost/>}

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
  const { role, view, conversations, announcements, authResolving, isAuthenticated, viewer, facility, claimArea, paymentReturnError, retryPaymentReturn } = useApp()

  if (authResolving) return <Loader />
  if (isAuthenticated && viewer?.accessStatus === 'suspended') return <AccessNotice suspended />
  if (!role) return <Login />
  if (isAuthenticated && viewer?.role === 'parent' && viewer?.hasActiveChildren === false && viewer?.hasFacility) return <AccessNotice />

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
      window.history.replaceState(null, '', '/app')
    }
  }

  const unread = conversations.reduce((n, c) => n + c.unread, 0) + (announcements?.unread || 0)

  const navConfig = {
    parent: [
      { id: 'home', label: 'Home', icon: Home, render: FamilyToday, dock: true },
      { id: 'timeline', label: 'Daily Log', icon: ListChecks, render: FamilyDailyLog, dock: true },
      { id: 'messages', label: 'Messages', icon: MessageCircle, render: Messages, badge: unread || null, dock: true },
      { id: 'photos', label: 'Photos', icon: Image, render: Photos },
      { id: 'memories', label: 'Memory Book', icon: BookHeart, render: MemoryBook },
      { id: 'calendar', label: 'Calendar', icon: CalendarDays, render: ParentCalendar },
      { id: 'billing', label: 'Billing', icon: CreditCard, render: ParentBilling },
      { id: 'incidents', label: 'Incident reports', icon: ClipboardList, render: Incidents },
      { id: 'profile', label: 'Child Profile', icon: Baby, render: FamilyProfile },
      { id: 'me', label: 'Me', icon: User, render: Me, dock: true },
    ],
    staff: [
      { id: 'home', label: 'Home', icon: Home, render: StaffHome, dock: true },
      { id: 'attendance', label: 'Attendance', icon: LogIn, render: Attendance, dock: true },
      { id: 'messages', label: 'Messages', icon: MessageCircle, render: Messages, badge: unread || null, dock: true },
      { id: 'log', label: 'Log Activity', icon: ClipboardList, render: LogActivity },
      { id: 'incidents', label: 'Incident reports', icon: ClipboardList, render: Incidents },
      { id: 'extras', label: 'Extras', icon: ReceiptText, render: ExtrasLogger },
      { id: 'photos', label: 'Photos', icon: Image, render: PostPhotos },
      { id: 'milestones', label: 'Milestones', icon: Sparkles, render: MilestoneTracker },
      { id: 'calm', label: 'Calm Corner', icon: Wind, render: CalmCorner },
      { id: 'intake', label: 'Intake', icon: ScanLine, render: IntakeDesk },
      { id: 'lesson', label: 'Lesson Plans', icon: BookOpen, render: EducatorLessons },
      { id: 'calendar', label: 'Calendar', icon: CalendarDays, render: ParentCalendar },
      { id: 'me', label: 'Me', icon: User, render: Me, dock: true },
    ],
    admin: [
      { id: 'home', label: 'Dashboard', icon: Home, render: DirectorToday, dock: true },
      { id: 'attendance', label: 'Attendance', icon: LogIn, render: Attendance, dock: true },
      { id: 'log', label: 'Log care activity', icon: ClipboardList, render: LogActivity },
      { id: 'incidents', label: 'Incident reports', icon: ClipboardList, render: Incidents },
      { id: 'account', label: 'Account', icon: Settings, render: Account },
      { id: 'finance', label: 'Finance', icon: PiggyBank, render: FinanceStudio },
      { id: 'invoices', label: 'Invoices', icon: ReceiptText, render: InvoicingStudio },
      { id: 'subsidies', label: 'Subsidies', icon: Landmark, render: SubsidiesStudio },
      { id: 'profit', label: 'Profitability', icon: TrendingUp, render: Profitability },
      { id: 'books', label: 'Bookkeeping', icon: BookOpen, render: BookkeepingStudio },
      { id: 'families', label: 'Families', icon: UsersRound, render: Families, dock: true },
      { id: 'inquiries', label: 'Inquiries', icon: Inbox, render: Crm },
      { id: 'photos', label: 'Photos', icon: Image, render: PostPhotos },
      { id: 'messages', label: 'Messages', icon: MessageCircle, render: Messages, badge: unread || null, dock:true },
      { id: 'calendar', label: 'Calendar & closures', icon: CalendarDays, render: DirectorCalendar },
      { id: 'alerts', label: 'Activity & alerts', icon: Inbox, render: OwnerActivity },
      { id: 'curriculum', label: 'Curriculum', icon: GraduationCap, render: DirectorCurriculum },
      { id: 'milestones', label: 'Milestones', icon: Sparkles, render: MilestoneTracker },
      { id: 'calm', label: 'Calm Corner', icon: Wind, render: CalmCorner },
      { id: 'staff', label: 'Educators', icon: Users, render: EducatorsAdmin },
      { id: 'payroll', label: 'Payroll', icon: Banknote, render: Payroll },
      { id: 'intake', label: 'Intake', icon: ScanLine, render: IntakeDesk },
      { id: 'enrollment', label: 'Enrollment', icon: Sprout, render: Enrollment },
      { id: 'billing', label: 'Tuition', icon: Wallet, render: AdminBilling },
      { id: 'rooms', label: 'Rooms', icon: DoorOpen, render: Rooms },
      { id: 'reports', label: 'Reports', icon: BarChart3, render: WorkingReports },
      { id: 'me', label: 'Me', icon: User, render: Me },
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
        {paymentReturnError && <div role="alert" className="mb-5 rounded-2xl border border-coral-200 bg-coral-50 p-4"><p className="text-sm text-coral-700">{paymentReturnError}</p><button onClick={retryPaymentReturn} className="btn-ghost mt-3">Retry confirmation</button></div>}
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
            <Suspense fallback={<div role="status" className="p-6 text-slate-500">Opening this page…</div>}><View /></Suspense>
          </ErrorBoundary>
        </motion.div>
      </Shell>
      <Toasts />
    </>
  )
}

function AccessNotice({ suspended = false }) {
  const { logout, membershipError, retryMembership, joiningFacility } = useApp()
  return <div className="aurora flex min-h-screen items-center justify-center px-5"><div className="max-w-lg rounded-3xl bg-white p-8 shadow-card">
    <BrandLockup variant="nav" />
    <h1 className="mt-6 text-3xl text-brand-700">{suspended ? 'Daycare access has ended' : 'Your family dashboard'}</h1>
    <p className="mt-3 text-slate-600">{suspended ? 'Your daycare has suspended this account’s access. Contact the owner if you need help.' : 'Your account is ready. The daycare needs to link your child’s active enrolment before their schedule and updates appear.'}</p>
    {joiningFacility && <p role="status" className="mt-4 text-sm">Connecting your enrolment…</p>}
    {membershipError && <div role="alert" className="mt-4"><p className="text-sm text-coral-600">{membershipError}</p><button disabled={joiningFacility} className="btn-ghost mt-3" onClick={retryMembership}>Retry joining</button></div>}
    <button className="btn-primary mt-6" onClick={logout}>Sign out</button>
  </div></div>
}
