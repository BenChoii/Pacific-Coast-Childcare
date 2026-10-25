import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useProtectedMedia } from '../lib/useProtectedMedia.js'
import { motion } from 'framer-motion'
import {
  Footprints, MessageCircle, Smile, Brain, Sparkles, Award, Plus, Trash2, Check,
  BookHeart, Camera, Loader2,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, Card, Pill, Avatar, KnitEmpty, YarnConfetti } from '../components/ui.jsx'

export const DOMAINS = [
  { id: 'Motor', label: 'Motor', icon: Footprints, soft: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500',
    suggestions: ['Walks up stairs', 'Runs confidently', 'Hops on one foot', 'Builds a tower of 6 blocks', 'Holds a crayon with fingers', 'Uses scissors', 'Catches a ball'] },
  { id: 'Language', label: 'Language', icon: MessageCircle, soft: 'bg-grape-400/15 text-grape-600', dot: 'bg-grape-500',
    suggestions: ['Says 2-word phrases', 'Names familiar objects', 'Follows 2-step directions', 'Tells a short story', 'Asks “why” questions', 'Recognizes letters', 'Knows 10+ words'] },
  { id: 'Social', label: 'Social-Emotional', icon: Smile, soft: 'bg-blush-300/25 text-blush-600', dot: 'bg-blush-500',
    suggestions: ['Plays alongside peers', 'Takes turns', 'Shows empathy', 'Separates calmly at drop-off', 'Expresses feelings in words', 'Makes a friend'] },
  { id: 'Cognitive', label: 'Cognitive', icon: Brain, soft: 'bg-mint-400/15 text-mint-600', dot: 'bg-mint-500',
    suggestions: ['Sorts by color or shape', 'Counts to 10', 'Completes a puzzle', 'Matches pairs', 'Understands same/different', 'Names colors'] },
  { id: 'Self-help', label: 'Self-help', icon: Sparkles, soft: 'bg-sunshine-400/20 text-amber-600', dot: 'bg-amber-500',
    suggestions: ['Washes hands', 'Feeds self with a spoon', 'Puts on shoes', 'Cleans up toys', 'Drinks from an open cup', 'Toilet trained'] },
]
const domainMeta = (d) => DOMAINS.find((x) => x.id === d) || DOMAINS[0]
const STATUSES = [
  { id: 'Emerging', tone: 'bg-sunshine-400/20 text-amber-600' },
  { id: 'Progressing', tone: 'bg-brand-100 text-brand-700' },
  { id: 'Mastered', tone: 'bg-mint-400/15 text-mint-600' },
]
const statusTone = (s) => (STATUSES.find((x) => x.id === s) || STATUSES[1]).tone

function useRecordPages(endpoint, childId, enabled, extra={}) {
  const [page,setPage] = useState({childId:null,records:[],before:undefined})
  const same = page.childId === childId
  const before = same ? page.before : undefined
  const result = useQuery(endpoint, enabled && childId ? {childId,limit:50,...extra,...(before ? {before} : {})} : 'skip')
  const previous = same ? page.records : []
  const rows = [...new Map([...previous,...(result || [])].map(row=>[row.id,row])).values()]
  return {records:rows,loading:enabled && result===undefined,hasMore:result?.length===50,
    more:()=>{const last=result?.[result.length-1]; if(last?._creationTime) setPage({childId,records:rows,before:last._creationTime})},
    reset:()=>setPage({childId,records:[],before:undefined})}
}
function csvCell(value) {let s=String(value ?? ''); if(/^[=+@-]/.test(s)) s="'"+s; return '"'+s.replaceAll('"','""')+'"'}
function downloadMilestones(child, rows) {
  const csv=[['Child','Date','Domain','Milestone','Status','Note','Educator'],...rows.map(m=>[child.name,m.date,m.domain,m.label,m.status,m.note,m.by])].map(r=>r.map(csvCell).join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); const a=document.createElement('a');a.href=url;a.download='memory-book-milestones.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function printMemories(child,milestones,photos) {
  const page=window.open('','_blank')
  if(!page) return false
  const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const html=`<!doctype html><html><head><title>${escape(child.first)}'s Memory Book</title><style>body{font:16px system-ui;margin:36px;color:#243342}h1{font-family:Georgia,serif}article{break-inside:avoid;border-top:1px solid #ddd;padding:16px 0}small{color:#667}figure{break-inside:avoid;display:inline-block;vertical-align:top;width:42%;margin:12px 3%}img{width:100%;max-height:350px;object-fit:contain}button{padding:12px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><h1>${escape(child.first)}'s journey</h1><p>Loaded memories exported ${escape(new Date().toLocaleDateString())}. ${milestones.length} milestones and ${photos.length} individually attributed photos.</p>${milestones.map(m=>`<article><h2>${escape(m.label)}</h2><p>${escape(m.note)}</p><small>${escape(m.date)} · ${escape(m.domain)} · ${escape(m.status)} · ${escape(m.by)}</small></article>`).join('')}${photos.filter(p=>p.imageUrl).map(p=>`<figure><img src="${escape(p.imageUrl)}" alt="${escape(p.caption)}"><figcaption>${escape(p.caption)}</figcaption></figure>`).join('')}</body></html>`
  page.document.write(html);page.document.close();return true
}

/* ============ Educator / Director: tag milestones ============ */
export function MilestoneTracker() {
  const { childrenList, milestones, addMilestone, removeMilestone, pushToast, facility, viewer } = useApp()
  const [childId, setChildId] = useState('')
  const child = childrenList.find((c) => c.id === childId) || childrenList[0]
  const [domain, setDomain] = useState('Motor')
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState('Progressing')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [justSaved, setJustSaved] = useState(0)
  const [error,setError] = useState('')
  const live=!!viewer?.id && !facility?.isDemo
  const pages=useRecordPages(api.milestones.list,child?.id,live)
  const dm = domainMeta(domain)

  const save = async () => {
    if (!child || !label.trim()) { pushToast('Pick a child and a milestone.', { emoji: '🧩', tone: 'coral' }); return }
    setBusy(true);setError('')
    try {
      await addMilestone({ childId: child.id, domain, label: label.trim(), status, note: note.trim() || undefined })
      pushToast(`Milestone logged for ${child.first} 🌟`, { emoji: '🌟', tone: 'mint' })
      setLabel(''); setNote(''); pages.reset()
      setJustSaved(Date.now())
      setTimeout(() => setJustSaved(0), 2200)
    } catch(err) {setError(err.message || 'The milestone could not be saved. Your draft is still here.')} finally { setBusy(false) }
  }

  const childMilestones = child ? (live ? pages.records : milestones).filter((m) => m.childId === child.id) : []

  if (childrenList.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHeader eyebrow="Development" title="Milestones 🌟" />
        <KnitEmpty
          image="/cinema/spots/cubs.webp"
          title="Waiting on your first little ones"
          hint="Add children in Account → Children, then capture their growth moments here — every milestone lands in their family’s Memory Book."
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Development" title="Milestones 🌟" subtitle="Capture growth moments — families see them in their Memory Book" />

      {/* Child picker */}
      <div className="flex flex-wrap gap-2">
        {childrenList.map((c) => (
          <button key={c.id} disabled={busy} onClick={() => {if ((label.trim() || note.trim()) && c.id !== child?.id && !window.confirm('Discard this unsaved milestone draft and switch children?')) return; setChildId(c.id);setLabel('');setNote('');setError('')}} className={`flex items-center gap-2 rounded-2xl border-2 bg-white p-1.5 pr-4 transition ${c.id === child?.id ? 'border-brand-400 shadow-sm' : 'border-transparent hover:border-slate-200'}`}>
            <Avatar emoji={c.emoji} gradient={c.color} src={c.imageUrl} size="h-9 w-9" />
            <span className="text-sm font-bold text-slate-700">{c.first}</span>
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl bg-coral-50 p-3 text-sm text-coral-700">{error}</p>}
      <Card className="relative space-y-4 overflow-hidden">
        {justSaved > 0 && <YarnConfetti key={justSaved} count={20} />}
        {/* Domain tabs */}
        <div className="flex flex-wrap gap-2">
          {DOMAINS.map((d) => (
            <button key={d.id} onClick={() => { setDomain(d.id); setLabel('') }} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition ${domain === d.id ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}>
              <d.icon size={14} /> {d.label}
            </button>
          ))}
        </div>

        {/* Suggestions */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Quick pick — or type your own below</p>
          <div className="flex flex-wrap gap-2">
            {dm.suggestions.map((s) => (
              <button key={s} onClick={() => setLabel(s)} className={`pill ${label === s ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{s}</button>
            ))}
          </div>
        </div>

        <input className="input" placeholder="Milestone (e.g. Wrote her name for the first time)" value={label} onChange={(e) => setLabel(e.target.value)} />

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Progress</p>
          <div className="flex gap-2">
            {STATUSES.map((s) => (
              <button key={s.id} onClick={() => setStatus(s.id)} className={`flex-1 rounded-2xl border-2 py-2 text-sm font-bold transition ${status === s.id ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-slate-500'}`}>{s.id}</button>
            ))}
          </div>
        </div>

        <textarea rows={2} className="input resize-none" placeholder="Add a note for the family (optional)…" value={note} onChange={(e) => setNote(e.target.value)} />

        <button onClick={save} disabled={busy} className="btn-primary w-full">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={18} /> Log milestone for {child?.first}</>}
        </button>
      </Card>

      {/* Existing milestones for this child */}
      <div>
        <h3 className="mb-2 font-extrabold text-slate-800">{child?.first}'s milestones · {childMilestones.length}</h3>
        {childMilestones.length === 0 ? (
          <Card className="text-center"><p className="text-sm font-semibold text-slate-400">No milestones yet — log the first above 🌱</p></Card>
        ) : (
          <Card className="p-0">
            {childMilestones.map((m, i) => {
              const md = domainMeta(m.domain)
              return (
                <div key={m.id} className={`flex items-start gap-3 p-4 ${i !== childMilestones.length - 1 ? 'border-b border-line' : ''}`}>
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${md.soft}`}><md.icon size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-700">{m.label}</span>
                      <Pill className={statusTone(m.status)}>{m.status}</Pill>
                    </div>
                    {m.note && <p className="text-sm font-semibold text-slate-500">{m.note}</p>}
                    <p className="text-xs font-bold text-slate-400">{m.domain} · {m.date} · {m.by}</p>
                  </div>
                  <button aria-label={`Remove ${m.label}`} disabled={busy} onClick={async()=>{if(!window.confirm(`Remove the milestone “${m.label}”?`)) return;setBusy(true);setError('');try{await removeMilestone(m.id);pages.reset();pushToast('Milestone removed',{emoji:'📝'})}catch(err){setError(err.message || 'Could not remove the milestone.')}finally{setBusy(false)}}} className="rounded-xl p-2 text-slate-300 hover:bg-coral-50 hover:text-coral-500"><Trash2 size={15} /></button>
                </div>
              )
            })}
          </Card>
        )}
      </div>
      {live && <div className="flex flex-wrap items-center gap-3"><p role="status" className="text-sm text-slate-500">{pages.loading ? 'Loading milestones…' : `${childMilestones.length} loaded milestones`}</p>{pages.hasMore && <button disabled={pages.loading} className="btn-ghost" onClick={pages.more}>Load earlier milestones</button>}</div>}
    </div>
  )
}

/* ============ Parent: Memory Book ============ */
export function MemoryBook() {
  const { childrenList, milestones, photos, viewer, facility, pushToast, activeChildId, setActiveChildId } = useApp()
  const mine = childrenList.filter(c => c.parentUserId===viewer?.id || (c.guardianUserIds || []).includes(viewer?.id))
  const kids = mine.length ? mine : childrenList
  const childId = activeChildId || ''
  const setChildId = setActiveChildId
  const child = kids.find((c) => c.id === childId) || kids[0]

  const live=!!viewer?.id && !facility?.isDemo
  const milestonePages=useRecordPages(api.milestones.list,child?.id,live)
  const photoPages=useRecordPages(api.photos.list,child?.id,live,{individualOnly:true})
  const protectedPhotos=useProtectedMedia(photoPages.records.filter(p=>p.childId===child?.id))
  if (!child) {
    return (
      <div className="space-y-5">
        <SectionHeader eyebrow="Keepsake" title="Memory Book 📖" />
        <KnitEmpty
          image="/cinema/spots/memory.webp"
          title="A book waiting for its first page"
          hint="Your child’s memory book appears here once they’re linked to your account."
        />
      </div>
    )
  }

  const childMilestones = (live ? milestonePages.records : milestones).filter((m) => m.childId === child.id)
  const mastered = childMilestones.filter((m) => m.status === 'Mastered').length
  // The keepsake contains only explicitly attributed child photos. Class-wide
  // photos remain in the feed rather than becoming a sibling's individual memory.
  const childPhotos = (live ? protectedPhotos : photos).filter(p => p.childId === child.id)

  return (
    <div className="space-y-6">
      {kids.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {kids.map((c) => (
            <button key={c.id} onClick={() => setChildId(c.id)} className={`pill ${c.id === child.id ? 'bg-brand-500 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>{c.first}</button>
          ))}
        </div>
      )}

      {/* Keepsake hero */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="pt-1">
        <div className="flex items-center gap-4">
          <Avatar emoji={child.emoji} gradient={child.color} src={child.imageUrl} size="h-16 w-16" />
          <div>
            <p className="eyebrow inline-flex items-center gap-1.5"><BookHeart size={13} /> Memory Book</p>
            <h2 className="mt-1 text-3xl leading-tight text-slate-800 sm:text-4xl">{child.first}'s journey</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">{childMilestones.length} milestones · {mastered} mastered · {childPhotos.length} photos</p>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={()=>{if(!printMemories(child,childMilestones,childPhotos))pushToast('Allow the print window to open, then try again.',{tone:'coral'})}}>Print loaded memories</button><button className="btn-ghost" disabled={!childMilestones.length} onClick={()=>downloadMilestones(child,childMilestones)}>Export loaded milestones</button></div>
      {live && <p className="text-xs text-slate-500">This book shows loaded records for {child.first}. Load earlier records below before exporting a longer history. Class photos are available in the photo feed.</p>}
      {/* Milestone timeline */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 font-extrabold text-slate-800"><Award size={18} className="text-grape-500" /> Milestones</h3>
        {childMilestones.length === 0 ? (
          <KnitEmpty
            image="/cinema/spots/memory.webp"
            size="h-28 w-28"
            title={`${child.first}’s story starts here`}
            hint={`Educators add milestones as ${child.first} grows — every one lands in this book, ready to look back on.`}
          />
        ) : (
          <Card>
            <div className="relative pl-2">
              <div className="absolute bottom-2 left-[1.35rem] top-2 w-0.5 bg-slate-100" />
              <div className="space-y-5">
                {childMilestones.map((m, i) => {
                  const md = domainMeta(m.domain)
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative flex gap-4">
                      <span className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white shadow-md ${md.dot}`}><md.icon size={16} /></span>
                      <div className="flex-1 rounded-2xl bg-slate-50 p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-extrabold text-slate-700">{m.label}</span>
                          <Pill className={statusTone(m.status)}>{m.status}</Pill>
                        </div>
                        {m.note && <p className="mt-0.5 text-sm font-semibold text-slate-500">{m.note}</p>}
                        <p className="mt-1 text-xs font-bold text-slate-400">{m.domain} · {m.date} · {m.by}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Photo memories */}
      {childPhotos.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-extrabold text-slate-800"><Camera size={18} className="text-brand-500" /> Photo memories</h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {childPhotos.map((p) => (
              <div key={p.id} className="relative overflow-hidden rounded-2xl shadow-card">
                {p.imageUrl ? <img loading="lazy" src={p.imageUrl} alt={p.caption} className="aspect-square w-full object-cover" />
                  : <div className={`flex aspect-square items-center justify-center bg-gradient-to-br ${p.gradient} text-4xl`}>{p.emoji}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {live && <div className="flex flex-wrap items-center gap-3"><p role="status" className="text-sm text-slate-500">{milestonePages.loading || photoPages.loading ? 'Loading memories…' : 'Loaded records are shown above.'}</p>{milestonePages.hasMore && <button disabled={milestonePages.loading} className="btn-ghost" onClick={milestonePages.more}>Load earlier milestones</button>}{photoPages.hasMore && <button disabled={photoPages.loading} className="btn-ghost" onClick={photoPages.more}>Load earlier photos</button>}</div>}
    </div>
  )
}
