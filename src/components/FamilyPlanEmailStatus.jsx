import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'

export default function FamilyPlanEmailStatus({ planId }) {
  const { facility } = useApp()
  const status = useQuery(api.familyNotifications.deliveryStatus, facility && !facility.isDemo && planId ? { planId } : 'skip')
  const retry = useMutation(api.familyNotifications.retryPlan)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  if (!status) return null
  const pending = status.pending + status.sending + status.retrying
  const total = Object.values(status).reduce((a, b) => a + b, 0)
  if (!total) return <p className="mt-3 text-sm text-slate-500">Sharing a new uploaded schedule or plan emails the parents in its class.</p>
  const retryFailed = async () => {
    setBusy(true); setError('')
    try { await retry({ planId }) }
    catch (e) { setError(e.message || 'Could not retry delivery. Please try again.') }
    finally { setBusy(false) }
  }
  return <div className="mt-3 text-sm text-slate-600">
    <p role="status">Parent emails: {status.sent} sent{pending ? `, ${pending} queued` : ''}{status.failed ? `, ${status.failed} failed` : ''}{status.recorded ? `, ${status.recorded} recorded with delivery off` : ''}{status.skipped ? `, ${status.skipped} no longer applicable` : ''}.</p>
    {status.failed > 0 && <button type="button" className="btn-ghost mt-2" disabled={busy} onClick={retryFailed}>{busy ? 'Retrying…' : 'Retry failed emails'}</button>}
    {error && <p role="alert" className="mt-2 text-coral-600">{error}</p>}
  </div>
}
