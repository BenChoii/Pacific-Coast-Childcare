import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import {
  CreditCard, Baby, Share2, Plus, Trash2, Copy, Check, Link2, ExternalLink,
  Sparkles, ShieldCheck, Users, Loader2, MapPin,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, Card, Pill, ProgressBar, Avatar } from '../components/ui.jsx'

const TIERS = [
  { range: '1–5 children', rate: 'Free', highlight: true },
  { range: '6th child', rate: '$20 / mo' },
  { range: 'Each child after', rate: '+$2 / mo' },
]
const origin = () => window.location.origin

export function Account() {
  const { claimArea } = useApp()
  const [tab, setTab] = useState(claimArea ? 'listing' : 'plan')
  const tabs = [
    { id: 'plan', label: 'Plan & billing', icon: CreditCard },
    { id: 'children', label: 'Children', icon: Baby },
    { id: 'family', label: 'Family links', icon: Share2 },
    { id: 'listing', label: 'Public listing', icon: MapPin },
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
      {tab === 'listing' && <ListingPanel />}
    </div>
  )
}

/* ---------------- Public directory listing ---------------- */
const DIR_AREAS = [
  ['north-vancouver', 'North Vancouver'], ['surrey', 'Surrey'], ['vancouver', 'Vancouver'],
  ['burnaby', 'Burnaby'], ['richmond', 'Richmond'], ['langley', 'Langley'], ['coquitlam', 'Coquitlam'],
  ['victoria', 'Victoria'], ['vernon', 'Vernon'], ['comox-valley', 'Comox Valley'],
  ['abbotsford', 'Abbotsford'], ['kelowna', 'Kelowna'], ['nanaimo', 'Nanaimo'],
  ['new-westminster', 'New Westminster'], ['maple-ridge', 'Maple Ridge'],
]
const DIR_STATUS = [
  ['accepting', 'Accepting enrolments', 'bg-mint-400/15 text-mint-600'],
  ['waitlist', 'Waitlist open', 'bg-amber-400/15 text-amber-600'],
  ['full', 'Currently full', 'bg-slate-200 text-slate-500'],
  ['unconfirmed', "Don't show / unconfirmed", 'bg-brand-50 text-brand-700'],
]
const PAYMENT_METHODS = ['e-Transfer', 'Credit/debit card', 'Cheque', 'Cash', 'Pre-authorized debit', 'CCFRI / subsidy']

function ListingPanel() {
  const data = useQuery(api.directory.myListing)
  const upsert = useMutation(api.directory.upsertMyListing)
  const { pushToast, claimArea, claimName, clearClaimArea } = useApp()
  const claimAreaRef = useRef(claimArea) // captured before it's cleared
  const claimNameRef = useRef(claimName)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  // Consume the claim intent once we've landed here.
  useEffect(() => { if (claimArea) clearClaimArea() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data) return
    setForm((prev) => prev ?? {
      area: claimAreaRef.current || data.listing?.area || 'north-vancouver',
      name: claimNameRef.current || data.listing?.name || data.facilityName || '',
      status: data.listing?.status || 'accepting',
      spots: data.listing?.spots ?? '',
      visible: data.listing?.visible ?? true,
      programs: (data.profile?.programs || []).map((p) => ({ name: p.name || '', capacity: p.capacity ?? '', opensAt: p.opensAt || '' })),
      paymentMethods: data.profile?.paymentMethods || [],
      about: data.profile?.about || '',
      agesServed: data.profile?.agesServed || '',
      website: data.profile?.website || '',
      phone: data.profile?.phone || '',
    })
  }, [data])

  if (data === undefined) {
    return <Card><div className="flex items-center gap-2 text-sm font-semibold text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading your listing…</div></Card>
  }
  if (data?.isDemo) {
    return (
      <Card className="border-dashed">
        <p className="text-sm font-semibold text-slate-500">
          <Sparkles size={15} className="mr-1 inline text-brand-500" />
          This is the live demo workspace — public directory listings are disabled here so the demo daycare never appears on a real area board. Your own facility will be able to publish its status.
        </p>
      </Card>
    )
  }
  if (!form) return null

  const areaName = (DIR_AREAS.find((a) => a[0] === form.area) || [, ''])[1]
  const boardUrl = `${origin()}/childcare/${form.area}`
  const update = (patch) => { setForm((f) => ({ ...f, ...patch })); setSaved(false) }
  const addProgram = () => update({ programs: [...form.programs, { name: '', capacity: '', opensAt: '' }] })
  const setProgram = (i, patch) => update({ programs: form.programs.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const removeProgram = (i) => update({ programs: form.programs.filter((_, j) => j !== i) })
  const togglePay = (m) => update({ paymentMethods: form.paymentMethods.includes(m) ? form.paymentMethods.filter((x) => x !== m) : [...form.paymentMethods, m] })

  // Profile completeness — gentle nudge to enrich (status is the only required bit).
  const filledCount = [form.status !== 'unconfirmed', form.programs.some((p) => p.name?.trim()), form.paymentMethods.length > 0, !!form.about?.trim(), !!form.agesServed?.trim()].filter(Boolean).length
  const pct = Math.round((filledCount / 5) * 100)

  const save = async () => {
    setBusy(true)
    try {
      await upsert({
        area: form.area,
        name: form.name.trim(),
        status: form.status,
        spots: form.status === 'accepting' && form.spots !== '' ? Math.max(0, Number(form.spots) || 0) : undefined,
        visible: !!form.visible && form.status !== 'unconfirmed',
        programs: form.programs.filter((p) => p.name?.trim()).map((p) => ({ name: p.name.trim(), capacity: p.capacity !== '' && p.capacity != null ? Math.max(0, Number(p.capacity) || 0) : undefined, opensAt: p.opensAt?.trim() || undefined })),
        paymentMethods: form.paymentMethods,
        about: form.about,
        agesServed: form.agesServed,
        website: form.website,
        phone: form.phone,
      })
      setSaved(true)
      pushToast(form.status === 'unconfirmed' ? 'Saved — your listing is hidden' : `Live on the ${areaName} board ✨`, { emoji: '📍', tone: 'mint' })
    } catch (e) {
      pushToast(e?.message || 'Could not save', { emoji: '⚠️', tone: 'coral' })
    } finally { setBusy(false) }
  }

  const live = form.visible && form.status !== 'unconfirmed'

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="pt-1"
      >
        <Pill className="pill-info"><MapPin size={13} className="mr-1 inline" /> Free local listing</Pill>
        <h2 className="mt-3 text-3xl leading-tight text-slate-800 sm:text-4xl">Get found by parents searching your area</h2>
        <p className="mt-2 max-w-md text-sm font-medium text-slate-500">
          Mitten runs free public boards of which daycares are accepting enrolments. Set your status and parents searching <strong className="font-semibold text-slate-700">{areaName}</strong> see your openings — live.
        </p>
      </motion.div>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">Your area</span>
            <select className="input w-full" value={form.area} onChange={(e) => update({ area: e.target.value })}>
              {DIR_AREAS.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">Name shown to parents</span>
            <input className="input w-full" value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="Your daycare's name" />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-400">Enrolment status</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {DIR_STATUS.map(([val, label, tone]) => (
              <button
                key={val}
                onClick={() => update({ status: val })}
                className={`flex items-center justify-between rounded-2xl border p-3 text-left text-sm font-bold transition ${form.status === val ? 'border-brand-300 bg-brand-50/60 text-brand-700' : 'border-line text-slate-600 hover:border-brand-200'}`}
              >
                <span>{label}</span>
                {form.status === val && <Check size={16} className="text-brand-600" />}
              </button>
            ))}
          </div>
        </div>

        {form.status === 'accepting' && (
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">Open spots (optional)</span>
            <input className="input w-full sm:w-48" type="number" min="0" value={form.spots} onChange={(e) => update({ spots: e.target.value })} placeholder="e.g. 3" />
          </label>
        )}

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 p-3">
          <div>
            <div className="text-sm font-extrabold text-slate-700">Show me on the public board</div>
            <div className="text-xs font-bold text-slate-400">Turn off any time to hide your listing.</div>
          </div>
          <button
            onClick={() => update({ visible: !form.visible })}
            className={`relative h-7 w-12 rounded-full transition ${form.visible ? 'bg-mint-500' : 'bg-slate-300'}`}
            aria-pressed={form.visible}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${form.visible ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={busy} className="btn-primary !py-3">
            {busy ? <Loader2 size={18} className="animate-spin" /> : saved ? <><Check size={18} /> Saved</> : <>Save & publish</>}
          </button>
          <a href={boardUrl} target="_blank" rel="noreferrer" className="btn-ghost !py-3 text-sm">
            <ExternalLink size={15} /> View the {areaName} board
          </a>
          <Pill className={live ? 'bg-mint-400/15 text-mint-600' : 'bg-slate-200 text-slate-500'}>
            {live ? '● Live to parents' : '○ Hidden'}
          </Pill>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-800">Tell parents more</h3>
            <p className="text-xs font-bold text-slate-400">Optional — but richer listings get far more enquiries, and it all carries into your Mitten app later.</p>
          </div>
          <Pill className="whitespace-nowrap bg-brand-50 text-brand-700">{pct}% complete</Pill>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-5">
          <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-400">Programs &amp; spaces</span>
          <div className="space-y-2">
            {form.programs.map((p, i) => (
              <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
                <input className="input" placeholder="Program (e.g. Infant/Toddler)" value={p.name} onChange={(e) => setProgram(i, { name: e.target.value })} />
                <input className="input" type="number" min="0" placeholder="# kids" value={p.capacity} onChange={(e) => setProgram(i, { capacity: e.target.value })} />
                <input className="input" placeholder="Opens (Sep 2026)" value={p.opensAt} onChange={(e) => setProgram(i, { opensAt: e.target.value })} />
                <button onClick={() => removeProgram(i)} className="justify-self-start rounded-xl p-2 text-slate-300 transition hover:bg-coral-50 hover:text-coral-500"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button onClick={addProgram} className="btn-ghost mt-2 !py-2 text-sm"><Plus size={15} /> Add a program</button>
        </div>

        <div className="mt-5">
          <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-400">Payment methods you accept</span>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => {
              const on = form.paymentMethods.includes(m)
              return (
                <button key={m} onClick={() => togglePay(m)} className={`rounded-full border px-3 py-1.5 text-sm font-bold transition ${on ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line text-slate-500 hover:border-brand-200'}`}>
                  {on && <Check size={13} className="mr-1 inline" />}{m}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="block"><span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">Ages served</span><input className="input w-full" placeholder="10 mo – 5 yrs" value={form.agesServed} onChange={(e) => update({ agesServed: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">Phone (for parents)</span><input className="input w-full" placeholder="604-…" value={form.phone} onChange={(e) => update({ phone: e.target.value })} /></label>
          <label className="block"><span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">Website</span><input className="input w-full" placeholder="yourdaycare.ca" value={form.website} onChange={(e) => update({ website: e.target.value })} /></label>
        </div>

        <label className="mt-5 block">
          <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-400">What makes your daycare special</span>
          <textarea className="input w-full" rows={3} maxLength={1000} placeholder="Your approach, what's included, what sets you apart from other centres…" value={form.about} onChange={(e) => update({ about: e.target.value })} />
        </label>

        <button onClick={save} disabled={busy} className="btn-primary mt-5 !py-3">
          {busy ? <Loader2 size={18} className="animate-spin" /> : saved ? <><Check size={18} /> Saved</> : <>Save listing &amp; profile</>}
        </button>
      </Card>

      <Card>
        <h3 className="font-extrabold text-slate-800">How it shows up</h3>
        <p className="mt-1 text-xs font-bold text-slate-400">
          Already on the board as “Unconfirmed”? Use the <strong>exact name</strong> shown there and we’ll update that row. A new name simply adds your centre.
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
          <ShieldCheck size={14} className="text-mint-500" /> You control your status · parents are always told to call to confirm.
        </div>
      </Card>
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
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="pt-1"
      >
        <Pill className="pill-info">{planLabel}</Pill>
        <h2 className="mt-3 text-5xl text-slate-800">
          {billable ? `$${monthly.toFixed(2)}` : '$0'}<span className="text-xl text-slate-400">/mo</span>
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {childCount} {childCount === 1 ? 'child' : 'children'} enrolled
          {!billable && remainingFree > 0 && ` · ${remainingFree} more free`}
        </p>
        <div className="mt-4 max-w-sm">
          <ProgressBar value={Math.min(100, Math.round((childCount / Math.max(freeLimit, 1)) * 100))} />
          <p className="mt-1.5 text-xs font-semibold text-slate-400">
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
