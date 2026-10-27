import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { FamilyLearningPlan } from './parent.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Check, ChevronDown, Plus, Pencil, Trash2, BookOpen, Video, FileText,
  Link2, ExternalLink, GraduationCap, Sparkles, Save, X, Users, Play, CircleDot,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Card, SectionHeader, Pill, ProgressBar } from '../components/ui.jsx'
import { PlanAttachmentEditor } from '../components/PlanAttachments.jsx'
import { ScheduleAgendaEditor } from '../components/ClassSchedule.jsx'
import FamilyPlanEmailStatus from '../components/FamilyPlanEmailStatus.jsx'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PROGRAMS = ['Little Leaders', 'Global Citizens', 'Real Life Skills', 'Smart Minds STEM', 'Mindful Hearts', 'Routine']
const PROGRAM_PILL = {
  'Little Leaders': 'bg-brand-100 text-brand-700',
  'Global Citizens': 'bg-sky-100 text-brand-600',
  'Real Life Skills': 'bg-mint-400/20 text-mint-500',
  'Smart Minds STEM': 'bg-sunshine-400/20 text-amber-600',
  'Mindful Hearts': 'bg-blush-100 text-blush-600',
  Routine: 'bg-slate-100 text-slate-500',
}
const PROGRAM_EMOJI = {
  'Little Leaders': '🌟', 'Global Citizens': '🌍', 'Real Life Skills': '🧺',
  'Smart Minds STEM': '🔬', 'Mindful Hearts': '💛', Routine: '🕐',
}
const NEXT_STATUS = { planned: 'active', active: 'done', done: 'planned' }

function dateInFacility(facility) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: facility?.timezone || 'America/Vancouver', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date())
  const get = type => parts.find(p => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
function moveDate(date, amount) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0,10) }
function dayForDate(date) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(date+'T12:00:00Z').getUTCDay()] }
function monday(date) { const index = DAYS.indexOf(dayForDate(date)); return moveDate(date,-index) }
function useWorkingPlan() {
  const app = useApp()
  const [date,setDate] = useState(() => dateInFacility(app.facility))
  const [room,setRoom] = useState('')
  const rooms = [...new Set([...app.childrenList.map(c=>c.room).filter(Boolean),app.lessonPlan?.room].filter(r=>r && r !== 'Unassigned'))].sort()
  const selectedRoom = room || rooms[0] || 'Main Room'
  const startDate = monday(date)
  const live = !!app.viewer?.id && !app.facility?.isDemo
  const planQ = useQuery(api.lessons.plan, live ? {room:selectedRoom,startDate} : 'skip')
  const blocksQ = useQuery(api.lessons.blocks, live ? {room:selectedRoom,startDate} : 'skip')
  const rosterQ = useQuery(api.roster.list, live ? {date} : 'skip')
  return { ...app, date,setDate, room:selectedRoom,setRoom, rooms:rooms.length?rooms:['Main Room'],startDate,endDate:moveDate(startDate,6),
    plan:live ? planQ : app.lessonPlan, blocks:live ? blocksQ || [] : app.lessonBlocks,
    datedRoster:live ? rosterQ || [] : app.roster, loading:live && (planQ === undefined || blocksQ === undefined),live }
}
function PlanSelection({selection}) {
  return <Card className="!p-4"><div className="grid gap-3 sm:grid-cols-2">
    <Labeled label="Classroom"><select className="input" value={selection.room} onChange={e=>selection.setRoom(e.target.value)}>{selection.rooms.map(room=><option key={room}>{room}</option>)}</select></Labeled>
    <Labeled label="Lesson date"><input className="input" type="date" value={selection.date} onChange={e=>e.target.value && selection.setDate(e.target.value)} /></Labeled>
  </div><p className="mt-2 text-xs text-slate-500">Week of {selection.startDate} through {selection.endDate}. Completion belongs to one classroom and date.</p></Card>
}
function DayTabs({ day, setDay }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {DAYS.map((d) => (
        <button key={d} onClick={() => setDay(d)}
          className={`shrink-0 rounded-full border px-5 py-2 text-sm font-bold transition ${day === d ? 'border-transparent bg-brand-600 text-white shadow-md' : 'border-line bg-white text-slate-600'}`}>
          {d}
        </button>
      ))}
    </div>
  )
}
function Tabs({ tab, setTab, items }) {
  return (
    <div className="inline-flex rounded-2xl bg-slate-100 p-1">
      {items.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)}
          className={`rounded-xl px-5 py-2 text-sm font-bold transition ${tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ===================== EDUCATOR ===================== */
export function EducatorLessons() {
  const selection = useWorkingPlan()
  const { plan: lessonPlan, blocks: lessonBlocks, datedRoster: roster, resources, setLessonStatus, toggleLessonChild } = selection
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const act = async action => { if (busy) return; setBusy(true); setError(''); try { const id=await action(); if (typeof id==='string') setOpenId(id) } catch(err) {setError(err.message || 'The lesson update could not be saved. Please retry.')} finally {setBusy(false)} }
  const [tab, setTab] = useState('plan')
  const day = dayForDate(selection.date)
  const setDay = next => selection.setDate(moveDate(selection.startDate,DAYS.indexOf(next)))
  const [openId, setOpenId] = useState(null)

  const dayBlocks = lessonBlocks.filter((b) => b.day === day).sort((a, b) => a.order - b.order)
  const done = dayBlocks.filter((b) => b.status === 'done').length
  const present = roster.filter((r) => r.room === selection.room && ['checked-in','napping'].includes(r.status))

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Curriculum" title="Lesson plans 📚" subtitle={lessonPlan?.theme ? `${lessonPlan.theme} · ${lessonPlan.week}` : 'This week'} />
      <Tabs tab={tab} setTab={setTab} items={[{ id: 'plan', label: 'This week' }, { id: 'training', label: 'Training' }]} />

      {tab === 'plan' ? (
        <>
          <PlanSelection selection={selection} />
          <DayTabs day={day} setDay={setDay} />
          {error && <p role="alert" className="rounded-xl bg-coral-50 p-3 text-sm text-coral-700">{error}</p>}
          {selection.loading && <p role="status" className="text-sm text-slate-500">Loading lesson plan…</p>}
          {dayBlocks.length > 0 && (
            <Card className="!p-4">
              <div className="mb-2 flex items-center justify-between text-sm font-bold">
                <span className="text-slate-500">{day} · {done} of {dayBlocks.length} done</span>
                <span className="text-brand-600">{Math.round((done / dayBlocks.length) * 100)}%</span>
              </div>
              <ProgressBar value={done} max={dayBlocks.length} gradient="from-brand-400 to-mint-400" />
            </Card>
          )}

          <div className="space-y-2.5">
            {dayBlocks.map((b, i) => {
              const open = openId === b.id
              return (
                <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={`card overflow-hidden p-0 ${b.status === 'done' ? 'opacity-75' : ''}`}>
                  <div className="flex items-stretch">
                    {/* status toggle */}
                    <button
                      disabled={busy || selection.date !== dateInFacility(selection.facility)} aria-label={`Change ${b.title} status`}
                      onClick={() => act(() => setLessonStatus({ id: b.id, status: NEXT_STATUS[b.status], date:selection.date }))}
                      className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 border-r border-line"
                    >
                      <StatusDot status={b.status} />
                    </button>
                    {/* body */}
                    <button onClick={() => setOpenId(open ? null : b.id)} className="flex flex-1 items-center gap-3 p-3.5 text-left">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[11px] font-bold uppercase tracking-wide text-slate-400">{b.time}</div>
                        <div className={`font-extrabold text-slate-800 ${b.status === 'done' ? 'line-through decoration-slate-300' : ''}`}>{b.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Pill className={PROGRAM_PILL[b.program]}>{PROGRAM_EMOJI[b.program]} {b.program}</Pill>
                          {b.template && <Pill className="bg-slate-100 text-slate-500">Template · completion recorded for this date</Pill>}
                          {b.doneChildren.length > 0 && <Pill className="bg-mint-400/15 text-mint-500"><Users size={11} /> {b.doneChildren.length}</Pill>}
                        </div>
                      </div>
                      <ChevronDown size={18} className={`shrink-0 text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  <AnimatePresence>
                    {open && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-3 border-t border-line bg-tint/60 p-4">
                          <p className="text-sm font-semibold text-slate-600">{b.detail}</p>
                          {b.materials.length > 0 && (
                            <div>
                              <p className="eyebrow mb-1.5">Materials</p>
                              <div className="flex flex-wrap gap-1.5">{b.materials.map((m) => <Pill key={m} className="bg-white text-slate-600 ring-1 ring-line">{m}</Pill>)}</div>
                            </div>
                          )}
                          {b.objectives.length > 0 && (
                            <div>
                              <p className="eyebrow mb-1.5">Learning goals</p>
                              <ul className="space-y-1">{b.objectives.map((o) => <li key={o} className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Sparkles size={13} className="text-grape-500" /> {o}</li>)}</ul>
                            </div>
                          )}
                          <div>
                            <p className="eyebrow mb-1.5">Who took part ({b.doneChildren.length}/{present.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {present.map((r) => {
                                const on = (b.doneChildIds || []).includes(r.childId)
                                return (
                                  <button key={r.childId} disabled={busy || selection.date !== dateInFacility(selection.facility)} onClick={() => act(() => toggleLessonChild({ id: b.id, childId:r.childId, date:selection.date }))}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${on ? 'border-transparent bg-mint-500 text-white' : 'border-line bg-white text-slate-500'}`}>
                                    {on ? <Check size={12} /> : <span className="text-sm leading-none">{r.emoji}</span>} {r.name.split(' ')[0]}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
            {dayBlocks.length === 0 && <Card><p className="py-6 text-center text-sm font-semibold text-slate-400">No blocks planned for {day} yet.</p></Card>}
          </div>
        </>
      ) : (
        <TrainingList resources={resources} />
      )}
    </div>
  )
}

function StatusDot({ status }) {
  if (status === 'done') return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint-500 text-white"><Check size={16} /></span>
  if (status === 'active') return <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-brand-500 text-brand-500"><Play size={13} className="fill-brand-500" /></span>
  return <span className="h-7 w-7 rounded-full border-2 border-slate-300" />
}

/* ===================== TRAINING (shared) ===================== */
function typeMeta(t) {
  if (t === 'video') return { Icon: Video, tile: 'bg-coral-500' }
  if (t === 'article') return { Icon: FileText, tile: 'bg-brand-500' }
  return { Icon: Link2, tile: 'bg-grape-500' }
}
function TrainingList({ resources, onRemove }) {
  return (
    <div className="space-y-3">
      {resources.length === 0 && <Card><p className="py-6 text-center text-sm font-semibold text-slate-400">No training materials yet.</p></Card>}
      {resources.map((r, i) => {
        const { Icon, tile } = typeMeta(r.type)
        return (
          <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="card flex items-center gap-3 p-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tile} text-white shadow-md`}><Icon size={20} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-extrabold text-slate-800">{r.title}</div>
              <div className="truncate text-xs font-semibold text-slate-400">{r.note}</div>
              <Pill className="mt-1 bg-slate-100 text-slate-500">{r.category}</Pill>
            </div>
            <a href={r.url} target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-2 text-sm"><ExternalLink size={15} /> Open</a>
            {onRemove && <button onClick={() => onRemove({ id: r.id })} className="rounded-xl p-2 text-slate-300 hover:bg-coral-400/10 hover:text-coral-600"><Trash2 size={17} /></button>}
          </motion.div>
        )
      })}
    </div>
  )
}

/* ===================== DIRECTOR ===================== */
export function DirectorCurriculum() {
  const {
    lessonPlan, lessonBlocks, setLessonTheme, addLessonBlock, updateLessonBlock, deleteLessonBlock,
    resources, addResource, removeResource, pushToast,
  } = useApp()
  const selection = useWorkingPlan()
  const [tab, setTab] = useState('plan')

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Curriculum studio" title="Lesson plans & training 🎓" subtitle="Build the week your educators run — and the materials that grow them" />
      <Tabs tab={tab} setTab={setTab} items={[{ id: 'plan', label: 'Lesson builder' }, { id: 'training', label: 'Training library' }, { id: 'family', label: 'Family plans' }]} />
      {tab === 'family' ? <><PlanSelection selection={selection}/><FamilyPlanManager lessonPlan={selection.plan} lessonBlocks={selection.blocks} /></> : tab === 'plan' ? (
        <Builder
          plan={selection.plan} blocks={selection.blocks} selection={selection}
          setTheme={setLessonTheme} addBlock={addLessonBlock} updateBlock={updateLessonBlock} deleteBlock={deleteLessonBlock}
          pushToast={pushToast}
        />
      ) : (
        <TrainingManager resources={resources} addResource={addResource} removeResource={removeResource} pushToast={pushToast} />
      )}
    </div>
  )
}

function Builder({ plan, blocks, selection, setTheme, addBlock, updateBlock, deleteBlock, pushToast }) {
  const day = dayForDate(selection.date)
  const setDay = next => selection.setDate(moveDate(selection.startDate,DAYS.indexOf(next)))
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [themeTarget,setThemeTarget] = useState(null)
  const [editingTheme, setEditingTheme] = useState(false)
  const [theme, setThemeVal] = useState(plan?.theme || '')
  const [week, setWeekVal] = useState(plan?.week || '')
  const [form, setForm] = useState(null) // null | {id?, ...fields}

  const dayBlocks = blocks.filter((b) => b.day === day).sort((a, b) => a.order - b.order)

  const saveTheme = async () => { if(busy) return; setBusy(true); setError(''); try { await setTheme({theme,week,...themeTarget}); setEditingTheme(false); pushToast('Dated classroom theme saved', {emoji:'🎓',tone:'mint'}) } catch(err) {setError(err.message || 'Could not save theme. Your draft is still here.')} finally {setBusy(false)} }
  const startAdd = () => setForm({time:'',title:'',detail:'',program:'Routine',materials:'',objectives:'',date:selection.date,room:selection.room,planId:plan?.id})
  const startEdit = (b) => setForm({ id: b.id, date:b.date || selection.date, room:b.room, time: b.time, title: b.title, detail: b.detail, program: b.program, materials: b.materials.join(', '), objectives: b.objectives.join(', ') })
  const submitForm = async () => {
    if (busy) return
    setBusy(true); setError('')
    const payload = {
      time: form.time, title: form.title, detail: form.detail, program: form.program,
      materials: form.materials.split(',').map((s) => s.trim()).filter(Boolean),
      objectives: form.objectives.split(',').map((s) => s.trim()).filter(Boolean),
    }
    try {
      if (form.id) await updateBlock({id:form.id,...payload})
      else await addBlock({day:dayForDate(form.date),date:form.date,room:form.room,planId:form.planId,...payload})
      pushToast(form.id ? 'Block updated' : 'Dated classroom block saved', {emoji:'✅',tone:'mint'})
      setForm(null)
    } catch(err) {setError(err.message || 'Could not save. Your block draft is still here.')} finally {setBusy(false)}

  }

  return (
    <div className="space-y-4">
      <PlanSelection selection={selection} />
      {error && <p role="alert" className="rounded-xl bg-coral-50 p-3 text-sm text-coral-700">{error}</p>}
      {selection.loading && <p role="status" className="text-sm text-slate-500">Loading plan…</p>}
      {/* Theme editor */}
      <Card className="!p-4">
        {editingTheme ? (
          <div className="space-y-2">
            <input className="input" value={theme} onChange={(e) => setThemeVal(e.target.value)} placeholder="Weekly theme" />
            <input className="input" value={week} onChange={(e) => setWeekVal(e.target.value)} placeholder="Week label" />
            <div className="flex gap-2">
              <button onClick={saveTheme} disabled={busy} className="btn-primary flex-1 !py-2 text-sm"><Save size={15} /> Save theme</button>
              <button onClick={() => setEditingTheme(false)} disabled={busy} className="btn-ghost !py-2 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">This week’s theme</p>
              <h3 className="text-xl text-slate-800">{plan?.theme || 'Untitled'}</h3>
              <p className="text-xs font-bold text-slate-400">{plan?.week}</p>
            </div>
            <button onClick={() => { setThemeVal(plan?.theme || ''); setWeekVal(plan?.week || `${selection.startDate} – ${selection.endDate}`); setThemeTarget({room:selection.room,startDate:selection.startDate,endDate:selection.endDate}); setEditingTheme(true) }} className="btn-ghost !py-2 text-sm"><Pencil size={14} /> Edit</button>
          </div>
        )}
      </Card>

      <DayTabs day={day} setDay={setDay} />

      <div className="space-y-2.5">
        {dayBlocks.map((b) => (
          <div key={b.id} className="card flex items-center gap-3 p-3.5">
            <div className="w-16 shrink-0 font-mono text-[11px] font-bold uppercase tracking-wide text-slate-400">{b.time}</div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-slate-800">{b.title}</div>
              <Pill className={`mt-1 ${PROGRAM_PILL[b.program]}`}>{PROGRAM_EMOJI[b.program]} {b.program}</Pill>
            </div>
            <button onClick={() => startEdit(b)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil size={16} /></button>
            <button disabled={busy} aria-label={`Delete ${b.title}`} onClick={async () => {if(!window.confirm(`Remove ${b.title}?`)) return; setBusy(true); setError(''); try {await deleteBlock({id:b.id}); pushToast('Block removed',{emoji:'🗑️',tone:'coral'})} catch(err) {setError(err.message || 'Could not remove block.')} finally {setBusy(false)}}} className="rounded-xl p-2 text-slate-300 hover:bg-coral-400/10 hover:text-coral-600"><Trash2 size={16} /></button>
          </div>
        ))}
        {dayBlocks.length === 0 && <Card><p className="py-5 text-center text-sm font-semibold text-slate-400">No blocks for {day}. Add the first one.</p></Card>}
      </div>

      {form ? (
        <Card className="space-y-3 ring-2 ring-brand-200">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-800">{form.id ? 'Edit block' : `Add block · ${form.date} · ${form.room}`}</h3>
            <button disabled={busy} onClick={() => setForm(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Time"><input className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="10:00 AM" /></Labeled>
            <Labeled label="Program">
              <select className="input" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })}>
                {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Labeled>
          </div>
          <Labeled label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Activity title" /></Labeled>
          <Labeled label="Description"><textarea rows={2} className="input resize-none" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} placeholder="What educators do with the children" /></Labeled>
          <Labeled label="Materials (comma-separated)"><input className="input" value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} placeholder="Globe, flag, picture book" /></Labeled>
          <Labeled label="Learning goals (comma-separated)"><input className="input" value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} placeholder="Turn-taking, Geography awareness" /></Labeled>
          <button onClick={submitForm} disabled={busy || !form.title || !form.time} className="btn-primary w-full"><Save size={16} /> {form.id ? 'Save changes' : 'Add to plan'}</button>
        </Card>
      ) : (
        <button onClick={startAdd} className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 bg-white py-4 font-bold text-slate-500 transition hover:border-brand-300 hover:text-brand-600">
          <Plus size={18} /> Add a block to {day}
        </button>
      )}
    </div>
  )
}

function TrainingManager({ resources, addResource, removeResource, pushToast }) {
  const [form, setForm] = useState(null)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const startAdd = () => setForm({ title: '', url: '', type: 'video', note: '', category: '' })
  const submit = async () => {
    if(busy) return; setError('')
    try { const url=new URL(form.url); if(!['https:','http:'].includes(url.protocol)) throw Error('Use a valid https:// link.') } catch {setError('Use a valid https:// training link.');return}
    setBusy(true)
    try { await addResource({title:form.title,url:form.url,type:form.type,note:form.note,category:form.category || 'General'}); pushToast('Shared with all educators',{emoji:'📚',tone:'mint'}); setForm(null) }
    catch(err) {setError(err.message || 'Could not share. Your draft is still here.')} finally {setBusy(false)}
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-500">Share websites and YouTube videos as ongoing training. Everything here appears in every educator’s <span className="font-bold text-slate-600">Training</span> tab.</p>
      {error && <p role="alert" className="rounded-xl bg-coral-50 p-3 text-sm text-coral-700">{error}</p>}
      <TrainingList resources={resources} onRemove={async a => {if(busy) return; setBusy(true);setError('');try{await removeResource(a);pushToast('Removed',{emoji:'🗑️',tone:'coral'})}catch(err){setError(err.message || 'Could not remove training material.')}finally{setBusy(false)}}} />
      {form ? (
        <Card className="space-y-3 ring-2 ring-brand-200">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-800">Add training material</h3>
            <button disabled={busy} onClick={() => setForm(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
          </div>
          <Labeled label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Serve & Return (video)" /></Labeled>
          <Labeled label="Link (website or YouTube)"><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></Labeled>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Type">
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="video">YouTube / video</option>
                <option value="article">Article</option>
                <option value="link">Website / link</option>
              </select>
            </Labeled>
            <Labeled label="Category"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Child development" /></Labeled>
          </div>
          <Labeled label="Note"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Why it matters" /></Labeled>
          <button onClick={submit} disabled={busy || !form.title || !form.url} className="btn-primary w-full"><Plus size={16} /> Share with educators</button>
        </Card>
      ) : (
        <button onClick={startAdd} className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 bg-white py-4 font-bold text-slate-500 transition hover:border-brand-300 hover:text-brand-600">
          <Plus size={18} /> Add training material
        </button>
      )}
    </div>
  )
}

function Labeled({ label, children }) {
  return <label className="block"><span className="eyebrow mb-1.5 block">{label}</span>{children}</label>
}

const blankFamilyPlan = { title: '', kind: 'learning', period: 'week', startDate: '', endDate: '', room: '', overview: '', activities: '', goals: '', attachments: [], agenda: [] }
export function FamilyPlanManager({lessonPlan,lessonBlocks}) {
  const plans = useQuery(api.lessons.familyPlans, {})
  const save = useMutation(api.lessons.saveFamilyPlan)
  const publish = useMutation(api.lessons.publishFamilyPlan)
  const remove = useMutation(api.lessons.removeFamilyPlan)
  const { pushToast, childrenList = [], facility } = useApp()
  const [form, setForm] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const set = key => e => {
    const value = e.target.value
    setForm(current => ({ ...current, [key]: value, ...(key === 'period' && value === 'day' ? { endDate: current.startDate } : {}), ...(key === 'startDate' && current.period === 'day' ? { endDate: value } : {}) }))
  }
  const rooms = [...new Set([...childrenList.map(child => child.room), ...(plans || []).map(plan => plan.room), lessonPlan?.room].filter(room => room && room !== 'Unassigned'))].sort()
  const submit = async e => {
    e.preventDefault(); if (busy || uploading) return; setBusy(true); setError('')
    try {
      const fields = Object.fromEntries(Object.keys(blankFamilyPlan).map(k => [k, k === 'room' ? form[k] || undefined : form[k]]))
      if (fields.period === 'day') fields.endDate = fields.startDate
      await save({ ...fields, ...(form.id ? { id: form.id } : {}) })
      setForm(null); pushToast('Draft saved. Publish when you’re ready for families to see it.', { emoji: '📚', tone: 'mint' })
    } catch (err) { setError(err.message || 'Could not save the plan.') } finally { setBusy(false) }
  }
  const changePublish = async plan => {
    if (busy || uploading) return
    setError(''); setBusy(true)
    try { const delivery = await publish({ id: plan.id, published: plan.status !== 'published' }); pushToast(plan.status === 'published' ? 'Plan returned to draft' : `Update is now visible to families${delivery?.queued ? `. ${delivery.queued} parent email ${delivery.queued === 1 ? 'alert' : 'alerts'} queued.` : ''}`, { emoji: '📚', tone: 'mint' }) }
    catch (err) { setError(err.message || 'Could not update publication.') } finally { setBusy(false) }
  }
  const erase = async plan => {
    if (busy || uploading) return
    if (!window.confirm(`Delete the family plan “${plan.title}”?`)) return
    setBusy(true);setError('')
    try { await remove({ id: plan.id }) } catch (err) { setError(err.message || 'Could not remove the plan.') } finally {setBusy(false)}
  }
  const copy = async plan => {
    try { await navigator.clipboard.writeText(`${plan.title}\n${plan.startDate} – ${plan.endDate}\n${plan.room || 'All rooms'}\n\n${plan.overview}\n\nActivities\n${plan.activities}\n\nLearning goals\n${plan.goals}`); pushToast('Plan copied for sharing', { emoji: '📋' }) }
    catch { setError('Copy unavailable. Open the preview to select the plan text.') }
  }
  const useWorkingPlan = () => {
    const activities = [...lessonBlocks].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.order - b.order).map(b => `${b.day} · ${b.title}\n${b.detail}`).join('\n\n')
    const goals = [...new Set(lessonBlocks.flatMap(b => b.objectives || []))].join('\n')
    setForm({ ...blankFamilyPlan, title: lessonPlan?.theme || '', room: lessonPlan?.room || '', startDate:lessonPlan?.startDate || '', endDate:lessonPlan?.endDate || '', activities, goals })
    setError('')
  }
  const uploadSchedule = () => {
    const startDate = dateInFacility(facility)
    setForm({ ...blankFamilyPlan, title: 'Class schedule', kind: 'schedule', room: lessonPlan?.room || '', startDate, endDate: moveDate(startDate, 6) })
    setError('')
  }
  return <div className="space-y-4">
    <Card><h3 className="text-xl text-slate-800">Share class schedules and learning plans</h3><p className="mt-2 text-sm text-slate-600">Upload a photo or PDF, add a daily, weekly or monthly overview, and choose the class. A shared class schedule photo appears prominently on parents’ Dashboard throughout its date range. Save a draft and preview it before sharing. Sharing new files adds them to the family calendar and queues email alerts for parents with an enrolled child in that class. Drafts do not send emails. Saving changes returns a shared update to draft until you share it again.</p><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy || uploading} className="btn-primary" onClick={uploadSchedule}><FileText size={16} />Upload class schedule</button><button disabled={busy || uploading} className="btn-ghost" onClick={() => { setForm({ ...blankFamilyPlan, room: lessonPlan?.room || '' }); setError('') }}><Plus size={16} />New family update</button><button disabled={busy || uploading} className="btn-ghost" onClick={useWorkingPlan}>Start from current lesson plan</button></div></Card>
    {error && <p role="alert" className="rounded-xl bg-coral-50 p-3 text-sm text-coral-700">{error}</p>}
    {form && <Card><form className="space-y-3" onSubmit={submit}>
      <div className="flex justify-between"><h3 className="text-xl">{form.id ? 'Edit family update' : 'New family update'}</h3><button type="button" disabled={busy || uploading} aria-label="Close family plan editor" onClick={() => setForm(null)}><X size={18} /></button></div>
      <label className="block text-sm font-semibold">Title<input className="input mt-1" required maxLength={160} value={form.title} onChange={set('title')} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Update type<select className="input mt-1" value={form.kind} onChange={set('kind')}><option value="learning">Learning plan</option><option value="schedule">Class schedule</option></select></label><label className="text-sm font-semibold">Period<select className="input mt-1" value={form.period} onChange={set('period')}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label></div>
      <label className="block text-sm font-semibold">Class<input className="input mt-1" list="family-plan-classes" value={form.room} maxLength={100} onChange={set('room')} placeholder="Leave empty for all classes" /><datalist id="family-plan-classes">{rooms.map(room => <option value={room} key={room} />)}</datalist></label><p className="text-xs text-slate-500">Choose the class name used on the children’s enrolments. Leave empty only when this update applies to every class.</p>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">{form.period === 'day' ? 'Date' : 'From'}<input type="date" className="input mt-1" required value={form.startDate} onChange={set('startDate')} /></label>{form.period !== 'day' && <label className="text-sm font-semibold">Through<input type="date" className="input mt-1" required min={form.startDate} value={form.endDate} onChange={set('endDate')} /></label>}</div>
      {form.kind === 'schedule' && <p className="text-sm text-slate-600">Check the dates for how long families should see this schedule. A photo is enough to share it; no time blocks are required. Add optional time blocks below to show parents and educators what is scheduled now and next. Text and times are not read automatically from the photo.</p>}
      <PlanAttachmentEditor attachments={form.attachments || []} onChange={attachments => setForm(current => ({ ...current, attachments }))} disabled={busy} onBusyChange={setUploading} />
      {form.kind === 'schedule' && <ScheduleAgendaEditor value={form.agenda || []} onChange={agenda => setForm(current => ({ ...current, agenda }))} disabled={busy || uploading} />}
      {[['overview', 'Overview for parents'], ['activities', 'Activities to look forward to'], ['goals', 'Learning goals']].map(([key, label]) => <label key={key} className="block text-sm font-semibold">{label}<textarea rows={key === 'activities' ? 6 : 3} maxLength={15000} className="input mt-1" value={form[key]} onChange={set(key)} /></label>)}
      <button className="btn-primary" disabled={busy || uploading}><Save size={16} />{uploading ? 'Wait for files to finish uploading…' : busy ? 'Saving…' : 'Save draft'}</button>
    </form></Card>}
    {plans === undefined ? <p className="text-sm text-slate-500">Loading plans…</p> : !plans.length ? <Card><p className="text-sm text-slate-600">No family updates yet. Add a schedule photo or a daily, weekly or monthly learning plan above.</p></Card> : plans.map(plan => <Card key={plan.id}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><Pill className={plan.status === 'published' ? 'bg-mint-100 text-mint-700' : 'bg-slate-100 text-slate-500'}>{plan.status === 'published' ? 'Visible to families' : 'Draft · private'}</Pill><h3 className="mt-2 text-xl">{plan.title}</h3><p className="mt-1 text-sm text-slate-500">{plan.startDate} – {plan.endDate} · {plan.room || 'All rooms'}</p></div><button disabled={busy || uploading} onClick={() => erase(plan)} className="p-2 text-coral-500" aria-label={`Delete ${plan.title}`}><Trash2 size={16} /></button></div>
      {plan.attachments?.length > 0 && <p className="mt-2 text-sm text-slate-500">{plan.attachments.length} attached {plan.attachments.length === 1 ? 'file' : 'files'}</p>}
      <div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary !py-2 text-sm" disabled={busy || uploading} onClick={() => changePublish(plan)}>{plan.status === 'published' ? 'Unpublish' : 'Share with parents'}</button><button disabled={busy || uploading} className="btn-ghost !py-2 text-sm" onClick={() => { setForm({ ...blankFamilyPlan, ...plan, attachments: plan.attachments || [], agenda: plan.agenda || [], room: plan.room || '' }); setError('') }}><Pencil size={14} />Edit</button><button className="btn-ghost !py-2 text-sm" onClick={() => setPreview(preview === plan.id ? null : plan.id)}>Preview</button><button className="btn-ghost !py-2 text-sm" onClick={() => copy(plan)}>Copy for sharing</button></div>
      {plan.attachments?.length > 0 && <FamilyPlanEmailStatus planId={plan.id} />}
      {preview === plan.id && <div className="mt-4 border-t border-line pt-4"><FamilyLearningPlan plan={plan} /></div>}
    </Card>)}
  </div>
}
