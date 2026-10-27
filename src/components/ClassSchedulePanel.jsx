import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useApp } from '../context/AppContext.jsx'
import { ClassScheduleNow } from './ClassSchedule.jsx'

// The server filters family plans and closures to the selected active child.
// Parent visibility never depends on a client-side classroom filter alone.
export default function ClassSchedulePanel() {
  const { facility, viewer, role, childrenList, activeChildId, educators } = useApp()
  const child = childrenList.find(c => c.id === activeChildId) || childrenList[0]
  const isParent = role === 'parent'
  const args = isParent ? child ? { childId: child.id } : 'skip' : {}
  const plans = useQuery(api.lessons.familyPlans, args)
  const events = useQuery(api.calendar.list, args)
  if (isParent && !child) return null
  if (!plans || !events) return <p role="status" className="text-sm text-slate-500">Loading the class schedule…</p>
  const names = [...new Set([...childrenList.map(c => c.room), ...educators.map(e => e.room), ...plans.map(p => p.room)].filter(room => room && room !== 'Unassigned' && room !== 'All rooms'))]
  const ownRoom = educators.find(e => e.userId === viewer?.id)?.room
  return <ClassScheduleNow plans={plans} events={events} timeZone={facility?.timezone || 'America/Vancouver'} room={isParent ? child.room : undefined} rooms={isParent ? [child.room].filter(Boolean) : names} initialRoom={!isParent && ownRoom && ownRoom !== 'Unassigned' ? ownRoom : undefined} showAttachments />
}
