import { useState } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Lock, Upload, FileText, Loader2, Check, X, AlertTriangle, User, Building2,
} from 'lucide-react'

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] font-semibold text-slate-400">{hint}</span>}
    </label>
  )
}

export default function EmployeeOnboarding({ token }) {
  const info = useQuery(api.onboarding.info, token ? { token } : 'skip')
  const uploadDocument = useAction(api.onboarding.uploadDocument)
  const submit = useAction(api.onboarding.submit)

  const [f, setF] = useState({
    fullName: '', preferredName: '', dob: '', address: '', phone: '', personalEmail: '',
    emergencyName: '', emergencyPhone: '', startDate: '',
    sin: '', institution: '', transit: '', account: '',
  })
  const set = (k) => (e) => { setReview(false); setF((p) => ({ ...p, [k]: e.target.value })) }
  const [docs, setDocs] = useState([]) // {name, storageId} | {name, uploading:true}
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const [review, setReview] = useState(false)

  if (!token || info === null) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-coral-400/15 text-coral-500"><X size={24} /></span>
          <h1 className="text-2xl text-slate-800">This link is no longer active</h1>
          <p className="text-sm font-medium text-slate-500">Ask your employer to send you a fresh onboarding link.</p>
        </div>
      </Shell>
    )
  }
  if (info === undefined) {
    return <Shell><div className="py-10 text-center"><Loader2 className="mx-auto animate-spin text-brand-400" /></div></Shell>
  }
  if (done && info.status !== 'submitted') return <Shell facility={info.facilityName}><p role="status" className="py-8 text-center text-slate-500">Confirming your submitted form…</p></Shell>
  if (done || info.status === 'submitted') {
    return (
      <Shell facility={info.facilityName}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-400/15 text-mint-500"><Check size={30} /></span>
          <h1 className="text-2xl text-slate-800">You're all set! 🎉</h1>
          <p className="max-w-sm text-sm font-medium text-slate-500">
            Thanks — your details were sent securely to {info.facilityName}. Your submitted form is locked. If something needs fixing, ask the owner for a correction link.
          </p>
          <a className="btn-primary mt-4" href={info.portalInviteToken ? `/join?t=${encodeURIComponent(info.portalInviteToken)}` : `/login${info.loginEmail ? `?email=${encodeURIComponent(info.loginEmail)}` : ''}`}>{info.portalInviteToken ? 'Set up your staff dashboard' : 'Sign in to your dashboard'}</a>
          {info.portalInviteToken && <p className="text-xs text-slate-500">Use {info.loginEmail} to create your account, or sign in if you already have one. Your payroll record stays linked to the same educator.</p>}
        </div>
      </Shell>
    )
  }

  const uploadFiles = async (files) => {
    setErr(''); setReview(false)
    if (docs.length + files.length > 10) { setErr('Attach up to 10 documents. Remove a file before adding another.'); return }
    for (const file of files) {
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || !file.size || file.size > 8 * 1024 * 1024) {
        setErr(`${file.name}: use a PDF, JPEG, PNG, WebP or GIF of up to 8 MiB.`); continue
      }
      const placeholder = { name: file.name, uploading: true }
      setDocs((d) => [...d, placeholder])
      try {
        const { storageId } = await uploadDocument({ token, fileName: file.name, mimeType: file.type, bytes: await file.arrayBuffer() })
        setDocs((d) => d.map((x) => x === placeholder ? { name: file.name, kind: 'document', storageId } : x))
      } catch (error) {
        setDocs((d) => d.filter((x) => x !== placeholder))
        setErr(error.message || 'A file failed to upload. Please try again.')
      }
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!f.fullName.trim()) return setErr('Please enter your full legal name.')
    if (!f.personalEmail.trim()) return setErr('Enter the personal email you will use for your staff login.')
    if (!consent) return setErr('Please check the consent box to continue.')
    if (docs.some((d) => d.uploading)) return setErr('Please wait for your files to finish uploading.')
    if (!review) { setReview(true); return }
    setBusy(true)
    try {
      await submit({
        token,
        fullName: f.fullName, preferredName: f.preferredName, dob: f.dob, address: f.address,
        phone: f.phone, personalEmail: f.personalEmail, emergencyName: f.emergencyName,
        emergencyPhone: f.emergencyPhone, startDate: f.startDate,
        sin: f.sin,
        bank: { institution: f.institution, transit: f.transit, account: f.account },
        documents: docs.filter((d) => d.storageId).map((d) => ({ name: d.name, kind: d.kind, storageId: d.storageId })),
        consent,
      })
      setDone(true)
    } catch (e2) {
      setErr(e2.message || 'Something went wrong submitting your info.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell facility={info.facilityName}>
      <div className="mb-5 text-center">
        <p className="pill-mono mx-auto"><ShieldCheck size={12} /> Secure employee onboarding</p>
        <h1 className="mt-3 text-2xl text-brand-700">Welcome{info.inviteName && info.inviteName !== 'New employee' ? `, ${info.inviteName.split(' ')[0]}` : ''} 👋</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {info.facilityName} needs a few details to add you to payroll. It only takes a couple of minutes.
        </p>
      </div>

      {!info.encConfigured && (
        <div className="mb-4 flex gap-2.5 rounded-2xl border border-sunshine-400/40 bg-sunshine-400/10 p-3 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-sunshine-600" />
          <p className="font-medium text-slate-600">Secure storage for your SIN &amp; banking isn't switched on yet. You can fill everything else now, but hold off on those two fields and let your employer know.</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <fieldset disabled={busy} className="space-y-6 disabled:opacity-70">
        <Section icon={User} title="About you">
          <Field label="Full legal name"><input className="input" value={f.fullName} onChange={set('fullName')} placeholder="Jordan Alex Rivera" required /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preferred name"><input className="input" value={f.preferredName} onChange={set('preferredName')} placeholder="Jordan" /></Field>
            <Field label="Date of birth"><input type="date" className="input" value={f.dob} onChange={set('dob')} /></Field>
          </div>
          <Field label="Home address"><input className="input" value={f.address} onChange={set('address')} placeholder="123 Main St, Langley, BC" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone"><input type="tel" className="input" value={f.phone} onChange={set('phone')} placeholder="(604) 555-0199" /></Field>
            <Field label="Personal email for your staff login"><input required type="email" className="input" value={f.personalEmail} onChange={set('personalEmail')} placeholder="you@email.com" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Emergency contact"><input className="input" value={f.emergencyName} onChange={set('emergencyName')} placeholder="Name" /></Field>
            <Field label="Emergency phone"><input type="tel" className="input" value={f.emergencyPhone} onChange={set('emergencyPhone')} placeholder="(604) 555-0123" /></Field>
          </div>
          <Field label="Start date (if known)"><input type="date" className="input" value={f.startDate} onChange={set('startDate')} /></Field>
        </Section>

        <Section icon={Lock} title="Payroll details" secure>
          <Field label="Social Insurance Number (SIN)" hint="9 digits — encrypted, only your employer can view it.">
            <input className="input" inputMode="numeric" value={f.sin} onChange={set('sin')} placeholder="123 456 789" disabled={!info.encConfigured} autoComplete="off" />
          </Field>
          <p className="eyebrow !mb-1">Direct deposit</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Institution"><input className="input" inputMode="numeric" value={f.institution} onChange={set('institution')} placeholder="001" disabled={!info.encConfigured} /></Field>
            <Field label="Transit"><input className="input" inputMode="numeric" value={f.transit} onChange={set('transit')} placeholder="12345" disabled={!info.encConfigured} /></Field>
            <Field label="Account"><input className="input" inputMode="numeric" value={f.account} onChange={set('account')} placeholder="1234567" disabled={!info.encConfigured} /></Field>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400"><Lock size={11} /> These two are encrypted before they're stored and never shown to anyone but your employer.</p>
        </Section>

        <Section icon={FileText} title="Documents">
          <p className="text-sm font-medium text-slate-500">Upload a void cheque, ID/work permit, and any signed forms your employer asked for. Up to 10 PDF or image files, 8 MiB each.</p>
          {info.fileUploadsConfigured === false && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Secure document storage is not enabled yet. Ask the owner to enable it before uploading employment documents. You can submit the contact fields without files.</p>}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-5 text-sm font-bold text-slate-500 transition hover:border-brand-300 hover:text-brand-600">
            <Upload size={18} /> Choose files
            <input type="file" disabled={info.fileUploadsConfigured === false} multiple accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { uploadFiles([...e.target.files]); e.target.value = '' }} />
          </label>
          {docs.length > 0 && (
            <ul className="space-y-1.5">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                  <FileText size={15} className="text-brand-500" />
                  <span className="truncate">{d.name}</span>
                  <span className="ml-auto">{d.uploading ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <button type="button" aria-label={`Remove ${d.name}`} onClick={() => { setDocs(current => current.filter((_, index) => index !== i)); setReview(false) }} className="rounded p-1 text-slate-500 hover:text-coral-600"><X size={16} /></button>}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <label className="flex items-start gap-2.5 rounded-2xl bg-slate-50 p-3.5 text-sm font-medium text-slate-600">
          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setReview(false) }} className="mt-0.5 h-4 w-4 accent-brand-600" />
          <span>I confirm this information is accurate and I consent to {info.facilityName} collecting and storing it for employment &amp; payroll purposes.</span>
        </label>

        {review && <div role="status" className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-slate-600">
          <p className="font-bold text-brand-700">Review before submitting</p>
          <p className="mt-2">{f.fullName} · {f.personalEmail}</p>
          <p>{docs.length} document{docs.length === 1 ? '' : 's'} attached. Payroll fields are hidden for privacy.</p>
          <p className="mt-2">Check your details above. Once submitted, only the owner can issue a correction link.</p>
          <button type="button" onClick={() => setReview(false)} className="mt-2 font-bold text-brand-600">Keep editing</button>
        </div>}
        {err && <p role="alert" className="rounded-xl bg-coral-400/10 px-3 py-2 text-sm font-bold text-coral-600">{err}</p>}

        <button type="submit" disabled={busy || docs.some(d => d.uploading)} className="btn-primary w-full py-3 text-base disabled:opacity-50">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} {review ? 'Confirm and submit securely' : 'Review your details'}
        </button>
        <p className="text-center text-[11px] font-semibold text-slate-400">🔒 Sent over an encrypted connection to {info.facilityName} on Mitten. This form is not saved on this device. Keep this tab open until you submit.</p>
        </fieldset>
      </form>
    </Shell>
  )
}

function Section({ icon: Icon, title, secure, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${secure ? 'bg-grape-500/15 text-grape-600' : 'bg-brand-50 text-brand-600'}`}><Icon size={16} /></span>
        <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
        {secure && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-grape-500/10 px-2 py-0.5 text-[10px] font-bold text-grape-600"><Lock size={10} /> Encrypted</span>}
      </div>
      {children}
    </div>
  )
}

function Shell({ children, facility }) {
  return (
    <div className="aurora min-h-screen px-5 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-5 flex items-center justify-center gap-2">
          <img src="/brand/mitten-mark.svg" alt="Mitten" className="h-8 w-8" />
          {facility ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500"><Building2 size={14} /> {facility} · powered by Mitten</span>
          ) : (
            <span className="font-display text-xl text-brand-700">Mitten</span>
          )}
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="card p-6 sm:p-8">
          {children}
        </motion.div>
      </div>
    </div>
  )
}
