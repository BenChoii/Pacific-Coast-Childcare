import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'

// A tappable avatar that uploads a new profile photo. Shows the image if set,
// otherwise an emoji/initials fallback, with a camera overlay on hover.
export default function AvatarUpload({ src, fallback, gradient = 'from-brand-400 to-grape-500', size = 'h-20 w-20', rounded = 'rounded-3xl', onUpload }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const pick = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try { await onUpload(f) } finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className={`group relative inline-flex ${size} items-center justify-center overflow-hidden ${rounded} bg-gradient-to-br ${gradient} text-3xl text-white shadow-md`}
    >
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
      {src ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span>{fallback}</span>}
      <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
        {busy ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
      </span>
    </button>
  )
}
