import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard, Baby, Share2, Plus, Trash2, Copy, Check, Link2, ExternalLink,
  Sparkles, ShieldCheck, Users, Loader2,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, Card, Pill, ProgressBar, Avatar } from '../components/ui.jsx'

const TIERS = [
  { range: '1–5 children', rate: 'Free', highlight: true },
  { range: '6th child', rate: '$20 / mo' },
  { range: 'Each child after', rate: '+$2 / mo' },
]
const origin = () => window.location.origin

export function Account() {
  const [tab, setTab] = useState('plan')
  const tabs = [
    { id: 'plan', label: 'Plan & billing', icon: CreditCard },
    { id: 'children', label: 'Children', icon: Baby },
    { id: 'family', label: 'Family links', icon: Share2 },
  ]
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Manage" title="Account" subtitle="Your plan, your children and the links you share with families" />
      <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
          >
            <t.icon size={16} /> <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      {tab === 'plan' && <PlanPanel />}
      {tab === 'children' && <ChildrenPanel />}
      {tab === 'family' && <FamilyPanel />}
    </div>
  )
}

/* ---------------- Plan & billing ---------------- */
function PlanPanel() {
  const { facility, startBilling, openBillingPortal, pushToast } = useApp()
  const [busy, setBusy] = useState('')
  if (!facility) return null
  const { plan, childCount, freeLimit, billable, monthly, remainingFree, hasCard, isDemo } = facility

  const planTone =
    plan === 'active' ? 'bg-mint-400/15 text-mint-600'
      : plan === 'past_due' ? 'bg-coral-400/15 text-coral-600'
        : 'bg-brand-50 text-brand-700'
  const planLabel = billable && hasCard ? 'Active subscription' : plan === 'past_due' ? 'Payment past due' : 'Free plan'

  const run = async (which, fn) => {
    setBusy(which)
    try { await fn() } finally { setBusy('') }
  }

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-brand-500 via-brand-600 to-grape-500 p-6 text-white shadow-playful"
      >
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <Pill className="bg-white/20 text-white backdrop-blur">{planLabel}</Pill>
        <h2 className="mt-3 text-3xl font-extrabold">
          {billable ? `$${monthly.toFixed(2)}` : '$0'}<span className="text-lg font-bold text-white/80">/mo</span>
        </h2>
        <p className="mt-1 text-sm font-semibold text-white/85">
          {childCount} {childCount === 1 ? 'child' : 'children'} enrolled
          {!billable && remainingFree > 0 && ` · ${remainingFree} more free`}
        </p>
        <div className="mt-4 max-w-sm">
          <ProgressBar value={Math.min(100, Math.round((childCount / Math.max(freeLimit, 1)) * 100))} gradient="from-white/70 to-white" />
          <p className="mt-1.5 text-xs font-bold text-white/70">
            {billable ? 'Billed monthly · adjusts automatically as your roster changes' : `Free up to ${freeLimit} children`}
          </p>
        </div>
      </motion.div>

      {isDemo && (
        <Card className="border-dashed">
          <p className="text-sm font-semibold text-slate-500">
            <Sparkles size={15} className="mr-1 inline text-brand-500" />
            This is the live demo workspace. Real facilities get their own private, isolated data.
          </p>
        </Card>
      )}

      {!isDemo && (
        <div className="grid gap-3 sm:grid-cols-2">
          {billable && !hasCard && (
            <button onClick={() => run('start', startBilling)} className="btn-primary justify-center !py-3.5">
              {busy === 'start' ? <Loader2 size={18} className="animate-spin" /> : <><CreditCard size={18} /> Set up billing</>}
            </button>
          )}
          {hasCard && (
            <button onClick={() => run('portal', openBillingPortal)} className="btn-ghost justify-center !py-3.5">
              {busy === 'portal' ? <Loader2 size={18} className="animate-spin" /> : <><CreditCard size={18} /> Manage card & invoices</>}
            </button>
          )}
          {!billable && !hasCard && (
            <button onClick={() => run('start', startBilling)} className="btn-ghost justify-center !py-3.5">
              {busy === 'start' ? <Loader2 size={18} className="animate-spin" /> : <><CreditCard size={18} /> Add a card now</>}
            </button>
          )}
        </div>
      )}

      {!isDemo && (
        <p className="text-center text-[11px] font-bold text-slate-400">
          Mitten is an OKTD.ca company — subscription charges appear as OKTD.CA on your card statement.
        </p>
      )}

      <Card>
        <h3 className="font-extrabold text-slate-800">Your pricing</h3>
        <p className="mb-3 text-xs font-bold text-slate-400">Roughly half of what the big platforms charge — and free to start.</p>
        <div className="divide-y divide-slate-100">
          {TIERS.map((t) => (
            <div key={t.range} className={`flex items-center justify-between py-2.5 ${t.highlight ? 'font-extrabold text-brand-700' : 'font-bold text-slate-600'}`}>
              <span>{t.range}</span>
              <span>{t.rate}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
          <ShieldCheck size={14} className="text-mint-500" /> Free up to 5 children · $20/mo + $2/child after · cancel anytime · your data is always yours
        </p>
      </Card>
    </div>
  )
}

/* ---------------- Children ---------------- */
const ROOMS = ['Infants', 'Toddlers', 'Preschool', 'Pre-K', 'Main Room']
const COLORS = ['from-brand-400 to-brand-600', 'from-blush-300 to-blush-500', 'from-mint-400 to-mint-500', 'from-grape-400 to-grape-600', 'from-sky-400 to-brand-500']
const EMOJIS = ['🐬', '🦋', '🦁', '🐢', '🐝', '🌸', '🚀', '🐙', '🦊', '🐼']

function ChildrenPanel() {
  const { childrenList, enrollChild, removeChild, facility, pushToast } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ first: '', last: '', age: '3 yrs', room: 'Preschool', parent: '', allergies: '', tuition: '' })
  const remaining = facility ? facility.remainingFree : 0

  const add = async (e) => {
    e.preventDefault()
    if (!form.first.trim()) return
    setBusy(true)
    const i = childrenList.length
    try {
      const res = await enrollChild({
        first: form.first.trim(),
        name: `${form.first.trim()} ${form.last.trim()}`.trim(),
        age: form.age,
        room: form.room,
        emoji: EMOJIS[i % EMOJIS.length],
        color: COLORS[i % COLORS.length],
        parent: form.parent.trim() || 'Parent',
        allergies: form.allergies.split(',').map((s) => s.trim()).filter(Boolean),
        monthlyTuition: Number(form.tuition) || undefined,
      })
      if (res?.redirecting) return // off to Stripe
      if (res?.ok || res?.billingSkipped) {
        setForm({ first: '', last: '', age: '3 yrs', room: 'Preschool', parent: '', allergies: '', tuition: '' })
        setOpen(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-slate-800">{childrenList.length} enrolled</h3>
          {facility && !facility.billable && <p className="text-xs font-bold text-slate-400">{remaining} more free · then your pricing scale kicks in</p>}
        </div>
        <button onClick={() => setOpen((o) => !o)} className="btn-primary !py-2.5">
          <Plus size={16} /> Add child
        </button>
      </div>

      {open && (
        <Card>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="First name" value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} required />
            <input className="input" placeholder="Last name" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} />
            <input className="input" placeholder="Age (e.g. 3 yrs)" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            <select className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>
              {ROOMS.map((r) => <option key={r}>{r}</option>)}
            </select>
            <input className="input" placeholder="Parent / guardian name" value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} />
            <input className="input" placeholder="Allergies (comma separated)" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
            <input className="input sm:col-span-2" type="number" placeholder="Monthly tuition you charge (optional, e.g. 1200)" value={form.tuition} onChange={(e) => setForm({ ...form, tuition: e.target.value })} />
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <>Enroll child</>}
              </button>
              {facility && facility.childCount >= facility.freeLimit && !facility.hasCard && (
                <p className="mt-2 text-center text-xs font-semibold text-slate-400">
                  This one crosses your free limit — we’ll collect a card, then it’s billed automatically.
                </p>
              )}
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0">
        {childrenList.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-400">No children yet. Add your first above.</div>
        ) : (
          childrenList.map((c, i, arr) => (
            <div key={c.id} className={`flex items-center gap-3 p-4 ${i !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
              <Avatar emoji={c.emoji} gradient={c.color} src={c.imageUrl} size="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold text-slate-700">{c.name}</div>
                <div className="text-xs font-bold text-slate-400">{c.age} · {c.room} · {c.parent}</div>
              </div>
              {c.allergies?.length > 0 && <Pill className="bg-coral-400/15 text-coral-600">{c.allergies.join(', ')}</Pill>}
              <button onClick={() => removeChild(c.id)} className="rounded-xl p-2 text-slate-300 transition hover:bg-coral-50 hover:text-coral-500">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

/* ---------------- Family links ---------------- */
function FamilyPanel() {
  const { facility, invites, generateInvite, revokeInvite, pushToast } = useApp()
  const [busy, setBusy] = useState('')
  const [copied, setCopied] = useState('')

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    pushToast('Link copied 📋', { emoji: '📋', tone: 'mint' })
    setTimeout(() => setCopied(''), 1600)
  }
  const make = async (role) => {
    setBusy(role)
    try {
      const r = await generateInvite(role)
      const url = `${origin()}/join?t=${r.token}`
      copy(url, r.token)
    } finally { setBusy('') }
  }

  const slugLink = facility ? `${origin()}/${facility.slug}` : ''

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2"><Link2 size={16} className="text-brand-500" /><h3 className="font-extrabold text-slate-800">Your family sign-in link</h3></div>
        <p className="mt-1 text-xs font-bold text-slate-400">Returning families sign in here. Share it on your website or front door.</p>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-slate-50 p-2 pl-4">
          <span className="flex-1 truncate font-mono text-sm font-semibold text-slate-600">{slugLink}</span>
          <button onClick={() => copy(slugLink, 'slug')} className="btn-ghost !py-2 text-sm">{copied === 'slug' ? <Check size={15} /> : <Copy size={15} />} Copy</button>
          <a href={slugLink} target="_blank" rel="noreferrer" className="btn-ghost !py-2 text-sm"><ExternalLink size={15} /></a>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={() => make('parent')} disabled={busy === 'parent'} className="card flex items-center gap-3 p-4 text-left transition hover:shadow-playful">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-300 to-blush-500 text-white">{busy === 'parent' ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}</span>
          <div><div className="font-extrabold text-slate-800">Invite a parent</div><div className="text-xs font-bold text-slate-400">Creates + copies a join link</div></div>
        </button>
        <button onClick={() => make('staff')} disabled={busy === 'staff'} className="card flex items-center gap-3 p-4 text-left transition hover:shadow-playful">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">{busy === 'staff' ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}</span>
          <div><div className="font-extrabold text-slate-800">Invite an educator</div><div className="text-xs font-bold text-slate-400">Creates + copies a join link</div></div>
        </button>
      </div>

      <Card className="p-0">
        <div className="border-b border-slate-100 p-4 font-extrabold text-slate-800">Active invite links</div>
        {invites.length === 0 ? (
          <div className="p-6 text-center text-sm font-semibold text-slate-400">No links yet. Generate one above to invite your families.</div>
        ) : (
          invites.map((inv, i, arr) => {
            const url = `${origin()}/join?t=${inv.token}`
            return (
              <div key={inv.id} className={`flex items-center gap-3 p-3 ${i !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <Pill className={inv.role === 'parent' ? 'bg-blush-300/20 text-blush-600' : inv.role === 'staff' ? 'bg-brand-50 text-brand-700' : 'bg-grape-400/15 text-grape-600'}>
                  {inv.role === 'staff' ? 'educator' : inv.role}
                </Pill>
                <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-slate-500">{url}</span>
                <button onClick={() => copy(url, inv.token)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">{copied === inv.token ? <Check size={15} /> : <Copy size={15} />}</button>
                <button onClick={() => revokeInvite(inv.id)} className="rounded-xl p-2 text-slate-300 hover:bg-coral-50 hover:text-coral-500"><Trash2 size={15} /></button>
              </div>
            )
          })
        )}
      </Card>
    </div>
  )
}
