import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Expand, X } from 'lucide-react'
import { Card } from './ui.jsx'
import { ClassScheduleNow } from './ClassSchedule.jsx'
import { PlanAttachments } from './PlanAttachments.jsx'
import { useProtectedMedia } from '../lib/useProtectedMedia.js'
import { dashboardProgram } from '../lib/familyProgram.js'
import { dayKey } from '../lib/careData.js'

function ProgramPhoto({ attachment, title }) {
  const [photo] = useProtectedMedia([{ imageId: attachment.storageId, imageUrl: null }])
  const [expanded, setExpanded] = useState(false)
  const dialog = useRef(null)
  useEffect(() => {
    if (expanded && photo.imageUrl) dialog.current?.showModal()
    else dialog.current?.close()
  }, [expanded, photo.imageUrl])
  return <div className="min-w-0">
    {photo.imageUrl ? <button type="button" className="group block w-full rounded-2xl border border-line bg-slate-50 p-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500" onClick={() => setExpanded(true)} aria-label={`Open ${title} at full size`}>
      <img src={photo.imageUrl} alt={attachment.name || title} className="max-h-[65vh] w-full rounded-xl object-contain" />
      <span className="mt-2 flex items-center justify-center gap-2 py-2 text-sm font-bold text-brand-700"><Expand size={16} />Tap to read the full program</span>
    </button> : photo.imageError ? <div role="alert" className="rounded-xl bg-coral-50 p-4 text-sm text-coral-800">The program photo could not load.<button type="button" className="btn-ghost ml-2" onClick={photo.retryImage}>Try again</button></div> : <div role="status" className="flex min-h-48 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">Loading your class program photo…</div>}
    <dialog ref={dialog} onCancel={() => setExpanded(false)} onClose={() => setExpanded(false)} className="max-h-[94dvh] w-[96vw] max-w-5xl overflow-y-auto rounded-2xl border-0 bg-white p-3 shadow-2xl backdrop:bg-slate-900/60">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white py-2"><h3 className="break-words text-lg">{title}</h3><button type="button" autoFocus className="btn-ghost min-h-11 min-w-11 shrink-0 !p-2" aria-label="Close full-size program" onClick={() => setExpanded(false)}><X size={20} /></button></div>
      {expanded && photo.imageUrl && <><p className="my-3 text-sm text-slate-500">Pinch to zoom, or open the original for a closer look.</p><img src={photo.imageUrl} alt={attachment.name || title} className="h-auto w-full" /><a href={photo.imageUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-3">Open original photo</a></>}
    </dialog>
  </div>
}

export default function ParentScheduleSpotlight({ child, plans, events = [], timeZone = 'America/Vancouver', onCalendar }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const interval = setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  if (!plans) return <Card><p role="status" className="text-sm text-slate-500">Loading your child’s class program…</p></Card>
  const plan = dashboardProgram(plans, { date: dayKey(now, timeZone), room: child.room })
  const photo = plan?.attachments.find(file => file.mimeType?.startsWith('image/'))
  return <section aria-label="Your child’s class program" className={`grid min-w-0 gap-4 ${plan ? 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}>
    {plan && <Card className="min-w-0 border-brand-100 !p-4 sm:!p-5"><div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="eyebrow">{child.room || 'Your daycare'} · Class program</p><h2 className="mt-1 break-words text-2xl">{plan.title}</h2><p className="mt-1 text-sm text-slate-500">{plan.startDate} – {plan.endDate}</p></div><button type="button" className="btn-ghost !py-2 text-sm" onClick={onCalendar}><CalendarDays size={16} />All plans</button></div>
      {photo ? <ProgramPhoto key={`${child.id}:${photo.storageId}`} attachment={photo} title={plan.title} /> : <PlanAttachments attachments={plan.attachments} />}
      {plan.overview && <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">{plan.overview}</p>}
      {photo && plan.attachments.length > 1 && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-brand-700">More files from this program</summary><PlanAttachments attachments={plan.attachments.filter(file => file.storageId !== photo.storageId)} /></details>}
    </Card>}
    <ClassScheduleNow plans={plans} events={events} timeZone={timeZone} room={child.room || undefined} rooms={[child.room].filter(Boolean)} />
  </section>
}
