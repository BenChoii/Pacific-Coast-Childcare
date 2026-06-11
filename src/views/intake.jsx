import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
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
  const { uploadImage, scanIntake, enrollChild, generateInvite, childrenList, pushToast } = useApp()
  const [step, setStep] = useState('capture') // capture | scanning | review | done
  const [fields, setFields] = useState(BLANK)
  const [scanError, setScanError] = useState('')
  const [room, setRoom] = useState('Preschool')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { childName, link, parentName }
  const [copied, setCopied] = useState(false)
  const cameraRef = useRef(null)
  const uploadRef = useRef(null)

  const set = (k) => (e) => setFields((p) => ({ ...p, [k]: e.target.value }))

  const onPhoto = async (file) => {
    if (!file) return
    setScanError('')
    setStep('scanning')
    try {
      const storageId = await uploadImage(file)
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
    const first = fields.childFirst.trim()
    if (!first) { pushToast('The child needs at least a first name.', { emoji: '🧒', tone: 'coral' }); return }
    setBusy(true)
    try {
      const i = childrenList.length
      const allergies = fields.allergies.split(',').map((s) => s.trim()).filter(Boolean)
      const res = await enrollChild({
        first,
        name: `${first} ${fields.childLast.trim()}`.trim(),
        age: fields.childAge.trim() || (fields.childDob ? `b. ${fields.childDob}` : '—'),
        room,
        emoji: EMOJIS[i % EMOJIS.length],
        color: COLORS[i % COLORS.length],
        parent: fields.parentName.trim() || 'Parent',
        allergies,
      })
      if (res?.redirecting) return // crossed the free limit → off to Stripe; resumes after
      if (!(res?.ok || res?.billingSkipped)) { setBusy(false); return }

      // Find the new child to link the invite (freshest matching name).
      // childrenList is live but may not have refreshed yet — retry briefly.
      let childId = null
      for (let tries = 0; tries < 6 && !childId; tries++) {
        await new Promise((r) => setTimeout(r, 350))
        const fullName = `${first} ${fields.childLast.trim()}`.trim()
        const match = [...(childrenListRef.current || [])].reverse().find((c) => c.name === fullName || c.first === first)
        if (match) childId = match.id
      }
      const { token } = await generateInvite('parent', fields.parentName.trim() || `${first}'s family`, childId || undefined)
      setResult({
        childName: first,
        parentName: fields.parentName.trim(),
        linked: !!childId,
        link: `${window.location.origin}/join?t=${token}`,
      })
      setStep('done')
    } catch (e) {
      pushToast(e?.message || 'Could not enroll — try again.', { emoji: '⚠️', tone: 'coral' })
    } finally {
      setBusy(false)
    }
  }

  // live ref so the post-enroll lookup sees query refreshes
  const childrenListRef = useRef(childrenList)
  childrenListRef.current = childrenList

  const copy = () => { navigator.clipboard?.writeText(result.link); setCopied(true); setTimeout(() => setCopied(false), 1800) }

  /* ── capture ── */
  if (step === 'capture' || step === 'scanning') {
    const scanning = step === 'scanning'
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Enrolment" title="Intake desk 📋" subtitle="Turn a paper intake form into an enrolled child + a parent login — in under a minute" />
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
                <p className="mt-1 text-sm font-semibold text-slate-400">AI is extracting names, contacts &amp; allergies (~15s on free models)</p>
              </div>
            </div>
          ) : (
            <>
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-grape-500 text-white shadow-lg"><ScanLine size={28} /></span>
              <h3 className="text-2xl text-slate-800">Snap the paper form</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm font-medium text-slate-500">
                Photograph the family's enrolment form — AI reads it and pre-fills everything. You review before anything is created.
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
            The photo is stored privately in your facility and only used to pre-fill this form.
            Every field is human-reviewed before a child record or parent login exists.
          </p>
        </Card>
      </div>
    )
  }

  /* ── review ── */
  if (step === 'review') {
    return (
      <div className="space-y-5">
        <button onClick={() => { setStep('capture'); setScanError('') }} className="btn-ghost !py-2 text-sm"><ArrowLeft size={15} /> Back</button>
        <SectionHeader eyebrow="Review & confirm" title="Check what we read ✍️" subtitle="Fix anything the scan got wrong — then one tap enrolls the child and creates the family's login link" />

        <Card className="space-y-4 p-5">
          <p className="eyebrow flex items-center gap-1.5"><Baby size={13} /> Child</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="First name *" value={fields.childFirst} onChange={set('childFirst')} />
            <input className="input" placeholder="Last name" value={fields.childLast} onChange={set('childLast')} />
            <input className="input" placeholder="Age (e.g. 3 yrs)" value={fields.childAge} onChange={set('childAge')} />
            <select className="input" value={room} onChange={(e) => setRoom(e.target.value)}>
              {ROOMS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <input className="input" placeholder="Allergies (comma separated)" value={fields.allergies} onChange={set('allergies')} />

          <p className="eyebrow flex items-center gap-1.5 pt-2"><UserRound size={13} /> Parent / guardian</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="Parent name" value={fields.parentName} onChange={set('parentName')} />
            <input className="input" placeholder="Parent phone" value={fields.parentPhone} onChange={set('parentPhone')} />
            <input className="input sm:col-span-2" type="email" placeholder="Parent email (where you'll send the login link)" value={fields.parentEmail} onChange={set('parentEmail')} />
          </div>

          <p className="eyebrow flex items-center gap-1.5 pt-2"><Phone size={13} /> Emergency contact</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder="Name" value={fields.emergencyName} onChange={set('emergencyName')} />
            <input className="input" placeholder="Phone" value={fields.emergencyPhone} onChange={set('emergencyPhone')} />
          </div>

          {fields.notes && (
            <div className="flex gap-2.5 rounded-2xl bg-sunshine-400/10 p-3 text-sm">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-sunshine-600" />
              <p className="font-medium text-slate-600"><strong>From the form:</strong> {fields.notes}</p>
            </div>
          )}

          <button onClick={enroll} disabled={busy} className="btn-primary w-full py-3 disabled:opacity-50">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
            Enroll {fields.childFirst.trim() || 'child'} &amp; create the family link
          </button>
          <p className="text-center text-[11px] font-semibold text-slate-400">
            Emergency contact &amp; notes stay on this screen for your paper file — Cubby stores the child record, allergies and parent link.
          </p>
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
            <span className="truncate text-sm font-bold text-brand-700">{result?.link}</span>
            <button onClick={copy} className="btn-ghost ml-auto shrink-0 !py-1.5 text-xs">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-400">Text it, email it, or write it on the pickup slip — whatever reaches them.</p>
          <div className="mt-6 flex justify-center gap-2.5">
            <button onClick={() => { setFields(BLANK); setResult(null); setScanError(''); setStep('capture') }} className="btn-primary"><ScanLine size={16} /> Scan another form</button>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
