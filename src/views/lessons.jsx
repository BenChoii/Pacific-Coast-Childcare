import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Check, ChevronDown, Plus, Pencil, Trash2, BookOpen, Video, FileText,
  Link2, ExternalLink, GraduationCap, Sparkles, Save, X, Users, Play, CircleDot,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Card, SectionHeader, Pill, ProgressBar } from '../components/ui.jsx'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
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

function todayDay() {
  return ['Mon', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Fri'][new Date().getDay()]
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
  const { lessonPlan, lessonBlocks, roster, resources, setLessonStatus, toggleLessonChild } = useApp()
  const [tab, setTab] = useState('plan')
  const [day, setDay] = useState(todayDay())
  const [openId, setOpenId] = useState(null)

  const dayBlocks = lessonBlocks.filter((b) => b.day === day).sort((a, b) => a.order - b.order)
  const done = dayBlocks.filter((b) => b.status === 'done').length
  const present = roster.filter((r) => r.status !== 'absent' && r.status !== 'checked-out')

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Curriculum" title="Lesson plans 📚" subtitle={lessonPlan?.theme ? `${lessonPlan.theme} · ${lessonPlan.week}` : 'This week'} />
      <Tabs tab={tab} setTab={setTab} items={[{ id: 'plan', label: 'This week' }, { id: 'training', label: 'Training' }]} />

      {tab === 'plan' ? (
        <>
          <DayTabs day={day} setDay={setDay} />
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
                      onClick={() => setLessonStatus({ id: b.id, status: NEXT_STATUS[b.status] })}
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
                                const on = b.doneChildren.includes(r.name)
                                return (
                                  <button key={r.id} onClick={() => toggleLessonChild({ id: b.id, child: r.name })}
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
  const [tab, setTab] = useState('plan')

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Curriculum studio" title="Lesson plans & training 🎓" subtitle="Build the week your educators run — and the materials that grow them" />
      <Tabs tab={tab} setTab={setTab} items={[{ id: 'plan', label: 'Lesson builder' }, { id: 'training', label: 'Training library' }]} />
      {tab === 'plan' ? (
        <Builder
          plan={lessonPlan} blocks={lessonBlocks}
          setTheme={setLessonTheme} addBlock={addLessonBlock} updateBlock={updateLessonBlock} deleteBlock={deleteLessonBlock}
          pushToast={pushToast}
        />
      ) : (
        <TrainingManager resources={resources} addResource={addResource} removeResource={removeResource} pushToast={pushToast} />
      )}
    </div>
  )
}

function Builder({ plan, blocks, setTheme, addBlock, updateBlock, deleteBlock, pushToast }) {
  const [day, setDay] = useState(todayDay())
  const [editingTheme, setEditingTheme] = useState(false)
  const [theme, setThemeVal] = useState(plan?.theme || '')
  const [week, setWeekVal] = useState(plan?.week || '')
  const [form, setForm] = useState(null) // null | {id?, ...fields}

  const dayBlocks = blocks.filter((b) => b.day === day).sort((a, b) => a.order - b.order)

  const saveTheme = () => { setTheme({ theme, week }); setEditingTheme(false); pushToast('Theme updated for all educators', { emoji: '🎓', tone: 'mint' }) }
  const startAdd = () => setForm({ time: '', title: '', detail: '', program: 'Routine', materials: '', objectives: '' })
  const startEdit = (b) => setForm({ id: b.id, time: b.time, title: b.title, detail: b.detail, program: b.program, materials: b.materials.join(', '), objectives: b.objectives.join(', ') })
  const submitForm = () => {
    const payload = {
      time: form.time, title: form.title, detail: form.detail, program: form.program,
      materials: form.materials.split(',').map((s) => s.trim()).filter(Boolean),
      objectives: form.objectives.split(',').map((s) => s.trim()).filter(Boolean),
    }
    if (form.id) { updateBlock({ id: form.id, ...payload }); pushToast('Block updated', { emoji: '✏️', tone: 'brand' }) }
    else { addBlock({ day, ...payload }); pushToast('Block added — live for educators', { emoji: '✅', tone: 'mint' }) }
    setForm(null)
  }

  return (
    <div className="space-y-4">
      {/* Theme editor */}
      <Card className="!p-4">
        {editingTheme ? (
          <div className="space-y-2">
            <input className="input" value={theme} onChange={(e) => setThemeVal(e.target.value)} placeholder="Weekly theme" />
            <input className="input" value={week} onChange={(e) => setWeekVal(e.target.value)} placeholder="Week label" />
            <div className="flex gap-2">
              <button onClick={saveTheme} className="btn-primary flex-1 !py-2 text-sm"><Save size={15} /> Save theme</button>
              <button onClick={() => setEditingTheme(false)} className="btn-ghost !py-2 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">This week’s theme</p>
              <h3 className="text-xl text-slate-800">{plan?.theme || 'Untitled'}</h3>
              <p className="text-xs font-bold text-slate-400">{plan?.week}</p>
            </div>
            <button onClick={() => { setThemeVal(plan?.theme || ''); setWeekVal(plan?.week || ''); setEditingTheme(true) }} className="btn-ghost !py-2 text-sm"><Pencil size={14} /> Edit</button>
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
            <button onClick={() => { deleteBlock({ id: b.id }); pushToast('Block removed', { emoji: '🗑️', tone: 'coral' }) }} className="rounded-xl p-2 text-slate-300 hover:bg-coral-400/10 hover:text-coral-600"><Trash2 size={16} /></button>
          </div>
        ))}
        {dayBlocks.length === 0 && <Card><p className="py-5 text-center text-sm font-semibold text-slate-400">No blocks for {day}. Add the first one.</p></Card>}
      </div>

      {form ? (
        <Card className="space-y-3 ring-2 ring-brand-200">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-800">{form.id ? 'Edit block' : `Add block · ${day}`}</h3>
            <button onClick={() => setForm(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
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
          <button onClick={submitForm} disabled={!form.title || !form.time} className="btn-primary w-full"><Save size={16} /> {form.id ? 'Save changes' : 'Add to plan'}</button>
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
  const startAdd = () => setForm({ title: '', url: '', type: 'video', note: '', category: '' })
  const submit = () => {
    addResource({ title: form.title, url: form.url, type: form.type, note: form.note, category: form.category || 'General' })
    pushToast('Shared with all educators', { emoji: '📚', tone: 'mint' })
    setForm(null)
  }
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-500">Share websites and YouTube videos as ongoing training. Everything here appears in every educator’s <span className="font-bold text-slate-600">Training</span> tab.</p>
      <TrainingList resources={resources} onRemove={(a) => { removeResource(a); pushToast('Removed', { emoji: '🗑️', tone: 'coral' }) }} />
      {form ? (
        <Card className="space-y-3 ring-2 ring-brand-200">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-800">Add training material</h3>
            <button onClick={() => setForm(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
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
          <button onClick={submit} disabled={!form.title || !form.url} className="btn-primary w-full"><Plus size={16} /> Share with educators</button>
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
