import { useState } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { LockKeyhole, RotateCcw, Users, AlertTriangle } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { Card, Pill } from './ui.jsx'

function ActionConfirmation({ title, children, busy, error, confirmLabel, onConfirm, onCancel }) {
  return (
    <div role="alertdialog" aria-modal="false" aria-label={title} className="mt-4 rounded-2xl border border-coral-200 bg-coral-50 p-4">
      <h4 className="font-extrabold text-slate-800">{title}</h4>
      <div className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{children}</div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-coral-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={onConfirm} className="btn-primary disabled:opacity-50">{busy ? 'Saving…' : confirmLabel}</button>
        <button type="button" disabled={busy} onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  )
}

export function MembershipManager({ audience = 'parent' }) {
  const { facility, viewer, pushToast } = useApp()
  const live = !!facility && !facility.isDemo && viewer?.role === 'admin'
  const members = useQuery(api.users.listMembers, live ? {} : 'skip')
  const setAccess = useMutation(api.users.setMemberAccess)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!live) return null
  const visible = (members || []).filter((m) => audience === 'parent' ? m.role === 'parent' : m.role === 'staff' || m.role === 'admin')
  const change = async () => {
    setBusy(true); setError('')
    try {
      await setAccess({ id: selected.id, status: selected.accessStatus === 'suspended' ? 'active' : 'suspended' })
      pushToast(selected.accessStatus === 'suspended' ? 'Access restored.' : 'Access suspended.', { emoji: '🔒' })
      setSelected(null)
    } catch (e) { setError(e.message || 'Could not change access. Please try again.') }
    finally { setBusy(false) }
  }
  return (
    <Card>
      <div className="flex items-center gap-2"><LockKeyhole size={19} className="text-brand-600" /><h3 className="text-xl text-slate-800">{audience === 'parent' ? 'Parent' : 'Team'} app access</h3></div>
      <p className="mt-2 text-sm font-medium text-slate-500">Suspend an account when someone leaves. Their past records stay on file, and you can restore access later.</p>
      {members === undefined ? <p role="status" className="py-4 text-sm text-slate-500">Loading accounts…</p> : !visible.length ? <p className="py-4 text-sm text-slate-500">No {audience === 'parent' ? 'parent' : 'team'} accounts have joined yet.</p> : (
        <div className="mt-4 divide-y divide-line">
          {visible.map((m) => {
            const suspended = m.accessStatus === 'suspended'
            const protectedAccount = m.isOwner || m.isCurrentUser || m.id === viewer.id
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-slate-700">{m.name || 'Unnamed account'}</div>
                  <div className="break-all text-xs font-semibold text-slate-500">{m.email}</div>
                  {m.children?.length > 0 && <div className="mt-1 text-xs text-slate-500">{m.children.map((c) => c.name).join(', ')}</div>}
                  {suspended && m.accessReason && <div className="mt-1 text-xs text-slate-500">{m.accessReason.startsWith('child-released:') ? 'No active child enrolment' : m.accessReason === 'director' ? 'Suspended by a director' : 'Access suspended'}</div>}
                </div>
                <Pill className={suspended ? 'bg-coral-400/15 text-coral-600' : 'bg-mint-400/15 text-mint-600'}>{suspended ? 'Suspended' : 'Active'}</Pill>
                {protectedAccount ? <span className="text-xs font-semibold text-slate-400">{m.isOwner ? 'Owner account' : 'Your account'}</span> : (
                  <button type="button" disabled={busy} className="btn-ghost !px-3 !py-2 text-xs" onClick={() => { setSelected(m); setError('') }}>
                    {suspended ? <RotateCcw size={14} /> : <LockKeyhole size={14} />}{suspended ? 'Restore access' : 'Suspend access'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {selected && <ActionConfirmation title={`${selected.accessStatus === 'suspended' ? 'Restore' : 'Suspend'} ${selected.name || 'this account'}’s access?`} busy={busy} error={error} confirmLabel={selected.accessStatus === 'suspended' ? 'Restore access' : 'Suspend access'} onConfirm={change} onCancel={() => setSelected(null)}>
        {selected.accessStatus === 'suspended' ? 'They will be able to sign in and use the information permitted by their role and active enrolments again.' : 'They will lose access to this daycare’s dashboard, schedules, messages and classroom updates, including from an existing session. This does not delete records or release any enrolled children.'}
      </ActionConfirmation>}
    </Card>
  )
}

export function ChildEnrollmentControls({ child, onReleased }) {
  const { facility, viewer, pushToast } = useApp()
  const { removeChild } = useApp()
  const assignRoom = useMutation(api.children.assignRoom)
  const setEnrollmentDays = useMutation(api.children.setEnrollmentDays)
  const [room, setRoom] = useState(child.room || '')
  const [days, setDays] = useState(child.enrollmentDays || [])
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!facility || facility.isDemo || viewer?.role !== 'admin') return null
  const save = async () => {
    setBusy(true); setError('')
    try {
      if (action === 'release') {
        await removeChild(child.id)
        pushToast('Enrolment released. Past records are preserved.', { emoji: '🔒' })
        onReleased?.()
      } else if (action === 'days') {
        await setEnrollmentDays({ id: child.id, days })
        pushToast('Attendance days shared with the family.')
      } else {
        await assignRoom({ id: child.id, room: action === 'unassign' ? '' : room.trim() })
        pushToast(action === 'unassign' ? 'Class assignment removed.' : 'Class assignment updated.')
        if (action === 'unassign') setRoom('')
      }
      setAction(null)
    } catch (e) { setError(e.message || 'Could not update enrolment. Please try again.') }
    finally { setBusy(false) }
  }
  return (
    <Card>
      <h3 className="text-xl text-slate-800">Class & enrolment</h3>
      <p className="mt-2 text-sm font-medium text-slate-500">Current class: <strong>{child.room || 'Not assigned'}</strong></p>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-xs font-bold text-slate-500">Class name
          <input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={120} className="input mt-1 w-full" placeholder="Enter class name" />
        </label>
        <button type="button" disabled={busy || !room.trim() || room.trim() === child.room} className="btn-ghost" onClick={() => { setError(''); setAction('assign') }}>Save class</button>
        {child.room && child.room !== 'Unassigned' && <button type="button" disabled={busy} className="btn-ghost" onClick={() => { setError(''); setAction('unassign') }}>Remove from class</button>}
      </div>
      <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">Removing a class assignment keeps the child enrolled and the parent’s app access active. Release the enrolment below when the child leaves the daycare.</p>
      <fieldset className="mt-5 border-t border-line pt-4">
        <legend className="text-sm font-extrabold text-slate-700">Regular attendance days</legend>
        <p className="mt-1 text-xs font-medium text-slate-500">Choose the child’s weekly days. Parents see these alongside published closures, which override the regular schedule.</p>
        <div className="mt-3 flex flex-wrap gap-2">{weekdays.map((d) => <label key={d} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold"><input type="checkbox" checked={days.includes(d)} onChange={() => setDays((current) => current.includes(d) ? current.filter((day) => day !== d) : weekdays.filter((day) => day === d || current.includes(day)))} />{d}</label>)}</div>
        <button type="button" disabled={busy} className="btn-ghost mt-3" onClick={() => { setAction('days'); setError('') }}>Save attendance days</button>
      </fieldset>
      <button type="button" disabled={busy} onClick={() => { setAction('release'); setError('') }} className="btn-ghost mt-4 text-coral-600"><AlertTriangle size={15} /> Release enrolment</button>
      {action && <ActionConfirmation title={action === 'days' ? `Update ${child.name}’s attendance days?` : action === 'release' ? `Release ${child.name}’s enrolment?` : action === 'unassign' ? `Remove ${child.name} from this class?` : `Move ${child.name} to ${room.trim()}?`} busy={busy} error={error} confirmLabel={action === 'days' ? 'Share attendance days' : action === 'release' ? 'Release enrolment' : action === 'unassign' ? 'Remove class assignment' : 'Save class'} onConfirm={save} onCancel={() => setAction(null)}>
        {action === 'days' ? `Parents will see ${days.length ? days.join(', ') : 'no regular attendance days selected'} in their child’s calendar. Published holiday and closure dates still take priority.` : action === 'release' ? 'This removes the child from active classes and attendance. Their linked parent loses daycare app access if they have no other enrolled children. If a sibling remains, the parent keeps access only for that sibling. Past records stay on file and the enrolment can be restored.' : action === 'unassign' ? 'The child stays enrolled without a class assignment. The parent keeps app access. Use Release enrolment when they are leaving the daycare.' : 'This updates the child’s class assignment. Their linked parent keeps access to the child’s information.'}
      </ActionConfirmation>}
    </Card>
  )
}

export function ReleasedChildren() {
  const { facility, viewer, pushToast } = useApp()
  const live = !!facility && !facility.isDemo && viewer?.role === 'admin'
  const archived = useQuery(api.children.archived, live ? {} : 'skip')
  const restore = useMutation(api.children.restore)
  const syncQuantity = useAction(api.billing.syncQuantity)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!live) return null
  const save = async () => {
    setBusy(true); setError('')
    try {
      await restore({ id: selected.id })
      try { await syncQuantity({}) } catch { pushToast('Enrolment restored. Plan quantity could not refresh; check Account → Billing.', { emoji: '⚠️', tone: 'coral' }) }
      pushToast('Enrolment restored.')
      setSelected(null)
    } catch (e) { setError(e.message || 'Could not restore enrolment.') }
    finally { setBusy(false) }
  }
  return (
    <Card>
      <div className="flex items-center gap-2"><Users size={18} className="text-brand-600" /><h3 className="text-xl text-slate-800">Released enrolments</h3></div>
      {archived === undefined ? <p className="mt-3 text-sm text-slate-500">Loading released enrolments…</p> : !archived.length ? <p className="mt-3 text-sm text-slate-500">No released enrolments.</p> : <div className="mt-3 divide-y divide-line">{archived.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1"><div className="font-extrabold text-slate-700">{c.name}</div><div className="text-xs text-slate-500">{c.parent}{c.archivedAt ? ` · Released ${new Date(c.archivedAt).toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' })}` : ''}</div></div>
          <button type="button" disabled={busy} className="btn-ghost !py-2" onClick={() => { setSelected(c); setError('') }}><RotateCcw size={14} />Restore enrolment</button>
        </div>
      ))}</div>}
      {selected && <ActionConfirmation title={`Restore ${selected.name}’s enrolment?`} busy={busy} error={error} confirmLabel="Restore enrolment" onConfirm={save} onCancel={() => setSelected(null)}>
        This returns the child to active enrolment. Parent access is restored only if it was suspended automatically because no active enrolments remained; a manually suspended account stays suspended.
      </ActionConfirmation>}
    </Card>
  )
}
