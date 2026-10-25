import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { dayKey } from '../lib/careData.js'
import {
  ScanLine, Camera, Upload, PenLine, Loader2, Sparkles, ArrowLeft, Check, Copy,
  Link2, AlertTriangle, Baby, UserRound, Phone, ShieldAlert,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { SectionHeader, Card } from '../components/ui.jsx'

const ROOMS = ['Infants', 'Toddlers', 'Preschool', 'Pre-K', 'Main Room']
const COLORS = ['from-brand-400 to-brand-600', 'from-blush-300 to-blush-500', 'from-mint-400 to-mint-500', 'from-grape-400 to-grape-600', 'from-sky-400 to-brand-500']
const EMOJIS = ['🐬', '🦋', '🦁', '🐢', '🐝', '🌸', '🚀', '🐙', '🦊', '🐼']

const BLANK = {
  childFirst: '', childLast: '', childAge: '', childDob: '',
  parentName: '', parentEmail: '', parentPhone: '',
  emergencyName: '', emergencyPhone: '', allergies: '', notes: '',
}

// Paper intake form → enrolled child + a child-linked parent invite.
// Photo/camera → AI OCR pre-fills the review form; manual entry is one tap away.
// A human always reviews before anything is created.
export function IntakeDesk() {
  const { uploadImage, scanIntake, enrollChild, generateInvite, childrenList, pushToast, isAuthenticated, role, facility, setView } = useApp()
  const updateProfile = useMutation(api.children.updateProfile)
  const [step, setStep] = useState('capture') // capture | scanning | review | done
  const [fields, setFields] = useState(BLANK)
  const [scanError, setScanError] = useState('')
  const [room, setRoom] = useState('Preschool')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { childName, link, parentName }
  const [copied, setCopied] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [createdChildId, setCreatedChildId] = useState(null)
  const cameraRef = useRef(null)
  const uploadRef = useRef(null)

  const set = (k) => (e) => setFields((p) => ({ ...p, [k]: e.target.value }))

  const onPhoto = async (file) => {
    if (!file) return
    setScanError('')
    setStep('scanning')
    try {
      const storageId = await uploadImage(file, 'intake')
      const res = await scanIntake(storageId)
      if (res?.fields) {
        setFields({ ...BLANK, ...res.fields })
        setStep('review')
        pushToast('Form read! Double-check every field before enrolling.', { emoji: '🔍', tone: 'brand' })
      } else {
        setScanError(res?.error || (res?.configured === false ? 'AI isn’t connected yet — type the form in manually.' : 'Scan failed — try again or type it in.'))
        setStep('capture')
      }
    } catch {
      setScanError('Upload failed — check your connection and try again.')
      setStep('capture')
    }
  }

  const enroll = async () => {
    if (busy) return
    const first = fields.childFirst.trim(), email = fields.parentEmail.trim().toLowerCase()
    setSaveError('')
    if (!first) { setSaveError('Enter the child’s first name.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setSaveError('Enter the parent email that should receive this child’s invitation.'); return }
    if ((fields.emergencyName.trim() && !fields.emergencyPhone.trim()) || (fields.emergencyPhone.trim() && !fields.emergencyName.trim())) { setSaveError('Enter both the emergency contact name and phone, or leave both empty.'); return }
    if (fields.parentPhone.trim() && !fields.parentName.trim()) { setSaveError('Add the parent’s name with their phone number.'); return }
    if (fields.childDob && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.childDob) || Number.isNaN(Date.parse(fields.childDob)) || new Date(fields.childDob).toISOString().slice(0,10) !== fields.childDob)) { setSaveError('Check the child’s date of birth.'); return }
    if (fields.childDob && fields.childDob > dayKey(Date.now(), facility?.timezone || 'America/Vancouver')) { setSaveError('The child’s date of birth cannot be in the future.'); return }
    let childId = createdChildId
    setBusy(true)
    try {
      const i = childrenList.length, allergies = fields.allergies.split(',').map(value => value.trim()).filter(Boolean)
      if (!childId) {
        const res = await enrollChild({ first, name: `${first} ${fields.childLast.trim()}`.trim(), age: fields.childAge.trim() || (fields.childDob ? `b. ${fields.childDob}` : 'Not provided'), room, emoji: EMOJIS[i % EMOJIS.length], color: COLORS[i % COLORS.length], parent: fields.parentName.trim() || 'Parent', allergies })
        if (res?.redirecting) return
        if (!(res?.ok || res?.billingSkipped) || !res.childId) throw new Error('The enrolment did not return a child record. Check Children before trying a new intake.')
        childId = res.childId
        setCreatedChildId(childId)
      }
      const emergencyContacts = []
      if (fields.parentPhone.trim()) emergencyContacts.push({ name: fields.parentName.trim(), relationship: 'Parent / guardian', phone: fields.parentPhone.trim() })
      if (fields.emergencyName.trim()) emergencyContacts.push({ name: fields.emergencyName.trim(), relationship: 'Emergency contact', phone: fields.emergencyPhone.trim() })
      await updateProfile({ id: childId, name: `${first} ${fields.childLast.trim()}`.trim(), age: fields.childAge.trim() || (fields.childDob ? `b. ${fields.childDob}` : 'Not provided'), room, allergies, dateOfBirth: fields.childDob || '', emergencyContacts, careInstructions: fields.notes.trim() })
      const { token } = await generateInvite('parent', fields.parentName.trim() || `${first}'s family`, childId, email)
      setResult({ childName: first, parentName: fields.parentName.trim(), email, linked: true, link: `${window.location.origin}/join?t=${token}` })
      setStep('done')
    } catch (error) {
      setSaveError(childId ? 'The child record is already created. The remaining care details or invitation could not be saved. Keep this form open and retry to finish the same child.' : error?.message || 'Could not finish intake. Keep this form open and retry.')
    } finally { setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(result.link); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { setSaveError('Copy was blocked. Select the link and copy it manually.') }
  }
  if (isAuthenticated && !facility?.isDemo && role !== 'admin') return <div className="space-y-5">
    <SectionHeader eyebrow="Enrolment" title="Director review required" />
    <Card><p className="font-bold text-slate-700">Only the director can enrol a child and create their family’s invitation.</p><p className="mt-2 text-sm text-slate-500">Give the enrolment form to your director so they can review the care details and add the child. You can continue recording care for enrolled children.</p><button onClick={() => setView('home')} className="btn-primary mt-4">Return to your dashboard</button></Card>
  </div>

  /* ── capture ── */
  if (step === 'capture' || step === 'scanning') {
    const scanning = step === 'scanning'
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Enrolment" title="Intake desk 📋" subtitle="Review a paper form, save the child’s care details and create a family invitation" />
        {scanError && (
          <Card className="flex items-center gap-2.5 border-coral-400/40 bg-coral-400/10 p-4 text-sm font-semibold text-coral-600">
            <AlertTriangle size={17} className="shrink-0" /> {scanError}
          </Card>
        )}
        <Card className="relative overflow-hidden p-8 text-center">
          {scanning ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <motion.div animate={{ y: [0, 44, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} className="relative flex h-24 w-20 items-start justify-center rounded-xl border-2 border-brand-200 bg-brand-50 pt-2">
                <span className="text-3xl">📋</span>
                <motion.div animate={{ top: ['10%', '85%', '10%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} className="absolute left-1 right-1 h-0.5 rounded bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
              </motion.div>
              <div>
                <p className="font-display text-2xl text-brand-700">Reading the form…</p>
                <p className="mt-1 text-sm font-semibold text-slate-400">Reading names, contacts and allergies. You will review every field before saving.</p>
              </div>
            </div>
          ) : (
            <>
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-grape-500 text-white shadow-lg"><ScanLine size={28} /></span>
              <h3 className="text-2xl text-slate-800">Snap the paper form</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm font-medium text-slate-500">
                Photograph the family's enrolment form — AI helps read it and pre-fills a draft. You review before anything is created.
              </p>
              <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2.5 sm:flex-row">
                <button onClick={() => cameraRef.current?.click()} className="btn-primary flex-1 py-3"><Camera size={17} /> Take photo</button>
                <button onClick={() => uploadRef.current?.click()} className="btn-ghost flex-1 py-3"><Upload size={17} /> Upload photo</button>
              </div>
              <button onClick={() => { setFields(BLANK); setStep('review') }} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 transition hover:text-brand-600">
                <PenLine size={14} /> No form? Type it in manually
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </>
          )}
        </Card>
        <Card className="flex gap-3 p-4">
          <span className="text-xl">🔒</span>
          <p className="text-sm font-medium leading-relaxed text-slate-500">
            Scanning sends this form to the configured AI service to help read it. You can enter it manually instead.
            Review every field before a child record or invitation is created. An invitation does not create or email a parent account.
          </p>
        </Card>
      </div>
    )
  }

  /* ── review ── */
  if (step === 'review') {
    return (
      <div className="space-y-5">
        <button disabled={busy || !!createdChildId} onClick={() => { setStep('capture'); setScanError('') }} className="btn-ghost !py-2 text-sm"><ArrowLeft size={15} /> Back</button>
        <SectionHeader eyebrow="Review & confirm" title="Check what we read ✍️" subtitle="Check names, dates, contacts and care instructions before saving. You will share the family’s invitation yourself." />

        <Card className="space-y-4 p-5">
          {createdChildId && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">The child record is created. Retry finishes the care details and invitation for this same child.</p>}
          {saveError && <p role="alert" className="rounded-xl bg-coral-50 p-3 text-sm font-semibold text-coral-700">{saveError}</p>}
          <fieldset disabled={busy} className="space-y-4">
          <p className="eyebrow flex items-center gap-1.5"><Baby size={13} /> Child</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="First name *" value={fields.childFirst} onChange={set('childFirst')} />
            <input className="input" placeholder="Last name" value={fields.childLast} onChange={set('childLast')} />
            <input className="input" placeholder="Age (e.g. 3 yrs)" value={fields.childAge} onChange={set('childAge')} />
            <label className="block text-sm font-semibold text-slate-600">Date of birth<input type="date" className="input mt-1" value={fields.childDob} onChange={set('childDob')} /></label>
            <select className="input" value={room} onChange={(e) => setRoom(e.target.value)}>
              {ROOMS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <input className="input" placeholder="Allergies (comma separated)" value={fields.allergies} onChange={set('allergies')} />

          <p className="eyebrow flex items-center gap-1.5 pt-2"><UserRound size={13} /> Parent / guardian</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="Parent name" value={fields.parentName} onChange={set('parentName')} />
            <input className="input" type="tel" placeholder="Parent phone" value={fields.parentPhone} onChange={set('parentPhone')} />
            <input className="input sm:col-span-2" type="email" placeholder="Parent email for this invitation *" value={fields.parentEmail} onChange={set('parentEmail')} />
          </div>

          <p className="eyebrow flex items-center gap-1.5 pt-2"><Phone size={13} /> Emergency contact</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="Name" value={fields.emergencyName} onChange={set('emergencyName')} />
            <input className="input" placeholder="Phone" value={fields.emergencyPhone} onChange={set('emergencyPhone')} />
          </div>

          <label className="block"><span className="eyebrow mb-1 block">Care instructions / notes</span><textarea className="input" rows={4} value={fields.notes} onChange={set('notes')} placeholder="Medical, dietary, comfort or custody notes for the care team" /></label>

          <button onClick={enroll} disabled={busy} className="btn-primary w-full py-3 disabled:opacity-50">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
            {createdChildId ? 'Finish care details and family link' : `Enrol ${fields.childFirst.trim() || 'child'} and create family link`}
          </button>
          <p className="text-center text-[11px] font-semibold text-slate-400">
            Saves date of birth, parent/emergency phone contacts, allergies and care instructions. The family invitation is linked to this child and the parent email above.
          </p>
          </fieldset>
        </Card>
      </div>
    )
  }

  /* ── done ── */
  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="p-8 text-center">
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-mint-400/15 text-mint-500"><Check size={32} /></motion.span>
          <h3 className="text-2xl text-slate-800">{result?.childName} is enrolled! 🎉</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm font-medium text-slate-500">
            {result?.linked
              ? <>This link is <strong>tied to {result.childName}</strong> — when {result?.parentName || 'the family'} signs up with it, their account connects to {result.childName} automatically. They'll only ever see their own child.</>
              : <>Send this link to {result?.parentName || 'the family'} — they'll create their account and connect to {result?.childName}.</>}
          </p>
          <div className="mx-auto mt-5 flex max-w-md items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-2.5">
            <Link2 size={15} className="shrink-0 text-brand-500" />
            <input readOnly value={result?.link || ''} aria-label="Family invitation link" onFocus={event => event.target.select()} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-brand-700" />
            <button onClick={copy} className="btn-ghost ml-auto shrink-0 !py-1.5 text-xs">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-400">Share this link with {result?.email}. It expires in 7 days and can be accepted once. No invitation email has been sent automatically.</p>
          {saveError && <p role="alert" className="mt-3 text-sm font-semibold text-coral-700">{saveError}</p>}
          <div className="mt-6 flex justify-center gap-2.5">
            <button onClick={() => { setFields(BLANK); setResult(null); setScanError(''); setSaveError(''); setCreatedChildId(null); setStep('capture') }} className="btn-primary"><ScanLine size={16} /> Scan another form</button>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
