import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import {
  Receipt, Download, CheckCircle2, Clock, Loader2, Plus, X, Send, Ban,
  Building2, Upload, CreditCard, Mail, ToggleLeft, ToggleRight, ExternalLink, ShieldCheck,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, Card, Pill } from '../components/ui.jsx'
import { openInvoicePrint } from '../lib/invoiceDoc.js'

const money = (n) => `$${Number(n || 0).toLocaleString()}`

const STATUS_STYLE = {
  due: 'bg-coral-500/10 text-coral-600',
  processing: 'bg-sunshine-400/15 text-sunshine-600',
  paid: 'bg-mint-400/15 text-mint-600',
}

export function InvoicingStudio() {
  const { facility, invoices, pushToast } = useApp()
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const confirmPaid = useMutation(api.invoices.confirmPaid)
  const voidInvoice = useMutation(api.invoices.voidInvoice)

  const visible = useMemo(
    () => invoices.filter((i) => (filter === 'all' ? true : i.status === filter)),
    [invoices, filter]
  )
  const totals = useMemo(() => {
    const sum = (st) => invoices.filter((i) => i.status === st).reduce((s, i) => s + i.amount, 0)
    return { due: sum('due'), processing: sum('processing'), paid: sum('paid') }
  }, [invoices])

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Billing"
        title="Invoices 🧾"
        subtitle="Issue branded invoices, track e-Transfers and card payments"
        action={
          <button onClick={() => setCreating(true)} className="btn-primary px-4 py-2 text-sm">
            <Plus size={16} /> New invoice
          </button>
        }
      />

      <BillingProfileCard />

      <div className="grid grid-cols-3 gap-3">
        {[
          ['due', 'Outstanding', totals.due, 'from-coral-500 to-blush-400'],
          ['processing', 'In transit', totals.processing, 'from-sunshine-400 to-coral-400'],
          ['paid', 'Collected', totals.paid, 'from-mint-400 to-brand-500'],
        ].map(([st, label, amt, g]) => (
          <button key={st} onClick={() => setFilter(filter === st ? 'all' : st)} className={`rounded-3xl p-4 text-left text-white shadow-sm transition bg-gradient-to-br ${g} ${filter === st ? 'ring-4 ring-brand-200' : ''}`}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-white/80">{label}</div>
            <div className="text-2xl font-extrabold">{money(amt)}</div>
          </button>
        ))}
      </div>

      <Card className="p-0">
        {visible.length === 0 && (
          <div className="p-8 text-center text-sm font-semibold text-slate-400">
            No invoices{filter !== 'all' ? ` with status “${filter}”` : ' yet — create one or turn on auto-invoicing above'}.
          </div>
        )}
        {visible.map((inv, i) => (
          <div key={inv.id} className={`flex flex-wrap items-center gap-3 p-4 ${i !== visible.length - 1 ? 'border-b border-slate-100' : ''}`}>
            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${STATUS_STYLE[inv.status] || 'bg-slate-100 text-slate-400'}`}>
              <Receipt size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-extrabold text-slate-700">
                {inv.billTo || 'Family'} · {money(inv.amount)}
              </div>
              <div className="text-xs font-bold text-slate-400">
                {inv.period} · {inv.id}
                {inv.method === 'etransfer' && inv.etransferRef ? ` · e-Transfer ref ${inv.etransferRef}` : ''}
              </div>
            </div>
            <Pill className={STATUS_STYLE[inv.status]}>{inv.status === 'processing' ? 'e-Transfer sent' : inv.status}</Pill>
            {inv.status === 'processing' && (
              <button
                onClick={async () => { await confirmPaid({ id: inv.id }); pushToast('Marked paid — receipt updated for the family.', { emoji: '✅', tone: 'mint' }) }}
                className="btn bg-mint-400/15 px-3 py-1.5 text-xs font-bold text-mint-600"
              >
                <CheckCircle2 size={14} /> Confirm received
              </button>
            )}
            {inv.status === 'due' && (
              <button
                onClick={async () => { await voidInvoice({ id: inv.id }); pushToast('Invoice voided.', { emoji: '🗑️' }) }}
                className="btn bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500"
              >
                <Ban size={14} /> Void
              </button>
            )}
            <button onClick={() => openInvoicePrint(inv, facility)} className="btn bg-brand-500/10 px-3 py-1.5 text-xs font-bold text-brand-600">
              <Download size={14} /> PDF
            </button>
          </div>
        ))}
      </Card>

      {creating && <CreateInvoiceSheet onClose={() => setCreating(false)} />}
    </div>
  )
}

/* ── Business profile + payment rails ─────────────────────────────────────── */
function BillingProfileCard() {
  const { facility, pushToast, uploadImage } = useApp()
  const update = useMutation(api.facilities.updateBillingProfile)
  const setLogo = useMutation(api.facilities.setLogo)
  const connectLink = useAction(api.connect.createOnboardingLink)
  const refreshConnect = useAction(api.connect.refreshStatus)
  const [open, setOpen] = useState(!facility?.etransferEmail && !facility?.connectReady)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(() => ({
    address: facility?.address || '',
    phone: facility?.phone || '',
    billingEmail: facility?.billingEmail || '',
    etransferEmail: facility?.etransferEmail || '',
    gstNumber: facility?.gstNumber || '',
    invoiceFooter: facility?.invoiceFooter || '',
  }))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    await update(form)
    pushToast('Invoice branding saved.', { emoji: '🎨', tone: 'mint' })
  }

  const startConnect = async () => {
    setBusy(true)
    try {
      const res = await connectLink({ origin: window.location.origin })
      if (res?.url) { window.location.href = res.url; return }
      pushToast(res?.error || 'Stripe isn’t configured yet — card payments activate once Mitten’s Stripe key is set.', { emoji: 'ℹ️' })
    } catch (e) {
      pushToast(String(e?.message || 'Could not start Stripe onboarding.'), { emoji: '⚠️', tone: 'coral' })
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          {facility?.logoUrl
            ? <img src={facility.logoUrl} alt="" className="h-10 w-10 rounded-xl object-contain" />
            : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600"><Building2 size={18} /></span>}
          <div className="text-left">
            <div className="font-extrabold text-slate-800">Invoice branding & payment rails</div>
            <div className="text-xs font-bold text-slate-400">
              {facility?.connectReady ? 'Card payments live (your Stripe account)' : 'Card payments not set up'}
              {' · '}
              {facility?.etransferEmail ? `e-Transfer to ${facility.etransferEmail}` : 'e-Transfer not set up'}
            </div>
          </div>
        </div>
        <Pill className="bg-slate-100 text-slate-500">{open ? 'Hide' : 'Edit'}</Pill>
      </button>

      {open && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
          <div className="flex items-center gap-3">
            <label className="btn cursor-pointer bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
              <Upload size={14} /> {facility?.logoUrl ? 'Replace logo' : 'Upload your logo'}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const storageId = await uploadImage(file)
                await setLogo({ storageId })
                pushToast('Logo updated — it now appears on every invoice.', { emoji: '🖼️', tone: 'mint' })
              }} />
            </label>
            <span className="text-xs font-semibold text-slate-400">Shown at the top of every invoice your families download.</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Business address"><input className="input" value={form.address} onChange={set('address')} placeholder="123 Seaside Ave, Vancouver BC" /></Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} placeholder="604-555-0123" /></Field>
            <Field label="Billing email (shown on invoices)"><input className="input" value={form.billingEmail} onChange={set('billingEmail')} placeholder="billing@yourdaycare.ca" /></Field>
            <Field label="GST/HST number (optional)"><input className="input" value={form.gstNumber} onChange={set('gstNumber')} placeholder="123456789 RT0001" /></Field>
            <Field label="Interac e-Transfer email — enables the e-Transfer payment option">
              <input className="input" value={form.etransferEmail} onChange={set('etransferEmail')} placeholder="pay@yourdaycare.ca" />
            </Field>
            <Field label="Invoice footer note (optional)"><input className="input" value={form.invoiceFooter} onChange={set('invoiceFooter')} placeholder="Thank you for being part of our community!" /></Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={save} className="btn-primary px-4 py-2 text-sm">Save branding</button>
            <AutoInvoiceToggle />
          </div>

          <div className="rounded-2xl bg-brand-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-brand-600" />
                <div>
                  <div className="text-sm font-extrabold text-slate-700">Card payments — your own Stripe account</div>
                  <div className="text-xs font-semibold text-slate-400">
                    Visa/Mastercard payments go straight to your bank, with your name on the parent's statement. Mitten takes 0%.
                  </div>
                </div>
              </div>
              {facility?.connectReady ? (
                <Pill className="bg-mint-400/15 text-mint-600"><ShieldCheck size={13} /> Live</Pill>
              ) : (
                <div className="flex gap-2">
                  <button onClick={startConnect} disabled={busy} className="btn-primary px-4 py-2 text-sm">
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                    {facility?.connectStarted ? 'Resume setup' : 'Set up card payments'}
                  </button>
                  {facility?.connectStarted && (
                    <button onClick={async () => { const r = await refreshConnect({}); pushToast(r?.ready ? 'Card payments are live! 🎉' : 'Still pending — finish the Stripe steps.', { emoji: r?.ready ? '✅' : '⏳', tone: r?.ready ? 'mint' : undefined }) }} className="btn bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
                      Check status
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </Card>
  )
}

function AutoInvoiceToggle() {
  const { facility, pushToast } = useApp()
  const update = useMutation(api.facilities.updateBillingProfile)
  const on = !!facility?.autoInvoice
  return (
    <button
      onClick={async () => { await update({ autoInvoice: !on }); pushToast(!on ? 'Auto-invoicing ON — tuition + plans + extras invoice on the 1st.' : 'Auto-invoicing off.', { emoji: !on ? '🤖' : '💤', tone: 'mint' }) }}
      className="btn bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600"
    >
      {on ? <ToggleRight size={18} className="text-mint-500" /> : <ToggleLeft size={18} />}
      Auto-invoice monthly {on ? 'on' : 'off'}
    </button>
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

/* ── Create invoice ───────────────────────────────────────────────────────── */
function CreateInvoiceSheet({ onClose }) {
  const { pushToast } = useApp()
  const families = useQuery(api.invoices.families) ?? []
  const create = useMutation(api.invoices.create)
  const now = new Date()
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [familyKey, setFamilyKey] = useState('')
  const [period, setPeriod] = useState(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`)
  const [due, setDue] = useState(`${MONTHS[now.getMonth()]} 15, ${now.getFullYear()}`)
  const [includeExtras, setIncludeExtras] = useState(true)
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)

  const family = families.find((f) => String(f.parentUserId) === familyKey)
  const pickFamily = (key) => {
    setFamilyKey(key)
    const fam = families.find((f) => String(f.parentUserId) === key)
    setItems(fam ? fam.kids.filter((k) => k.monthlyTuition > 0).map((k) => ({ label: `Tuition — ${k.name}`, amt: k.monthlyTuition })) : [])
  }

  const submit = async () => {
    if (!family) return
    setBusy(true)
    try {
      const res = await create({
        parentUserId: family.parentUserId,
        billTo: family.parentName,
        childName: family.kids.map((k) => k.name).join(', '),
        period, due,
        items: items.filter((it) => it.label && it.amt > 0).map((it) => ({ label: it.label, amt: Number(it.amt) })),
        includeExtras,
      })
      pushToast(`Invoice ${res.invId} issued for $${res.amount.toLocaleString()}.`, { emoji: '🧾', tone: 'mint' })
      onClose()
    } catch (e) {
      pushToast(String(e?.message || 'Could not create the invoice.'), { emoji: '⚠️', tone: 'coral' })
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-4xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-slate-800">New invoice</h3>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={16} /></button>
        </div>

        {families.length === 0 ? (
          <p className="mt-4 text-sm font-semibold text-slate-400">
            No families with parent accounts yet — invite parents first (Account → Family links), then their invoices can be issued here.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <Field label="Bill to">
              <select className="input" value={familyKey} onChange={(e) => pickFamily(e.target.value)}>
                <option value="">Choose a family…</option>
                {families.map((f) => (
                  <option key={String(f.parentUserId)} value={String(f.parentUserId)}>
                    {f.parentName} — {f.kids.map((k) => k.name).join(', ')}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Period"><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
              <Field label="Due"><input className="input" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
            </div>
            <Field label="Line items">
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input flex-1" value={it.label} onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <input className="input w-24" type="number" value={it.amt} onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, amt: e.target.value } : x)))} />
                    <button onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))} className="rounded-xl bg-slate-100 px-2 text-slate-400"><X size={14} /></button>
                  </div>
                ))}
                <button onClick={() => setItems((arr) => [...arr, { label: '', amt: 0 }])} className="btn bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                  <Plus size={13} /> Add line
                </button>
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
              <input type="checkbox" checked={includeExtras} onChange={(e) => setIncludeExtras(e.target.checked)} className="h-4 w-4 rounded accent-brand-600" />
              Sweep in unbilled extras & monthly plans for this family
            </label>
            <button onClick={submit} disabled={!family || busy} className="btn-primary w-full justify-center py-3">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Issue invoice
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
