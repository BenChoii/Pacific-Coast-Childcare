import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { Mail, Copy, Check } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { Card } from './ui.jsx'

const validEmail = value => value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
const contactError = error => typeof error?.data === 'string' ? error.data : 'Could not save the contact. Your changes are still here; please retry.'

export function ParentContact({ compact = false }) {
  const { viewer, facility, isAuthenticated } = useApp()
  const enabled = isAuthenticated && !facility?.isDemo && viewer?.role === 'parent' && viewer.hasActiveChildren === true
  const contact = useQuery(api.facilities.parentContact, enabled ? {} : 'skip')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setCopied(false); setError('') }, [contact?.email])
  if (!enabled || !contact?.email) return null
  const name = contact.name?.trim().split(/\s+/)[0]
  const label = name ? `Email ${name}` : 'Email the daycare'
  // Encode the recipient and subject separately. No child details or message
  // text are placed in a URL or sent before the parent writes their own email.
  const recipient = contact.email.split('@').map(encodeURIComponent).join('@')
  const href = `mailto:${recipient}?subject=${encodeURIComponent(`Parent concern - ${contact.facilityName || 'Daycare'}`)}`
  const copy = async () => {
    setCopied(false); setError('')
    try { await navigator.clipboard.writeText(contact.email); setCopied(true) }
    catch { setError(`Copy was unavailable. You can use ${contact.email} in your mail app.`) }
  }
  return <div className={`min-w-0 rounded-2xl border border-brand-100 bg-brand-50/40 ${compact ? 'px-4 py-3' : 'p-5'}`}>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><p className="font-bold text-slate-700">Have a question or concern?</p><p className="text-xs text-slate-500">Email your daycare directly. Opens your mail app.</p></div>
      <div className="flex min-w-0 flex-wrap gap-2"><a className="btn-primary !px-4 !py-2" href={href}><Mail size={16}/>{label}</a><button type="button" className="btn-ghost !px-3 !py-2" onClick={copy}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Email copied' : 'Copy email'}</button></div>
    </div>
    <p className="mt-2 break-all text-xs text-slate-500">{contact.email}</p>
    {copied && <p role="status" className="mt-1 text-xs text-mint-700">Email address copied.</p>}
    {error && <p role="alert" className="mt-2 text-xs text-coral-600">{error}</p>}
  </div>
}

export function ParentContactSettings() {
  const { viewer, facility, isAuthenticated } = useApp()
  const enabled = isAuthenticated && !facility?.isDemo && viewer?.role === 'admin'
  const contact = useQuery(api.facilities.parentContact, enabled ? {} : 'skip')
  const saveContact = useMutation(api.facilities.setParentContact)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => { if (contact) setForm(current => current ?? { email: contact.configuredEmail || '', name: contact.configuredName || '' }) }, [contact])
  if (!enabled) return null
  if (contact === undefined || !form) return <Card><p className="text-sm text-slate-500">Loading parent contact…</p></Card>
  const edit = (key, value) => { setForm(current => ({ ...current, [key]: value })); setSaved(false); setError('') }
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    const email = form.email.trim(), name = form.name.trim()
    if (email && !validEmail(email)) { setError('Enter a valid email address.'); return }
    if (name.length > 120) { setError('Use a contact name of up to 120 characters.'); return }
    setBusy(true); setSaved(false); setError('')
    try { await saveContact({ email, name }); setForm({ email, name }); setSaved(true) }
    catch (error) { setError(contactError(error)) }
    finally { setBusy(false) }
  }
  return <Card><form onSubmit={submit} className="space-y-4">
    <div><h3 className="text-xl">Parent email contact</h3><p className="mt-1 text-sm text-slate-500">Parents can email you from their dashboard or Messages. Their mail app opens so they can write privately.</p></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-600">Contact name<input className="input mt-1" value={form.name} maxLength={120} disabled={busy} placeholder={contact.name || 'Daycare owner'} onChange={event => edit('name', event.target.value)}/></label><label className="block text-sm font-bold text-slate-600">Contact email<input type="email" className="input mt-1" value={form.email} maxLength={254} disabled={busy} placeholder={contact.fallbackEmail || 'you@example.com'} onChange={event => edit('email', event.target.value)}/></label></div>
    <p className="break-words text-xs text-slate-500">Leave these fields blank to use the owner’s account name and email{contact.fallbackEmail ? ` (${contact.fallbackEmail})` : ''}. This does not change your sign-in or billing email.</p>
    {error && <p role="alert" className="text-sm text-coral-600">{error}</p>}
    {saved && <p role="status" className="text-sm text-mint-700">Parent contact saved.</p>}
    <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save parent contact'}</button>
  </form></Card>
}
