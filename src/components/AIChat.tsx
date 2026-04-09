/**
 * AiChat.tsx
 * Chat IA flottant accessible depuis toutes les pages.
 * Contexte opération injecté automatiquement si operationId fourni.
 * Streaming SSE pour les réponses.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, X, Send, Loader2, RotateCcw, ChevronDown, Crosshair } from 'lucide-react'
import { useSelection } from './SelectionContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://nanotera-api-saas-production.up.railway.app'

const STORAGE_KEY = 'nanotera_ai_model'
const DEFAULT_MODEL = 'claude-sonnet-4-5'
function getStoredModel() { return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MODEL }

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface AiChatProps {
  operationId?: string
  operationLabel?: string
}

const SUGGESTIONS = [
  "Combien de cartons pour 2 500 ex ?",
  "Explique le seuil PDV",
  "Comment fonctionne le bin-packing FFD ?",
  "Quelle est la différence entre palette groupée et PDV ?",
]

export default function AiChat({ operationId, operationLabel }: AiChatProps) {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const { active: selectionActive, activate: activateSelection, consume: consumeSelected } = useSelection()
  const inputRef                  = useRef<HTMLInputElement>(null)
  const sessionIdRef              = useRef<string | null>(null)
  const closeTimerRef             = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const abortRef                  = useRef<AbortController | null>(null)

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on open + créer/réouvrir session
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      // Créer une nouvelle session si pas de session active
      if (!sessionIdRef.current) {
        fetch(`${API_BASE}/api/chat/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation_id: operationId ?? null,
            page_url: window.location.pathname,
            model: getStoredModel(),
          }),
        })
          .then(r => r.json())
          .then(d => { if (d.id) sessionIdRef.current = d.id })
          .catch(() => {})
      }
      // Annuler le timer de fermeture si le chat est rouvert
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [open])


  // Injecter l'élément sélectionné depuis le pointeur
  useEffect(() => {
    if (!open) return
    const el = consumeSelected()
    if (!el) return
    const ctx = `[Contexte sélectionné — ${el.label}]\n${JSON.stringify(el.data, null, 2)}`
    setInput(prev => prev ? prev + '\n' + ctx : ctx)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return
    setInput('')

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])

    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true }
    setMessages(prev => [...prev, assistantMsg])
    setStreaming(true)

    abortRef.current = new AbortController()

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          operation_id: operationId ?? null,
          history,
          model: getStoredModel(),
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      if (!res.body) throw new Error('Pas de stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          if (data.startsWith('[ERROR]')) {
            accumulated += '\n\n⚠️ ' + data.slice(8)
            break
          }
          // Restaurer les sauts de ligne
          accumulated += data.replace(/\\n/g, '\n')
          setMessages(prev => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: accumulated, streaming: true }
            return next
          })
        }
      }

      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: accumulated, streaming: false }
        return next
      })
      // Sauvegarder les deux messages
      if (sessionIdRef.current) {
        const saveMsg = (role: string, content: string) =>
          fetch(`${API_BASE}/api/chat/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionIdRef.current, role, content }),
          }).catch(() => {})
        saveMsg('user', text)
        saveMsg('assistant', accumulated)
      }

    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          next[next.length - 1] = { ...last, content: last.content || '_(annulé)_', streaming: false }
          return next
        })
      } else {
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: `Désolé, une erreur est survenue : ${e.message}`,
            streaming: false,
          }
          return next
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [messages, operationId, streaming])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const stopStreaming = () => {
    abortRef.current?.abort()
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
    sessionIdRef.current = null
  }

  const closeSession = () => {
    if (!sessionIdRef.current) return
    fetch(`${API_BASE}/api/chat/sessions/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionIdRef.current, model: getStoredModel() }),
    }).catch(() => {})
    sessionIdRef.current = null
    setMessages([])
    setInput('')
    setOpen(false)
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 h-10 px-4 rounded-full shadow-lg transition-all text-sm font-medium ${
          open
            ? 'bg-gray-900 text-white'
            : 'bg-white text-gray-800 border border-gray-200 hover:border-purple-300 hover:text-purple-700'
        }`}
      >
        <Sparkles size={15} className={open ? 'text-purple-300' : 'text-purple-500'} />
        {open ? 'Fermer' : 'Assistant IA'}
        {!open && messages.length > 0 && (
          <span className="flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-purple-500 text-white rounded-full">
            {messages.filter(m => m.role === 'assistant').length}
          </span>
        )}
      </button>

      {/* Panneau chat */}
      {open && (
        <div className="fixed bottom-16 right-5 z-50 w-[380px] flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xl"
          style={{ maxHeight: 'calc(100vh - 120px)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-purple-500" />
              <span className="text-xs font-medium text-gray-800">Assistant logistique</span>
              {operationLabel && (
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-mono">
                  {operationLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={clearChat} className="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Effacer la conversation">
                  <RotateCcw size={12} />
                </button>
                <button onClick={closeSession} className="p-1 text-gray-400 hover:text-green-600 transition-colors text-[11px] font-medium leading-none px-1.5" title="Clore et résumer la session">
                  ✓ Clore
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 text-center">
                  Posez une question sur l'opération en cours ou sur les règles métier.
                </p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left text-[11px] px-3 py-2 bg-gray-50 hover:bg-purple-50 border border-gray-100 hover:border-purple-200 rounded-lg text-gray-600 hover:text-purple-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gray-900 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {msg.content
                    ? msg.content.split('\n').map((line, j) => (
                        <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</span>
                      ))
                    : msg.streaming
                    ? <span className="inline-flex gap-0.5 items-center">
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                      </span>
                    : null
                  }
                  {msg.streaming && msg.content && (
                    <span className="inline-block w-0.5 h-3 bg-gray-500 ml-0.5 animate-pulse" />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-purple-300 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Votre question…"
                disabled={streaming}
                className="flex-1 text-xs bg-transparent outline-none text-gray-800 placeholder-gray-400 disabled:opacity-50"
              />
              {/* Pointer button */}
              <button
                onClick={() => { activateSelection(); setOpen(false) }}
                title="Sélectionner un élément dans la page"
                style={{ color: selectionActive ? '#6B52C8' : '#D5D2CA', flexShrink: 0 }}
                className="hover:text-purple-500 transition-colors"
              >
                <Crosshair size={14} />
              </button>
              {streaming ? (
                <button onClick={stopStreaming} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="text-purple-500 hover:text-purple-700 disabled:opacity-30 disabled:cursor-default transition-colors flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
            <div className="text-[10px] text-gray-400 text-center mt-1.5">Entrée pour envoyer · ✕ pour annuler</div>
          </div>
        </div>
      )}
    </>
  )
}
