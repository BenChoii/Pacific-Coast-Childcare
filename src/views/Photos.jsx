import { useEffect, useRef, useState } from 'react'
import { useQuery } from 'convex/react'
import { motion } from 'framer-motion'
import { Heart, Download, Camera, Users, Baby, Loader2, X, ImagePlus, RefreshCw, Expand } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { useProtectedMedia } from '../lib/useProtectedMedia.js'
import { SectionHeader, Card, KnitEmpty } from '../components/ui.jsx'

const PAGE_SIZE = 50
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default function Photos({ canPost = false }) {
  const { photos: initialPhotos, likePhoto, postPhoto, childrenList, pushToast, viewer, facility } = useApp()
  const scope = `${viewer?.id || 'demo'}:${facility?.id || ''}`
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const live = !!viewer?.id && !facility?.isDemo
  const [archive, setArchive] = useState({ scope, records: [], before: undefined })
  const previous = archive.scope === scope ? archive.records : []
  const before = archive.scope === scope ? archive.before : undefined
  const page = useQuery(api.photos.list, live ? { limit: PAGE_SIZE, ...(before ? { before } : {}) } : 'skip')
  const rows = live ? [...new Map([...previous, ...(page || [])].map(row => [row.id, row])).values()] : initialPhotos
  const cached = new Map(initialPhotos.map(photo => [photo.imageId, photo.imageUrl]))
  const protectedRows = useProtectedMedia(rows.map(photo => photo.imageId && cached.get(photo.imageId) ? { ...photo, imageUrl: cached.get(photo.imageId) } : photo))
  const [reactions, setReactions] = useState({ scope, values: {} })
  const reactionValues = reactions.scope === scope ? reactions.values : {}
  const photos = protectedRows.map(photo => reactionValues[photo.id] === undefined ? photo : {
    ...photo, liked: reactionValues[photo.id], likes: Math.max(0, photo.likes + Number(reactionValues[photo.id]) - Number(!!photo.liked)),
  })
  const loading = live && page === undefined
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
  const [audience, setAudience] = useState('all')
  const [childId, setChildId] = useState('')
  const [room, setRoom] = useState('')
  const [error, setError] = useState('')
  const [liking, setLiking] = useState([])
  const likeRequests = useRef(new Set())
  const [selectedId, setSelectedId] = useState(null)
  const classRooms = [...new Set(childrenList.map(c => c.room?.trim()).filter(name => name && name !== 'Unassigned' && name !== 'All rooms'))].sort()
  const cameraRef = useRef(null)
  const libraryRef = useRef(null)
  const selected = photos.find(photo => photo.id === selectedId)

  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => { if (selectedId && !selected) setSelectedId(null) }, [selectedId, selected])

  const pickFile = event => {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next) return
    if (!IMAGE_TYPES.includes(next.type) || next.size > 20 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, WebP or GIF image smaller than 20 MB. Your current draft has been kept.')
      return
    }
    setFile(next)
    setError('')
  }
  const reset = () => {
    setFile(null); setCaption(''); setAudience('all'); setChildId(''); setRoom(''); setOpen(false); setError('')
  }
  const submit = async () => {
    if (busy) return
    if (!file) { setError('Choose a photo first.'); return }
    if (audience === 'family' && !childId) { setError('Pick which child this is for.'); return }
    if (audience === 'all' && !classRooms.includes(room)) { setError('Choose the class to share this photo with.'); return }
    const child = childrenList.find(c => c.id === childId)
    if (audience === 'family' && !child) { setError('That child is no longer in the active roster.'); return }
    setBusy(true); setError('')
    try {
      await postPhoto({ file, caption: caption.trim(), audience, room: audience === 'family' ? child.room : room,
        childId: audience === 'family' ? childId : undefined, childName: audience === 'family' ? child.name : undefined })
      pushToast(audience === 'family' ? `Shared with ${child.first || 'the'} family 📸` : `Shared with ${room} families 📸`, { emoji: '📸', tone: 'grape' })
      setArchive({ scope, records: [], before: undefined })
      reset()
    } catch {
      setError('The photo could not be shared. Your photo, caption and audience are still here. Please try again.')
    } finally { setBusy(false) }
  }
  const react = async photo => {
    if (likeRequests.current.has(photo.id)) return
    likeRequests.current.add(photo.id); setLiking(ids => [...ids, photo.id]); setError('')
    const requestScope = scope
    try {
      const result = await likePhoto(photo.id)
      if (scopeRef.current === requestScope) setReactions(current => ({ scope, values: { ...(current.scope === scope ? current.values : {}), [photo.id]: result?.liked ?? !photo.liked } }))
    } catch {
      if (scopeRef.current === requestScope) setError('Your reaction could not be saved. Please try again.')
    } finally {
      likeRequests.current.delete(photo.id)
      setLiking(ids => ids.filter(id => id !== photo.id))
    }
  }
  const loadEarlier = () => {
    const last = page?.[page.length - 1]
    if (last?._creationTime) setArchive({ scope, records: rows, before: last._creationTime })
  }

  return <div className="space-y-5">
    <SectionHeader title={canPost ? 'Share moments 📸' : 'Photo feed 📸'}
      subtitle={canPost ? 'Share with one family or an enrolled classroom' : 'Moments shared with your family and your child’s class'}
      action={canPost ? <button disabled={busy} onClick={() => setOpen(value => !value)} className="btn-grape"><Camera size={18} />{open ? 'Hide photo draft' : 'Post photo'}</button> : null} />
    {error && <p role="alert" className="rounded-2xl bg-coral-50 p-4 text-sm text-coral-700">{error}</p>}
    {canPost && open && <Card className="space-y-4">
      <input aria-label="Take a photo" ref={cameraRef} type="file" accept={IMAGE_TYPES.join(',')} capture="environment" onChange={pickFile} disabled={busy} className="hidden" />
      <input aria-label="Choose a photo" ref={libraryRef} type="file" accept={IMAGE_TYPES.join(',')} onChange={pickFile} disabled={busy} className="hidden" />
      {preview ? <div className="relative overflow-hidden rounded-3xl bg-slate-50">
        <img src={preview} alt="Selected photo, shown in full before sharing" className="max-h-80 w-full object-contain" />
        <button disabled={busy} aria-label="Remove selected photo" onClick={() => setFile(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-3 text-white"><X size={18} /></button>
      </div> : <div className="grid grid-cols-2 gap-3">
        <button disabled={busy} onClick={() => cameraRef.current?.click()} className="flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-3xl bg-brand-600 text-white"><Camera size={28} /><span className="text-sm font-bold">Take photo</span></button>
        <button disabled={busy} onClick={() => libraryRef.current?.click()} className="flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 bg-white text-slate-500"><ImagePlus size={28} /><span className="text-sm font-bold">Choose photo</span></button>
      </div>}
      <label className="block text-sm font-bold text-slate-600">Caption and description
        <textarea rows={2} maxLength={5000} disabled={busy} className="input mt-1" placeholder="Describe the moment for families…" value={caption} onChange={event => setCaption(event.target.value)} />
      </label>
      <fieldset disabled={busy}><legend className="mb-2 text-sm font-bold text-slate-600">Who can see this?</legend>
        <div className="grid grid-cols-2 gap-2">
          <button aria-pressed={audience === 'all'} onClick={() => setAudience('all')} className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left ${audience === 'all' ? 'border-brand-400 bg-brand-50' : 'border-line bg-white'}`}><Users size={18} className="shrink-0 text-brand-600" /><span><strong className="block text-sm">Whole class</strong><span className="text-xs text-slate-500">Families in one classroom</span></span></button>
          <button aria-pressed={audience === 'family'} onClick={() => setAudience('family')} className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left ${audience === 'family' ? 'border-brand-400 bg-brand-50' : 'border-line bg-white'}`}><Baby size={18} className="shrink-0 text-blush-500" /><span><strong className="block text-sm">One child</strong><span className="text-xs text-slate-500">Only that child’s guardians</span></span></button>
        </div>
        {audience === 'all' ? <label className="mt-3 block text-sm font-semibold text-slate-600">Share with this class
          <select className="input mt-2" value={room} onChange={event => setRoom(event.target.value)} required><option value="">Select class…</option>{classRooms.map(name => <option key={name}>{name}</option>)}</select>
          {!classRooms.length && <span className="mt-2 block text-xs text-slate-500">Assign an enrolled child to a class first, or share with one family.</span>}
        </label> : <label className="mt-3 block text-sm font-semibold text-slate-600">Child receiving this photo
          <select className="input mt-2" value={childId} onChange={event => setChildId(event.target.value)}><option value="">Select child…</option>{childrenList.map(child => <option key={child.id} value={child.id}>{child.name} · {child.room || 'No class assigned'}</option>)}</select>
        </label>}
      </fieldset>
      <div className="flex gap-2"><button disabled={busy} onClick={reset} className="btn-ghost flex-1">Discard draft</button><button onClick={submit} disabled={busy || !file || (audience === 'all' ? !classRooms.includes(room) : !childId)} className="btn-primary flex-1">{busy ? <><Loader2 size={18} className="animate-spin" />Sharing…</> : <><Camera size={16} />Share photo</>}</button></div>
    </Card>}
    {loading && !photos.length ? <p role="status" className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading shared photos…</p> : !photos.length ? <KnitEmpty image="/cinema/spots/camera.webp" title="No moments shared yet" hint={canPost ? 'Share the first photo with a classroom or family.' : 'Photos appear here when an educator shares them with your child’s class or family.'} /> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {photos.map((photo, index) => <motion.figure key={photo.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 10) * 0.03 }} className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
        <div className="relative bg-slate-50">
          {photo.imageUrl ? <button aria-label={`View full photo: ${photo.caption || 'Classroom moment'}`} onClick={() => setSelectedId(photo.id)} className="block w-full"><img loading="lazy" decoding="async" src={photo.imageUrl} alt={photo.caption || 'A moment shared by your daycare'} className="aspect-square w-full object-cover" /><span className="absolute bottom-2 right-2 rounded-full bg-black/55 p-2 text-white"><Expand size={16} /></span></button>
            : photo.imageLoading ? <div role="status" aria-label="Loading photo" className="flex aspect-square items-center justify-center"><Loader2 size={28} className="animate-spin text-brand-500" /></div>
            : photo.imageError || photo.imageId ? <div className="flex aspect-square flex-col items-center justify-center gap-2 p-3 text-center"><p className="text-sm text-slate-500">Photo could not load.</p><button className="btn-ghost !px-3 !py-2" onClick={() => photo.retryImage?.()}><RefreshCw size={15} />Retry photo</button></div>
            : <div aria-label="Illustrated sample photo" className={`flex aspect-square items-center justify-center bg-gradient-to-br ${photo.gradient} text-5xl`}>{photo.emoji}</div>}
          {canPost && photo.audience === 'family' && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-blush-500/95 px-2 py-1 text-[10px] font-bold text-white"><Baby size={11} />{photo.childName?.split(' ')[0] || 'Family only'}</span>}
        </div>
        <figcaption className="space-y-2 p-3"><p className="break-words text-sm font-semibold text-slate-700">{photo.caption || 'Classroom moment'}</p><time dateTime={photo.createdAt ? new Date(photo.createdAt).toISOString() : undefined} className="block text-xs text-slate-500">{photo.createdAt ? new Date(photo.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : photo.time}</time><div className="flex flex-wrap items-center justify-between gap-2"><button disabled={liking.includes(photo.id)} aria-pressed={!!photo.liked} aria-label={`${photo.liked ? 'Remove' : 'Add'} reaction to ${photo.caption || 'this photo'}`} onClick={() => react(photo)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-slate-600">{liking.includes(photo.id) ? <Loader2 size={17} className="animate-spin" /> : <Heart size={18} className={photo.liked ? 'fill-coral-500 text-coral-500' : ''} />}<span className="text-xs font-bold">{photo.likes}</span></button>{photo.imageUrl && <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => setSelectedId(photo.id)}>View full photo</button>}</div></figcaption>
      </motion.figure>)}
    </div>}
    {live && <div className="flex flex-wrap items-center gap-3"><p role="status" className="text-sm text-slate-500">{loading ? 'Loading earlier photos…' : `${photos.length} loaded photos`}</p>{page?.length === PAGE_SIZE && <button disabled={loading} onClick={loadEarlier} className="btn-ghost">Load earlier photos</button>}</div>}
    {selected && <PhotoViewer photo={selected} onClose={() => setSelectedId(null)} />}
  </div>
}

function PhotoViewer({ photo, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector('button')?.focus()
    const key = event => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const controls = [...(ref.current?.querySelectorAll('button, a[href]') || [])]
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus?.() }
  }, [])
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/85 p-3 sm:p-6" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby="photo-viewer-title" className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line p-4"><h2 id="photo-viewer-title" className="min-w-0 truncate text-lg">{photo.caption || 'Shared classroom photo'}</h2><button aria-label="Close full photo" onClick={onClose} className="btn-ghost !p-3"><X size={20} /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3">{photo.imageUrl ? <img src={photo.imageUrl} alt={photo.caption || 'A moment shared by your daycare'} className="mx-auto max-h-[65dvh] max-w-full object-contain" /> : <p role="status" className="p-6 text-center text-sm text-slate-500">Photo is loading or no longer available.</p>}</div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line p-4"><p className="max-h-24 min-w-0 flex-1 overflow-y-auto break-words text-sm text-slate-600">{photo.caption}</p>{photo.imageUrl && <a href={photo.imageUrl} download={`daycare-photo-${photo.id}`} className="btn-ghost"><Download size={16} />Save photo</a>}</footer>
    </section>
  </div>
}
