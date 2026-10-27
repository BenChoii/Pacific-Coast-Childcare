import { useEffect, useRef, useState } from 'react'
import { useAction } from 'convex/react'
import { useAuthToken } from '@convex-dev/auth/react'
import { Download, FileText, ImagePlus, Loader2, X } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { fileToBase64, usePrivateDownload } from '../lib/files.js'

const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 8 * 1024 * 1024
export function validatePlanFiles(files, existingCount = 0) {
  if (existingCount + files.length > 5) throw new Error('Attach up to five photos or PDF files to one update.')
  for (const file of files) {
    if (!TYPES.includes(file.type)) throw new Error('Choose JPEG, PNG, WebP, GIF or PDF files.')
    if (!file.size || file.size > MAX_BYTES) throw new Error('Each file must be smaller than 8 MB.')
  }
}
const sizeLabel = bytes => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

export function PlanAttachmentEditor({ attachments = [], onChange, disabled = false, onBusyChange }) {
  const upload = useAction(api.files.uploadFile)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const choose = async event => {
    const input = event.currentTarget || event.target
    const files = Array.from(input.files || [])
    if (!files.length || uploading || disabled) return
    setError('')
    try { validatePlanFiles(files, attachments.length) }
    catch (err) { setError(err.message); input.value = ''; return }
    setUploading(true); onBusyChange?.(true)
    const next = [...attachments]
    try {
      // One file at a time keeps large phone uploads within a bounded budget.
      for (const file of files) {
        const result = await upload({ base64: await fileToBase64(file), mimeType: file.type, purpose: 'learning-plan' })
        next.push({ storageId: result.storageId, name: file.name.slice(0, 160), mimeType: file.type, size: file.size })
        if (mounted.current) onChange([...next])
      }
    } catch (err) { if (mounted.current) setError(err.message || 'A file could not upload. Completed files are still attached; choose the remaining file again.') }
    finally {
      input.value = ''
      if (mounted.current) { setUploading(false); onBusyChange?.(false) }
    }
  }
  return <div className="rounded-2xl border border-line p-4">
    <h4 className="font-bold text-slate-800">Photos & PDF files</h4>
    <p className="mt-1 text-sm text-slate-600">Attach a photo of the class schedule or an existing lesson-plan PDF. Up to five files, 8 MB each. Save the draft to preview the files, then publish when ready.</p>
    {attachments.length > 0 && <ul className="mt-3 space-y-2">{attachments.map((file, index) => <li key={file.storageId} className="flex min-w-0 items-center gap-2 rounded-xl bg-tint p-3">
      <FileText size={18} className="shrink-0 text-brand-600" /><span className="min-w-0 flex-1 break-words text-sm">{file.name} <span className="text-slate-500">({sizeLabel(file.size)})</span></span>
      <button type="button" className="btn-ghost !p-2" aria-label={`Remove ${file.name}`} disabled={disabled || uploading} onClick={() => onChange(attachments.filter((_, i) => i !== index))}><X size={16} /></button>
    </li>)}</ul>}
    <label className={`btn-ghost mt-3 inline-flex cursor-pointer ${disabled || uploading || attachments.length >= 5 ? 'pointer-events-none opacity-50' : ''}`}>
      {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}{uploading ? 'Uploading files…' : 'Choose photos or PDFs'}
      <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" multiple disabled={disabled || uploading || attachments.length >= 5} aria-label="Attach schedule photos or learning-plan PDFs" onChange={choose} />
    </label>
    {error && <p role="alert" className="mt-3 text-sm text-coral-700">{error}</p>}
  </div>
}

export function PrivatePlanAttachment({ attachment }) {
  const token = useAuthToken()
  const download = usePrivateDownload()
  const key = `${token || ''}:${attachment.storageId}`
  const request = useRef({ version: 0, controller: null, url: null })
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setPreview(null); setBusy(false); setError('')
    return () => {
      request.current.version += 1; request.current.controller?.abort()
      if (request.current.url) URL.revokeObjectURL(request.current.url)
      request.current.url = null
    }
  }, [key])
  const close = () => {
    request.current.version += 1; request.current.controller?.abort()
    if (request.current.url) URL.revokeObjectURL(request.current.url)
    request.current.url = null; setPreview(null); setBusy(false)
  }
  const open = async () => {
    if (preview?.key === key) { close(); return }
    if (busy) return
    setError('')
    if (!token) { setError('Please sign in again to view this file.'); return }
    const base = import.meta.env.VITE_CONVEX_URL?.replace(/\.cloud\/?$/, '.site')
    if (!base) { setError('File previews are temporarily unavailable.'); return }
    const version = ++request.current.version
    request.current.controller?.abort(); const controller = new AbortController(); request.current.controller = controller
    setBusy(true)
    try {
      const response = await fetch(`${base}/files/private?storageId=${encodeURIComponent(attachment.storageId)}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      if (!response.ok) throw new Error('This file is unavailable or your access has changed. Please contact your daycare.')
      const blob = await response.blob()
      if (!TYPES.includes(blob.type)) throw new Error('This file cannot be previewed. Try downloading it.')
      const url = URL.createObjectURL(blob)
      if (request.current.version !== version) { URL.revokeObjectURL(url); return }
      if (request.current.url) URL.revokeObjectURL(request.current.url)
      request.current.url = url; setPreview({ key, url, mimeType: blob.type })
    } catch (err) { if (request.current.version === version && !controller.signal.aborted) setError(err.message || 'Could not load this file. Please try again.') }
    finally { if (request.current.version === version) setBusy(false) }
  }
  const save = async () => {
    setDownloading(true); setError('')
    try { await download(attachment.storageId, attachment.name) }
    catch (err) { setError(err.message || 'Could not download this file. Please try again.') }
    finally { setDownloading(false) }
  }
  const visible = preview?.key === key ? preview : null
  return <div className="min-w-0 rounded-2xl border border-line bg-white p-4">
    <p className="break-words font-semibold text-slate-800">{attachment.name}</p>
    <p className="mt-1 text-xs text-slate-500">{attachment.mimeType === 'application/pdf' ? 'PDF' : 'Photo'} · {sizeLabel(attachment.size)}</p>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-ghost !py-2" disabled={busy} onClick={open}>{busy ? 'Loading preview…' : visible ? 'Close preview' : 'Preview file'}</button><button type="button" className="btn-ghost !py-2" disabled={downloading} onClick={save}>{downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}{downloading ? 'Downloading…' : 'Download file'}</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-coral-700">{error}</p>}
    {visible && <div className="mt-4">
      {visible.mimeType.startsWith('image/') ? <img src={visible.url} alt={attachment.name} className="max-h-[70vh] w-full rounded-xl object-contain" /> : <><iframe src={visible.url} title={`Preview ${attachment.name}`} className="h-[60vh] min-h-80 w-full rounded-xl border border-line" /><p className="mt-2 text-sm text-slate-500">If your phone cannot show the PDF here, use Download file.</p></>}
    </div>}
  </div>
}

export function PlanAttachments({ attachments = [] }) {
  if (!attachments.length) return null
  return <section className="mt-5" aria-label="Schedule and learning-plan files"><h4 className="mb-3 font-bold text-slate-800">Files from your daycare</h4><div className="space-y-3">{attachments.map(file => <PrivatePlanAttachment key={file.storageId} attachment={file} />)}</div></section>
}
