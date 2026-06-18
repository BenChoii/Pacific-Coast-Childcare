import { useRef, useState } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { BookOpen, Upload, X, FileText, Trash2, Download, Wand2, Receipt, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, StatCard, Pill, KnitEmpty } from '../components/ui.jsx'

const money = (n) => `$${Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
// CRA-style expense buckets a Canadian daycare actually uses.
const CATEGORIES = [
  'Supplies & materials', 'Food & snacks', 'Toys & equipment', 'Rent', 'Utilities',
  'Wages & subcontractors', 'Insurance', 'Office & admin', 'Repairs & maintenance',
  'Professional fees', 'Advertising & web', 'Vehicle & travel', 'Training', 'Bank & merchant fees', 'Other',
]
const KINDS = [['receipt', 'Receipt'], ['invoice', 'Invoice'], ['statement', 'Statement'], ['other', 'Other']]

function BooksLocked() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="rounded-4xl border border-line bg-white/80 p-10 text-center shadow-playful backdrop-blur">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-mint-400 to-brand-500 text-white shadow-md"><BookOpen size={28} /></div>
        <p className="eyebrow">Pro add-on</p>
        <h1 className="mt-1 text-3xl text-brand-700">Bookkeeping, done for you</h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-slate-500">
          Snap a photo of every receipt and invoice. We organize them by category, track your GST/HST, and hand your accountant a tidy export — so you spend less at tax time.
        </p>
        <button className="btn-primary mx-auto mt-6 px-7 py-3" onClick={() => (window.location.href = '/app?upgrade=bookkeeping')}><Receipt size={18} /> Add bookkeeping to my plan</button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>{children}</label>
}

export function BookkeepingStudio() {
  const { facility, pushToast } = useApp()
  const enabled = facility?.addons?.bookkeeping
  const docs = useQuery(api.bookkeeping.listByFacility) ?? []
  const summary = useQuery(api.bookkeeping.summary)
  const genUrl = useMutation(api.bookkeeping.generateUploadUrl)
  const add = useMutation(api.bookkeeping.add)
  const update = useMutation(api.bookkeeping.update)
  const remove = useMutation(api.bookkeeping.remove)
  const scan = useAction(api.ai.scanReceipt)
  const fileInput = useRef(null)
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState(null)
  const [filter, setFilter] = useState('all')
  const [scanning, setScanning] = useState(false)

  const autofill = async () => {
    if (!edit?.storageId) return
    setScanning(true)
    try {
      const r = await scan({ storageId: edit.storageId })
      if (r?.configured === false) pushToast('AI auto-fill isn’t set up yet.', { emoji: '⚠️', tone: 'coral' })
      else if (r?.error) pushToast(r.error, { emoji: '⚠️', tone: 'coral' })
      else if (r?.fields) {
        const f = r.fields
        setEdit((e) => ({
          ...e,
          vendor: f.vendor || e.vendor,
          docDate: f.docDate || e.docDate,
          amount: f.amount != null ? f.amount : e.amount,
          taxAmount: f.taxAmount != null ? f.taxAmount : e.taxAmount,
          category: f.category || e.category,
          kind: f.kind || e.kind,
        }))
        pushToast('Read it — double-check the details ✨', { emoji: '✨', tone: 'mint' })
      }
    } catch { pushToast('Couldn’t scan that one.', { emoji: '⚠️', tone: 'coral' }) }
    setScanning(false)
  }

  if (!enabled) return <BooksLocked />

  const shown = filter === 'all' ? docs : docs.filter((d) => (d.category || 'Uncategorized') === filter)

  const onFiles = async (files) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of files) {
        const url = await genUrl()
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
        const { storageId } = await res.json()
        await add({ storageId, fileName: file.name, mimeType: file.type, kind: file.type === 'application/pdf' ? 'invoice' : 'receipt', direction: 'expense' })
      }
      pushToast(`${files.length} document${files.length > 1 ? 's' : ''} added — tap to categorize 📄`, { emoji: '📄', tone: 'brand' })
    } catch { pushToast('Upload failed — try again.', { emoji: '⚠️', tone: 'coral' }) }
    setBusy(false)
  }

  const exportCsv = () => {
    const head = ['Date', 'Vendor', 'Category', 'Kind', 'Type', 'Amount', 'GST/HST', 'Status', 'Notes']
    const rows = docs.map((d) => [d.docDate || '', d.vendor || '', d.category || 'Uncategorized', d.kind || '', d.direction || 'expense', d.amount ?? '', d.taxAmount ?? '', d.status, (d.notes || '').replace(/\n/g, ' ')])
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `bookkeeping-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Director bookkeeping"
        title="Bookkeeping 📚"
        subtitle="Upload receipts & invoices — we organize them for tax time."
        action={
          <div className="flex gap-2">
            <button className="btn-ghost px-3 py-2" onClick={exportCsv} disabled={!docs.length}><Download size={16} /> Export</button>
            <button className="btn-primary px-4 py-2" onClick={() => fileInput.current?.click()} disabled={busy}><Upload size={16} /> {busy ? 'Uploading…' : 'Upload'}</button>
          </div>
        }
      />
      <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => onFiles([...e.target.files])} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Receipt} label="Expenses (total)" value={money(summary?.expense)} gradient="from-brand-400 to-grape-500" />
        <StatCard icon={FileText} label="GST/HST tracked" value={money(summary?.tax)} gradient="from-mint-400 to-mint-500" delay={0.04} />
        <StatCard icon={AlertTriangle} label="To categorize" value={summary?.unreviewed ?? 0} gradient="from-sunshine-400 to-coral-500" delay={0.08} />
        <StatCard icon={BookOpen} label="Documents" value={summary?.count ?? 0} gradient="from-sky-400 to-brand-500" delay={0.12} />
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-3 text-sm text-brand-600">
        <Wand2 size={16} className="shrink-0" />
        <span><strong>AI auto-fill is on</strong> — tap any receipt photo, then hit <em>AI auto-fill</em> and we’ll read the vendor, amount &amp; GST for you to confirm.</span>
      </div>

      {/* category filter */}
      {summary?.byCategory?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter('all')} className={`rounded-full px-3 py-1 text-xs font-bold ${filter === 'all' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>All · {money(summary.expense)}</button>
          {summary.byCategory.map((c) => (
            <button key={c.category} onClick={() => setFilter(c.category)} className={`rounded-full px-3 py-1 text-xs font-bold ${filter === c.category ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{c.category} · {money(c.total)}</button>
          ))}
        </div>
      )}

      {docs.length === 0 ? (
        <KnitEmpty image="/cinema/spots/letter.webp" title="No documents yet" hint="Upload a receipt or invoice (photo or PDF) and we’ll help you file it." action={<button className="btn-primary px-5 py-2.5" onClick={() => fileInput.current?.click()}><Upload size={16} /> Upload your first</button>} />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-line bg-white/80 shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
              <tr><th className="px-4 py-3">Vendor</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Category</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-right">GST</th><th className="px-3 py-3">Status</th><th className="px-3 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((d) => (
                <tr key={d.id} className="cursor-pointer hover:bg-brand-50/40" onClick={() => setEdit({ ...d, amount: d.amount ?? '', taxAmount: d.taxAmount ?? '', category: d.category || '', vendor: d.vendor || '', docDate: d.docDate || '', notes: d.notes || '', kind: d.kind || 'receipt' })}>
                  <td className="px-4 py-3"><div className="flex items-center gap-2 font-semibold text-slate-700">{d.fileUrl ? <FileText size={15} className="text-brand-400" /> : null}{d.vendor || <span className="text-slate-300">Untitled</span>}</div></td>
                  <td className="px-3 py-3 text-slate-500">{d.docDate || '—'}</td>
                  <td className="px-3 py-3">{d.category ? <Pill className="bg-brand-50 text-brand-600">{d.category}</Pill> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-700">{d.amount != null ? money(d.amount) : '—'}</td>
                  <td className="px-3 py-3 text-right text-slate-500">{d.taxAmount != null ? money(d.taxAmount) : '—'}</td>
                  <td className="px-3 py-3">{d.status === 'filed' ? <span className="inline-flex items-center gap-1 text-xs font-bold text-mint-600"><CheckCircle2 size={13} /> Filed</span> : <span className="text-xs font-semibold text-sunshine-600">To review</span>}</td>
                  <td className="px-3 py-3 text-right">{d.fileUrl && <a href={d.fileUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand-400 hover:text-brand-600">view</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <Modal title={edit.fileName || 'Document'} onClose={() => setEdit(null)}>
          <div className="space-y-3">
            {edit.fileUrl && (edit.mimeType || '').startsWith('image/') && <img src={edit.fileUrl} alt="" className="max-h-48 w-full rounded-2xl object-contain bg-slate-50" />}
            {edit.storageId && (edit.mimeType || '').startsWith('image/') && (
              <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-400 to-grape-500 py-2.5 font-bold text-white shadow-md transition hover:shadow-playful disabled:opacity-60" disabled={scanning} onClick={autofill}>
                <Wand2 size={16} /> {scanning ? 'Reading the receipt…' : 'AI auto-fill from photo'}
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vendor"><input className="input" value={edit.vendor} onChange={(e) => setEdit({ ...edit, vendor: e.target.value })} placeholder="Costco, BC Hydro…" /></Field>
              <Field label="Date"><input type="date" className="input" value={edit.docDate} onChange={(e) => setEdit({ ...edit, docDate: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (incl. tax)"><input type="number" step="0.01" className="input" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} placeholder="0.00" /></Field>
              <Field label="GST/HST"><input type="number" step="0.01" className="input" value={edit.taxAmount} onChange={(e) => setEdit({ ...edit, taxAmount: e.target.value })} placeholder="0.00" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                  <option value="">Choose…</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Type">
                <select className="input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                  {KINDS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes"><input className="input" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="Optional" /></Field>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost px-3 py-2 text-coral-500" onClick={async () => { await remove({ id: edit.id }); setEdit(null) }}><Trash2 size={15} /></button>
              <button className="btn-ghost flex-1 py-2" onClick={async () => { await save(edit, update, 'unreviewed'); setEdit(null) }}>Save</button>
              <button className="btn-primary flex-1 py-2" onClick={async () => { await save(edit, update, 'filed'); setEdit(null); pushToast('Filed ✅', { emoji: '✅', tone: 'mint' }) }}><CheckCircle2 size={15} /> File it</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

async function save(edit, update, status) {
  await update({
    id: edit.id, vendor: edit.vendor || undefined, docDate: edit.docDate || undefined,
    amount: edit.amount === '' ? undefined : Number(edit.amount),
    taxAmount: edit.taxAmount === '' ? undefined : Number(edit.taxAmount),
    category: edit.category || undefined, kind: edit.kind, notes: edit.notes || undefined, status,
  })
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-4xl border border-line bg-white p-6 shadow-playful sm:rounded-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="truncate text-xl font-extrabold text-brand-700">{title}</h2>
          <button className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
