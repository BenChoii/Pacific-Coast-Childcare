import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Heart, Download, Camera, Users, Baby, Loader2, X, ImagePlus } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, Card } from '../components/ui.jsx'

export default function Photos({ canPost = false }) {
  const { photos, likePhoto, postPhoto, childrenList, pushToast } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
  const [audience, setAudience] = useState('all') // 'all' | 'family'
  const [childId, setChildId] = useState('')
  const cameraRef = useRef(null)
  const libraryRef = useRef(null)

  const pickFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }
  const reset = () => { setFile(null); setPreview(''); setCaption(''); setAudience('all'); setChildId(''); setOpen(false) }

  const submit = async () => {
    if (!file) { pushToast('Choose a photo first.', { emoji: '📷', tone: 'coral' }); return }
    if (audience === 'family' && !childId) { pushToast('Pick which child this is for.', { emoji: '👶', tone: 'coral' }); return }
    setBusy(true)
    try {
      const child = childrenList.find((c) => c.id === childId)
      await postPhoto({
        file,
        caption: caption.trim(),
        audience,
        childId: audience === 'family' ? childId : undefined,
        childName: audience === 'family' ? child?.name : undefined,
      })
      pushToast(audience === 'family' ? `Shared with ${child?.first || 'the'} family 📸` : 'Shared with the whole class 📸', { emoji: '📸', tone: 'grape' })
      reset()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title={canPost ? 'Share moments 📸' : 'Photo feed 📸'}
        subtitle={canPost ? 'Snap & post — choose the whole class or just one family' : 'Sweet moments from your child’s day'}
        action={canPost ? (
          <button onClick={() => setOpen((o) => !o)} className="btn-grape">
            <Camera size={18} /> Post photo
          </button>
        ) : null}
      />

      {/* Composer */}
      {canPost && open && (
        <Card className="space-y-4">
          {/* capture="environment" opens the rear camera directly on phones */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={pickFile} className="hidden" />
          <input ref={libraryRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
          {preview ? (
            <div className="relative overflow-hidden rounded-3xl">
              <img src={preview} alt="preview" className="max-h-72 w-full object-cover" />
              <button onClick={() => { setFile(null); setPreview('') }} className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white"><X size={16} /></button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => cameraRef.current?.click()} className="flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-3xl bg-gradient-to-br from-brand-500 to-grape-500 text-white shadow-md transition hover:-translate-y-0.5">
                <Camera size={28} /> <span className="text-sm font-bold">Take photo</span>
              </button>
              <button onClick={() => libraryRef.current?.click()} className="flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 bg-white text-slate-400 transition hover:border-brand-300 hover:text-brand-500">
                <ImagePlus size={28} /> <span className="text-sm font-bold">Upload photo</span>
              </button>
            </div>
          )}

          <input className="input" placeholder="Add a caption…" value={caption} onChange={(e) => setCaption(e.target.value)} />

          <div>
            <p className="mb-2 text-sm font-extrabold text-slate-600">Who can see this?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAudience('all')} className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left transition ${audience === 'all' ? 'border-brand-400 bg-brand-50' : 'border-line bg-white'}`}>
                <Users size={18} className="text-brand-500" />
                <div><div className="text-sm font-extrabold text-slate-700">Whole class</div><div className="text-[11px] font-semibold text-slate-400">All families see it</div></div>
              </button>
              <button onClick={() => setAudience('family')} className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left transition ${audience === 'family' ? 'border-brand-400 bg-brand-50' : 'border-line bg-white'}`}>
                <Baby size={18} className="text-blush-500" />
                <div><div className="text-sm font-extrabold text-slate-700">One child</div><div className="text-[11px] font-semibold text-slate-400">Only that family</div></div>
              </button>
            </div>
            {audience === 'family' && (
              <select className="input mt-2" value={childId} onChange={(e) => setChildId(e.target.value)}>
                <option value="">Select child…</option>
                {childrenList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="btn-ghost flex-1">Cancel</button>
            <button onClick={submit} disabled={busy} className="btn-primary flex-1">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <><Camera size={16} /> Share</>}
            </button>
          </div>
        </Card>
      )}

      {photos.length === 0 ? (
        <Card className="text-center"><p className="text-sm font-semibold text-slate-400">No photos yet{canPost ? ' — share your first moment above!' : '.'}</p></Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="group relative overflow-hidden rounded-3xl shadow-card"
            >
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.caption} className="aspect-square w-full object-cover" />
              ) : (
                <div className={`flex aspect-square items-center justify-center bg-gradient-to-br ${p.gradient} text-6xl`}>{p.emoji}</div>
              )}
              {/* Audience badge (staff/director only see family-targeted ones) */}
              {canPost && p.audience === 'family' && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-blush-500/90 px-2 py-0.5 text-[10px] font-extrabold text-white backdrop-blur">
                  <Baby size={11} /> {p.childName?.split(' ')[0] || 'Family'}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="text-sm font-extrabold text-white">{p.caption}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white/80">{p.time}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => likePhoto(p.id)} className="flex items-center gap-1 text-white">
                      <Heart size={15} className={p.liked ? 'fill-coral-500 text-coral-500' : ''} />
                      <span className="text-[11px] font-extrabold">{p.likes}</span>
                    </button>
                    {p.imageUrl && <a href={p.imageUrl} target="_blank" rel="noreferrer" className="text-white/90 hover:text-white"><Download size={15} /></a>}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
