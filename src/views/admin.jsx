import { motion } from 'framer-motion'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import {
  Users, DollarSign, TrendingUp, UserPlus, Building2, Clock, AlertTriangle,
  CheckCircle2, ArrowUpRight, Wallet, Percent,
  Baby, Share2, Image as ImageIcon, MessageCircle, BookOpen, CreditCard, Plus, ArrowRight,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { StatCard, Card, SectionHeader, Pill, Avatar, ProgressBar, HomeSkeleton } from '../components/ui.jsx'
import {
  enrollmentPipeline, staffSchedule, rooms, attendanceTrend, revenueTrend,
  enrollmentByRoom, billingSummary,
} from '../data/mockData.js'

const chartTooltip = {
  contentStyle: {
    borderRadius: 16,
    border: 'none',
    boxShadow: '0 8px 30px -10px rgba(15,23,42,0.2)',
    fontWeight: 700,
    fontSize: 12,
  },
}

/* ---------------- Admin Dashboard ---------------- */
export function AdminHome() {
  const { setView, loading, roster, facility } = useApp()
  const totalEnrolled = rooms.reduce((n, r) => n + r.enrolled, 0)
  const capacity = rooms.reduce((n, r) => n + r.capacity, 0)

  if (loading && roster.length === 0) return <HomeSkeleton />

  // Real facilities get a clean, true-to-their-data dashboard instead of the
  // sample analytics (which stay on the demo workspace for sales walkthroughs).
  if (facility && !facility.isDemo) return <RealAdminHome />

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-mint-400 via-brand-500 to-grape-500 p-6 text-white shadow-playful sm:p-8"
      >
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <span className="absolute right-8 top-6 hidden text-6xl opacity-90 sm:block animate-float">🏫</span>
        <p className="text-sm font-bold text-white/80">Center overview · Saturday, Jun 7</p>
        <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{totalEnrolled} enrolled · {Math.round((totalEnrolled / capacity) * 100)}% capacity</h2>
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur">
          <TrendingUp size={16} /> Revenue up 12% vs. last quarter
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Enrolled" value={totalEnrolled} sub={`of ${capacity} spots`} gradient="from-brand-400 to-brand-600" />
        <StatCard icon={UserPlus} label="Open inquiries" value="14" sub="3 tours this week" gradient="from-grape-400 to-grape-600" delay={0.05} />
        <StatCard icon={DollarSign} label="Collected (MTD)" value="$64.2k" sub="78% on auto-pay" gradient="from-mint-400 to-mint-500" delay={0.1} />
        <StatCard icon={AlertTriangle} label="Overdue" value="$2.1k" sub="2 families" gradient="from-coral-400 to-coral-600" delay={0.15} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" delay={0.1}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-800">Revenue trend</h3>
              <p className="text-xs font-bold text-slate-400">Monthly tuition collected ($000s)</p>
            </div>
            <Pill className="bg-mint-400/15 text-mint-500"><ArrowUpRight size={14} /> +12%</Pill>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueTrend} margin={{ left: -20, right: 8 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0E74C1" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#0E74C1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#eef2f6" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontWeight: 700, fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontWeight: 700, fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip {...chartTooltip} formatter={(v) => [`$${v}k`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#0E74C1" strokeWidth={3} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card delay={0.15}>
          <h3 className="mb-3 font-extrabold text-slate-800">Enrollment by room</h3>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={enrollmentByRoom} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                {enrollmentByRoom.map((e) => (
                  <Cell key={e.name} fill={e.color} />
                ))}
              </Pie>
              <Tooltip {...chartTooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {enrollmentByRoom.map((e) => (
              <div key={e.name} className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                {e.name}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card delay={0.2}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800">Weekly attendance</h3>
          <button onClick={() => setView('reports')} className="text-sm font-extrabold text-brand-600">Reports →</button>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={attendanceTrend} margin={{ left: -20, right: 8 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#eef2f6" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontWeight: 700, fontSize: 12, fill: '#94a3b8' }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontWeight: 700, fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip {...chartTooltip} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="present" radius={[8, 8, 0, 0]} fill="#6E84C8" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

/* ---------------- Real facility dashboard ---------------- */
function RealAdminHome() {
  const { setView, facility, childrenList, educators } = useApp()
  const kids = childrenList.length
  const present = (childrenList || []).filter((c) => c.status === 'checked-in' || c.status === 'napping').length

  const quick = [
    { label: 'Add a child', desc: 'Enroll a new little one', icon: Baby, tone: 'from-brand-400 to-brand-600', go: 'account' },
    { label: 'Invite families', desc: 'Share your parent link', icon: Share2, tone: 'from-blush-300 to-blush-500', go: 'account' },
    { label: 'Share a photo', desc: 'Post a moment to the feed', icon: ImageIcon, tone: 'from-coral-400 to-blush-500', go: 'photos' },
    { label: 'Message families', desc: 'Two-way chat', icon: MessageCircle, tone: 'from-grape-400 to-grape-600', go: 'messages' },
    { label: 'Build a lesson plan', desc: 'Plan the week & training', icon: BookOpen, tone: 'from-mint-400 to-brand-400', go: 'curriculum' },
    { label: 'Plan & billing', desc: 'Your plan and card', icon: CreditCard, tone: 'from-sky-400 to-brand-500', go: 'account' },
  ]

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-mint-400 via-brand-500 to-grape-500 p-6 text-white shadow-playful sm:p-8"
      >
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <span className="absolute right-8 top-6 hidden text-6xl opacity-90 sm:block animate-float">🧸</span>
        <p className="text-sm font-bold text-white/80">Welcome back · {facility?.name}</p>
        <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
          {kids === 0 ? 'Let’s enroll your first child' : `${kids} ${kids === 1 ? 'child' : 'children'} enrolled`}
        </h2>
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur">
          {facility?.billable ? <><CreditCard size={15} /> ${facility.monthly?.toFixed(2)}/mo plan</> : <><CheckCircle2 size={15} /> Free plan · {facility?.remainingFree} of {facility?.freeLimit} spots left</>}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Enrolled" value={kids} sub={kids === 0 ? 'add your first' : 'children'} gradient="from-brand-400 to-brand-600" />
        <StatCard icon={CheckCircle2} label="In today" value={present} sub="checked in" gradient="from-mint-400 to-mint-500" delay={0.05} />
        <StatCard icon={Building2} label="Educators" value={(educators || []).length} sub="on your team" gradient="from-grape-400 to-grape-600" delay={0.1} />
        <StatCard icon={Wallet} label="Monthly" value={facility?.billable ? `$${facility.monthly?.toFixed(0)}` : '$0'} sub={facility?.billable ? 'subscription' : 'free tier'} gradient="from-sky-400 to-brand-500" delay={0.15} />
      </div>

      <div>
        <h3 className="mb-3 font-extrabold text-slate-800">Quick actions</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quick.map((q, i) => (
            <motion.button
              key={q.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setView(q.go)}
              className="card flex items-center gap-3 p-4 text-left transition hover:-translate-y-1 hover:shadow-playful"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${q.tone} text-white shadow-md`}>
                <q.icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-slate-800">{q.label}</div>
                <div className="text-xs font-bold text-slate-400">{q.desc}</div>
              </div>
              <ArrowRight size={16} className="text-slate-300" />
            </motion.button>
          ))}
        </div>
      </div>

      {kids === 0 && (
        <Card className="border-dashed text-center">
          <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Plus size={22} /></span>
          <h3 className="font-extrabold text-slate-800">Your workspace is ready</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm font-semibold text-slate-400">
            Add your children, invite your families and educators, and start sharing the day. You’re free up to {facility?.freeLimit} children.
          </p>
          <button onClick={() => setView('account')} className="btn-primary mx-auto mt-4"><Baby size={16} /> Add your first child</button>
        </Card>
      )}
    </div>
  )
}

/* ---------------- Enrollment Pipeline ---------------- */
export function Enrollment() {
  const { facility, childrenList } = useApp()
  if (facility && !facility.isDemo) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Enrollment 🌱" subtitle={`${childrenList.length} children enrolled`} />
        {childrenList.length === 0 ? (
          <Card className="text-center"><p className="text-sm font-semibold text-slate-400">No children enrolled yet. Add them in Account → Children.</p></Card>
        ) : (
          <Card className="p-0">
            {childrenList.map((c, i, arr) => (
              <div key={c.id} className={`flex items-center gap-3 p-4 ${i !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${c.color} text-lg`}>{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-extrabold text-slate-700">{c.name}</div>
                  <div className="text-xs font-bold text-slate-400">{c.age} · {c.room} · {c.parent}</div>
                </div>
                <Pill className="bg-mint-400/15 text-mint-500">Enrolled</Pill>
              </div>
            ))}
          </Card>
        )}
        <p className="text-xs font-semibold text-slate-400">A full inquiry → tour → enrolled pipeline is coming. For now, add enrolled children in Account → Children.</p>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <SectionHeader title="Enrollment pipeline 🌱" subtitle="Track families from first inquiry to enrolled" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {enrollmentPipeline.map((stage, i) => (
          <motion.div
            key={stage.stage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="card p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${stage.color}`} />
                <span className="font-extrabold text-slate-800">{stage.stage}</span>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-extrabold text-slate-600">{stage.count}</span>
            </div>
            <div className="space-y-2">
              {stage.leads.map((lead) => (
                <div key={lead} className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100">
                  {lead}
                </div>
              ))}
              {stage.count > stage.leads.length && (
                <div className="px-1 text-xs font-bold text-slate-400">+ {stage.count - stage.leads.length} more</div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Admin Billing ---------------- */
export function AdminBilling() {
  const { facility, childrenList } = useApp()
  if (facility && !facility.isDemo) {
    const revenue = childrenList.reduce((s, c) => s + (c.monthlyTuition || 0), 0)
    const withT = childrenList.filter((c) => (c.monthlyTuition || 0) > 0)
    return (
      <div className="space-y-6">
        <SectionHeader title="Tuition 💰" subtitle="What your families pay each month" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard icon={Wallet} label="Monthly tuition" value={`$${revenue.toLocaleString()}`} gradient="from-mint-400 to-mint-500" />
          <StatCard icon={Users} label="Paying families" value={withT.length} sub={`of ${childrenList.length}`} gradient="from-brand-400 to-brand-600" delay={0.05} />
          <StatCard icon={CreditCard} label="Cubby plan" value={facility.monthly ? `$${facility.monthly}` : 'Free'} gradient="from-grape-400 to-grape-600" delay={0.1} />
        </div>
        <Card className="p-0">
          <div className="border-b border-slate-100 p-4 font-extrabold text-slate-800">Per-child tuition</div>
          {childrenList.length === 0 ? (
            <div className="p-6 text-center text-sm font-semibold text-slate-400">Add children to track tuition.</div>
          ) : childrenList.map((c, i, arr) => (
            <div key={c.id} className={`flex items-center gap-3 p-4 ${i !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${c.color} text-lg`}>{c.emoji}</span>
              <div className="flex-1"><div className="font-extrabold text-slate-700">{c.name}</div><div className="text-xs font-bold text-slate-400">{c.parent}</div></div>
              <span className="font-extrabold text-slate-700">{c.monthlyTuition ? `$${c.monthlyTuition.toLocaleString()}/mo` : '—'}</span>
            </div>
          ))}
        </Card>
        <p className="text-xs font-semibold text-slate-400">Set each child’s tuition in Profitability. Families pay through the parent app (Stripe). Automated invoicing is coming.</p>
      </div>
    )
  }
  const pct = Math.round((billingSummary.collected / (billingSummary.collected + billingSummary.outstanding)) * 100)
  return (
    <div className="space-y-6">
      <SectionHeader title="Billing & payments 💰" subtitle="Center-wide tuition health" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Collected MTD" value={`$${(billingSummary.collected / 1000).toFixed(1)}k`} gradient="from-mint-400 to-mint-500" />
        <StatCard icon={Clock} label="Outstanding" value={`$${(billingSummary.outstanding / 1000).toFixed(1)}k`} gradient="from-sunshine-400 to-coral-500" delay={0.05} />
        <StatCard icon={AlertTriangle} label="Overdue" value={`$${(billingSummary.overdue / 1000).toFixed(1)}k`} gradient="from-coral-400 to-coral-600" delay={0.1} />
        <StatCard icon={Percent} label="Auto-pay" value={`${billingSummary.autopayRate}%`} gradient="from-grape-400 to-grape-600" delay={0.15} />
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800">Collection rate this month</h3>
          <span className="font-extrabold text-mint-500">{pct}%</span>
        </div>
        <ProgressBar value={pct} gradient="from-mint-400 to-brand-500" />
        <p className="mt-2 text-sm font-semibold text-slate-400">
          ${billingSummary.collected.toLocaleString()} collected · ${billingSummary.outstanding.toLocaleString()} still expected
        </p>
      </Card>

      <Card className="p-0">
        <div className="border-b border-slate-100 p-4 font-extrabold text-slate-800">Family balances</div>
        {[
          { name: 'Rivera family', emoji: '🐬', amt: 1180, status: 'On auto-pay', tone: 'bg-mint-400/15 text-mint-500' },
          { name: 'Patel family', emoji: '🦁', amt: 0, status: 'Paid', tone: 'bg-mint-400/15 text-mint-500' },
          { name: 'Brooks family', emoji: '🐝', amt: 1060, status: 'Due Jun 15', tone: 'bg-sunshine-400/20 text-amber-600' },
          { name: 'Wright family', emoji: '🚀', amt: 2120, status: 'Overdue', tone: 'bg-coral-400/15 text-coral-600' },
        ].map((f, i, arr) => (
          <div key={f.name} className={`flex items-center gap-3 p-4 ${i !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
            <Avatar emoji={f.emoji} gradient="from-brand-300 to-grape-400" />
            <div className="flex-1">
              <div className="font-extrabold text-slate-700">{f.name}</div>
              <Pill className={`mt-0.5 ${f.tone}`}>{f.status}</Pill>
            </div>
            <span className="font-extrabold text-slate-700">${f.amt.toLocaleString()}</span>
            <button className="btn-ghost !py-2 text-sm">Remind</button>
          </div>
        ))}
      </Card>
    </div>
  )
}

/* ---------------- Staff Scheduling ---------------- */
export function StaffScheduling() {
  const statusTone = {
    'On floor': 'bg-mint-400/15 text-mint-500',
    Break: 'bg-sunshine-400/20 text-amber-600',
    Off: 'bg-slate-100 text-slate-500',
  }
  const onFloor = staffSchedule.filter((s) => s.status === 'On floor').length
  return (
    <div className="space-y-5">
      <SectionHeader title="Staff & scheduling 🧑‍🏫" subtitle={`${onFloor} on the floor · ratios healthy across all rooms`} />
      <Card className="p-0">
        {staffSchedule.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-3 p-4 ${i !== staffSchedule.length - 1 ? 'border-b border-slate-100' : ''}`}
          >
            <Avatar emoji={s.emoji} gradient="from-brand-400 to-grape-500" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-extrabold text-slate-700">{s.name}</div>
              <div className="text-xs font-bold text-slate-400">{s.role} · {s.room}</div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-extrabold text-slate-600">{s.shift}</div>
              <div className="text-xs font-bold text-slate-400">{s.hours}h / wk</div>
            </div>
            <Pill className={statusTone[s.status]}>{s.status}</Pill>
          </motion.div>
        ))}
      </Card>
    </div>
  )
}

/* ---------------- Rooms ---------------- */
export function Rooms() {
  const { facility, childrenList, educators } = useApp()
  if (facility && !facility.isDemo) {
    const byRoom = {}
    childrenList.forEach((c) => { byRoom[c.room] = (byRoom[c.room] || 0) + 1 })
    const roomNames = Object.keys(byRoom)
    return (
      <div className="space-y-5">
        <SectionHeader title="Rooms 🚪" subtitle="Live occupancy by room" />
        {roomNames.length === 0 ? (
          <Card className="text-center"><p className="text-sm font-semibold text-slate-400">Rooms appear here as you assign children to them.</p></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {roomNames.map((name, i) => {
              const staff = (educators || []).filter((e) => e.room === name).length
              return (
                <motion.div key={name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-800">{name}</h3>
                    <Pill className="bg-brand-50 text-brand-700">{byRoom[name]} {byRoom[name] === 1 ? 'child' : 'children'}</Pill>
                  </div>
                  <div className="text-sm font-bold text-slate-400">{staff} {staff === 1 ? 'educator' : 'educators'} assigned</div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <SectionHeader title="Rooms & capacity 🚪" subtitle="Live occupancy and ratios" />
      <div className="grid gap-4 sm:grid-cols-2">
        {rooms.map((r, i) => {
          const pct = Math.round((r.enrolled / r.capacity) * 100)
          const full = pct >= 100
          return (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-800">{r.name}</h3>
                  <p className="text-xs font-bold text-slate-400">{r.age} · ratio {r.ratio}</p>
                </div>
                <Pill className={full ? 'bg-coral-400/15 text-coral-600' : 'bg-mint-400/15 text-mint-500'}>
                  {full ? 'Full' : `${r.capacity - r.enrolled} open`}
                </Pill>
              </div>
              <div className="mb-2 flex items-end justify-between">
                <span className="text-2xl font-extrabold text-slate-800">{r.enrolled}<span className="text-base text-slate-400">/{r.capacity}</span></span>
                <span className="text-sm font-bold text-slate-400">{r.staff} staff</span>
              </div>
              <ProgressBar value={pct} gradient={full ? 'from-coral-400 to-coral-600' : 'from-brand-400 to-grape-500'} />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Reports ---------------- */
export function Reports() {
  const reports = [
    { name: 'Attendance summary', desc: 'Daily headcounts & ratios', emoji: '📊', tone: 'from-brand-400 to-brand-600' },
    { name: 'CACFP meal report', desc: 'Food program reimbursement', emoji: '🍎', tone: 'from-coral-400 to-pink-500' },
    { name: 'Revenue & aging', desc: 'Tuition collected & overdue', emoji: '💰', tone: 'from-mint-400 to-mint-500' },
    { name: 'Immunization status', desc: 'Health compliance by child', emoji: '💉', tone: 'from-grape-400 to-grape-600' },
    { name: 'Staff hours', desc: 'Payroll-ready time totals', emoji: '⏱️', tone: 'from-sunshine-400 to-coral-500' },
    { name: 'Enrollment funnel', desc: 'Inquiry → enrolled conversion', emoji: '🌱', tone: 'from-brand-400 to-mint-500' },
  ]
  return (
    <div className="space-y-5">
      <SectionHeader title="Reports 📈" subtitle="One-tap exports for compliance & ops" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r, i) => (
          <motion.button
            key={r.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-5 text-left transition hover:-translate-y-1 hover:shadow-playful"
          >
            <span className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${r.tone} text-2xl shadow-md`}>
              {r.emoji}
            </span>
            <div className="font-extrabold text-slate-800">{r.name}</div>
            <div className="text-sm font-semibold text-slate-400">{r.desc}</div>
            <div className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-brand-600">
              Export <ArrowUpRight size={15} />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
