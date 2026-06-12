import { useState } from 'react'
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

/* ============ Educator / Director: tag milestones ============ */
export function MilestoneTracker() {
  const { childrenList, milestones, addMilestone, removeMilestone, pushToast } = useApp()
  const [childId, setChildId] = useState('')
  const child = childrenList.find((c) => c.id === childId) || childrenList[0]
  const [domain, setDomain] = useState('Motor')
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState('Progressing')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [justSaved, setJustSaved] = useState(0)
  const dm = domainMeta(domain)

  const save = async () => {
    if (!child || !label.trim()) { pushToast('Pick a child and a milestone.', { emoji: '🧩', tone: 'coral' }); return }
    setBusy(true)
    try {
      await addMilestone({ childId: child.id, domain, label: label.trim(), status, note: note.trim() || undefined })
      pushToast(`Milestone logged for ${child.first} 🌟`, { emoji: '🌟', tone: 'mint' })
      setLabel(''); setNote('')
      setJustSaved(Date.now())
      setTimeout(() => setJustSaved(0), 2200)
    } finally { setBusy(false) }
  }

  const childMilestones = child ? milestones.filter((m) => m.childId === child.id) : []

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
          <button key={c.id} onClick={() => setChildId(c.id)} className={`flex items-center gap-2 rounded-2xl border-2 bg-white p-1.5 pr-4 transition ${c.id === child?.id ? 'border-brand-400 shadow-sm' : 'border-transparent hover:border-slate-200'}`}>
            <Avatar emoji={c.emoji} gradient={c.color} src={c.imageUrl} size="h-9 w-9" />
            <span className="text-sm font-bold text-slate-700">{c.first}</span>
          </button>
        ))}
      </div>

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
                  <button onClick={() => removeMilestone(m.id)} className="rounded-xl p-2 text-slate-300 hover:bg-coral-50 hover:text-coral-500"><Trash2 size={15} /></button>
                </div>
              )
            })}
          </Card>
        )}
      </div>
    </div>
  )
}

/* ============ Parent: Memory Book ============ */
export function MemoryBook() {
  const { childrenList, milestones, photos, viewer } = useApp()
  const mine = childrenList.filter((c) => c.parentUserId === viewer?.id)
  const kids = mine.length ? mine : childrenList
  const [childId, setChildId] = useState('')
  const child = kids.find((c) => c.id === childId) || kids[0]

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

  const childMilestones = milestones.filter((m) => m.childId === child.id)
  const mastered = childMilestones.filter((m) => m.status === 'Mastered').length
  // Photos the parent can see for this child = class photos + this child's family photos.
  const childPhotos = photos.filter((p) => !p.childId || p.childId === child.id)

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
        className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-blush-300 via-brand-400 to-grape-500 p-6 text-white shadow-playful sm:p-8">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
        <div className="flex items-center gap-4">
          <Avatar emoji={child.emoji} gradient="from-white/30 to-white/10" src={child.imageUrl} size="h-16 w-16" />
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-white/85"><BookHeart size={15} /> Memory Book</p>
            <h2 className="text-2xl font-extrabold sm:text-3xl">{child.first}'s journey</h2>
            <p className="mt-1 text-sm font-semibold text-white/85">{childMilestones.length} milestones · {mastered} mastered · {childPhotos.length} photos</p>
          </div>
        </div>
      </motion.div>

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
                {p.imageUrl ? <img src={p.imageUrl} alt={p.caption} className="aspect-square w-full object-cover" />
                  : <div className={`flex aspect-square items-center justify-center bg-gradient-to-br ${p.gradient} text-4xl`}>{p.emoji}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
