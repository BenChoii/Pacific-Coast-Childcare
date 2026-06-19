import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, BarChart, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts'
import {
  DollarSign, Percent, Users, Gauge, TrendingUp, ArrowLeft, ChevronRight, Phone, Mail,
  ShieldCheck, AlertTriangle, Syringe, Stethoscope, FileText, CalendarDays, Clock, Award,
  Baby, HeartPulse, CreditCard, MessageCircle, Pill as PillIcon, CheckCircle2, Sparkles,
  UserPlus, Link2, Copy, Loader2, Check,
} from 'lucide-react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { Card, SectionHeader, Pill, Avatar, ProgressBar, StatCard } from '../components/ui.jsx'
import AvatarUpload from '../components/AvatarUpload.jsx'
import { financials, childProfiles, families } from '../data/mockData.js'

const tip = {
  contentStyle: { borderRadius: 16, border: 'none', boxShadow: '0 8px 30px -10px rgba(15,23,42,0.2)', fontWeight: 700, fontSize: 12 },
}
const money = (n) => `$${n.toLocaleString()}`

function useTick() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

/* ===================== PROFITABILITY ===================== */
export function Profitability() {
  const { facility } = useApp()
  if (facility && !facility.isDemo) return <RealProfitability />
  const { kpis, monthly, perProgram, perChild } = financials
  const programRows = perProgram.map((p) => ({ ...p, margin: +(p.revenue - p.cost).toFixed(1), marginPct: Math.round(((p.revenue - p.cost) / p.revenue) * 100) }))
  const childRows = perChild.map((c) => ({ ...c, margin: c.revenue - c.cost, marginPct: Math.round(((c.revenue - c.cost) / c.revenue) * 100) }))

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Financial analytics" title="Profitability 💰" subtitle="Per enrolment, per program, and over time" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Net profit (MTD)" value="$22.3k" sub="+6.7% vs. May" gradient="from-mint-400 to-mint-500" />
        <StatCard icon={Percent} label="Profit margin" value={`${kpis.marginPct}%`} sub="industry avg ~18%" gradient="from-brand-400 to-brand-600" delay={0.05} />
        <StatCard icon={Users} label="Revenue / child" value={money(kpis.revPerChild)} sub={`cost ${money(kpis.costPerChild)}`} gradient="from-grape-400 to-grape-600" delay={0.1} />
        <StatCard icon={Gauge} label="Occupancy" value={`${kpis.occupancyPct}%`} sub="53 of 60 spots" gradient="from-sunshine-400 to-coral-500" delay={0.15} />
      </div>

      {/* Profit over time */}
      <Card delay={0.1}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-slate-800">Revenue, cost & profit</h3>
            <p className="text-xs font-bold text-slate-400">Monthly ($000s)</p>
          </div>
          <Pill className="bg-mint-400/15 text-mint-500"><TrendingUp size={14} /> profit +40% YTD</Pill>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={monthly} margin={{ left: -18, right: 8 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#eef2f6" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontWeight: 700, fontSize: 12, fill: '#94a3b8' }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontWeight: 700, fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip {...tip} formatter={(v, n) => [`$${v}k`, n[0].toUpperCase() + n.slice(1)]} />
            <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#BFD8E6" maxBarSize={26} />
            <Bar dataKey="cost" radius={[6, 6, 0, 0]} fill="#F2C6CC" maxBarSize={26} />
            <Line type="monotone" dataKey="profit" stroke="#0E74C1" strokeWidth={3} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
          <Legend color="#BFD8E6" label="Revenue" />
          <Legend color="#F2C6CC" label="Cost" />
          <Legend color="#0E74C1" label="Profit" />
        </div>
      </Card>

      {/* Per program */}
      <div>
        <SectionHeader title="Profit by program" subtitle="Monthly contribution per program" />
        <div className="grid gap-4 sm:grid-cols-2">
          {programRows.map((p, i) => (
            <motion.div key={p.program} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                  <span className="font-extrabold text-slate-800">{p.program}</span>
                </div>
                <Pill className="bg-mint-400/15 text-mint-500">{p.marginPct}% margin</Pill>
              </div>
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <div className="serif-num text-2xl text-slate-800">${p.margin}k<span className="text-sm font-bold text-slate-400">/mo profit</span></div>
                  <div className="text-xs font-bold text-slate-400">{p.children} children · ${p.revenue}k rev · ${p.cost}k cost</div>
                </div>
              </div>
              <ProgressBar value={p.marginPct} gradient="from-brand-400 to-mint-400" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Per enrolment */}
      <div>
        <SectionHeader title="Profitability per enrolment" subtitle="Monthly economics for each child" />
        <Card className="p-0">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr] gap-2 border-b border-line px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-400 sm:grid">
            <span>Child</span><span className="text-right">Revenue</span><span className="text-right">Cost</span><span className="text-right">Margin</span><span className="text-right">%</span>
          </div>
          {childRows.map((c, i) => (
            <div key={c.name} className={`flex flex-wrap items-center gap-y-1 px-4 py-3 sm:grid sm:grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr] sm:gap-2 ${i !== childRows.length - 1 ? 'border-b border-line' : ''}`}>
              <div className="w-full sm:w-auto">
                <div className="font-extrabold text-slate-700">{c.name}</div>
                <div className="text-xs font-bold text-slate-400">{c.program} · {c.plan}</div>
              </div>
              <span className="text-sm font-bold text-slate-600 sm:text-right">Rev {money(c.revenue)}</span>
              <span className="text-sm font-bold text-slate-400 sm:text-right">Cost {money(c.cost)}</span>
              <span className="text-sm font-extrabold text-mint-500 sm:text-right">{money(c.margin)}</span>
              <span className="ml-auto sm:ml-0 sm:text-right"><Pill className="bg-mint-400/15 text-mint-500">{c.marginPct}%</Pill></span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

function Legend({ color, label }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>
}

/* Live profitability for a real facility — revenue from per-child tuition. */
function RealProfitability() {
  const { childrenList, facility, setTuition } = useApp()
  const revenue = childrenList.reduce((s, c) => s + (c.monthlyTuition || 0), 0)
  const enrolled = childrenList.length
  const avg = enrolled ? Math.round(revenue / enrolled) : 0
  const mittenCost = facility?.monthly || 0
  const net = revenue - mittenCost
  const withT = childrenList.filter((c) => (c.monthlyTuition || 0) > 0).length

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Financial analytics" title="Profitability 💰" subtitle="Live tuition revenue across your enrolments" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Monthly revenue" value={money(revenue)} sub="from tuition" gradient="from-mint-400 to-mint-500" />
        <StatCard icon={Users} label="Enrolled" value={enrolled} sub={`${withT} with tuition set`} gradient="from-brand-400 to-brand-600" delay={0.05} />
        <StatCard icon={Percent} label="Avg tuition" value={money(avg)} sub="per child / mo" gradient="from-grape-400 to-grape-600" delay={0.1} />
        <StatCard icon={CreditCard} label="Mitten plan" value={mittenCost ? money(mittenCost) : 'Free'} sub={mittenCost ? 'your only platform cost' : 'under 6 children'} gradient="from-sunshine-400 to-coral-500" delay={0.15} />
      </div>

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800">Revenue per enrolment</h3>
          <Pill className="bg-mint-400/15 text-mint-500">Net {money(net)}/mo</Pill>
        </div>
        <p className="mb-3 text-xs font-bold text-slate-400">Tap an amount to set each child’s monthly tuition.</p>
        {childrenList.length === 0 ? (
          <p className="py-6 text-center text-sm font-semibold text-slate-400">Add children in Account → Children to see revenue.</p>
        ) : (
          <div className="divide-y divide-line">
            {childrenList.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br ${c.color} text-lg`}>{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-extrabold text-slate-700">{c.name}</div>
                  <div className="text-xs font-bold text-slate-400">{c.age} · {c.room}</div>
                </div>
                <TuitionInput value={c.monthlyTuition || 0} onSave={(n) => setTuition(c.id, n)} />
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="text-xs font-semibold text-slate-400">
        Mitten tracks the revenue you enter here. Full expense/P&L tracking is coming — for now this shows tuition revenue minus your Mitten subscription.
      </p>
    </div>
  )
}

function TuitionInput({ value, onSave }) {
  const [v, setV] = useState(value || '')
  useEffect(() => { setV(value || '') }, [value])
  return (
    <div className="flex items-center gap-1">
      <span className="font-bold text-slate-400">$</span>
      <input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onSave(Number(v) || 0)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        placeholder="0"
        className="w-20 rounded-xl border border-line bg-white px-2 py-1.5 text-right text-sm font-extrabold text-slate-700 outline-none focus:border-brand-400"
      />
      <span className="text-xs font-bold text-slate-400">/mo</span>
    </div>
  )
}

/* ===================== FAMILIES & CHILDREN ===================== */
export function Families() {
  const { facility } = useApp()
  if (facility && !facility.isDemo) return <RealFamilies />
  return <DemoFamilies />
}

function RealFamilies() {
  const { childrenList, roster } = useApp()
  const [sel, setSel] = useState(null)
  if (sel) {
    const child = childrenList.find((c) => c.id === sel)
    return <RealChildProfile child={child} roster={roster} onBack={() => setSel(null)} />
  }
  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Records" title="Families & children" subtitle="Everyone enrolled at your facility" />
      {childrenList.length === 0 ? (
        <Card className="text-center"><p className="text-sm font-semibold text-slate-400">No children yet. Add them in Account → Children.</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {childrenList.map((c, i) => (
            <motion.button key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => setSel(c.id)}
              className="card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-playful">
              <Avatar emoji={c.emoji} gradient={c.color} src={c.imageUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold text-slate-800">{c.name}</div>
                <div className="truncate text-xs font-bold text-slate-400">{c.age} · {c.room} · {c.parent}</div>
              </div>
              {c.allergies?.length > 0 && <span title="Allergy on file"><AlertTriangle size={16} className="text-coral-500" /></span>}
              <ChevronRight size={18} className="text-slate-300" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

function RealChildProfile({ child, roster, onBack }) {
  const { setChildPhoto } = useApp()
  if (!child) return null
  const live = (roster || []).find((r) => r.name === child.name)
  return (
    <div className="space-y-5">
      <Back onBack={onBack} />
      <Card className="overflow-hidden p-0">
        <div className={`relative bg-gradient-to-br ${child.color} p-6 text-white`}>
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-xl" />
          <div className="flex items-center gap-4">
            <AvatarUpload src={child.imageUrl} fallback={child.emoji} size="h-20 w-20" gradient="from-white/30 to-white/10" onUpload={(f) => setChildPhoto(child.id, f)} />
            <div className="min-w-0">
              <h2 className="text-2xl">{child.name}</h2>
              <p className="font-semibold text-white/85">{child.age} · {child.room}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Mini label="Status" value={live?.status === 'checked-in' ? 'In' : live?.status === 'napping' ? 'Napping' : live?.status === 'absent' ? 'Absent' : 'Out'} tone="text-mint-500" />
          <Mini label="Mood" value={live?.mood && live.mood !== '—' ? live.mood : '—'} tone="text-grape-600" />
          <Mini label="Tuition" value={child.monthlyTuition ? money(child.monthlyTuition) : '—'} tone="text-brand-600" />
          <Mini label="Allergies" value={child.allergies?.length ? String(child.allergies.length) : '0'} tone={child.allergies?.length ? 'text-coral-500' : 'text-slate-400'} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <H icon={Users} tone="text-brand-500">Guardian</H>
          <ContactRow name={child.parent} sub="Parent / guardian" primary />
        </Card>
        <Card>
          <H icon={HeartPulse} tone="text-coral-500">Allergies & care</H>
          {child.allergies?.length ? (
            <div className="flex flex-wrap gap-2">
              {child.allergies.map((a) => <Pill key={a} className="bg-coral-400/15 text-coral-600"><AlertTriangle size={12} /> {a}</Pill>)}
            </div>
          ) : <p className="text-sm font-semibold text-slate-400">No allergies on file.</p>}
          <p className="mt-3 text-xs font-semibold text-slate-400">Health records, immunizations & milestones are coming soon — for now manage care notes in the daily log.</p>
        </Card>
      </div>
    </div>
  )
}

function DemoFamilies() {
  const [tab, setTab] = useState('children')
  const [sel, setSel] = useState(null) // {type, id}

  if (sel?.type === 'child') {
    const child = childProfiles.find((c) => c.id === sel.id)
    return <ChildProfile child={child} onBack={() => setSel(null)} />
  }
  if (sel?.type === 'family') {
    const fam = families.find((f) => f.id === sel.id)
    return <FamilyProfile family={fam} onBack={() => setSel(null)} />
  }

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Records" title="Families & children" subtitle="Full profile, health, billing & history" />

      <div className="inline-flex rounded-2xl bg-slate-100 p-1">
        {[{ id: 'children', label: 'Children' }, { id: 'families', label: 'Families' }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-xl px-5 py-2 text-sm font-bold transition ${tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'children' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {childProfiles.map((c, i) => (
            <motion.button key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.99 }}
              onClick={() => setSel({ type: 'child', id: c.id })}
              className="card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-playful">
              <Avatar emoji={c.emoji} gradient={c.color} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold text-slate-800">{c.name}</div>
                <div className="truncate text-xs font-bold text-slate-400">{c.age} · {c.program}</div>
              </div>
              {c.allergies.length > 0 && <span title="Allergy on file"><AlertTriangle size={16} className="text-coral-500" /></span>}
              {c.balance > 0 && <Pill className="bg-sunshine-400/20 text-amber-600">{money(c.balance)}</Pill>}
              <ChevronRight size={18} className="text-slate-300" />
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {families.map((f, i) => (
            <motion.button key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.99 }}
              onClick={() => setSel({ type: 'family', id: f.id })}
              className="card flex items-center gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-playful">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-grape-500 text-white">👪</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold text-slate-800">{f.name}</div>
                <div className="truncate text-xs font-bold text-slate-400">{f.children.join(' & ')} · {f.primary}</div>
              </div>
              {f.balance > 0 ? <Pill className="bg-coral-400/15 text-coral-600">{money(f.balance)} due</Pill> : <Pill className="bg-mint-400/15 text-mint-500">Paid</Pill>}
              <ChevronRight size={18} className="text-slate-300" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

function Back({ onBack }) {
  return (
    <button onClick={onBack} className="mb-1 inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-brand-600">
      <ArrowLeft size={16} /> Back
    </button>
  )
}

function ChildProfile({ child, onBack }) {
  if (!child) return null
  const napAvg = Math.round(child.trends.naps.filter((n) => n.min > 0).reduce((a, b) => a + b.min, 0) / child.trends.naps.filter((n) => n.min > 0).length)
  const mealAvg = Math.round(child.trends.meals.filter((m) => m.pct > 0).reduce((a, b) => a + b.pct, 0) / child.trends.meals.filter((m) => m.pct > 0).length)

  return (
    <div className="space-y-5">
      <Back onBack={onBack} />
      {/* Header */}
      <Card className="overflow-hidden p-0">
        <div className={`relative bg-gradient-to-br ${child.color} p-6 text-white`}>
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-xl" />
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/25 text-4xl ring-4 ring-white/30">{child.emoji}</div>
            <div className="min-w-0">
              <h2 className="text-2xl">{child.name}</h2>
              <p className="font-semibold text-white/85">{child.age} · {child.program}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="pill bg-white/20 text-white">{child.status}</span>
                <span className="pill bg-white/20 text-white">{child.schedule}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Mini label="Attendance" value={`${child.attendanceRate}%`} tone="text-mint-500" />
          <Mini label="Avg nap" value={`${napAvg}m`} tone="text-grape-600" />
          <Mini label="Avg meal" value={`${mealAvg}%`} tone="text-coral-600" />
          <Mini label="Tuition" value={money(child.tuition)} tone="text-brand-600" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Guardians & contacts */}
        <Card>
          <H icon={Users} tone="text-brand-500">Guardians & contacts</H>
          <div className="space-y-2">
            {child.guardians.map((g) => (
              <ContactRow key={g.name} name={g.name} sub={g.relation} phone={g.phone} email={g.email} primary={g.primary} />
            ))}
            {child.emergency.map((g) => (
              <ContactRow key={g.name} name={g.name} sub={`Emergency · ${g.relation}`} phone={g.phone} />
            ))}
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Authorized pickups</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {child.pickups.map((p) => <Pill key={p} className="bg-slate-100 text-slate-600"><ShieldCheck size={12} /> {p}</Pill>)}
          </div>
        </Card>

        {/* Health */}
        <Card>
          <H icon={HeartPulse} tone="text-coral-500">Health & medical</H>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Allergies</p>
              {child.allergies.length ? child.allergies.map((a) => (
                <div key={a.name} className="mt-1 flex items-center gap-2 rounded-xl bg-coral-400/10 p-2.5">
                  <AlertTriangle size={16} className="text-coral-500" />
                  <span className="text-sm font-bold text-slate-700">{a.name}</span>
                  <Pill className="bg-coral-400/15 text-coral-600">{a.severity}</Pill>
                  <span className="ml-auto text-xs font-semibold text-slate-400">{a.plan}</span>
                </div>
              )) : <p className="mt-1 text-sm font-semibold text-slate-400">None on file</p>}
            </div>
            {child.medications.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Medications</p>
                {child.medications.map((m) => (
                  <div key={m.name} className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-600"><PillIcon size={14} className="text-grape-500" /> {m.name} · {m.dose} · {m.schedule}</div>
                ))}
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Immunizations</p>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {child.immunizations.map((im) => (
                  <div key={im.name} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <Syringe size={13} className="text-mint-500" /> {im.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Stethoscope size={14} className="text-brand-500" /> {child.physician.name}</div>
          </div>
        </Card>

        {/* Milestones */}
        <Card>
          <H icon={Award} tone="text-grape-500">Developmental milestones</H>
          <div className="space-y-2">
            {child.milestones.map((m) => {
              const tone = m.status === 'Mastered' ? 'bg-mint-400/15 text-mint-500' : m.status === 'Emerging' ? 'bg-sunshine-400/20 text-amber-600' : 'bg-brand-100 text-brand-700'
              return (
                <div key={m.label} className="flex items-center justify-between rounded-xl bg-tint p-2.5">
                  <span className="text-sm font-bold text-slate-600">{m.label}</span>
                  <Pill className={tone}>{m.status}</Pill>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Trends */}
        <Card>
          <H icon={TrendingUp} tone="text-mint-500">This week's trends</H>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Nap minutes</p>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={child.trends.naps} margin={{ left: -28, right: 0 }}>
              <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fontWeight: 700, fontSize: 11, fill: '#94a3b8' }} />
              <YAxis hide />
              <Tooltip {...tip} formatter={(v) => [`${v} min`, 'Nap']} />
              <Bar dataKey="min" radius={[5, 5, 0, 0]} fill="#8FA3DA" maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
          <p className="mb-1 mt-2 text-xs font-bold uppercase tracking-wide text-slate-400">Meals eaten (%)</p>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={child.trends.meals} margin={{ left: -28, right: 0 }}>
              <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fontWeight: 700, fontSize: 11, fill: '#94a3b8' }} />
              <YAxis hide />
              <Tooltip {...tip} formatter={(v) => [`${v}%`, 'Eaten']} />
              <Bar dataKey="pct" radius={[5, 5, 0, 0]} fill="#E89B8E" maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Notes & incidents */}
        <Card>
          <H icon={MessageCircle} tone="text-brand-500">Notes & incidents</H>
          <div className="space-y-2">
            {child.notes.map((n, i) => (
              <div key={i} className="rounded-xl bg-tint p-3">
                <div className="mb-0.5 flex items-center gap-2">
                  <Pill className={n.type === 'Incident' ? 'bg-coral-400/15 text-coral-600' : 'bg-brand-100 text-brand-700'}>{n.type}</Pill>
                  <span className="text-xs font-bold text-slate-400">{n.date} · {n.by}</span>
                </div>
                <p className="text-sm font-semibold text-slate-600">{n.text}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Documents & billing */}
        <Card>
          <H icon={FileText} tone="text-grape-500">Documents</H>
          <div className="space-y-2">
            {child.documents.map((d) => (
              <div key={d.name} className="flex items-center gap-3 rounded-xl bg-tint p-2.5">
                <FileText size={16} className="text-slate-400" />
                <span className="flex-1 text-sm font-bold text-slate-600">{d.name}</span>
                <Pill className={d.status === 'Action needed' || d.status === 'In progress' ? 'bg-coral-400/15 text-coral-600' : 'bg-mint-400/15 text-mint-500'}>{d.status}</Pill>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <H icon={CreditCard} tone="text-mint-500">Billing</H>
          <div className="flex items-center justify-between rounded-xl bg-tint p-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Current balance</div>
              <div className={`serif-num text-2xl ${child.balance > 0 ? 'text-coral-600' : 'text-mint-500'}`}>{money(child.balance)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Monthly tuition</div>
              <div className="serif-num text-2xl text-slate-700">{money(child.tuition)}</div>
            </div>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400">Enrolled since {child.enrolledSince} · DOB {child.dob}</p>
        </Card>
      </div>
    </div>
  )
}

function FamilyProfile({ family, onBack }) {
  if (!family) return null
  const kids = childProfiles.filter((c) => family.children.includes(c.first))
  return (
    <div className="space-y-5">
      <Back onBack={onBack} />
      <Card className="overflow-hidden p-0">
        <div className="relative bg-gradient-to-br from-brand-500 to-grape-600 p-6 text-white">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-xl" />
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/25 text-3xl ring-4 ring-white/30">👪</span>
            <div>
              <h2 className="text-2xl">{family.name}</h2>
              <p className="font-semibold text-white/85">{family.children.join(' & ')} · {family.plan}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 p-4">
          <Mini label="Balance" value={money(family.balance)} tone={family.balance > 0 ? 'text-coral-600' : 'text-mint-500'} />
          <Mini label="Auto-pay" value={family.autopay ? 'On' : 'Off'} tone={family.autopay ? 'text-mint-500' : 'text-slate-400'} />
          <Mini label="Messages" value={String(family.comms)} tone="text-brand-600" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <H icon={Users} tone="text-brand-500">Primary contact</H>
          <ContactRow name={family.primary} sub="Primary guardian" phone={family.phone} email={family.email} primary />
        </Card>
        <Card>
          <H icon={CreditCard} tone="text-mint-500">Billing</H>
          <div className="space-y-2 text-sm font-semibold text-slate-600">
            <Row label="Plan" value={family.plan} />
            <Row label="Payment method" value={family.method} />
            <Row label="Auto-pay" value={family.autopay ? 'Enrolled' : 'Not enrolled'} />
            <Row label="Balance" value={money(family.balance)} tone={family.balance > 0 ? 'text-coral-600' : 'text-mint-500'} />
            <Row label="Last contact" value={family.lastContact} />
          </div>
        </Card>
      </div>

      <Card>
        <H icon={Baby} tone="text-grape-500">Children</H>
        <div className="grid gap-2 sm:grid-cols-2">
          {kids.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-tint p-3">
              <Avatar emoji={c.emoji} size="h-10 w-10" gradient={c.color} />
              <div>
                <div className="font-extrabold text-slate-700">{c.name}</div>
                <div className="text-xs font-bold text-slate-400">{c.age} · {c.program}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ===================== EDUCATORS (live clock) ===================== */
function InviteEmployee() {
  const { facility, isAuthenticated } = useApp()
  const createLink = useMutation(api.onboarding.createLink)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('Educator')
  const [link, setLink] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // Hidden in the unauthenticated demo (createLink requires a real admin).
  if (!isAuthenticated || !facility || facility.isDemo) return null

  const gen = async () => {
    setBusy(true)
    try {
      const { token } = await createLink({ name, role })
      setLink(`${window.location.origin}/onboard?t=${token}`)
      setName('')
      setCopied(false)
    } finally { setBusy(false) }
  }
  const copy = () => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800) }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-grape-500 text-white"><UserPlus size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-slate-700">Onboard a new employee</div>
          <div className="text-xs font-medium text-slate-400">Send a secure link — they add their details, banking, SIN &amp; documents themselves.</div>
        </div>
        {!open && <button onClick={() => setOpen(true)} className="btn-primary !py-2 text-sm"><UserPlus size={15} /> Send onboarding link</button>}
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block min-w-[10rem] flex-1"><span className="eyebrow mb-1 block">Name (optional)</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New hire's name" /></label>
          <label className="block"><span className="eyebrow mb-1 block">Role</span><input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Educator" /></label>
          <button onClick={gen} disabled={busy} className="btn-primary !py-2 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Create link</button>
        </div>
      )}
      {link && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-2.5">
          <Link2 size={15} className="shrink-0 text-brand-500" />
          <span className="truncate text-sm font-bold text-brand-700">{link}</span>
          <button onClick={copy} className="btn-ghost ml-auto shrink-0 !py-1.5 text-xs">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
        </div>
      )}
    </Card>
  )
}

export function EducatorsAdmin() {
  const { educators } = useApp()
  const [selId, setSelId] = useState(null)
  const now = useTick()

  const sel = educators.find((e) => e.id === selId)
  if (sel) return <EducatorProfile e={sel} now={now} onBack={() => setSelId(null)} />

  const onFloor = educators.filter((e) => e.status === 'in').length
  const elapsed = (e) => {
    const sec = e.todaySeconds + (e.status === 'in' && e.clockInAt ? (now - e.clockInAt) / 1000 : 0)
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  }

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Team" title="Educators 🧑‍🏫" subtitle={`${onFloor} clocked in · live time tracking`} />

      <InviteEmployee />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users} label="On the floor" value={onFloor} gradient="from-mint-400 to-mint-500" />
        <StatCard icon={Clock} label="Hours today" value={`${educators.reduce((a, e) => a + (e.todaySeconds + (e.status === 'in' && e.clockInAt ? (now - e.clockInAt) / 1000 : 0)) / 3600, 0).toFixed(1)}`} gradient="from-brand-400 to-brand-600" delay={0.05} />
        <StatCard icon={Gauge} label="Ratios" value="All ✓" sub="within limits" gradient="from-grape-400 to-grape-600" delay={0.1} />
        <StatCard icon={Award} label="Certified" value={`${educators.length}/${educators.length}`} sub="CPR current" gradient="from-sunshine-400 to-coral-500" delay={0.15} />
      </div>

      <Card className="p-0">
        {educators.map((e, i) => {
          const live = e.status === 'in'
          return (
            <motion.button key={e.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.995 }}
              onClick={() => setSelId(e.id)}
              className={`flex w-full items-center gap-3 p-4 text-left ${i !== educators.length - 1 ? 'border-b border-line' : ''}`}>
              <div className="relative">
                <Avatar emoji={e.emoji} gradient="from-brand-400 to-grape-500" src={e.imageUrl} />
                <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${live ? 'bg-mint-500' : 'bg-slate-300'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold text-slate-700">{e.name}</div>
                <div className="text-xs font-bold text-slate-400">{e.role} · {e.room}</div>
              </div>
              <div className="text-right">
                {live ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-mint-500"><span className="h-2 w-2 animate-pulse rounded-full bg-mint-500" />{elapsed(e)}</span>
                ) : (
                  <span className="font-mono text-sm font-bold text-slate-400">{e.hoursWeek > 0 ? elapsed(e) : 'Off'}</span>
                )}
                <div className="text-[11px] font-bold text-slate-400">{e.hoursWeek}/{e.hoursTarget}h wk</div>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </motion.button>
          )
        })}
      </Card>
    </div>
  )
}

function EducatorProfile({ e, now, onBack }) {
  const { setEducatorPhoto } = useApp()
  const live = e.status === 'in'
  const sec = e.todaySeconds + (live && e.clockInAt ? (now - e.clockInAt) / 1000 : 0)
  const today = `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  return (
    <div className="space-y-5">
      <Back onBack={onBack} />
      <Card className="overflow-hidden p-0">
        <div className="relative bg-gradient-to-br from-brand-500 to-grape-600 p-6 text-white">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-xl" />
          <div className="flex items-center gap-4">
            <div className="relative">
              <AvatarUpload src={e.imageUrl} fallback={e.emoji} size="h-20 w-20" gradient="from-white/30 to-white/10" onUpload={(f) => setEducatorPhoto(e.id, f)} />
              <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full ring-2 ring-white ${live ? 'bg-mint-400' : 'bg-slate-300'}`} />
            </div>
            <div>
              <h2 className="text-2xl">{e.name}</h2>
              <p className="font-semibold text-white/85">{e.role} · {e.room}</p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]">
                {live ? <><span className="h-2 w-2 animate-pulse rounded-full bg-mint-300" /> Clocked in · {today}</> : 'Clocked out'}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 p-4">
          <Mini label="Today" value={today} tone="text-brand-600" />
          <Mini label="This week" value={`${e.hoursWeek}h`} tone="text-grape-600" />
          <Mini label="PTO left" value={e.pto} tone="text-mint-500" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <H icon={Clock} tone="text-brand-500">Today's punches</H>
          {e.punches.length ? (
            <div className="space-y-2">
              {e.punches.map((p, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-tint p-2.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${p.type === 'in' ? 'bg-mint-400/20 text-mint-500' : 'bg-coral-400/15 text-coral-600'}`}>
                    {p.type === 'in' ? '↧' : '↥'}
                  </span>
                  <span className="font-bold capitalize text-slate-700">Clock {p.type}</span>
                  <span className="ml-auto font-mono text-sm font-bold text-slate-500">{p.time}</span>
                </div>
              ))}
              {live && <p className="text-xs font-bold text-mint-500">● Currently on the floor</p>}
            </div>
          ) : <p className="text-sm font-semibold text-slate-400">Not scheduled today.</p>}
        </Card>

        <Card>
          <H icon={Gauge} tone="text-grape-500">Weekly hours</H>
          <div className="mb-2 flex items-end justify-between">
            <span className="serif-num text-3xl text-slate-800">{e.hoursWeek}<span className="text-base font-bold text-slate-400">/{e.hoursTarget}h</span></span>
            <Pill className="bg-mint-400/15 text-mint-500">{Math.round((e.hoursWeek / e.hoursTarget) * 100)}%</Pill>
          </div>
          <ProgressBar value={e.hoursWeek} max={e.hoursTarget} gradient="from-brand-400 to-grape-500" />
          <p className="mt-3 text-sm font-semibold text-slate-500">Hired {e.hireDate}</p>
        </Card>

        <Card className="lg:col-span-2">
          <H icon={Award} tone="text-mint-500">Certifications</H>
          <div className="flex flex-wrap gap-2">
            {e.certifications.map((c) => (
              <Pill key={c} className="bg-mint-400/15 text-mint-500"><CheckCircle2 size={13} /> {c}</Pill>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ---- small helpers ---- */
function Mini({ label, value, tone }) {
  return (
    <div className="rounded-2xl bg-tint p-3 text-center">
      <div className={`text-xl font-extrabold ${tone}`}>{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  )
}
function H({ icon: Icon, tone, children }) {
  return <h3 className="mb-3 flex items-center gap-2 font-extrabold text-slate-800"><Icon size={18} className={tone} /> {children}</h3>
}
function ContactRow({ name, sub, phone, email, primary }) {
  return (
    <div className="rounded-xl bg-tint p-3">
      <div className="flex items-center gap-2">
        <span className="font-extrabold text-slate-700">{name}</span>
        {primary && <Pill className="bg-brand-100 text-brand-700">Primary</Pill>}
        <span className="ml-auto text-xs font-bold text-slate-400">{sub}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
        {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-600"><Phone size={13} /> {phone}</a>}
        {email && <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 hover:text-brand-600"><Mail size={13} /> {email}</a>}
      </div>
    </div>
  )
}
function Row({ label, value, tone = 'text-slate-700' }) {
  return (
    <div className="flex items-center justify-between border-b border-line/70 py-1.5 last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className={`font-bold ${tone}`}>{value}</span>
    </div>
  )
}
