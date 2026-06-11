import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import {
  PiggyBank, SlidersHorizontal, BarChart3, ReceiptText, Plus, Trash2, Loader2,
  AlertTriangle, Check, X, Clock, Users, TrendingUp, Sparkles, Copy, ChevronDown,
  Baby, DollarSign, Wand2, CalendarClock,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, Card, StatCard, Pill } from '../components/ui.jsx'

const money = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-CA', { maximumFractionDigits: 2 })
const money0 = (n) => '$' + Math.round(n).toLocaleString()

// BC licence types drive ratio math in the projections studio.
const LICENSE = {
  it: { label: 'Under 36 months', ratio: 4, max: 12 },
  g35: { label: '30 months – school age', ratio: 8, max: 25 },
  pre: { label: 'Preschool (part-day)', ratio: 10, max: 20 },
  sa: { label: 'School age', ratio: 12, max: 30 },
  ma: { label: 'Multi-age', ratio: 8, max: 8 },
}
const BURDEN = 1.12 // employer CPP/EI/WorkSafeBC approximation
const HOURS_MO = 160

/* ════════════════════════ PROJECTIONS (what-if studio) ═══════════════════ */

const defaultRoom = (name = 'New room') => ({ name, type: 'g35', enrolled: 8, tuition: 1100, wage: 24, educatorsOverride: null })

function scenarioMath(sc) {
  const rooms = sc.rooms.map((r) => {
    const lic = LICENSE[r.type]
    const required = Math.max(1, Math.ceil(r.enrolled / lic.ratio))
    const educators = r.educatorsOverride ?? required
    const revenue = r.enrolled * r.tuition
    const staffCost = educators * r.wage * HOURS_MO * BURDEN
    return { ...r, lic, required, educators, revenue, staffCost, overCap: r.enrolled > lic.max, short: educators < required }
  })
  const kids = rooms.reduce((s, r) => s + r.enrolled, 0)
  const tuitionRev = rooms.reduce((s, r) => s + r.revenue, 0)
  const plansRev = sc.plans.reduce((s, p) => s + kids * (p.uptake / 100) * p.price, 0)
  const extrasRev = plansRev + (sc.incidentsMo || 0)
  const staffCost = rooms.reduce((s, r) => s + r.staffCost, 0)
  const totalCost = staffCost + (sc.overhead || 0)
  const revenue = tuitionRev + extrasRev
  const profit = revenue - totalCost
  return { rooms, kids, tuitionRev, plansRev, extrasRev, staffCost, totalCost, revenue, profit, margin: revenue > 0 ? (profit / revenue) * 100 : 0 }
}

function NumField({ label, value, onChange, step = 1, min = 0, prefix, suffix, w = 'w-24' }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <span className="flex items-center gap-1 rounded-xl border border-line bg-white px-2">
        {prefix && <span className="text-xs font-bold text-slate-400">{prefix}</span>}
        <input type="number" min={min} step={step} value={value}
          onChange={(e) => onChange(+e.target.value || 0)}
          className={`${w} border-0 bg-transparent py-2 text-sm font-bold text-slate-700 outline-none`} />
        {suffix && <span className="text-xs font-bold text-slate-400">{suffix}</span>}
      </span>
    </label>
  )
}

function Projections() {
  const { childrenList } = useApp()
  const services = useQuery(api.extras.listServices) || []

  const makeInitial = () => {
    // Seed Scenario A from the live roster when one exists.
    if (childrenList.length > 0) {
      const byRoom = {}
      for (const c of childrenList) {
        byRoom[c.room] = byRoom[c.room] || { n: 0, t: [] }
        byRoom[c.room].n++
        if (c.monthlyTuition) byRoom[c.room].t.push(c.monthlyTuition)
      }
      const rooms = Object.entries(byRoom).map(([name, d]) => ({
        ...defaultRoom(name),
        enrolled: d.n,
        tuition: d.t.length ? Math.round(d.t.reduce((s, x) => s + x, 0) / d.t.length) : 1100,
      }))
      return { rooms, overhead: 4000, incidentsMo: 150, plans: [] }
    }
    return { rooms: [defaultRoom('Sunbeams'), { ...defaultRoom('Explorers'), type: 'it', enrolled: 6, tuition: 1500 }], overhead: 4000, incidentsMo: 150, plans: [{ name: 'Extended hours', price: 50, uptake: 30 }] }
  }

  const [scs, setScs] = useState(() => {
    const a = makeInitial()
    return [ { name: 'Scenario A', ...a }, { name: 'Scenario B', ...JSON.parse(JSON.stringify(a)) } ]
  })
  const [cur, setCur] = useState(0)
  // Surface the daycare's real add-on plans as modelable rows once loaded.
  useEffect(() => {
    const planSvcs = services.filter((s) => s.kind === 'plan' && s.active)
    if (!planSvcs.length) return
    setScs((prev) => prev.map((sc) => sc.plans.length ? sc : ({ ...sc, plans: planSvcs.map((p) => ({ name: p.name, price: p.amount, uptake: 25 })) })))
  }, [services.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const sc = scs[cur]
  const setSc = (patch) => setScs((p) => p.map((s, i) => (i === cur ? { ...s, ...patch } : s)))
  const setRoom = (i, patch) => setSc({ rooms: sc.rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const m = scenarioMath(sc)
  const other = scenarioMath(scs[1 - cur])
  const delta = m.profit - other.profit

  return (
    <div className="space-y-5">
      {/* scenario switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {scs.map((s, i) => (
          <button key={i} onClick={() => setCur(i)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${i === cur ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-slate-500 border border-line'}`}>
            {s.name}
          </button>
        ))}
        <button onClick={() => setScs((p) => p.map((s, i) => (i === 1 ? { ...JSON.parse(JSON.stringify(p[0])), name: 'Scenario B' } : s)))}
          className="btn-ghost !py-2 text-xs"><Copy size={13} /> Copy A → B</button>
        <span className={`ml-auto rounded-full px-3 py-1.5 text-xs font-bold ${delta >= 0 ? 'bg-mint-400/15 text-mint-600' : 'bg-coral-400/15 text-coral-600'}`}>
          {sc.name} vs {scs[1 - cur].name}: {delta >= 0 ? '+' : ''}{money0(delta)}/mo
        </span>
      </div>

      {/* headline numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Monthly revenue" value={money0(m.revenue)} sub={`${money0(m.tuitionRev)} tuition + ${money0(m.extrasRev)} extras`} gradient="from-mint-400 to-mint-500" />
        <StatCard icon={Users} label="Staffing cost" value={money0(m.staffCost)} sub={`${m.rooms.reduce((s, r) => s + r.educators, 0)} educators · incl. ~12% burden`} gradient="from-brand-400 to-brand-600" delay={0.04} />
        <StatCard icon={TrendingUp} label="Monthly profit" value={money0(m.profit)} sub={`${m.margin.toFixed(1)}% margin`} gradient={m.profit >= 0 ? 'from-grape-400 to-grape-600' : 'from-coral-400 to-coral-600'} delay={0.08} />
        <StatCard icon={Baby} label="Children" value={m.kids} sub="across all rooms" gradient="from-sunshine-400 to-coral-500" delay={0.12} />
      </div>

      {/* rooms */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Rooms — drag the levers</p>
          <button onClick={() => setSc({ rooms: [...sc.rooms, defaultRoom(`Room ${sc.rooms.length + 1}`)] })} className="btn-ghost !py-1.5 text-xs"><Plus size={13} /> Add room</button>
        </div>
        {m.rooms.map((r, i) => (
          <div key={i} className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input value={r.name} onChange={(e) => setRoom(i, { name: e.target.value })}
                className="w-32 rounded-lg border-0 bg-slate-50 px-2 py-1.5 text-sm font-extrabold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-brand-200" />
              <select value={r.type} onChange={(e) => setRoom(i, { type: e.target.value, educatorsOverride: null })}
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-bold text-slate-600">
                {Object.entries(LICENSE).map(([k, l]) => <option key={k} value={k}>{l.label} · 1:{l.ratio}</option>)}
              </select>
              <span className="ml-auto text-sm font-extrabold text-slate-700">{money0(r.revenue)}<span className="text-xs font-semibold text-slate-400">/mo</span></span>
              {sc.rooms.length > 1 && (
                <button onClick={() => setSc({ rooms: sc.rooms.filter((_, j) => j !== i) })} className="rounded-lg p-1.5 text-slate-300 hover:bg-coral-50 hover:text-coral-500"><Trash2 size={14} /></button>
              )}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="eyebrow mb-1 flex justify-between"><span>Enrolled</span><span className={r.overCap ? 'text-coral-500' : 'text-brand-600'}>{r.enrolled}{r.overCap ? ` > max ${r.lic.max}!` : ` / max ${r.lic.max}`}</span></span>
                <input type="range" min="1" max={r.lic.max + 4} value={r.enrolled} onChange={(e) => setRoom(i, { enrolled: +e.target.value, educatorsOverride: null })} className="w-full accent-brand-500" />
              </label>
              <label className="block">
                <span className="eyebrow mb-1 flex justify-between"><span>Tuition / child / mo</span><span className="text-brand-600">{money0(r.tuition)}</span></span>
                <input type="range" min="400" max="2600" step="25" value={r.tuition} onChange={(e) => setRoom(i, { tuition: +e.target.value })} className="w-full accent-grape-500" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div>
                <span className="eyebrow mb-1 block">Educators (ratio needs {r.required})</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setRoom(i, { educatorsOverride: Math.max(1, r.educators - 1) })} className="h-8 w-8 rounded-lg bg-slate-100 font-bold text-slate-600 active:scale-90">−</button>
                  <span className={`w-8 text-center text-lg font-extrabold ${r.short ? 'text-coral-500' : 'text-slate-800'}`}>{r.educators}</span>
                  <button onClick={() => setRoom(i, { educatorsOverride: r.educators + 1 })} className="h-8 w-8 rounded-lg bg-slate-100 font-bold text-slate-600 active:scale-90">+</button>
                  {r.educatorsOverride !== null && r.educatorsOverride !== r.required && (
                    <button onClick={() => setRoom(i, { educatorsOverride: null })} className="ml-1 text-[10px] font-bold text-brand-500 underline">reset</button>
                  )}
                </div>
              </div>
              <NumField label="Avg wage" value={r.wage} onChange={(v) => setRoom(i, { wage: v })} step={0.5} prefix="$" suffix="/hr" w="w-16" />
              <span className="ml-auto text-xs font-bold text-slate-400">staff cost {money0(r.staffCost)}/mo</span>
            </div>
            {r.short && (
              <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-coral-400/10 px-3 py-2 text-xs font-bold text-coral-600">
                <AlertTriangle size={13} /> Below the BC ratio for this licence — licensing would require {r.required}.
              </p>
            )}
          </div>
        ))}
      </Card>

      {/* extras + overhead */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <p className="eyebrow flex items-center gap-1.5"><Sparkles size={12} /> Extras revenue (the creative levers)</p>
          {sc.plans.map((p, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-3">
              <input value={p.name} onChange={(e) => setSc({ plans: sc.plans.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })}
                className="w-36 rounded-lg border-0 bg-white px-2 py-1.5 text-sm font-bold text-slate-700 outline-none" />
              <NumField label="$/mo" value={p.price} onChange={(v) => setSc({ plans: sc.plans.map((x, j) => j === i ? { ...x, price: v } : x) })} prefix="$" w="w-16" />
              <label className="block flex-1 min-w-[8rem]">
                <span className="eyebrow mb-1 flex justify-between"><span>Family uptake</span><span className="text-brand-600">{p.uptake}%</span></span>
                <input type="range" min="0" max="100" step="5" value={p.uptake} onChange={(e) => setSc({ plans: sc.plans.map((x, j) => j === i ? { ...x, uptake: +e.target.value } : x) })} className="w-full accent-mint-500" />
              </label>
              <button onClick={() => setSc({ plans: sc.plans.filter((_, j) => j !== i) })} className="rounded-lg p-1.5 text-slate-300 hover:text-coral-500"><X size={14} /></button>
            </div>
          ))}
          <button onClick={() => setSc({ plans: [...sc.plans, { name: 'New add-on plan', price: 40, uptake: 25 }] })} className="btn-ghost w-full !py-2 text-xs"><Plus size={13} /> Model an add-on plan</button>
          <div className="flex items-end justify-between gap-3">
            <NumField label="Late pickup / incident fees (est)" value={sc.incidentsMo} onChange={(v) => setSc({ incidentsMo: v })} prefix="$" suffix="/mo" w="w-20" />
            <span className="rounded-xl bg-mint-400/10 px-3 py-2 text-sm font-extrabold text-mint-600">extras {money0(m.extrasRev)}/mo</span>
          </div>
        </Card>
        <Card className="space-y-3 p-5">
          <p className="eyebrow">Overhead &amp; outcome</p>
          <NumField label="Rent, food, insurance & other" value={sc.overhead} onChange={(v) => setSc({ overhead: v })} prefix="$" suffix="/mo" w="w-24" />
          <div className="space-y-1.5 border-t border-line pt-3 text-sm">
            {[['Tuition', m.tuitionRev], ['Add-on plans', m.plansRev], ['Incident fees', sc.incidentsMo || 0], ['Staffing', -m.staffCost], ['Overhead', -(sc.overhead || 0)]].map(([k, v]) => (
              <div key={k} className="flex justify-between font-semibold text-slate-500"><span>{k}</span><span className={v < 0 ? 'text-coral-500' : 'text-slate-700'}>{v < 0 ? '−' : ''}{money0(Math.abs(v))}</span></div>
            ))}
            <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold text-slate-800">
              <span>Profit</span><span className={m.profit >= 0 ? 'text-mint-600' : 'text-coral-500'}>{money0(m.profit)}/mo</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400">≈ {money0(m.profit * 12)}/year at {m.margin.toFixed(1)}% margin</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ════════════════════════ REPORTS (real data, filters & weighting) ═══════ */

const PERIODS = [['month', 'This month'], ['30', 'Last 30 days'], ['all', 'All time']]

function Reports() {
  const { childrenList, educators } = useApp()
  const charges = useQuery(api.extras.listCharges) || []
  const subs = useQuery(api.extras.listSubscriptions) || []
  const setStatus = useMutation(api.extras.setChargeStatus)

  const rooms = useMemo(() => [...new Set(childrenList.map((c) => c.room))], [childrenList])
  const [roomFilter, setRoomFilter] = useState([]) // empty = all
  const [period, setPeriod] = useState('month')
  const [types, setTypes] = useState({ tuition: true, plans: true, incidents: true })
  const [statusFilter, setStatusFilter] = useState('all')
  const [weight, setWeight] = useState('revenue') // revenue | extras | name

  const inPeriod = (t) => {
    if (period === 'all') return true
    const d = new Date(t), now = new Date()
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    return now - d < 30 * 864e5
  }
  const roomOk = (room) => roomFilter.length === 0 || roomFilter.includes(room)

  const kids = childrenList.filter((c) => roomOk(c.room))
  const kidIds = new Set(kids.map((k) => k.id))
  const fCharges = charges.filter((c) => inPeriod(c.createdAt) && (statusFilter === 'all' || c.status === statusFilter) && (!c.childId || kidIds.has(c.childId) || roomFilter.length === 0))
  const fSubs = subs.filter((s) => kidIds.has(s.childId) || roomFilter.length === 0)

  const tuitionMRR = types.tuition ? kids.reduce((s, c) => s + (c.monthlyTuition || 0), 0) : 0
  const plansMRR = types.plans ? fSubs.reduce((s, x) => s + x.monthlyAmount, 0) : 0
  const incidentsTotal = types.incidents ? fCharges.filter((c) => c.status !== 'waived').reduce((s, c) => s + c.amount, 0) : 0
  const unbilled = charges.filter((c) => c.status === 'unbilled').reduce((s, c) => s + c.amount, 0)
  const payroll = educators.reduce((s, e) => s + (e.payRate ? (e.payType === 'salary' ? (e.payRate / 12) : e.payRate * (e.hoursWeek || 0) * 4.33) : 0), 0) * BURDEN
  const total = tuitionMRR + plansMRR + incidentsTotal

  // per-family weighting
  const perKid = kids.map((c) => {
    const planRev = fSubs.filter((s) => s.childId === c.id).reduce((s, x) => s + x.monthlyAmount, 0)
    const incRev = fCharges.filter((x) => x.childId === c.id && x.status !== 'waived').reduce((s, x) => s + x.amount, 0)
    const rev = (types.tuition ? (c.monthlyTuition || 0) : 0) + (types.plans ? planRev : 0) + (types.incidents ? incRev : 0)
    return { ...c, planRev, incRev, rev }
  }).sort((a, b) => (weight === 'name' ? a.name.localeCompare(b.name) : weight === 'extras' ? (b.planRev + b.incRev) - (a.planRev + a.incRev) : b.rev - a.rev))
  const maxRev = Math.max(1, ...perKid.map((k) => k.rev))

  const chip = (on) => `rounded-full px-3 py-1.5 text-xs font-bold transition ${on ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 border border-line'}`

  return (
    <div className="space-y-5">
      {unbilled > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-sunshine-400/50 bg-sunshine-400/10 px-4 py-3 text-sm font-bold text-slate-700">
          <AlertTriangle size={16} className="text-sunshine-600" /> {money(unbilled)} in extras hasn't been billed yet — don't let it slip. Mark items billed below once invoiced.
        </div>
      )}

      {/* filters */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Rooms</span>
          <button onClick={() => setRoomFilter([])} className={chip(roomFilter.length === 0)}>All</button>
          {rooms.map((r) => (
            <button key={r} onClick={() => setRoomFilter((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r])} className={chip(roomFilter.includes(r))}>{r}</button>
          ))}
          <span className="eyebrow ml-3 mr-1">Period</span>
          {PERIODS.map(([id, l]) => <button key={id} onClick={() => setPeriod(id)} className={chip(period === id)}>{l}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Revenue</span>
          {Object.entries({ tuition: 'Tuition', plans: 'Add-on plans', incidents: 'Incident fees' }).map(([k, l]) => (
            <button key={k} onClick={() => setTypes((p) => ({ ...p, [k]: !p[k] }))} className={chip(types[k])}>{l}</button>
          ))}
          <span className="eyebrow ml-3 mr-1">Weight families by</span>
          {[['revenue', 'Total revenue'], ['extras', 'Extras'], ['name', 'Name']].map(([k, l]) => (
            <button key={k} onClick={() => setWeight(k)} className={chip(weight === k)}>{l}</button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Tuition MRR" value={money0(tuitionMRR)} sub={`${kids.filter((k) => k.monthlyTuition).length}/${kids.length} have tuition set`} gradient="from-brand-400 to-brand-600" />
        <StatCard icon={CalendarClock} label="Add-on plan MRR" value={money0(plansMRR)} sub={`${fSubs.length} active subscriptions`} gradient="from-grape-400 to-grape-600" delay={0.04} />
        <StatCard icon={ReceiptText} label="Incident fees" value={money0(incidentsTotal)} sub={`${fCharges.length} in period · ${money0(unbilled)} unbilled`} gradient="from-sunshine-400 to-coral-500" delay={0.08} />
        <StatCard icon={TrendingUp} label="Net (est)" value={money0(total - payroll)} sub={`${money0(total)} rev − ${money0(payroll)} payroll est`} gradient="from-mint-400 to-mint-500" delay={0.12} />
      </div>

      {/* family weighting */}
      <Card className="p-5">
        <p className="eyebrow mb-3">Revenue by family ({weight === 'extras' ? 'weighted by extras' : weight === 'name' ? 'A–Z' : 'weighted by total'})</p>
        {perKid.length === 0 ? (
          <p className="py-4 text-center text-sm font-semibold text-slate-400">No children match these filters yet.</p>
        ) : perKid.map((k) => (
          <div key={k.id} className="border-b border-line/60 py-2.5 last:border-0">
            <div className="flex items-center gap-2 text-sm">
              <span>{k.emoji}</span>
              <span className="font-extrabold text-slate-700">{k.name}</span>
              <span className="text-[11px] font-bold text-slate-400">{k.room}</span>
              <span className="ml-auto font-extrabold text-slate-800">{money0(k.rev)}<span className="text-[10px] font-semibold text-slate-400">/mo</span></span>
            </div>
            <div className="mt-1.5 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100">
              <div style={{ width: `${((k.monthlyTuition || 0) / maxRev) * 100}%` }} className="bg-gradient-to-r from-brand-400 to-brand-500" />
              <div style={{ width: `${(k.planRev / maxRev) * 100}%` }} className="bg-gradient-to-r from-grape-400 to-grape-500" />
              <div style={{ width: `${(k.incRev / maxRev) * 100}%` }} className="bg-gradient-to-r from-sunshine-400 to-coral-400" />
            </div>
          </div>
        ))}
        <p className="mt-3 flex gap-4 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-500" /> tuition</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-grape-500" /> plans</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-coral-400" /> incidents</span>
        </p>
      </Card>

      {/* incident ledger */}
      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">Incident ledger</p>
          <div className="flex gap-1.5">
            {['all', 'unbilled', 'billed', 'waived'].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={chip(statusFilter === s) + ' capitalize'}>{s}</button>
            ))}
          </div>
        </div>
        {fCharges.length === 0 ? (
          <p className="py-4 text-center text-sm font-semibold text-slate-400">No charges in this view. Educators log them from their Extras tab the moment they happen.</p>
        ) : fCharges.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 border-b border-line/60 py-2.5 text-sm last:border-0">
            <span>{c.emoji}</span>
            <div className="min-w-0">
              <span className="font-extrabold text-slate-700">{c.serviceName}</span>
              <span className="ml-1.5 font-bold text-slate-500">· {c.childName}</span>
              {c.minutes ? <span className="ml-1.5 text-xs font-bold text-slate-400">{c.minutes} min</span> : null}
              <div className="text-[11px] font-semibold text-slate-400">{new Date(c.createdAt).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · by {c.by}{c.note ? ` · ${c.note}` : ''}</div>
            </div>
            <span className="ml-auto font-extrabold text-slate-800">{money(c.amount)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.status === 'unbilled' ? 'bg-sunshine-400/15 text-sunshine-600' : c.status === 'billed' ? 'bg-mint-400/15 text-mint-600' : 'bg-slate-100 text-slate-400'}`}>{c.status}</span>
            {c.status === 'unbilled' && (
              <span className="flex gap-1">
                <button onClick={() => setStatus({ id: c.id, status: 'billed' })} className="rounded-lg bg-mint-400/15 px-2 py-1 text-[10px] font-bold text-mint-600">Mark billed</button>
                <button onClick={() => setStatus({ id: c.id, status: 'waived' })} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Waive</button>
              </span>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}

/* ════════════════════════ EXTRAS & PLANS (catalog + logging) ═════════════ */

const TEMPLATES = [
  { name: 'Late pickup', emoji: '⏰', kind: 'incident', pricing: 'per15', amount: 15 },
  { name: 'Early drop-off', emoji: '🌅', kind: 'incident', pricing: 'flat', amount: 10 },
  { name: 'Unscheduled early pickup', emoji: '🚗', kind: 'incident', pricing: 'flat', amount: 8 },
  { name: 'Extended hours plan', emoji: '🕖', kind: 'plan', pricing: 'monthly', amount: 50 },
  { name: 'Hot lunch plan', emoji: '🍲', kind: 'plan', pricing: 'monthly', amount: 65 },
]

export function QuickLog({ compact = false }) {
  const { childrenList, pushToast } = useApp()
  const services = (useQuery(api.extras.listServices) || []).filter((s) => s.kind === 'incident' && s.active)
  const logCharge = useMutation(api.extras.logCharge)
  const [svc, setSvc] = useState(null)
  const [childId, setChildId] = useState('')
  const [minutes, setMinutes] = useState(15)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const child = childrenList.find((c) => c.id === childId)
    if (!svc || !child) { pushToast('Pick the charge and the child.', { emoji: '🧒', tone: 'coral' }); return }
    setBusy(true)
    try {
      const { amount } = await logCharge({ serviceId: svc.id, childId: child.id, childName: child.name, minutes: svc.pricing === 'per15' ? minutes : undefined })
      pushToast(`${svc.name} logged for ${child.first || child.name} — ${money(amount)}`, { emoji: svc.emoji, tone: 'mint' })
      setSvc(null); setChildId(''); setMinutes(15)
    } catch (e) {
      pushToast(String(e?.message || '').includes('authenticated') ? 'Sign in to log charges (demo is read-only).' : (e?.message || 'Could not log.'), { emoji: '⚠️', tone: 'coral' })
    } finally { setBusy(false) }
  }

  if (services.length === 0) {
    return <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-400">No incident charges configured yet{compact ? ' — ask your director to set them up in Finance → Extras.' : ' — add one from the templates below.'}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {services.map((s) => (
          <button key={s.id} onClick={() => setSvc(svc?.id === s.id ? null : s)}
            className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-bold transition active:scale-95 ${svc?.id === s.id ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-slate-600'}`}>
            <span className="text-lg">{s.emoji}</span> {s.name}
            <span className="text-[10px] font-bold text-slate-400">{s.pricing === 'per15' ? `${money(s.amount)}/15min` : money(s.amount)}</span>
          </button>
        ))}
      </div>
      {svc && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-3">
          <label className="block min-w-[10rem] flex-1">
            <span className="eyebrow mb-1 block">Child</span>
            <select value={childId} onChange={(e) => setChildId(e.target.value)} className="input !py-2">
              <option value="">Pick a child…</option>
              {childrenList.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name} · {c.room}</option>)}
            </select>
          </label>
          {svc.pricing === 'per15' && (
            <label className="block">
              <span className="eyebrow mb-1 block">Minutes late</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setMinutes((m) => Math.max(5, m - 5))} className="h-9 w-9 rounded-lg bg-white font-bold text-slate-600 shadow-sm active:scale-90">−</button>
                <span className="w-12 text-center text-lg font-extrabold text-slate-800">{minutes}</span>
                <button onClick={() => setMinutes((m) => m + 5)} className="h-9 w-9 rounded-lg bg-white font-bold text-slate-600 shadow-sm active:scale-90">+</button>
              </div>
            </label>
          )}
          <button onClick={submit} disabled={busy} className="btn-primary !py-2.5 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Log {svc.pricing === 'per15' ? money(Math.max(1, Math.ceil(minutes / 15)) * svc.amount) : money(svc.amount)}
          </button>
        </motion.div>
      )}
    </div>
  )
}

function ExtrasManager() {
  const { childrenList, pushToast } = useApp()
  const services = useQuery(api.extras.listServices) || []
  const subs = useQuery(api.extras.listSubscriptions) || []
  const addService = useMutation(api.extras.addService)
  const toggleService = useMutation(api.extras.toggleService)
  const removeService = useMutation(api.extras.removeService)
  const subscribePlan = useMutation(api.extras.subscribePlan)
  const cancelPlan = useMutation(api.extras.cancelPlan)
  const [custom, setCustom] = useState({ name: '', emoji: '✨', kind: 'incident', pricing: 'flat', amount: 10 })
  const [showCustom, setShowCustom] = useState(false)
  const [assign, setAssign] = useState({ serviceId: '', childId: '' })

  const guard = async (fn, okMsg, emoji = '✅') => {
    try { await fn(); if (okMsg) pushToast(okMsg, { emoji, tone: 'mint' }) } catch (e) {
      pushToast(String(e?.message || '').includes('authenticated') ? 'Demo is read-only — sign in to manage extras.' : (e?.message || 'That didn’t work.'), { emoji: '⚠️', tone: 'coral' })
    }
  }
  const plans = services.filter((s) => s.kind === 'plan' && s.active)
  const existingNames = new Set(services.map((s) => s.name))

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <p className="eyebrow flex items-center gap-1.5"><Wand2 size={12} /> Log a charge right now</p>
        <QuickLog />
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">What you charge for</p>
          <button onClick={() => setShowCustom((s) => !s)} className="btn-ghost !py-1.5 text-xs"><Plus size={13} /> Custom</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.filter((t) => !existingNames.has(t.name)).map((t) => (
            <button key={t.name} onClick={() => guard(() => addService(t), `${t.name} added`, t.emoji)}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-brand-300 bg-brand-50/50 px-3 py-1.5 text-xs font-bold text-brand-600 transition hover:bg-brand-50">
              <Plus size={12} /> {t.emoji} {t.name} · {t.pricing === 'per15' ? `${money(t.amount)}/15min` : t.pricing === 'monthly' ? `${money(t.amount)}/mo` : money(t.amount)}
            </button>
          ))}
        </div>
        {showCustom && (
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-3">
            <input className="input !w-20 !py-2 text-center" maxLength={2} value={custom.emoji} onChange={(e) => setCustom({ ...custom, emoji: e.target.value })} />
            <input className="input !py-2 min-w-[10rem] flex-1" placeholder="Name (e.g. Weekend care)" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
            <select className="input !w-auto !py-2" value={custom.kind} onChange={(e) => setCustom({ ...custom, kind: e.target.value, pricing: e.target.value === 'plan' ? 'monthly' : 'flat' })}>
              <option value="incident">Per occurrence</option><option value="plan">Monthly plan</option>
            </select>
            {custom.kind === 'incident' && (
              <select className="input !w-auto !py-2" value={custom.pricing} onChange={(e) => setCustom({ ...custom, pricing: e.target.value })}>
                <option value="flat">Flat fee</option><option value="per15">Per 15 min</option>
              </select>
            )}
            <NumField label="Amount" value={custom.amount} onChange={(v) => setCustom({ ...custom, amount: v })} prefix="$" w="w-16" />
            <button onClick={() => guard(() => addService(custom).then(() => { setShowCustom(false); setCustom({ name: '', emoji: '✨', kind: 'incident', pricing: 'flat', amount: 10 }) }), 'Added')} className="btn-primary !py-2 text-sm">Add</button>
          </div>
        )}
        {services.length > 0 && (
          <div className="divide-y divide-line/60">
            {services.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 py-2.5 text-sm">
                <span className="text-lg">{s.emoji}</span>
                <span className="font-extrabold text-slate-700">{s.name}</span>
                <Pill className={s.kind === 'plan' ? 'bg-grape-500/10 text-grape-600' : 'bg-sunshine-400/15 text-sunshine-600'}>{s.kind === 'plan' ? 'monthly plan' : 'per occurrence'}</Pill>
                <span className="ml-auto font-bold text-slate-600">{s.pricing === 'per15' ? `${money(s.amount)}/15min` : s.kind === 'plan' ? `${money(s.amount)}/mo` : money(s.amount)}</span>
                <button onClick={() => guard(() => toggleService({ id: s.id, active: !s.active }))}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${s.active ? 'bg-mint-400/15 text-mint-600' : 'bg-slate-100 text-slate-400'}`}>{s.active ? 'Active' : 'Off'}</button>
                <button onClick={() => guard(() => removeService({ id: s.id }))} className="rounded-lg p-1.5 text-slate-300 hover:text-coral-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <p className="eyebrow">Add-on plans sold to families</p>
        {plans.length === 0 ? (
          <p className="text-sm font-semibold text-slate-400">Create a monthly plan above (extended hours, hot lunch…) — then sell it per child here.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-3">
            <label className="block min-w-[9rem] flex-1"><span className="eyebrow mb-1 block">Plan</span>
              <select className="input !py-2" value={assign.serviceId} onChange={(e) => setAssign({ ...assign, serviceId: e.target.value })}>
                <option value="">Pick a plan…</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.emoji} {p.name} · {money(p.amount)}/mo</option>)}
              </select>
            </label>
            <label className="block min-w-[9rem] flex-1"><span className="eyebrow mb-1 block">Child</span>
              <select className="input !py-2" value={assign.childId} onChange={(e) => setAssign({ ...assign, childId: e.target.value })}>
                <option value="">Pick a child…</option>
                {childrenList.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </label>
            <button disabled={!assign.serviceId || !assign.childId}
              onClick={() => guard(() => subscribePlan({ serviceId: assign.serviceId, childId: assign.childId }).then(() => setAssign({ serviceId: '', childId: '' })), 'Plan added — it now shows in their monthly total', '🧾')}
              className="btn-primary !py-2 text-sm disabled:opacity-40"><Plus size={14} /> Add to family</button>
          </div>
        )}
        {subs.length > 0 && (
          <div className="divide-y divide-line/60">
            {subs.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 py-2.5 text-sm">
                <span className="text-lg">{s.emoji}</span>
                <span className="font-extrabold text-slate-700">{s.childName}</span>
                <span className="font-semibold text-slate-500">· {s.serviceName}</span>
                <span className="ml-auto font-bold text-slate-600">{money(s.monthlyAmount)}/mo</span>
                <button onClick={() => guard(() => cancelPlan({ id: s.id }), 'Plan cancelled')} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-coral-500">Cancel</button>
              </div>
            ))}
          </div>
        )}
        {subs.length > 0 && (
          <p className="rounded-xl bg-grape-500/10 px-3 py-2 text-right text-sm font-extrabold text-grape-600">
            Add-on MRR: {money(subs.reduce((s, x) => s + x.monthlyAmount, 0))}/mo
          </p>
        )}
      </Card>
    </div>
  )
}

/* ════════════════════════ Shells ═════════════════════════════════════════ */

export function FinanceStudio() {
  const [tab, setTab] = useState('project')
  const tabs = [
    { id: 'project', label: 'Projections', icon: SlidersHorizontal },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'extras', label: 'Extras & plans', icon: ReceiptText },
  ]
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Money" title="Finance studio 💸" subtitle="Model what-ifs, watch the real numbers, and never miss a billable minute" />
      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition ${tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
            <t.icon size={15} /> <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {tab === 'project' && <Projections />}
        {tab === 'reports' && <Reports />}
        {tab === 'extras' && <ExtrasManager />}
      </motion.div>
    </div>
  )
}

// Educator-facing: log it the moment it happens, see today's log.
export function ExtrasLogger() {
  const charges = useQuery(api.extras.listCharges) || []
  const today = charges.filter((c) => new Date(c.createdAt).toDateString() === new Date().toDateString())
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="At the door" title="Extras ⏰" subtitle="Late pickup? Early drop-off? Tap it the moment it happens — billing handles the rest" />
      <Card className="p-5"><QuickLog compact /></Card>
      <Card className="p-5">
        <p className="eyebrow mb-2">Logged today</p>
        {today.length === 0 ? (
          <p className="py-3 text-center text-sm font-semibold text-slate-400">Nothing yet today. 🤞</p>
        ) : today.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 border-b border-line/60 py-2.5 text-sm last:border-0">
            <span>{c.emoji}</span>
            <span className="font-extrabold text-slate-700">{c.serviceName}</span>
            <span className="font-semibold text-slate-500">· {c.childName}{c.minutes ? ` · ${c.minutes} min` : ''}</span>
            <span className="ml-auto font-extrabold text-slate-800">{money(c.amount)}</span>
            <span className="text-[10px] font-bold text-slate-400">{new Date(c.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}

// Parent-facing: their own children's extras — transparent, no surprises.
export function ParentExtrasCard() {
  const charges = useQuery(api.extras.listCharges) || []
  const subs = useQuery(api.extras.listSubscriptions) || []
  const now = new Date()
  const monthCharges = charges.filter((c) => { const d = new Date(c.createdAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && c.status !== 'waived' })
  if (monthCharges.length === 0 && subs.length === 0) return null
  return (
    <Card className="p-5">
      <p className="eyebrow mb-2 flex items-center gap-1.5"><ReceiptText size={12} /> Extras this month</p>
      {subs.map((s) => (
        <div key={s.id} className="flex items-center gap-2 border-b border-line/60 py-2 text-sm last:border-0">
          <span>{s.emoji}</span><span className="font-bold text-slate-700">{s.serviceName}</span>
          <span className="text-xs font-semibold text-slate-400">· {s.childName} · monthly plan</span>
          <span className="ml-auto font-extrabold text-slate-800">{money(s.monthlyAmount)}/mo</span>
        </div>
      ))}
      {monthCharges.map((c) => (
        <div key={c.id} className="flex items-center gap-2 border-b border-line/60 py-2 text-sm last:border-0">
          <span>{c.emoji}</span><span className="font-bold text-slate-700">{c.serviceName}</span>
          <span className="text-xs font-semibold text-slate-400">· {c.childName} · {new Date(c.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}{c.minutes ? ` · ${c.minutes} min` : ''}</span>
          <span className="ml-auto font-extrabold text-slate-800">{money(c.amount)}</span>
        </div>
      ))}
      <p className="mt-2 text-right text-sm font-extrabold text-brand-700">
        {money(subs.reduce((s, x) => s + x.monthlyAmount, 0) + monthCharges.reduce((s, x) => s + x.amount, 0))} this month
      </p>
    </Card>
  )
}
