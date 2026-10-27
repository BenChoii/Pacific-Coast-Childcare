import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  Smile, Moon, Apple, Camera, MessageCircle, CalendarDays, CreditCard,
  Clock, ChevronRight, CheckCircle2, ShieldCheck, FileText, Phone, AlertTriangle, Download, Heart, Loader2, Sparkles, Send,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { openInvoicePrint } from '../lib/invoiceDoc.js'
import { StatCard, Card, SectionHeader, Pill, Avatar, ProgressBar, HomeSkeleton, KnitEmpty } from '../components/ui.jsx'
import AvatarUpload from '../components/AvatarUpload.jsx'
import { ParentExtrasCard } from './finance.jsx'
import { CalendarEntry, MonthCalendar, localDateLabel } from './calendar.jsx'
import { ACTIVITY_TYPES } from '../data/mockData.js'
import { dayKey } from '../lib/careData.js'
import { PlanAttachments } from '../components/PlanAttachments.jsx'
import { ClassScheduleNow } from '../components/ClassSchedule.jsx'

// Families only see children linked by the daycare; demo data stays in the demo workspace.
function useMyKids() {
  const { childrenList, viewer, isAuthenticated } = useApp()
  const kids = isAuthenticated
    ? childrenList.filter(c => (c.parentUserId === viewer?.id || c.guardianUserIds?.includes(viewer?.id)) && !c.archivedAt)
    : childrenList
  return { kids, needClaim: false }
}

export { FamilyToday as ParentHome, FamilyDailyLog as ParentTimeline, FamilyProfile as ParentProfile } from './care.jsx'

/* ---------------- Parent Calendar ---------------- */
export function ParentCalendar() {
  const { activeChildId, setActiveChildId, facility, role, viewer, educators = [], childrenList = [] } = useApp()
  const { kids } = useMyKids()
  const team = role === 'staff' || role === 'admin'
  const child = kids.find(c => c.id === activeChildId) || kids[0]
  // Staff use the class calendar without needing to be linked as a guardian.
  // A family without a selected linked child must not query an aggregate view.
  const scope = team ? {} : child ? { childId: child.id } : 'skip'
  const allEvents = useQuery(api.calendar.list, scope)
  const allPlans = useQuery(api.lessons.familyPlans, scope)
  const [roomChoice, setRoomChoice] = useState(null)
  const assignedRoom = role === 'staff' ? educators.find(e => e.userId === viewer?.id)?.room || '' : ''
  const room = team ? roomChoice ?? assignedRoom : child?.room
  const published = allPlans?.filter(plan => plan.status === 'published')
  const matchesRoom = row => !room || !row.room || row.room === room
  const events = allEvents?.filter(matchesRoom)
  const plans = published?.filter(matchesRoom)
  const rooms = [...new Set([
    ...childrenList.filter(c => !c.archivedAt).map(c => c.room),
    ...educators.map(e => e.room),
    ...(published || []).map(p => p.room), ...(allEvents || []).map(e => e.room),
  ].filter(Boolean))].sort()
  const [showPast, setShowPast] = useState(false)
  const today = dayKey(Date.now(),facility?.timezone)
  const visible = (events || []).filter(e => showPast || e.endDate >= today)
  const days = child?.enrollmentDays || child?.attendanceDays
  return <div className="space-y-5">
    <SectionHeader title="Calendar, schedules & learning plans" subtitle={`Dates and class updates from ${facility?.name || 'your daycare'}`} />
    {team ? <label className="block text-sm font-semibold">Class<select className="input mt-1" value={room || ''} onChange={e => setRoomChoice(e.target.value)}><option value="">All classes</option>{rooms.map(name => <option key={name} value={name}>{name}</option>)}</select></label> : kids.length > 1 && <label className="block text-sm font-semibold">Child<select className="input mt-1" value={child?.id || ''} onChange={e => setActiveChildId(e.target.value)}>{kids.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    {!team && !child ? <Card><p className="text-sm text-slate-600">Your daycare will link your child before their calendar and learning plans appear here.</p></Card> : <>
      {!team && <Card className="bg-brand-50/50"><h3 className="text-xl text-slate-800">{child.first}'s schedule</h3><p className="mt-2 text-sm text-slate-600">{Array.isArray(days) ? (days.length ? `Enrolled days: ${days.join(', ')}.` : 'No recurring attendance days are currently selected. Please contact your daycare before attending.') : 'Your daycare can confirm your child’s enrolled days with you.'} Closure dates below override regular attendance. Please do not attend on days marked closed.</p></Card>}
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl text-slate-800">Calendar & closures</h3><label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} />Show past dates</label></div>
      {events && <MonthCalendar key={team ? `class:${room || 'all'}` : child.id} events={events} attendanceDays={team ? undefined : days}/>}
      {events === undefined ? <p className="text-sm text-slate-500">Loading dates…</p> : visible.length ? <div className="grid gap-3">{visible.map(event => <CalendarEntry key={event.id} event={event} />)}</div> : <Card><p className="text-sm text-slate-600">No {showPast ? '' : 'upcoming '}calendar dates have been posted for {team ? room || 'these classes' : 'your child'}.</p></Card>}
      <h3 className="pt-3 text-2xl text-slate-800">Class schedules & learning plans</h3>
      {plans === undefined ? <p className="text-sm text-slate-500">Loading class updates…</p> : plans.length ? plans.map(plan => <FamilyLearningPlan key={plan.id} plan={plan} />) : <Card><p className="text-sm text-slate-600">Your daycare’s daily, weekly and monthly class updates will appear here when published.</p></Card>}
    </>}
  </div>
}

export function FamilyLearningPlan({ plan }) {
  const { facility } = useApp()
  return <Card>
    <div className="mb-2"><Pill className="bg-mint-100 text-mint-700">{plan.period === 'day' ? 'Daily' : plan.period === 'month' ? 'Monthly' : 'Weekly'} {plan.kind === 'schedule' ? 'class schedule' : 'learning plan'}</Pill></div>
    <h3 className="text-2xl text-slate-800">{plan.title}</h3>
    <p className="mt-1 text-sm font-bold text-slate-500">{localDateLabel(plan.startDate)} – {localDateLabel(plan.endDate)} · {plan.room || 'All rooms'}</p>
    {[['This period', plan.overview], ['Activities to look forward to', plan.activities], ['Learning goals', plan.goals]].filter(([, value]) => value).map(([heading, value]) => <div key={heading} className="mt-4"><h4 className="text-sm font-extrabold text-slate-700">{heading}</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{value}</p></div>)}
    {plan.kind === 'schedule' && plan.agenda?.length > 0 && <ClassScheduleNow plans={[plan]} timeZone={facility?.timezone || 'America/Vancouver'} room={plan.room} preview={plan.status === 'draft'} showTimeline />}
    <PlanAttachments attachments={plan.attachments || []} />
  </Card>
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
      if (!facility?.isDemo) { pushToast('Card payments are not available yet. Ask your daycare for their payment instructions.',{tone:'coral'}); return }
      await payInvoice(inv.id)
      pushToast('Sample payment recorded in the demo.', { emoji: '💳', tone: 'mint' })
    } catch {
      pushToast('Could not start checkout. Please try again.', { emoji: '⚠️', tone: 'coral' })
    } finally {
      setPaying(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Tuition & billing 💳" subtitle="Pay, review and download statements" />

      <p className="text-sm text-slate-500">Only invoices addressed to your account appear here. Ask your daycare if the family’s billing contact needs to change.</p>
      <ParentExtrasCard />

      {due.map((inv) => (
        <motion.div
          key={inv.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Amount due · {inv.period}</p>
              <p className="serif-num mt-1 text-4xl text-slate-800">${inv.amount.toLocaleString()}</p>
              <p className="pill pill-due mt-1.5 inline-flex items-center gap-1.5">
                <Clock size={14} /> Due {inv.due}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2">
              <button onClick={() => handlePay(inv)} disabled={paying === inv.id} className="btn-primary">
                {paying === inv.id ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />} Pay by card
              </button>
              {facility?.etransferEmail && (
                <button onClick={() => setEtOpen(etOpen === inv.id ? null : inv.id)} className="btn-ghost">
                  <Send size={16} /> Pay by e-Transfer
                </button>
              )}
              <button onClick={() => openInvoicePrint(inv, facility)} className="btn-ghost">
                <Download size={16} /> Invoice PDF
              </button>
            </div>
          </div>
          {inv.items && (
            <div className="mt-5 space-y-2 border-t border-line pt-4">
              {inv.items.map((it) => (
                <div key={it.label} className="flex items-center justify-between text-sm font-medium text-slate-600">
                  <span>{it.label}</span>
                  <span className="font-semibold text-slate-800">${it.amt}</span>
                </div>
              ))}
            </div>
          )}
          {etOpen === inv.id && facility?.etransferEmail && (
            <div className="mt-5 rounded-2xl border border-line bg-tint p-4 text-sm font-medium text-slate-600">
              <p>Send <b className="font-semibold text-slate-800">${inv.amount.toLocaleString()}</b> by Interac e-Transfer to <b className="font-semibold text-slate-800">{facility.etransferEmail}</b> and put <b className="font-semibold text-slate-800">{inv.id}</b> in the message.</p>
              <button
                onClick={async () => {
                  await markEtransfer({ id: inv.id })
                  setEtOpen(null)
                  pushToast('Thanks! We marked your e-Transfer as sent — your daycare will confirm receipt.', { emoji: '📨', tone: 'mint' })
                }}
                className="btn-primary mt-3"
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
            <div className="font-extrabold text-slate-800">No payable invoices currently recorded</div>
            <div className="text-sm font-semibold text-slate-400">Your daycare confirms any transfers awaiting receipt. Review the recorded history below.</div>
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
