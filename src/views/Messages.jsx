import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Circle } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { KnitEmpty } from '../components/ui.jsx'

export default function Messages() {
  const { conversations, sendMessage, markConversationRead } = useApp()
  const [activeId, setActiveId] = useState(null)
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)

  // Fall back to the first conversation until the user picks one (data loads async).
  const active = conversations.find((c) => c.id === activeId) || conversations[0]

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages.length])

  const handleSend = () => {
    if (!draft.trim() || !active) return
    sendMessage(active.id, draft.trim())
    setDraft('')
  }

  if (conversations.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center">
        <KnitEmpty
          image="/cinema/spots/letter.webp"
          title="No conversations yet"
          hint="Family message threads appear here the moment parents join. Invite a family from Account → Family links, and you can chat right away."
        />
      </div>
    )
  }

  return (
    <div className="grid h-[calc(100vh-9rem)] gap-4 lg:grid-cols-[320px_1fr]">
      {/* Conversation list */}
      <div className="card flex flex-col overflow-hidden p-0">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-lg font-extrabold text-slate-800">Messages</h2>
          <p className="text-xs font-bold text-slate-400">Chat with your child’s teachers</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setActiveId(c.id)
                markConversationRead(c.id)
              }}
              className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                c.id === active?.id ? 'bg-brand-50 ring-1 ring-brand-100' : 'hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-xl">{c.emoji}</span>
                {c.online && <Circle size={11} className="absolute -bottom-0.5 -right-0.5 fill-mint-400 text-mint-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-extrabold text-slate-700">{c.name}</span>
                  {c.unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-500 px-1.5 text-[11px] font-extrabold text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs font-semibold text-slate-400">
                  {c.messages[c.messages.length - 1]?.text}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="card flex flex-col overflow-hidden p-0">
        {active && (
          <>
            <div className="flex items-center gap-3 border-b border-slate-100 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-xl">{active.emoji}</span>
              <div>
                <div className="text-sm font-extrabold text-slate-800">{active.name}</div>
                <div className="text-xs font-bold text-slate-400">
                  {active.online ? <span className="text-mint-500">● Online now</span> : active.role}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-4">
              {active.messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-3xl px-4 py-2.5 text-sm font-semibold shadow-sm ${
                      m.from === 'me'
                        ? 'rounded-br-md bg-gradient-to-br from-brand-500 to-brand-600 text-white'
                        : 'rounded-bl-md bg-white text-slate-700 ring-1 ring-slate-100'
                    }`}
                  >
                    {m.text}
                    <div className={`mt-1 text-[10px] font-bold ${m.from === 'me' ? 'text-white/70' : 'text-slate-400'}`}>{m.time}</div>
                  </div>
                </motion.div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Write a message…"
                className="input"
              />
              <button onClick={handleSend} className="btn-primary !px-3.5">
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
