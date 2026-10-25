import { useState, useRef, useEffect } from 'react'
import { Send, ArrowLeft, Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { KnitEmpty } from '../components/ui.jsx'

export default function Messages() {
  const {conversations,sendMessage,markConversationRead,role}=useApp()
  const [activeId,setActiveId]=useState(null)
  const [drafts,setDrafts]=useState({})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const threadRef=useRef(null)
  const active=conversations.find(c=>c.id===activeId) || conversations[0]
  const draft=drafts[active?.id] || ''
  useEffect(()=>{
    if(threadRef.current) threadRef.current.scrollTop=threadRef.current.scrollHeight
    if(active?.unread && (activeId || window.matchMedia('(min-width:1024px)').matches)) markConversationRead(active.id).catch(()=>setError('Could not update read status.'))
  },[active?.id,active?.messages.length,active?.unread,activeId,markConversationRead])
  const send=async e=>{
    e?.preventDefault()
    if(!draft.trim() || !active || busy) return
    const id=active.id;const text=draft.trim();setBusy(true);setError('')
    try {await sendMessage(id,text);setDrafts(current=>({...current,[id]:current[id]?.trim()===text?'':current[id]}))}
    catch {setError('Message was not sent. Your draft is still here; please retry.')}
    finally {setBusy(false)}
  }
  if(!conversations.length) return <KnitEmpty image="/cinema/spots/letter.webp" title="No conversations yet" hint={role==='parent'?'Your daycare will start a family conversation after linking your child.':'A private family thread appears when a parent joins. Invite a guardian from Families or Account.'}/>
  return <div className="grid min-h-0 gap-4 lg:h-[calc(100dvh-11rem)] lg:grid-cols-[300px_minmax(0,1fr)]">
    <section aria-label="Conversation inbox" className={`card min-h-0 flex-col overflow-hidden !p-0 ${activeId?'hidden lg:flex':'flex'}`}>
      <div className="border-b border-line p-4"><h2 className="text-xl">Messages</h2><p className="text-sm text-slate-500">Private conversations with {role==='parent'?'your daycare':'families'}</p></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">{conversations.map(c=><button key={c.id} onClick={()=>{setActiveId(c.id);setError('')}} className={`mb-1 flex min-h-20 w-full items-center gap-3 rounded-2xl p-3 text-left ${c.id===active?.id?'bg-brand-50':'hover:bg-slate-50'}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">{c.emoji}</span>
        <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{c.name}</strong>{c.unread>0&&<span className="rounded-full bg-coral-500 px-2 py-1 text-xs text-white">{c.unread} unread</span>}</span><span className="mt-1 block truncate text-xs text-slate-500">{c.messages.at(-1)?.text || 'Start a conversation'}</span>{drafts[c.id]&&<span className="text-xs text-brand-600">Draft saved in this conversation</span>}</span>
      </button>)}</div>
    </section>
    <section aria-label="Conversation" className={`card h-[calc(100dvh-12rem)] min-h-[320px] min-w-0 flex-col overflow-hidden !p-0 lg:h-auto ${activeId?'flex':'hidden lg:flex'}`}>
      {active&&<><header className="flex shrink-0 items-center gap-3 border-b border-line p-3"><button aria-label="Back to inbox" className="btn-ghost !px-3 lg:hidden" onClick={()=>setActiveId(null)}><ArrowLeft size={18}/></button><span className="text-2xl">{active.emoji}</span><div className="min-w-0"><h2 className="truncate text-base font-bold">{active.name}</h2><p className="text-xs text-slate-500">{active.role}</p></div></header>
      <div ref={threadRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50 p-4">{active.messages.map(m=><div key={m.id} className={`flex ${m.from==='me'?'justify-end':'justify-start'}`}><div className={`max-w-[85%] break-words rounded-2xl px-4 py-3 text-sm ${m.from==='me'?'bg-brand-600 text-white':'bg-white text-slate-700 shadow-sm'}`}><p className="whitespace-pre-wrap">{m.text}</p><p className={`mt-1 text-[11px] ${m.from==='me'?'text-white/80':'text-slate-500'}`}>{m.authorName && m.from!=='me'?m.authorName+' · ':''}{m.sentAt?new Date(m.sentAt).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):m.time}</p></div></div>)}{!active.messages.length&&<p className="text-sm text-slate-500">No messages yet. Write the first one below.</p>}</div>
      <form onSubmit={send} className="shrink-0 border-t border-line bg-white p-3">{error&&<p role="alert" className="mb-2 text-sm text-coral-600">{error}</p>}<div className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Message</span><textarea rows={2} maxLength={5000} value={draft} onChange={e=>setDrafts(current=>({...current,[active.id]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}} placeholder="Write a message…" className="input min-h-12 resize-none"/></label><button type="submit" disabled={busy||!draft.trim()} aria-label="Send message" className="btn-primary min-h-12 !px-4">{busy?<Loader2 size={18} className="animate-spin"/>:<Send size={18}/>}</button></div><p className="mt-1 text-[11px] text-slate-400">Enter to send · Shift + Enter for a new line</p></form></>}
    </section>
  </div>
}
