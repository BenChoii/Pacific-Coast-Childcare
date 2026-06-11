import { useState } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion } from 'framer-motion'
import {
  Banknote, Settings2, History, Download, Printer, ArrowLeft, Check, Loader2,
  AlertTriangle, Calculator, Users, Trash2, Clock, UserPlus, Copy, Eye, Link2,
  ExternalLink, Lock, ShieldCheck, FileText,
} from 'lucide-react'
import { SectionHeader, Card } from '../components/ui.jsx'
import { useApp } from '../context/AppContext.jsx'

const PERIODS = [
  ['weekly', 'Weekly', 52, 6],
  ['biweekly', 'Bi-weekly', 26, 13],
  ['semimonthly', 'Semi-monthly', 24, 14],
]
const PPY = { weekly: 52, biweekly: 26, semimonthly: 24 }
const OT = 1.5
const r2 = (n) => Math.round((Number.isFinite(+n) ? +n : 0) * 100) / 100
const money = (n) => '$' + r2(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ymd = (d) => d.toISOString().slice(0, 10)

// Mirror of convex/payroll.ts computeLine — keep identical.
function calcLine(ed, input, payPeriod) {
  const rate = Math.max(0, ed.payRate || 0)
  const vac = ed.vacationPct === 6 ? 6 : 4
  const reg = Math.max(0, +input.regularHours || 0)
  const ot = Math.max(0, +input.otHours || 0)
  const stat = Math.max(0, +input.statPay || 0)
  const gross = r2(ed.payType === 'salary' ? rate / (PPY[payPeriod] || 26) + stat : reg * rate + ot * rate * OT + stat)
  return { gross, vacationAccrued: r2(gross * (vac / 100)) }
}

function defaultPeriod(payPeriod) {
  const back = PERIODS.find((p) => p[0] === payPeriod)?.[3] ?? 13
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - back)
  return { start: ymd(start), end: ymd(end) }
}

function Disclaimer() {
  return (
    <div className="flex gap-2.5 rounded-2xl border border-sunshine-400/40 bg-sunshine-400/10 p-3.5 text-sm">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-sunshine-600" />
      <p className="font-medium leading-relaxed text-slate-600">
        These are <strong>gross</strong> amounts. Cubby doesn't calculate or remit CPP, EI or income tax — you're
        responsible for source deductions &amp; CRA remittance, or hand these stubs to your payroll provider.
      </p>
    </div>
  )
}

/* ─────────────────────────── Pay setup tab ─────────────────────────── */
function PaySetup({ settings }) {
  const setPeriod = useMutation(api.payroll.setPayPeriod)
  const setPay = useMutation(api.payroll.setEducatorPay)
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <p className="eyebrow">Pay period</p>
        <p className="mt-1 text-sm font-medium text-slate-500">How often you run payroll. Sets how salaries split per run.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PERIODS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPeriod({ payPeriod: id })}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${settings.payPeriod === id ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="eyebrow">Each educator's pay</p>
        {settings.educators.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-slate-500">Add educators first (Educators tab), then set their pay here.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {settings.educators.map((ed) => (
              <EducatorPayRow key={ed._id} ed={ed} onSave={setPay} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function EducatorPayRow({ ed, onSave }) {
  const [payType, setPayType] = useState(ed.payType || 'hourly')
  const [rate, setRate] = useState(ed.payRate ?? '')
  const [vac, setVac] = useState(ed.vacationPct || 4)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = payType !== (ed.payType || 'hourly') || +rate !== (ed.payRate ?? '') || vac !== (ed.vacationPct || 4)

  const save = async () => {
    setSaving(true)
    try {
      await onSave({ educatorId: ed._id, payType, payRate: Math.max(0, +rate || 0), vacationPct: vac })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line p-3.5">
      <div className="flex items-center gap-2">
        <span className="text-xl">{ed.emoji || '🧑‍🏫'}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold text-slate-700">{ed.name}</div>
          <div className="truncate text-[11px] font-bold text-slate-400">{ed.role}</div>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
          {['hourly', 'salary'].map((t) => (
            <button
              key={t}
              onClick={() => setPayType(t)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold capitalize transition ${payType === t ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="eyebrow mb-1 block">{payType === 'salary' ? 'Annual salary' : 'Rate / hour'}</span>
          <div className="flex items-center gap-1 rounded-xl border border-line bg-white px-2.5">
            <span className="text-sm font-bold text-slate-400">$</span>
            <input
              type="number" min="0" step={payType === 'salary' ? '500' : '0.25'} value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={payType === 'salary' ? '52000' : '22.50'}
              className="w-28 border-0 py-2 text-sm font-bold text-slate-700 outline-none"
            />
          </div>
        </label>
        <label className="block">
          <span className="eyebrow mb-1 block">Vacation %</span>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
            {[4, 6].map((p) => (
              <button
                key={p} onClick={() => setVac(p)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${vac === p ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
              >
                {p}%
              </button>
            ))}
          </div>
        </label>
        <button
          onClick={save}
          disabled={saving || !dirty || rate === ''}
          className="btn-primary ml-auto !py-2 text-sm disabled:opacity-40"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────── Run payroll tab ─────────────────────────── */
function RunPayroll({ settings, onRan }) {
  const run = useMutation(api.payroll.runPayroll)
  const payable = settings.educators.filter((e) => e.payRate)
  const weeksFactor = settings.payPeriod === 'weekly' ? 1 : 2
  const [{ start, end }, setRange] = useState(() => defaultPeriod(settings.payPeriod))
  const [entries, setEntries] = useState(() =>
    Object.fromEntries(
      payable.map((e) => [e._id, { regularHours: e.payType === 'salary' ? 0 : r2((e.hoursWeek || 0) * weeksFactor), otHours: 0, statPay: 0 }]),
    ),
  )
  const [busy, setBusy] = useState(false)

  const set = (id, field, val) => setEntries((p) => ({ ...p, [id]: { ...p[id], [field]: val } }))

  const rows = payable.map((ed) => ({ ed, input: entries[ed._id], ...calcLine(ed, entries[ed._id], settings.payPeriod) }))
  const totalGross = r2(rows.reduce((s, r) => s + r.gross, 0))
  const totalVac = r2(rows.reduce((s, r) => s + r.vacationAccrued, 0))

  const generate = async () => {
    setBusy(true)
    try {
      const res = await run({
        periodStart: start,
        periodEnd: end,
        entries: payable.map((e) => ({
          educatorId: e._id,
          regularHours: Math.max(0, +entries[e._id].regularHours || 0),
          otHours: Math.max(0, +entries[e._id].otHours || 0),
          statPay: Math.max(0, +entries[e._id].statPay || 0),
        })),
      })
      onRan(res.runId)
    } catch (e) {
      alert(e.message || 'Could not generate the pay run.')
    } finally {
      setBusy(false)
    }
  }

  if (payable.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Settings2 size={22} /></span>
        <h3 className="text-xl text-slate-800">Set up pay first</h3>
        <p className="max-w-sm text-sm font-medium text-slate-500">
          No educators have a pay rate yet. Head to <strong>Pay setup</strong> to add hourly rates or salaries, then come back to run payroll.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Disclaimer />
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="eyebrow mb-1 block">Period start</span>
            <input type="date" value={start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} className="input !py-2" />
          </label>
          <label className="block">
            <span className="eyebrow mb-1 block">Period end</span>
            <input type="date" value={end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} className="input !py-2" />
          </label>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
            <Clock size={13} /> {PERIODS.find((p) => p[0] === settings.payPeriod)?.[1]}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="pb-2 pr-3 font-bold text-slate-400">Educator</th>
                <th className="pb-2 px-2 font-bold text-slate-400">Reg hrs</th>
                <th className="pb-2 px-2 font-bold text-slate-400">OT hrs</th>
                <th className="pb-2 px-2 font-bold text-slate-400">Stat pay</th>
                <th className="pb-2 px-2 text-right font-bold text-slate-400">Gross</th>
                <th className="pb-2 pl-2 text-right font-bold text-slate-400">Vac accr.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ ed, input, gross, vacationAccrued }) => {
                const salary = ed.payType === 'salary'
                return (
                  <tr key={ed._id} className="border-b border-line/60">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span>{ed.emoji || '🧑‍🏫'}</span>
                        <div className="min-w-0">
                          <div className="truncate font-extrabold text-slate-700">{ed.name}</div>
                          <div className="text-[11px] font-bold text-slate-400">
                            {salary ? `${money(ed.payRate / (PPY[settings.payPeriod] || 26))}/period · salary` : `${money(ed.payRate)}/hr`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      {salary ? <span className="text-slate-300">—</span> : (
                        <input type="number" min="0" step="0.5" value={input.regularHours}
                          onChange={(e) => set(ed._id, 'regularHours', e.target.value)}
                          className="w-20 rounded-lg border border-line px-2 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-brand-400" />
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      {salary ? <span className="text-slate-300">—</span> : (
                        <input type="number" min="0" step="0.5" value={input.otHours}
                          onChange={(e) => set(ed._id, 'otHours', e.target.value)}
                          className="w-16 rounded-lg border border-line px-2 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-brand-400" />
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex w-24 items-center gap-1 rounded-lg border border-line px-2">
                        <span className="text-xs font-bold text-slate-400">$</span>
                        <input type="number" min="0" step="1" value={input.statPay}
                          onChange={(e) => set(ed._id, 'statPay', e.target.value)}
                          className="w-full border-0 py-1.5 text-sm font-bold text-slate-700 outline-none" />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-extrabold text-slate-800">{money(gross)}</td>
                    <td className="py-2.5 pl-2 text-right font-bold text-mint-600">{money(vacationAccrued)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-extrabold text-slate-800">
                <td className="pt-3 pr-3" colSpan={4}>Totals · {rows.length} educator{rows.length === 1 ? '' : 's'}</td>
                <td className="pt-3 px-2 text-right text-brand-700">{money(totalGross)}</td>
                <td className="pt-3 pl-2 text-right text-mint-600">{money(totalVac)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-400">Reg hrs pre-filled from tracked weekly hours — review &amp; adjust before generating.</p>
          <button onClick={generate} disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
            Generate pay run &amp; stubs
          </button>
        </div>
      </Card>
    </div>
  )
}

/* ─────────────────────────── Stub view (run detail) ─────────────────────────── */
function csvForRun(run) {
  const head = ['Educator', 'Role', 'Pay type', 'Rate', 'Regular hrs', 'OT hrs', 'Stat pay', 'Gross pay', 'Vacation %', 'Vacation accrued']
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
  const rows = run.lines.map((l) =>
    [l.name, l.role, l.payType, l.rate, l.regularHours, l.otHours, l.statPay, l.gross, l.vacationPct + '%', l.vacationAccrued].map(esc).join(','),
  )
  const totals = esc('TOTALS') + ',,,,,,,' + esc(run.totalGross) + ',,' + esc(run.totalVacation)
  return [head.map(esc).join(','), ...rows, totals].join('\n')
}

function RunDetail({ runId, onBack }) {
  const run = useQuery(api.payroll.getRun, { runId })
  const del = useMutation(api.payroll.deleteRun)
  if (run === undefined) return <Card className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-brand-400" /></Card>
  if (run === null) return <Card className="p-10 text-center text-slate-500">Run not found.</Card>

  const download = () => {
    const blob = new Blob([csvForRun(run)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll_${run.periodStart}_to_${run.periodEnd}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="btn-ghost !py-2 text-sm"><ArrowLeft size={15} /> Back</button>
        <div className="ml-auto flex gap-2">
          <button onClick={() => window.print()} className="btn-ghost !py-2 text-sm"><Printer size={15} /> Print</button>
          <button onClick={download} className="btn-primary !py-2 text-sm"><Download size={15} /> CSV</button>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Pay run</p>
            <h3 className="text-2xl text-slate-800">{run.periodStart} → {run.periodEnd}</h3>
            <p className="mt-0.5 text-xs font-bold text-slate-400">
              {PERIODS.find((p) => p[0] === run.payPeriod)?.[1]} · {run.headcount} educator{run.headcount === 1 ? '' : 's'} · run by {run.createdByName}
            </p>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-display text-3xl text-brand-700">{money(run.totalGross)}</div>
              <div className="eyebrow">total gross</div>
            </div>
            <div>
              <div className="font-display text-3xl text-mint-600">{money(run.totalVacation)}</div>
              <div className="eyebrow">vacation accrued</div>
            </div>
          </div>
        </div>
      </Card>

      <Disclaimer />

      <div className="grid gap-3 sm:grid-cols-2">
        {run.lines.map((l, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center justify-between">
              <div className="font-extrabold text-slate-800">{l.name}</div>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold capitalize text-brand-700">{l.payType}</span>
            </div>
            <div className="mt-0.5 text-xs font-bold text-slate-400">{l.role} · {l.payType === 'salary' ? `${money(l.rate)}/yr` : `${money(l.rate)}/hr`}</div>
            <dl className="mt-3 space-y-1.5 text-sm">
              {l.payType !== 'salary' && (
                <>
                  <Row k={`Regular (${l.regularHours}h)`} v={money(l.regularHours * l.rate)} />
                  {l.otHours > 0 && <Row k={`Overtime (${l.otHours}h × 1.5)`} v={money(l.otHours * l.rate * OT)} />}
                </>
              )}
              {l.payType === 'salary' && <Row k="Salary (this period)" v={money(l.gross - l.statPay)} />}
              {l.statPay > 0 && <Row k="Stat-holiday pay" v={money(l.statPay)} />}
              <div className="my-1 border-t border-line" />
              <Row k="Gross pay" v={money(l.gross)} strong />
              <Row k={`Vacation accrued (${l.vacationPct}%)`} v={money(l.vacationAccrued)} mint />
            </dl>
          </Card>
        ))}
      </div>

      <button
        onClick={() => { if (confirm('Delete this pay run? This cannot be undone.')) del({ runId }).then(onBack) }}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-coral-500 hover:text-coral-600"
      >
        <Trash2 size={13} /> Delete this run
      </button>
    </div>
  )
}

function Row({ k, v, strong, mint }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="font-semibold text-slate-500">{k}</dt>
      <dd className={`font-bold ${strong ? 'text-slate-900' : mint ? 'text-mint-600' : 'text-slate-700'}`}>{v}</dd>
    </div>
  )
}

/* ─────────────────────────── History tab ─────────────────────────── */
function RunHistory({ onOpen }) {
  const runs = useQuery(api.payroll.listRuns)
  if (runs === undefined) return <Card className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-brand-400" /></Card>
  if (runs.length === 0) return (
    <Card className="flex flex-col items-center gap-2 p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><History size={22} /></span>
      <p className="text-sm font-medium text-slate-500">No pay runs yet. Generate your first one from the <strong>Run payroll</strong> tab.</p>
    </Card>
  )
  return (
    <div className="space-y-2.5">
      {runs.map((r) => (
        <button key={r._id} onClick={() => onOpen(r._id)} className="w-full text-left">
          <Card className="flex items-center gap-3 p-4 transition hover:border-brand-300">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-grape-500 text-white"><Banknote size={18} /></span>
            <div className="min-w-0">
              <div className="truncate font-extrabold text-slate-700">{r.periodStart} → {r.periodEnd}</div>
              <div className="text-[11px] font-bold text-slate-400">{r.headcount} educator{r.headcount === 1 ? '' : 's'} · {new Date(r.createdAt).toLocaleDateString('en-CA')}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-extrabold text-brand-700">{money(r.totalGross)}</div>
              <div className="eyebrow">gross</div>
            </div>
          </Card>
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────────── Employee onboarding (admin) ─────────────────────────── */
function OnboardingAdmin() {
  const enc = useQuery(api.onboarding.status)
  const profiles = useQuery(api.onboarding.listProfiles)
  const createLink = useMutation(api.onboarding.createLink)
  const [name, setName] = useState('')
  const [role, setRole] = useState('Educator')
  const [link, setLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState(null)

  if (openId) return <ProfileDetail profileId={openId} onBack={() => setOpenId(null)} />

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
    <div className="space-y-4">
      {enc && !enc.encConfigured && (
        <div className="flex gap-2.5 rounded-2xl border border-coral-400/40 bg-coral-400/10 p-3.5 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-coral-500" />
          <div className="font-medium text-slate-600">
            Secure storage for SIN &amp; banking isn't enabled yet. Set an encryption key once to turn it on:
            <code className="mt-1 block overflow-x-auto rounded bg-slate-800 px-2 py-1.5 font-mono text-[11px] text-mint-300">KEY=$(openssl rand -base64 32); npx convex env set ONBOARDING_ENC_KEY "$KEY" --prod</code>
            Links still collect everything else in the meantime.
          </div>
        </div>
      )}

      <Card className="p-5">
        <p className="eyebrow">Invite an employee</p>
        <p className="mt-1 text-sm font-medium text-slate-500">Generate a private link. They fill in their details, banking, SIN &amp; documents — it lands here, ready for payroll.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block min-w-[10rem] flex-1"><span className="eyebrow mb-1 block">Name (optional)</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New hire's name" /></label>
          <label className="block"><span className="eyebrow mb-1 block">Role</span><input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Educator" /></label>
          <button onClick={gen} disabled={busy} className="btn-primary disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Create link</button>
        </div>
        {link && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-2.5">
            <Link2 size={15} className="shrink-0 text-brand-500" />
            <span className="truncate text-sm font-bold text-brand-700">{link}</span>
            <button onClick={copy} className="btn-ghost ml-auto shrink-0 !py-1.5 text-xs">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
          </div>
        )}
      </Card>

      <Card className="p-0">
        <div className="border-b border-line p-4"><p className="eyebrow">Employees</p></div>
        {profiles === undefined ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto animate-spin text-brand-400" /></div>
        ) : profiles.length === 0 ? (
          <p className="p-6 text-center text-sm font-medium text-slate-500">No onboarding links yet. Create one above.</p>
        ) : profiles.map((p) => {
          const submitted = p.status === 'submitted'
          return (
            <button key={p._id} disabled={!submitted} onClick={() => submitted && setOpenId(p._id)}
              className={`flex w-full items-center gap-3 border-b border-line p-4 text-left last:border-0 ${submitted ? 'hover:bg-slate-50' : 'cursor-default'}`}>
              <span className="text-xl">🧑‍🏫</span>
              <div className="min-w-0">
                <div className="truncate font-extrabold text-slate-700">{p.fullName || p.inviteName}</div>
                <div className="text-[11px] font-bold text-slate-400">{p.inviteRole}</div>
              </div>
              <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold ${submitted ? 'bg-mint-400/15 text-mint-600' : 'bg-sunshine-400/15 text-sunshine-600'}`}>
                {submitted ? 'Submitted' : 'Pending'}
              </span>
              {submitted && <ExternalLink size={15} className="text-slate-300" />}
            </button>
          )
        })}
      </Card>
    </div>
  )
}

function ProfileDetail({ profileId, onBack }) {
  const p = useQuery(api.onboarding.getProfile, { profileId })
  const reveal = useAction(api.onboarding.reveal)
  const del = useMutation(api.onboarding.deleteProfile)
  const [secret, setSecret] = useState(null)
  const [revealing, setRevealing] = useState(false)

  if (p === undefined) return <Card className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-brand-400" /></Card>
  if (p === null) return <Card className="p-10 text-center text-slate-500">Not found.</Card>

  const doReveal = async () => {
    setRevealing(true)
    try { setSecret(await reveal({ profileId })) } catch (e) { alert(e.message || 'Could not reveal.') } finally { setRevealing(false) }
  }

  const rows = [
    ['Full legal name', p.fullName], ['Preferred name', p.preferredName], ['Date of birth', p.dob],
    ['Address', p.address], ['Phone', p.phone], ['Personal email', p.personalEmail],
    ['Emergency contact', p.emergencyName], ['Emergency phone', p.emergencyPhone], ['Start date', p.startDate],
  ].filter(([, val]) => val)

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="btn-ghost !py-2 text-sm"><ArrowLeft size={15} /> Back</button>
      <Card className="p-5">
        <h3 className="text-2xl text-slate-800">{p.fullName || p.inviteName}</h3>
        <p className="text-xs font-bold text-slate-400">{p.inviteRole} · submitted {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString('en-CA') : ''}</p>
        <dl className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {rows.map(([k, val]) => (
            <div key={k} className="flex flex-col"><dt className="eyebrow">{k}</dt><dd className="text-sm font-bold text-slate-700">{val}</dd></div>
          ))}
        </dl>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow flex items-center gap-1.5"><Lock size={12} /> Encrypted — SIN &amp; banking</p>
          {(p.hasSin || p.hasBank) && !secret && (
            <button onClick={doReveal} disabled={revealing} className="btn-ghost !py-1.5 text-xs">{revealing ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} Reveal</button>
          )}
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between"><dt className="font-semibold text-slate-500">SIN</dt><dd className="font-mono font-bold text-slate-800">{secret?.sin ?? p.sinMasked ?? '—'}</dd></div>
          <div className="flex items-center justify-between"><dt className="font-semibold text-slate-500">Direct deposit</dt><dd className="font-mono font-bold text-slate-800">{secret?.bank ? `${secret.bank.institution}-${secret.bank.transit}-${secret.bank.account}` : (p.bankMasked ?? '—')}</dd></div>
        </dl>
        {secret && <p className="mt-2 text-[11px] font-semibold text-coral-500">Revealed — copy what you need into your payroll system, then leave this screen. Don't leave it open.</p>}
      </Card>

      <Card className="p-5">
        <p className="eyebrow">Documents</p>
        {(!p.documents || p.documents.length === 0) ? (
          <p className="mt-2 text-sm font-medium text-slate-500">No documents uploaded.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {p.documents.map((d, i) => (
              <li key={i}>
                <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-brand-700 hover:bg-slate-100">
                  <FileText size={15} /> <span className="truncate">{d.name}</span> <Download size={14} className="ml-auto" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <button onClick={() => { if (confirm('Delete this employee profile and its documents? This cannot be undone.')) del({ profileId }).then(onBack) }} className="inline-flex items-center gap-1.5 text-xs font-bold text-coral-500 hover:text-coral-600">
        <Trash2 size={13} /> Delete profile
      </button>
    </div>
  )
}

/* ─────────────────────────── Demo preview (unauthenticated demo) ─────────────────────────── */
function PayrollDemo() {
  const sample = [
    { name: 'Marcus Lee', role: 'Lead Educator', detail: '80h + 4 OT', gross: 2064, vac: 82.56 },
    { name: 'Priya Sharma', role: 'ECE Assistant', detail: '75h', gross: 1500, vac: 90 },
    { name: 'Taylor Smith', role: 'Educator', detail: '70h', gross: 1400, vac: 56 },
  ]
  const totalGross = sample.reduce((s, r) => s + r.gross, 0)
  const totalVac = sample.reduce((s, r) => s + r.vac, 0)
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Payroll" title="Payroll" subtitle="Turn tracked hours into gross pay & pay stubs — no tax math, no money movement" />
      <div className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-3.5 text-sm font-bold text-brand-700">
        <Banknote size={16} /> Demo preview — create your daycare to run real payroll &amp; onboard your team.
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="eyebrow">Sample pay run</p><h3 className="text-2xl text-slate-800">May 28 → Jun 10 · Bi-weekly</h3></div>
          <div className="flex gap-5 text-right">
            <div><div className="font-display text-3xl text-brand-700">{money(totalGross)}</div><div className="eyebrow">total gross</div></div>
            <div><div className="font-display text-3xl text-mint-600">{money(totalVac)}</div><div className="eyebrow">vacation</div></div>
          </div>
        </div>
        <div className="mt-4 divide-y divide-line">
          {sample.map((r) => (
            <div key={r.name} className="flex items-center gap-3 py-2.5">
              <span className="text-xl">🧑‍🏫</span>
              <div className="min-w-0"><div className="truncate font-extrabold text-slate-700">{r.name}</div><div className="text-[11px] font-bold text-slate-400">{r.role} · {r.detail}</div></div>
              <div className="ml-auto text-right"><div className="font-extrabold text-slate-800">{money(r.gross)}</div><div className="text-[11px] font-bold text-mint-600">+{money(r.vac)} vac</div></div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex items-center gap-3 p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-grape-500 text-white"><UserPlus size={20} /></span>
        <div className="min-w-0">
          <div className="font-extrabold text-slate-800">Self-serve employee onboarding</div>
          <div className="text-sm font-medium text-slate-500">Send a link — staff add their details, banking &amp; SIN (encrypted) and upload documents themselves.</div>
        </div>
      </Card>

      <a href="/signup" className="btn-primary">Start free — run payroll for your team</a>
    </div>
  )
}

/* ─────────────────────────── Shell ─────────────────────────── */
export function Payroll() {
  const { facility, isAuthenticated } = useApp()
  // The unauthenticated "live demo" admin must not hit requireFacility queries
  // (they throw "Not authenticated"). Show a static preview instead.
  if (!isAuthenticated || !facility || facility.isDemo) return <PayrollDemo />
  return <PayrollReal />
}

function PayrollReal() {
  const settings = useQuery(api.payroll.settings)
  const [tab, setTab] = useState('run')
  const [openRun, setOpenRun] = useState(null)

  const tabs = [
    { id: 'run', label: 'Run payroll', icon: Calculator },
    { id: 'setup', label: 'Pay setup', icon: Settings2 },
    { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
    { id: 'history', label: 'History', icon: History },
  ]

  if (openRun) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Payroll" title="Pay run" subtitle="Gross pay & stubs — export or print for your records" />
        <RunDetail runId={openRun} onBack={() => { setOpenRun(null); setTab('history') }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Payroll" title="Payroll" subtitle="Turn tracked hours into gross pay & pay stubs — no tax math, no money movement" />

      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition ${tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
          >
            <t.icon size={15} /> <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {settings === undefined ? (
        <Card className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-brand-400" /></Card>
      ) : (
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {tab === 'run' && <RunPayroll settings={settings} onRan={(id) => setOpenRun(id)} />}
          {tab === 'setup' && <PaySetup settings={settings} />}
          {tab === 'onboarding' && <OnboardingAdmin />}
          {tab === 'history' && <RunHistory onOpen={(id) => setOpenRun(id)} />}
        </motion.div>
      )}
    </div>
  )
}
