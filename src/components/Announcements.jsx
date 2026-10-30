import { useEffect, useState } from 'react'
import { useMutation } from 'convex/react'
import { Megaphone, Send, Trash2, Loader2 } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { Card } from './ui.jsx'

const AUDIENCES = [['everyone', 'Everyone (families and educators)'], ['families', 'Families only'], ['staff', 'Educators only']]
const audienceLabel = value => value === 'families' ? 'Families' : value === 'staff' ? 'Educators' : 'Everyone'
const when = at => new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const errorText = (error, fallback) => typeof error?.data === 'string' ? error.data : fallback

function Composer() {
  const post = useMutation(api.announcements.post)
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [audience, setAudience] = useState('everyone'), [email, setEmail] = useState(true)
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('')
  const submit = async e => {
    e.preventDefault()
    if (busy || !title.trim() || !body.trim()) return
    setBusy(true); setError(''); setStatus('')
    try {
      const result = await post({ title: title.trim(), body: body.trim(), audience, email })
      setTitle(''); setBody('')
      setStatus(email ? `Posted. ${result.queued} email cop${result.queued === 1 ? 'y' : 'ies'} on the way.` : 'Posted in the app.')
    } catch (err) { setError(errorText(err, 'The announcement was not posted. Your text is still here; please retry.')) }
    finally { setBusy(false) }
  }
  return <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border border-line bg-white p-4">
    <label className="block text-sm font-bold">Title<input className="input mt-1" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Pajama day this Friday"/></label>
    <label className="block text-sm font-bold">Announcement<textarea className="input mt-1 min-h-28" maxLength={5000} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your update for families and educators…"/></label>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-bold">Send to<select className="input mt-1" value={audience} onChange={e => setAudience(e.target.value)}>{AUDIENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)}/>Also email a copy</label>
      <button type="submit" className="btn-primary ml-auto" disabled={busy || !title.trim() || !body.trim()}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}Post announcement</button>
    </div>
    {status && <p role="status" className="text-sm text-mint-600">{status}</p>}
    {error && <p role="alert" className="text-sm text-coral-600">{error}</p>}
  </form>
}

export default function Announcements() {
  const { announcements } = useApp()
  const markSeen = useMutation(api.announcements.markSeen)
  const remove = useMutation(api.announcements.remove)
  const [error, setError] = useState('')
  const unread = announcements?.unread || 0
  // Viewing the list clears the "new" count; the highlight stays until the next visit.
  useEffect(() => { if (unread > 0) markSeen({}).catch(() => {}) }, [unread, markSeen])
  if (!announcements || (!announcements.canPost && !announcements.items.length)) return null
  const del = async id => {
    if (!window.confirm('Delete this announcement for everyone?')) return
    setError('')
    try { await remove({ id }) } catch (err) { setError(errorText(err, 'Could not delete. Please retry.')) }
  }
  return <Card>
    <h2 className="flex items-center gap-2 text-xl"><Megaphone size={20}/>Announcements</h2>
    <p className="text-sm text-slate-500">{announcements.canPost ? 'Post one update to all families and educators at once.' : 'Updates from your daycare for everyone.'}</p>
    {announcements.canPost && <Composer/>}
    {error && <p role="alert" className="mt-3 text-sm text-coral-600">{error}</p>}
    <div className="mt-4 space-y-3">{announcements.items.map(item => <article key={item.id} className={`rounded-2xl p-4 ${item.isNew ? 'bg-brand-50' : 'bg-slate-50'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-words text-base font-bold">{item.isNew && <span className="mr-2 rounded-full bg-coral-500 px-2 py-0.5 text-xs text-white">New</span>}{item.title}</h3>
        {announcements.canPost && <button className="btn-ghost !min-h-9 !px-3" aria-label={`Delete ${item.title}`} onClick={() => del(item.id)}><Trash2 size={15}/></button>}</div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{item.body}</p>
      <p className="mt-2 text-xs text-slate-500">{item.authorName ? item.authorName + ' · ' : ''}{when(item.createdAt)}{announcements.canPost ? ` · ${audienceLabel(item.audience)}${item.emailed ? ' · emailed' : ''}` : ''}</p>
    </article>)}{!announcements.items.length && <p className="text-sm text-slate-500">No announcements yet.</p>}</div>
  </Card>
}

// Dashboard nudge for families and educators: newest unread announcement only.
export function AnnouncementBanner() {
  const { announcements, setView } = useApp()
  const latest = announcements?.items?.find(item => item.isNew)
  if (!latest) return null
  return <Card className="border-brand-100 bg-brand-50/40">
    <h3 className="flex items-center gap-2 text-lg"><Megaphone size={18}/>{latest.title}</h3>
    <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-700">{latest.body}</p>
    <button className="btn-ghost mt-3" onClick={() => setView('messages')}>{announcements.unread > 1 ? `See all ${announcements.unread} new announcements` : 'Open announcements'}</button>
  </Card>
}
