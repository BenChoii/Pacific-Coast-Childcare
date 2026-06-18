import { useMemo, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Landmark, Plus, X, Trash2, AlertTriangle, CheckCircle2, ExternalLink, FileText } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, Card, Pill } from '../components/ui.jsx'
import { openCf2798Print } from '../lib/cf2798Doc.js'

const money = (n) => `$${Number(n || 0).toLocaleString()}`

const TYPES = [
  ['ccfri', 'CCFRI fee reduction'],
  ['accb', 'Affordable Child Care Benefit'],
  ['cwelcc', '$10-a-day (CWELCC)'],
  ['other', 'Other subsidy'],
]
const STATUSES = [
  ['tracking', 'Tracking'],
  ['applied', 'Applied'],
  ['approved', 'Approved'],
  ['expired', 'Expired'],
]
const STATUS_STYLE = {
  tracking: 'bg-slate-100 text-slate-500',
  applied: 'bg-sunshine-400/15 text-sunshine-600',
  approved: 'bg-mint-400/15 text-mint-600',
  expired: 'bg-coral-500/10 text-coral-600',
}
const blank = { childId: '', type: 'ccfri', status: 'tracking', monthlyAmount: '', startDate: '', expiryDate: '', reference: '', notes: '', applyToInvoices: true }

export function SubsidiesStudio() {
  const { childrenList, facility, pushToast } = useApp()
  const subsidies = useQuery(api.subsidies.listByFacility) ?? []
  const expiring = useQuery(api.subsidies.expiringSoon) ?? []
  const upsert = useMutation(api.subsidies.upsert)
  const remove = useMutation(api.subsidies.remove)
  const [form, setForm] = useState(null) // null = closed; object = editing/creating

  const kids = useMemo(() => (childrenList || []).map((c) => ({ id: c._id ?? c.id, name: c.name })).filter((c) => c.id), [childrenList])

  const stats = useMemo(() => {
    const approved = subsidies.filter((s) => s.status === 'approved')
    const coveredKids = new Set(approved.map((s) => String(s.childId))).size
    const monthly = approved.reduce((sum, s) => sum + (s.applyToInvoices ? s.monthlyAmount : 0), 0)
    return { coveredKids, monthly, expiring: expiring.length }
  }, [subsidies, expiring])

  const open = (s) => setForm(s ? {
    id: s.id, childId: String(s.childId), type: s.type, status: s.status,
    monthlyAmount: s.monthlyAmount || '', startDate: s.startDate || '', expiryDate: s.expiryDate || '',
    reference: s.reference || '', notes: s.notes || '', applyToInvoices: s.applyToInvoices,
  } : { ...blank, childId: kids[0]?.id || '' })

  const save = async () => {
    if (!form.childId) { pushToast('Pick a child first.', { emoji: '⚠️', tone: 'coral' }); return }
    try {
      await upsert({
        id: form.id,
        childId: form.childId,
        type: form.type,
        status: form.status,
        monthlyAmount: form.monthlyAmount === '' ? 0 : Math.round(Number(form.monthlyAmount)),
        startDate: form.startDate || undefined,
        expiryDate: form.expiryDate || undefined,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
        applyToInvoices: !!form.applyToInvoices,
      })
      setForm(null)
      pushToast('Subsidy saved — approved amounts now net off the family’s invoices.', { emoji: '🏛️', tone: 'mint' })
    } catch (e) {
      pushToast(String(e?.message || e).replace('Uncaught Error:', '').trim(), { emoji: '⚠️', tone: 'coral' })
    }
  }

  const cf2798 = (s) => {
    const kid = (childrenList || []).find((c) => String(c._id ?? c.id) === String(s.childId)) || {}
    const ok = openCf2798Print(
      { child: { name: kid.name || s.childName, age: kid.age, parent: kid.parent }, parentName: kid.parent || '', monthlyFee: kid.monthlyTuition || 0 },
      facility || {}
    )
    if (ok) pushToast('CF2798 head-start ready — print or save as PDF for the family.', { emoji: '📄', tone: 'brand' })
    else pushToast('Allow pop-ups to open the form.', { emoji: '⚠️', tone: 'coral' })
  }

  const f = form

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Government funding"
        title="Subsidies 🏛️"
        subtitle="Track CCFRI, the Affordable Child Care Benefit & $10-a-day — approved amounts reduce invoices automatically"
        action={<button onClick={() => open(null)} className="btn-primary px-4 py-2 text-sm"><Plus size={16} /> Add subsidy</button>}
      />

      {expiring.length > 0 && (
        <Card className="border-coral-200 bg-coral-50/60 p-4">
          <div className="flex items-center gap-2 font-extrabold text-coral-600"><AlertTriangle size={18} /> Renewals needed</div>
          <div className="mt-2 space-y-1 text-sm font-semibold text-slate-600">
            {expiring.map((e) => (
              <div key={e.id}>
                {e.childName} · {e.typeLabel} — {e.expired ? <span className="text-coral-600">expired {e.expiryDate}</span> : <span>expires in {e.daysToExpiry} day{e.daysToExpiry === 1 ? '' : 's'} ({e.expiryDate})</span>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400">The Affordable Child Care Benefit must be renewed yearly — remind the family before it lapses so their reduction continues.</p>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          ['Children covered', stats.coveredKids, 'from-mint-400 to-brand-500'],
          ['Monthly reductions', money(stats.monthly), 'from-brand-400 to-grape-500'],
          ['Renewals due', stats.expiring, 'from-coral-500 to-blush-400'],
        ].map(([label, val, g]) => (
          <div key={label} className={`rounded-3xl bg-gradient-to-br ${g} p-4 text-white shadow-sm`}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-white/80">{label}</div>
            <div className="text-2xl font-extrabold">{val}</div>
          </div>
        ))}
      </div>

      <Card className="p-0">
        {subsidies.length === 0 && (
          <div className="p-8 text-center text-sm font-semibold text-slate-400">No subsidies tracked yet — add one to start netting it off the family’s invoices.</div>
        )}
        {subsidies.map((s, i) => (
          <div key={s.id} className={`flex flex-wrap items-center gap-3 p-4 ${i !== subsidies.length - 1 ? 'border-b border-slate-100' : ''}`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600"><Landmark size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-extrabold text-slate-700">{s.childName} · {s.typeLabel}</div>
              <div className="text-xs font-bold text-slate-400">
                {s.monthlyAmount > 0 ? `${money(s.monthlyAmount)}/mo` : 'amount not set'}
                {s.applyToInvoices && s.status === 'approved' && s.monthlyAmount > 0 ? ' · on invoices' : ''}
                {s.expiryDate ? ` · expires ${s.expiryDate}` : ''}
                {s.reference ? ` · ref ${s.reference}` : ''}
              </div>
            </div>
            {s.expiringSoon && <Pill className="bg-coral-500/10 text-coral-600">renew soon</Pill>}
            <Pill className={STATUS_STYLE[s.status]}>{STATUSES.find((x) => x[0] === s.status)?.[1] || s.status}</Pill>
            {s.type === 'accb' && (
              <button onClick={() => cf2798(s)} className="btn bg-brand-500/10 px-3 py-1.5 text-xs font-bold text-brand-600" title="Pre-filled Child Care Arrangement form (CF2798)"><FileText size={13} /> CF2798</button>
            )}
            <button onClick={() => open(s)} className="btn bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Edit</button>
            <button onClick={async () => { await remove({ id: s.id }); pushToast('Subsidy removed.', { emoji: '🗑️', tone: 'slate' }) }} className="flex h-8 w-8 items-center justify-center rounded-xl bg-coral-500/10 text-coral-500" aria-label="Remove subsidy"><Trash2 size={15} /></button>
          </div>
        ))}
      </Card>

      <p className="px-1 text-xs font-semibold text-slate-400">
        Amounts you enter are estimates you manage — Mitten doesn’t set eligibility. Official sources:{' '}
        <a className="text-brand-600" target="_blank" rel="noopener" href="https://www2.gov.bc.ca/gov/content/family-social-supports/caring-for-young-children/child-care-funding/child-care-benefit">Affordable Child Care Benefit <ExternalLink size={11} className="inline" /></a>{' · '}
        <a className="text-brand-600" target="_blank" rel="noopener" href="https://www2.gov.bc.ca/gov/content/family-social-supports/caring-for-young-children/childcarebc-programs/child-care-fee-reduction-initiative-provider-opt-in-status/information-for-families">CCFRI <ExternalLink size={11} className="inline" /></a>.
      </p>

      {f && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-700">{f.id ? 'Edit subsidy' : 'Add a subsidy'}</h3>
              <button onClick={() => setForm(null)} className="text-slate-400"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <Field label="Child">
                <select className="input" value={f.childId} onChange={(e) => setForm({ ...f, childId: e.target.value })} disabled={!!f.id}>
                  {kids.length === 0 && <option value="">No children yet</option>}
                  {kids.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Program"><select className="input" value={f.type} onChange={(e) => setForm({ ...f, type: e.target.value })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                <Field label="Status"><select className="input" value={f.status} onChange={(e) => setForm({ ...f, status: e.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Reduction $/month"><input type="number" min="0" className="input" value={f.monthlyAmount} onChange={(e) => setForm({ ...f, monthlyAmount: e.target.value })} placeholder="e.g. 350" /></Field>
                <Field label="Expiry / renewal date"><input type="date" className="input" value={f.expiryDate} onChange={(e) => setForm({ ...f, expiryDate: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date"><input type="date" className="input" value={f.startDate} onChange={(e) => setForm({ ...f, startDate: e.target.value })} /></Field>
                <Field label="Government ref #"><input className="input" value={f.reference} onChange={(e) => setForm({ ...f, reference: e.target.value })} placeholder="confirmation #" /></Field>
              </div>
              <Field label="Notes"><input className="input" value={f.notes} onChange={(e) => setForm({ ...f, notes: e.target.value })} placeholder="optional" /></Field>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input type="checkbox" checked={!!f.applyToInvoices} onChange={(e) => setForm({ ...f, applyToInvoices: e.target.checked })} />
                Net this off the family’s invoices (when approved)
              </label>
              <p className="text-xs font-semibold text-slate-400"><CheckCircle2 size={12} className="mr-1 inline text-mint-500" />Only <strong>Approved</strong> subsidies with an amount reduce invoices.</p>
              <button onClick={save} className="btn-primary w-full justify-center py-2.5 text-sm">{f.id ? 'Save changes' : 'Add subsidy'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  )
}
