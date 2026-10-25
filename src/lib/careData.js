export function dayKey(value=Date.now(), timezone='America/Vancouver') {
  return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))
}
export function childDayEntries(entries,child,date,timezone='America/Vancouver') {
  if(!child) return []
  return entries.filter(entry=>entry.childId===child.id && (entry.date || dayKey(entry.occurredAt || entry.createdAt || 0,timezone))===date)
}
export function nextAttendance(child,events,today,daysAhead=35) {
  if(!Array.isArray(child?.enrollmentDays)) return null
  const labels=['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  for(let i=0;i<daysAhead;i++){
    const value=new Date(today+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+i)
    const date=value.toISOString().slice(0,10)
    if(child.enrollmentDays.includes(labels[value.getUTCDay()])&&!events.some(e=>['closure','holiday'].includes(e.kind)&&e.startDate<=date&&e.endDate>=date&&(!e.room||e.room===child.room))) return date
  }
  return null
}
export function csvDownload(filename,headers,rows) {
  const cell=value=>{const text=String(value??'');return '"'+(/^[=+@\-\t\r]/.test(text)?"'":'')+text.replaceAll('"','""')+'"'}
  const blob=new Blob(['\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30_000)
}
