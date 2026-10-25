import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Bell, RotateCcw } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { Card, SectionHeader, Pill } from '../components/ui.jsx'

export default function OwnerActivity() {
  const events = useQuery(api.notifications.list, {})
  const retry = useMutation(api.notifications.retry)
  const [error, setError] = useState('')
  return <div className="space-y-5">
    <SectionHeader eyebrow="Owner notifications" title="Activity & alerts" subtitle="Onboarding, enrolment, account access, messages and family communication changes. Email alerts go to the facility owner’s account email." />
    {error && <p role="alert" className="text-sm text-coral-600">{error}</p>}
    {!events ? <p>Loading activity…</p> : !events.length ? <Card><Bell className="text-brand-500" /><p className="mt-3 text-slate-600">New daycare activity will appear here, with its email delivery status.</p></Card> : events.map(event => <Card key={event._id}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg capitalize">{event.type.replaceAll('_', ' ').replaceAll('.', ' · ')}</h3><Pill className={event.status === 'sent' ? 'bg-mint-100 text-mint-700' : 'bg-amber-100 text-amber-800'}>{event.status === 'sent' ? 'Email sent' : event.status === 'recorded' ? 'Recorded · email preference' : `Email ${event.status}`}</Pill></div>
      <p className="mt-2 text-sm text-slate-700">{event.summary}</p>
      <p className="mt-2 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString('en-CA', { timeZone: 'America/Vancouver' })} Pacific</p>
      {event.error && <p className="mt-2 text-xs text-coral-600">{event.error}</p>}
      {event.status === 'failed' && <button className="btn-ghost mt-3" onClick={async () => { try { await retry({ id: event._id }); setError('') } catch { setError('Could not retry this email. Please try again.') } }}><RotateCcw size={14} />Retry email</button>}
    </Card>)}
  </div>
}
