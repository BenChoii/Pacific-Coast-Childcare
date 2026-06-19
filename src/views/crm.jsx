import { useMemo, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Inbox, Plus, X, Phone, Mail, MessageSquare, UserPlus, Clock, Archive, ArrowRight, Sparkles, CalendarClock } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, StatCard, Pill, KnitEmpty } from '../components/ui.jsx'

const STAGES = [
  ['new', 'New', 'from-sky-400 to-brand-500'],
  ['contacted', 'Contacted', 'from-sunshine-400 to-sunshine-500'],
  ['toured', 'Toured', 'from-grape-400 to-grape-500'],
  ['enrolled', 'Enrolled', 'from-mint-400 to-mint-500'],
  ['lost', 'Lost', 'from-slate-300 to-slate-400'],
]
const STAGE_LABEL = Object.fromEntries(STAGES.map(([id, label]) => [id, label]))
const REASON_LABEL = { tour: 'Tour', package: 'Package', waitlist: 'Waitlist', birthday: 'Birthday', faq: 'FAQ' }
const SOURCE_LABEL = { 'book-tour': 'Book-a-tour', 'contact-form': 'Website', directory: 'Directory', manual: 'Added by hand' }
const blank = { name: '', email: '', phone: '', childAge: '', reason: 'tour', message: '' }

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '')

// Upsell shown to facilities that haven't unlocked the CRM add-on.
function CrmLocked() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="rounded-4xl border border-line bg-white/80 p-10 text-center shadow-playful backdrop-blur">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-grape-500 text-white shadow-md"><Inbox size={28} /></div>
        <p className="eyebrow">Pro add-on</p>
        <h1 className="mt-1 text-3xl text-brand-700">Turn website inquiries into enrolments</h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-slate-500">
          Every “book a tour” and contact-form message from your website lands right here — a simple pipeline to follow up, take notes, and fill your spots. Nothing slips through the cracks.
        </p>
        <button className="btn-primary mx-auto mt-6 px-7 py-3" onClick={() => (window.location.href = '/app?upgrade=crm')}>
          <Sparkles size={18} /> Add the CRM to my plan
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>{children}</label>
}

export function Crm() {
  const { facility, pushToast } = useApp()
  const enabled = facility?.addons?.crm
  const inquiries = useQuery(api.inquiries.listByFacility) ?? []
  const stats = useQuery(api.inquiries.stats)
  const setStatus = useMutation(api.inquiries.setStatus)
  const addManual = useMutation(api.inquiries.addManual)
  const addNote = useMutation(api.inquiries.addNote)
  const setFollowUp = useMutation(api.inquiries.setFollowUp)
  const archive = useMutation(api.inquiries.archive)
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState(null)
  const [note, setNote] = useState('')

  const byStage = useMemo(() => {
    const g = Object.fromEntries(STAGES.map(([id]) => [id, []]))
    for (const q of inquiries) (g[q.status] || g.new).push(q)
    return g
  }, [inquiries])

  if (!enabled) return <CrmLocked />

  const current = sel ? inquiries.find((q) => q.id === sel) : null

  const move = async (q, status) => {
    try { await setStatus({ id: q.id, status }); if (status === 'enrolled') pushToast('Enrolled — nice work! 🎒', { emoji: '🎒', tone: 'mint' }) }
    catch { pushToast('Could not update.', { emoji: '⚠️', tone: 'coral' }) }
  }
  const saveLead = async () => {
    if (!form.name.trim()) { pushToast('Add a name first.', { emoji: '⚠️', tone: 'coral' }); return }
    await addManual({ name: form.name, email: form.email || undefined, phone: form.phone || undefined, childAge: form.childAge || undefined, reason: form.reason, message: form.message || undefined })
    setForm(null); pushToast('Lead added 📒', { emoji: '📒', tone: 'brand' })
  }
  const saveNote = async () => { if (!note.trim()) return; await addNote({ id: current.id, text: note }); setNote('') }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Director CRM"
        title="Inquiries 📨"
        subtitle="Every lead from your website — follow up and fill your spots."
        action={<button className="btn-primary whitespace-nowrap px-4 py-2" onClick={() => setForm({ ...blank })}><Plus size={16} /> Add lead</button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <StatCard icon={Inbox} label="New" value={stats?.new ?? 0} gradient="from-sky-400 to-brand-500" />
        <StatCard icon={Phone} label="Contacted" value={stats?.contacted ?? 0} gradient="from-sunshine-400 to-sunshine-500" delay={0.04} />
        <StatCard icon={UserPlus} label="Toured" value={stats?.toured ?? 0} gradient="from-grape-400 to-grape-500" delay={0.08} />
        <StatCard icon={Sparkles} label="Enrolled" value={stats?.enrolled ?? 0} gradient="from-mint-400 to-mint-500" delay={0.12} />
        <StatCard icon={MessageSquare} label="Total open" value={stats?.total ?? 0} gradient="from-blush-400 to-grape-500" delay={0.16} />
      </div>

      {inquiries.length === 0 ? (
        <KnitEmpty image="/cinema/spots/welcome.webp" title="No inquiries yet" hint="When a family books a tour or messages you from your website, they’ll appear here automatically." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {STAGES.map(([id, label, gradient]) => (
            <div key={id} className="rounded-3xl border border-line bg-white/60 p-3 backdrop-blur">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${gradient} px-2.5 py-1 text-xs font-bold text-white`}>{label}</span>
                <span className="text-xs font-bold text-slate-400">{byStage[id].length}</span>
              </div>
              <div className="space-y-2.5">
                {byStage[id].map((q) => (
                  <button key={q.id} onClick={() => setSel(q.id)} className="w-full rounded-2xl border border-line bg-white/90 p-3 text-left shadow-card transition hover:shadow-playful">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 font-bold leading-tight text-slate-700">{q.name}</span>
                      <span className="shrink-0 text-[10px] font-semibold text-slate-400">{timeAgo(q.createdAt)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {q.reason && <Pill className="bg-brand-50 text-brand-600">{REASON_LABEL[q.reason] || q.reason}</Pill>}
                      {q.childAge && <Pill className="bg-slate-100 text-slate-500">{q.childAge}</Pill>}
                    </div>
                    {q.preferredSlot && <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-grape-600"><CalendarClock size={12} /> {q.preferredSlot}</p>}
                    {q.followUpAt && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-coral-500"><Clock size={12} /> Follow up {fmtDate(q.followUpAt)}</p>}
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-300">{SOURCE_LABEL[q.source] || q.source}</p>
                  </button>
                ))}
                {byStage[id].length === 0 && <p className="px-1 py-3 text-center text-xs text-slate-300">—</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add-lead modal */}
      {form && (
        <Modal onClose={() => setForm(null)} title="Add a lead">
          <div className="space-y-3">
            <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Parent name" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="parent@email.com" /></Field>
              <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Child's age"><input className="input" value={form.childAge} onChange={(e) => setForm({ ...form, childAge: e.target.value })} placeholder="e.g. 3 years" /></Field>
              <Field label="Reason">
                <select className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                  {Object.entries(REASON_LABEL).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes"><textarea className="input min-h-[70px]" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Anything they mentioned…" /></Field>
            <button className="btn-primary w-full py-2.5" onClick={saveLead}><Plus size={16} /> Add lead</button>
          </div>
        </Modal>
      )}

      {/* Lead detail */}
      {current && (
        <Modal onClose={() => setSel(null)} title={current.name}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {current.reason && <Pill className="bg-brand-50 text-brand-600">{REASON_LABEL[current.reason] || current.reason}</Pill>}
              <Pill className="bg-slate-100 text-slate-500">{SOURCE_LABEL[current.source] || current.source}</Pill>
              {current.childAge && <Pill className="bg-slate-100 text-slate-500">Age {current.childAge}</Pill>}
            </div>
            <div className="flex flex-wrap gap-2">
              {current.email && <a href={`mailto:${current.email}`} className="btn-ghost px-3 py-2 text-sm"><Mail size={15} /> {current.email}</a>}
              {current.phone && <a href={`tel:${current.phone}`} className="btn-ghost px-3 py-2 text-sm"><Phone size={15} /> {current.phone}</a>}
            </div>
            {current.preferredSlot && <p className="text-sm font-medium text-slate-600"><CalendarClock size={14} className="mr-1 inline" />Preferred time: <strong>{current.preferredSlot}</strong></p>}
            {current.message && <p className="rounded-2xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">“{current.message}”</p>}

            <div>
              <p className="eyebrow mb-1.5">Stage</p>
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map(([id, label, gradient]) => (
                  <button key={id} onClick={() => move(current, id)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${current.status === id ? `bg-gradient-to-r ${gradient} text-white shadow` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{label}</button>
                ))}
              </div>
            </div>

            <Field label="Follow-up reminder">
              <input type="date" className="input" defaultValue={current.followUpAt ? new Date(current.followUpAt).toISOString().slice(0, 10) : ''}
                onChange={(e) => setFollowUp({ id: current.id, followUpAt: e.target.value ? Date.parse(e.target.value) : null })} />
            </Field>

            <div>
              <p className="eyebrow mb-1.5">Notes & activity</p>
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {(current.notes || []).slice().reverse().map((n, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"><span>{n.text}</span><span className="ml-2 text-[10px] text-slate-400">{n.by} · {timeAgo(n.at)}</span></div>
                ))}
                {(!current.notes || current.notes.length === 0) && <p className="text-xs text-slate-300">No notes yet.</p>}
              </div>
              <div className="mt-2 flex gap-2">
                <input className="input flex-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log a call, a note…" onKeyDown={(e) => e.key === 'Enter' && saveNote()} />
                <button className="btn-primary px-3 py-2" onClick={saveNote}><ArrowRight size={16} /></button>
              </div>
            </div>

            <button className="btn-ghost w-full py-2 text-coral-500" onClick={async () => { await archive({ id: current.id }); setSel(null) }}><Archive size={15} /> Archive</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-4xl border border-line bg-white p-6 shadow-playful sm:rounded-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold text-brand-700">{title}</h2>
          <button className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
