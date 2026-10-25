import { query } from './_generated/server'
import { v } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import { requireAdmin, resolveFacilityId } from './lib'

export const snapshot=query({args:{startDate:v.string(),endDate:v.string()},handler:async(ctx,{startDate,endDate})=>{
  const uid=await getAuthUserId(ctx)
  const facilityId=uid?(await requireAdmin(ctx)).facilityId:await resolveFacilityId(ctx)
  if(!facilityId)return {error:'Sign in to download reports.'}
  const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s
  if(!valid(startDate)||!valid(endDate)||endDate<startDate||Date.parse(endDate)-Date.parse(startDate)>366*86400000)return {error:'Choose a valid range of up to one year.'}
  const get=async(table:any)=>await ctx.db.query(table).withIndex('by_facility',(q:any)=>q.eq('facilityId',facilityId)).take(5001)
  const [children,educators,invoices,calendar,attendance,activities]=await Promise.all([
    get('children'),get('educators'),get('invoices'),get('calendarEvents'),
    ctx.db.query('attendanceEvents').withIndex('by_facility_date',q=>q.eq('facilityId',facilityId).gte('date',startDate).lte('date',endDate)).take(10001),
    ctx.db.query('activities').withIndex('by_facility_date',q=>q.eq('facilityId',facilityId).gte('date',startDate).lte('date',endDate)).take(10001),
  ])
  if(attendance.length>10000||activities.length>10000||[children,educators,invoices,calendar].some(rows=>rows.length>5000))return {error:'This report is too large. Choose a shorter period or contact support for a complete export.'}
  const names=new Map(children.map((c:any)=>[c._id,c.name]))
  return {exports:{
    enrolments:{title:'Enrolments',headers:['Child','Age','Class','Guardian label','Attendance days','Enrolment'],rows:children.map((c:any)=>[c.name,c.age,c.room,c.parent,(c.enrollmentDays||[]).join(' / '),c.archivedAt?'Released':'Active'])},
    attendance:{title:'Attendance history',headers:['Date','Child','Status','Recorded time'],rows:attendance.map(a=>[a.date,names.get(a.childId)||'Released child',a.status,a.displayTime])},
    care:{title:'Care activity log',headers:['Date','Child','Type','Time','Title','Details','Recorded by'],rows:activities.map(a=>[a.date,names.get(a.childId)||a.childName||'',a.type,a.time,a.title,a.detail,a.by])},
    invoices:{title:'Invoices',headers:['Invoice','Period','Bill to','Amount CAD','Status','Paid on'],rows:invoices.map((i:any)=>[i.invId,i.period,i.billTo||'',i.amount,i.status,i.paidOn||''])},
    educators:{title:'Educator roster',headers:['Name','Role','Class','Hire date','Recorded certifications'],rows:educators.map((e:any)=>[e.name,e.role,e.room,e.hireDate,e.certifications.join(' / ')])},
    calendar:{title:'Calendar & closures',headers:['Title','Kind','From','Through','Class','Description'],rows:calendar.map((c:any)=>[c.title,c.kind,c.startDate,c.endDate,c.room||'All rooms',c.description])},
  }}
}})
