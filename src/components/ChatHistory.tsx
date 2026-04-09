/**
 * ChatHistory.tsx
 * Affiche l'historique des sessions de chat IA.
 * Utilisable dans OperationDetail ou en page dédiée.
 */

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { MessageSquare, ChevronDown, ChevronRight, Sparkles, Clock, Loader2, User, Bot } from 'lucide-react'

interface ChatSession {
  id: string
  operation_id: string | null
  page_url: string | null
  model: string | null
  resume: string | null
  nb_messages: number
  created_at: string
  closed_at: string | null
  statut: string
  code_operation?: string
  nom_operation?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  element_context: any
  created_at: string
}

interface ChatHistoryProps {
  operationId?: string
  maxSessions?: number
}

function SessionCard({ session }: { session: ChatSession }) {
  const [expanded, setExpanded]   = useState(false)
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [loading, setLoading]     = useState(false)

  const loadMessages = async () => {
    if (messages.length > 0) { setExpanded(e => !e); return }
    setLoading(true)
    try {
      const data = await api(`/api/chat/sessions/${session.id}/messages`)
      setMessages(data)
      setExpanded(true)
    } catch {}
    finally { setLoading(false) }
  }

  const date = new Date(session.created_at)
  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      {/* Header session */}
      <button onClick={loadMessages}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left">
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
          <MessageSquare size={14} className="text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-800">
              {dateStr} à {timeStr}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              session.closed_at
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {session.closed_at ? 'Résumée' : 'Ouverte'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-stone-400">{session.nb_messages} messages</span>
            {session.model && (
              <span className="text-xs text-stone-400">· {session.model.split('-')[0]}</span>
            )}
            {session.page_url && (
              <span className="text-xs text-stone-400">· {session.page_url}</span>
            )}
          </div>
        </div>
        {loading
          ? <Loader2 size={13} className="text-stone-400 animate-spin flex-shrink-0" />
          : expanded
          ? <ChevronDown size={13} className="text-stone-400 flex-shrink-0" />
          : <ChevronRight size={13} className="text-stone-400 flex-shrink-0" />
        }
      </button>

      {/* Résumé */}
      {session.resume && (
        <div className="px-4 pb-3 pt-0">
          <div className="flex items-start gap-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2.5">
            <Sparkles size={12} className="text-brand-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-medium text-brand-700 mb-1">Résumé IA</div>
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{session.resume}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {expanded && messages.length > 0 && (
        <div className="border-t border-stone-100">
          <div className="px-4 py-2 bg-stone-50 border-b border-stone-100">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">Conversation</span>
          </div>
          <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  msg.role === 'user' ? 'bg-stone-200' : 'bg-brand-100'
                }`}>
                  {msg.role === 'user'
                    ? <User size={11} className="text-stone-600" />
                    : <Bot size={11} className="text-brand-600" />
                  }
                </div>
                <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  {msg.element_context && (
                    <div className="text-xs text-stone-400 bg-stone-100 border border-stone-200 rounded px-2 py-1 mb-1 font-mono">
                      🎯 {msg.element_context.label || 'Élément sélectionné'}
                    </div>
                  )}
                  <div className={`text-sm leading-relaxed px-3 py-2 rounded-xl max-w-[90%] ${
                    msg.role === 'user'
                      ? 'bg-stone-800 text-white rounded-br-sm'
                      : 'bg-stone-100 text-stone-800 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">
                    {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChatHistory({ operationId, maxSessions = 10 }: ChatHistoryProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ limit: String(maxSessions) })
    if (operationId) params.set('operation_id', operationId)
    api(`/api/chat/sessions?${params}`)
      .then((data: ChatSession[]) => { setSessions(data); setLoading(false) })
      .catch(() => { setError('Erreur chargement'); setLoading(false) })
  }, [operationId])

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-stone-400 py-4">
      <Loader2 size={14} className="animate-spin" /> Chargement de l'historique…
    </div>
  )

  if (error) return (
    <div className="text-sm text-red-500 py-2">{error}</div>
  )

  if (sessions.length === 0) return (
    <div className="text-center py-8 text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl">
      Aucune conversation enregistrée.
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock size={13} className="text-stone-400" />
        <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
          {sessions.length} session{sessions.length > 1 ? 's' : ''} de chat
        </span>
      </div>
      {sessions.map(s => <SessionCard key={s.id} session={s} />)}
    </div>
  )
}
