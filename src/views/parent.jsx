import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAction, useMutation } from 'convex/react'
import {
  Smile, Moon, Apple, Camera, MessageCircle, CalendarDays, CreditCard,
  Clock, ChevronRight, CheckCircle2, ShieldCheck, FileText, Phone, AlertTriangle, Download, Heart, Loader2, Sparkles, Send,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { openInvoicePrint } from '../lib/invoiceDoc.js'
import { StatCard, Card, SectionHeader, Pill, Avatar, ProgressBar, HomeSkeleton } from '../components/ui.jsx'
import AvatarUpload from '../components/AvatarUpload.jsx'
import { ParentExtrasCard } from './finance.jsx'
import { ACTIVITY_TYPES, calendarEvents } from '../data/mockData.js'

// The parent's own children: those linked to their account; until they've
// claimed one we show the whole facility roster so they can pick theirs.
function useMyKids() {
  const { childrenList, viewer } = useApp()
  const mine = childrenList.filter((c) => c.parentUserId === viewer?.id)
  const kids = mine.length ? mine : childrenList
  const needClaim = !!viewer?.id && mine.length === 0 && childrenList.length > 0
  return { kids, needClaim }
}

function ClaimBanner() {
  const { childrenList, claimChild, pushToast } = useApp()
  return (
    <Card className="border-dashed">
      <h3 className="font-extrabold text-slate-800">Which child is yours?</h3>
      <p className="mb-3 text-sm font-semibold text-slate-400">Tap your child to link them to your account.</p>
      <div className="flex flex-wrap gap-2">
        {childrenList.map((c) => (
          <button
            key={c.id}
            onClick={async () => { await claimChild(c.id); pushToast(`${c.first} is linked to your account 💙`, { emoji: '👶', tone: 'mint' }) }}
            className="flex items-center gap-2 rounded-2xl border-2 border-line bg-white px-3 py-2 transition hover:border-brand-300"
          >
            <span className="text-lg">{c.emoji}</span>
            <span className="text-sm font-bold text-slate-700">{c.name}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}

/* ---------------- Parent Home ---------------- */
export function ParentHome() {
  const { setView, activeChildId, setActiveChildId, timeline, conversations, loading, viewer, invoices, dailyRecap } = useApp()
  const { kids, needClaim } = useMyKids()
  const child = kids.find((c) => c.id === activeChildId) || kids[0]
  const [recap, setRecap] = useState('')
  const [recapBusy, setRecapBusy] = useState(false)
  const makeRecap = async () => {
    if (!child) return
    setRecapBusy(true)
    try {
      const activities = timeline.slice(0, 10).map((t) => `- ${t.title}: ${t.detail}`).join('\n')
      const r = await dailyRecap({ childName: child.first, activities })
      setRecap(r?.text || (r?.configured === false ? 'AI recaps aren’t switched on yet.' : 'Couldn’t generate right now.'))
    } catch {
      setRecap('Couldn’t generate right now — please try again.')
    } finally { setRecapBusy(false) }
  }
  const unread = conversations.reduce((n, c) => n + c.unread, 0)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = (viewer?.name || 'there').split(' ')[0]
  const due = invoices.find((i) => i.status === 'due')
  const checkedIn = child && (child.status === 'checked-in' || child.status === 'napping')

  if (loading && timeline.length === 0) return <HomeSkeleton />
  if (!child) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Family" title={`Welcome, ${firstName}`} />
        <Card className="text-center">
          <p className="text-sm font-semibold text-slate-500">No child is linked to your account yet. Your daycare will add your child shortly, or ask them for an invite link.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {needClaim && <ClaimBanner />}
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-brand-400 via-brand-500 to-grape-500 p-6 text-white shadow-playful sm:p-8"
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-8 top-6 hidden text-6xl opacity-90 sm:block animate-float">{child.emoji}</div>
        <p className="text-sm font-bold text-white/80">{greeting}, {firstName} 👋</p>
        <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">{child.first} is having a great day!</h2>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur">
          <CheckCircle2 size={16} /> {checkedIn ? `Checked in at ${child.checkInTime} · ${child.room} room` : `${child.room} room`}
        </div>
      </motion.div>

      {/* Child switcher */}
      <div className="flex flex-wrap gap-3">
        {kids.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveChildId(c.id)}
            className={`flex items-center gap-3 rounded-3xl border-2 bg-white p-2 pr-5 transition ${
              c.id === activeChildId ? 'border-brand-400 shadow-playful' : 'border-transparent shadow-sm hover:border-slate-200'
            }`}
          >
            <Avatar emoji={c.emoji} gradient={c.color} src={c.imageUrl} />
            <div className="text-left">
              <div className="text-sm font-extrabold text-slate-800">{c.first}</div>
              <div className="text-xs font-bold text-slate-400">{c.age} · {c.room}</div>
            </div>
          </button>
        ))}
      </div>

      {/* AI day-in-a-glance */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-4xl border border-line bg-gradient-to-br from-brand-50 to-grape-400/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-extrabold text-slate-800"><Sparkles size={18} className="text-grape-500" /> Day in a glance</h3>
          {!recap && (
            <button onClick={makeRecap} disabled={recapBusy} className="btn-primary !py-2 text-sm">
              {recapBusy ? <Loader2 size={15} className="animate-spin" /> : 'Generate'}
            </button>
          )}
        </div>
        {recap ? (
          <>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{recap}</p>
            <button onClick={makeRecap} disabled={recapBusy} className="mt-2 text-xs font-bold text-brand-600">{recapBusy ? 'Refreshing…' : '↻ Refresh'}</button>
          </>
        ) : (
          <p className="mt-1 text-sm font-semibold text-slate-400">A warm AI summary of {child.first}'s day, from the classroom log.</p>
        )}
      </motion.div>

      {/* Today snapshot */}
      <div>
        <SectionHeader title={`${child.first}'s day so far`} subtitle="Live updates from the classroom" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={Smile} label="Mood" value={child.mood} gradient="from-sunshine-400 to-coral-500" delay={0} />
          <StatCard icon={Moon} label="Nap" value={`${Math.floor(child.napMinutes / 60)}h ${child.napMinutes % 60}m`} gradient="from-grape-400 to-grape-600" delay={0.05} />
          <StatCard icon={Apple} label="Meals" value="2 of 3" sub="Snack & lunch logged" gradient="from-coral-400 to-pink-500" delay={0.1} />
          <StatCard icon={Camera} label="New photos" value={child.photosToday} gradient="from-brand-400 to-brand-600" delay={0.15} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2" delay={0.1}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-800">Recent activity</h3>
            <button onClick={() => setView('timeline')} className="inline-flex items-center text-sm font-extrabold text-brand-600">
              Full log <ChevronRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {timeline.slice(0, 4).map((t) => {
              const meta = ACTIVITY_TYPES[t.type]
              return (
                <div key={t.id} className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg ${meta.soft}`}>{meta.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-slate-700">{t.title}</span>
                      <span className="shrink-0 text-xs font-bold text-slate-400">{t.time}</span>
                    </div>
                    <p className="truncate text-sm font-semibold text-slate-400">{t.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Side cards */}
        <div className="space-y-4">
          <QuickCard
            onClick={() => setView('messages')}
            icon={MessageCircle}
            title="Messages"
            sub={unread > 0 ? `${unread} new from teachers` : 'All caught up'}
            gradient="from-grape-400 to-grape-600"
            badge={unread}
          />
          <QuickCard
            onClick={() => setView('billing')}
            icon={CreditCard}
            title="Tuition"
            sub={due ? `$${due.amount.toLocaleString()} due ${due.due}` : 'No balance due'}
            gradient="from-mint-400 to-brand-500"
          />
          <QuickCard
            onClick={() => setView('calendar')}
            icon={CalendarDays}
            title="Calendar & events"
            sub="See what's coming up"
            gradient="from-blush-300 to-blush-500"
          />
        </div>
      </div>
    </div>
  )
}

function QuickCard({ icon: Icon, title, sub, gradient, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className="card flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-1 hover:shadow-playful"
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-md`}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-extrabold text-slate-800">{title}</div>
        <div className="truncate text-sm font-semibold text-slate-400">{sub}</div>
      </div>
      {badge > 0 && (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-coral-500 px-2 text-xs font-extrabold text-white">{badge}</span>
      )}
      <ChevronRight size={18} className="text-slate-300" />
    </button>
  )
}

/* ---------------- Parent Timeline ---------------- */
export function ParentTimeline() {
  const { timeline, activeChildId } = useApp()
  const { kids } = useMyKids()
  const child = kids.find((c) => c.id === activeChildId) || kids[0]
  const [filter, setFilter] = useState('all')
  const filters = ['all', 'meal', 'nap', 'diaper', 'activity', 'learning', 'photo']
  const items = filter === 'all' ? timeline : timeline.filter((t) => t.type === filter)

  return (
    <div className="space-y-5">
      <SectionHeader title="Daily log 📋" subtitle={child ? `Every moment of ${child.first}'s day, as it happens` : 'Live updates from the classroom'} />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const meta = ACTIVITY_TYPES[f]
          const active = filter === f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`pill capitalize ${active ? 'bg-brand-500 text-white shadow-md' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}
            >
              {f === 'all' ? '✨ All' : `${meta.emoji} ${meta.label}`}
            </button>
          )
        })}
      </div>

      <Card>
        <div className="relative pl-2">
          <div className="absolute bottom-2 left-[1.35rem] top-2 w-0.5 bg-slate-100" />
          <div className="space-y-5">
            {items.map((t, i) => {
              const meta = ACTIVITY_TYPES[t.type]
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative flex gap-4"
                >
                  <span className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-base text-white shadow-md ${meta.color}`}>
                    {meta.emoji}
                  </span>
                  <div className="flex-1 rounded-2xl bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-slate-700">{t.title}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                        <Clock size={12} /> {t.time}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-slate-500">{t.detail}</p>
                    <div className="mt-2 flex items-center gap-2">
                      {t.amount && <Pill className={meta.soft}>{t.amount}</Pill>}
                      <span className="text-xs font-bold text-slate-400">by {t.by}</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ---------------- Parent Calendar ---------------- */
export function ParentCalendar() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Calendar & events 📅" subtitle="What’s coming up at Pacific Coast" />
      <div className="grid gap-3">
        {calendarEvents.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-card"
          >
            <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl bg-slate-50 text-center">
              <span className="text-xs font-extrabold uppercase text-slate-400">{e.day}</span>
              <span className="text-lg font-extrabold text-slate-700">{e.date.split(' ')[1]}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{e.emoji}</span>
                <span className="font-extrabold text-slate-800">{e.title}</span>
              </div>
              <Pill className={`mt-1 ${e.color}`}>{e.tag}</Pill>
            </div>
            <button className="btn-ghost !py-2 text-sm">RSVP</button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Parent Billing ---------------- */
export function ParentBilling() {
  const { invoices, payInvoice, pushToast, facility } = useApp()
  const markEtransfer = useMutation(api.invoices.markEtransferSent)
  const [etOpen, setEtOpen] = useState(null) // invoice id with e-transfer panel open
  const createCheckout = useAction(api.payments.createCheckoutSession)
  const [paying, setPaying] = useState(null)
  const due = invoices.filter((i) => i.status === 'due')
  const history = invoices.filter((i) => i.status === 'paid')

  const handlePay = async (inv) => {
    setPaying(inv.id)
    try {
      const res = await createCheckout({ id: inv.id, origin: window.location.origin })
      if (res?.configured && res.url) {
        window.location.href = res.url // → Stripe Checkout
        return
      }
      if (res?.configured && res.error) {
        pushToast(res.error, { emoji: '⚠️', tone: 'coral' })
        return
      }
      // Stripe not configured yet → instant-pay demo fallback
      payInvoice(inv.id)
      pushToast(`Payment of $${inv.amount.toLocaleString()} recorded — thank you!`, { emoji: '💳', tone: 'mint' })
    } catch {
      pushToast('Could not start checkout. Please try again.', { emoji: '⚠️', tone: 'coral' })
    } finally {
      setPaying(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Tuition & billing 💳" subtitle="Pay, review and download statements" />

      <ParentExtrasCard />

      {due.map((inv) => (
        <motion.div
          key={inv.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-brand-500 to-grape-600 p-6 text-white shadow-playful"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white/80">Amount due · {inv.period}</p>
              <p className="text-4xl font-extrabold">${inv.amount.toLocaleString()}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur">
                <Clock size={14} /> Due {inv.due}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2">
              <button onClick={() => handlePay(inv)} disabled={paying === inv.id} className="btn bg-white text-brand-700 shadow-lg hover:-translate-y-0.5">
                {paying === inv.id ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />} Pay by card
              </button>
              {facility?.etransferEmail && (
                <button onClick={() => setEtOpen(etOpen === inv.id ? null : inv.id)} className="btn bg-white/20 text-white backdrop-blur hover:bg-white/30">
                  <Send size={16} /> Pay by e-Transfer
                </button>
              )}
              <button onClick={() => openInvoicePrint(inv, facility)} className="btn bg-white/20 text-white backdrop-blur hover:bg-white/30">
                <Download size={16} /> Invoice PDF
              </button>
            </div>
          </div>
          {inv.items && (
            <div className="mt-5 space-y-2 border-t border-white/20 pt-4">
              {inv.items.map((it) => (
                <div key={it.label} className="flex items-center justify-between text-sm font-semibold text-white/90">
                  <span>{it.label}</span>
                  <span className="font-extrabold">${it.amt}</span>
                </div>
              ))}
            </div>
          )}
          {etOpen === inv.id && facility?.etransferEmail && (
            <div className="mt-5 rounded-2xl bg-white/15 p-4 text-sm font-semibold backdrop-blur">
              <p>Send <b>${inv.amount.toLocaleString()}</b> by Interac e-Transfer to <b>{facility.etransferEmail}</b> and put <b>{inv.id}</b> in the message.</p>
              <button
                onClick={async () => {
                  await markEtransfer({ id: inv.id })
                  setEtOpen(null)
                  pushToast('Thanks! We marked your e-Transfer as sent — your daycare will confirm receipt.', { emoji: '📨', tone: 'mint' })
                }}
                className="btn mt-3 bg-white text-brand-700"
              >
                <CheckCircle2 size={16} /> I've sent it
              </button>
            </div>
          )}
        </motion.div>
      ))}

      {invoices.filter((i) => i.status === 'processing').map((inv) => (
        <Card key={inv.id} className="flex items-center gap-4 bg-sunshine-400/10">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sunshine-400/20 text-sunshine-600"><Clock /></span>
          <div className="flex-1">
            <div className="font-extrabold text-slate-800">e-Transfer on its way · ${inv.amount.toLocaleString()}</div>
            <div className="text-sm font-semibold text-slate-400">{inv.period} · {inv.id} — your daycare will confirm once it arrives.</div>
          </div>
          <button onClick={() => openInvoicePrint(inv, facility)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><Download size={18} /></button>
        </Card>
      ))}

      {due.length === 0 && (
        <Card className="flex items-center gap-4 bg-mint-400/10">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-400/20 text-mint-500"><CheckCircle2 /></span>
          <div>
            <div className="font-extrabold text-slate-800">You’re all paid up! 🎉</div>
            <div className="text-sm font-semibold text-slate-400">No outstanding balance. Auto-pay is on.</div>
          </div>
        </Card>
      )}

      <div>
        <SectionHeader title="Payment history" />
        <Card className="p-0">
          {history.map((inv, i) => (
            <div key={inv.id} className={`flex items-center gap-4 p-4 ${i !== history.length - 1 ? 'border-b border-slate-100' : ''}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mint-400/15 text-mint-500"><CheckCircle2 size={20} /></span>
              <div className="flex-1">
                <div className="font-extrabold text-slate-700">{inv.period}</div>
                <div className="text-xs font-bold text-slate-400">Paid {inv.paidOn} · {inv.id}</div>
              </div>
              <span className="font-extrabold text-slate-700">${inv.amount.toLocaleString()}</span>
              <button onClick={() => openInvoicePrint(inv, facility)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><Download size={18} /></button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

/* ---------------- Parent Profile ---------------- */
export function ParentProfile() {
  const { activeChildId, setActiveChildId, educators, setChildPhoto } = useApp()
  const { kids } = useMyKids()
  const child = kids.find((c) => c.id === activeChildId) || kids[0]
  const teacher = educators?.[0]?.name || 'Your child’s educator'

  if (!child) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Child" title="Child profile" />
        <Card className="text-center"><p className="text-sm font-semibold text-slate-500">No child linked yet.</p></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {kids.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveChildId(c.id)}
            className={`pill ${c.id === activeChildId ? 'bg-brand-500 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}
          >
            {c.emoji} {c.first}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className={`relative bg-gradient-to-br ${child.color} p-6 text-white`}>
          <div className="flex items-center gap-4">
            <AvatarUpload src={child.imageUrl} fallback={child.emoji} size="h-20 w-20" gradient="from-white/30 to-white/10" onUpload={(f) => setChildPhoto(child.id, f)} />
            <div>
              <h2 className="text-2xl font-extrabold">{child.name}</h2>
              <p className="font-bold text-white/80">{child.age} · {child.room} room</p>
              <p className="mt-0.5 text-xs font-semibold text-white/70">Tap the photo to add one 📷</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Info label="Status" value="Enrolled" icon={CheckCircle2} tone="text-mint-500" />
          <Info label="Primary teacher" value={teacher} icon={Smile} tone="text-brand-500" />
          <Info label="Allergies" value={child.allergies.length ? child.allergies.join(', ') : 'None on file'} icon={AlertTriangle} tone={child.allergies.length ? 'text-coral-500' : 'text-slate-400'} />
          <Info label="Parent / guardian" value={child.parent} icon={Phone} tone="text-grape-500" />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-extrabold text-slate-800"><ShieldCheck size={18} className="text-brand-500" /> Authorized pickups</h3>
          <div className="space-y-2">
            {[`${child.parent} (Parent)`].map((p) => (
              <div key={p} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <Avatar emoji="🧑" size="h-9 w-9" gradient="from-slate-300 to-slate-400" />
                <span className="text-sm font-bold text-slate-600">{p}</span>
                <CheckCircle2 size={16} className="ml-auto text-mint-500" />
              </div>
            ))}
            <p className="px-1 text-xs font-semibold text-slate-400">Ask your daycare to add more authorized pickups.</p>
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-extrabold text-slate-800"><FileText size={18} className="text-grape-500" /> Documents & forms</h3>
          <div className="space-y-2">
            {[
              { name: 'Enrollment agreement', status: 'Signed', tone: 'bg-mint-400/15 text-mint-500' },
              { name: 'Immunization record', status: 'On file', tone: 'bg-mint-400/15 text-mint-500' },
              { name: 'Summer 2026 form', status: 'Action needed', tone: 'bg-coral-400/15 text-coral-600' },
            ].map((d) => (
              <div key={d.name} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <FileText size={18} className="text-slate-400" />
                <span className="flex-1 text-sm font-bold text-slate-600">{d.name}</span>
                <Pill className={d.tone}>{d.status}</Pill>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Info({ label, value, icon: Icon, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
      <Icon size={20} className={tone} />
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="font-extrabold text-slate-700">{value}</div>
      </div>
    </div>
  )
}
