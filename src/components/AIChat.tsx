/**
 * AIChat.tsx
 * Chat IA accessible depuis toutes les pages du SaaS.
 *
 * Deux modes :
 *  - 'float' (défaut) : bouton flottant bas-droite + panneau pop-up
 *  - 'panel'          : intégré dans un conteneur parent, pleine hauteur,
 *                       sans positionnement fixed — idéal pour un layout côte-à-côte
 *
 * Actions contextuelles (mode panel + operationId) :
 *   Binpacking     → POST /api/operations/{id}/binpacking
 *   Fiches palettes → POST /api/operations/{id}/generate/fiches_palettes
 *   Bons de livraison → POST /api/operations/{id}/generate/bons_livraison
 *   Étiquettes     → POST /api/operations/{id}/generate/etiquettes
 *
 * Streaming SSE pour les réponses conversationnelles.
 * Sessions persistées via /api/chat/sessions.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Sparkles, X, Send, Loader2, RotateCcw, ChevronDown,
  Crosshair, Play, FileText, Package, Tag, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { useSelection } from './SelectionContext'

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://nanotera-api-saas-production.up.railway.app'

const STORAGE_KEY   = 'nanotera_ai_model'
const DEFAULT_MODEL = 'claude-sonnet-4-5'
function getStoredModel() { return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MODEL }

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role:      'user' | 'assistant' | 'system'
  content:   string
  streaming?: boolean
  /** Tag optionnel pour les messages d'action REST (ex: résultat binpacking) */
  actionTag?: 'success' | 'error' | 'running'
}

/** Action REST contextuelle — apparaît sous forme de chip dans le panneau */
interface ContextAction {
  id:      string
  label:   string
  icon:    React.ReactNode
  /** Message injecté dans le chat avant l'appel */
  prompt:  string
  /** Appel REST associé — null = conversationnel uniquement */
  call?:   () => Promise<ActionResult>
}

interface ActionResult {
  ok:      boolean
  summary: string
}

export interface AiChatProps {
  operationId?:   string
  operationLabel?: string
  /**
   * 'float'  : bouton flottant fixe bas-droite (comportement historique)
   * 'panel'  : intégré dans le conteneur parent, pleine hauteur
   */
  mode?:    'float' | 'panel'
  /** Callback de fermeture — uniquement en mode panel */
  onClose?: () => void
}

// ─── Suggestions par défaut (mode float sans opération) ─────────────────────

const DEFAULT_SUGGESTIONS = [
  "Combien de cartons pour 2 500 ex ?",
  "Explique le seuil PDV",
  "Comment fonctionne le bin-packing FFD ?",
  "Quelle est la différence entre palette groupée et PDV ?",
]

// ─── Helpers REST ─────────────────────────────────────────────────────────────

async function callRest(url: string, body?: object): Promise<ActionResult> {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      return { ok: false, summary: err.detail ?? `Erreur ${res.status}` }
    }
    const data = await res.json()
    return { ok: true, summary: data.summary
      ? JSON.stringify(data.summary)
      : 'Terminé avec succès.' }
  } catch (e: any) {
    return { ok: false, summary: e.message ?? 'Erreur réseau' }
  }
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AiChat({
  operationId,
  operationLabel,
  mode    = 'float',
  onClose,
}: AiChatProps) {

  const [open, setOpen]           = useState(mode === 'panel')
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const [actionRunning, setActionRunning] = useState<string | null>(null)

  const { active: selectionActive, activate: activateSelection, consume: consumeSelected } = useSelection()

  const inputRef     = useRef<HTMLInputElement>(null)
  const sessionIdRef = useRef<string | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const abortRef     = useRef<AbortController | null>(null)

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Ouverture : focus + création session ──────────────────────────────────
  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 100)
    if (!sessionIdRef.current) {
      fetch(`${API_BASE}/api/chat/sessions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          operation_id: operationId ?? null,
          page_url:     window.location.pathname,
          model:        getStoredModel(),
        }),
      })
        .then(r => r.json())
        .then(d => { if (d.id) sessionIdRef.current = d.id })
        .catch(() => {})
    }
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }, [open, operationId])

  // ── Injection sélection pointeur ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const el = consumeSelected()
    if (!el) return
    const ctx = `[Contexte sélectionné — ${el.label}]\n${JSON.stringify(el.data, null, 2)}`
    setInput(prev => prev ? prev + '\n' + ctx : ctx)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // ── En mode panel, rester toujours ouvert ────────────────────────────────
  useEffect(() => {
    if (mode === 'panel') setOpen(true)
  }, [mode])

  // ── Actions contextuelles (uniquement si operationId fourni) ─────────────
  const contextActions: ContextAction[] = operationId ? [
    {
      id:     'binpacking',
      label:  'Relancer le binpacking',
      icon:   <Play size={11} />,
      prompt: `Lance le binpacking pour l'opération ${operationId}.`,
      call:   () => callRest(`/api/operations/${operationId}/binpacking`, {}),
    },
    {
      id:     'fiches',
      label:  'Fiches palettes',
      icon:   <FileText size={11} />,
      prompt: `Génère les fiches palettes pour l'opération ${operationId}.`,
      call:   () => callRest(`/api/operations/${operationId}/generate/fiches_palettes`),
    },
    {
      id:     'bl',
      label:  'Bons de livraison',
      icon:   <Package size={11} />,
      prompt: `Génère les bons de livraison pour l'opération ${operationId}.`,
      call:   () => callRest(`/api/operations/${operationId}/generate/bons_livraison`),
    },
    {
      id:     'etiquettes',
      label:  'Étiquettes',
      icon:   <Tag size={11} />,
      prompt: `Génère les étiquettes pour l'opération ${operationId}.`,
      call:   () => callRest(`/api/operations/${operationId}/generate/etiquettes`),
    },
  ] : []

  // ── Trigger action contextuelle ───────────────────────────────────────────
  const triggerAction = useCallback(async (action: ContextAction) => {
    if (streaming || actionRunning) return
    setActionRunning(action.id)

    // Message utilisateur visible
    const userMsg: Message = { role: 'user', content: action.prompt }
    setMessages(prev => [...prev, userMsg])

    if (action.call) {
      // Message "en cours" immédiat
      const runningMsg: Message = {
        role:      'assistant',
        content:   `⏳ ${action.label} en cours…`,
        actionTag: 'running',
      }
      setMessages(prev => [...prev, runningMsg])

      const result = await action.call()

      // Remplacer le message running par le résultat
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role:      'assistant',
          content:   result.ok
            ? `✅ ${action.label} terminé.\n${result.summary}`
            : `⚠️ ${action.label} — ${result.summary}`,
          actionTag: result.ok ? 'success' : 'error',
        }
        return next
      })

      // Sauvegarder si session active
      if (sessionIdRef.current) {
        const save = (role: string, content: string) =>
          fetch(`${API_BASE}/api/chat/messages`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ session_id: sessionIdRef.current, role, content }),
          }).catch(() => {})
        save('user',      action.prompt)
        save('assistant', result.ok
          ? `✅ ${action.label} terminé.\n${result.summary}`
          : `⚠️ ${action.label} — ${result.summary}`)
      }
    } else {
      // Pas d'appel REST — envoyer comme message conversationnel
      await sendMessage(action.prompt, true)
    }

    setActionRunning(null)
  }, [streaming, actionRunning])

  // ── Envoi message conversationnel ─────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, skipInput = false) => {
    if (!text.trim() || streaming) return
    if (!skipInput) setInput('')

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])

    const assistantMsg: Message = { role: 'assistant', content: '', streaming: true }
    setMessages(prev => [...prev, assistantMsg])
    setStreaming(true)

    abortRef.current = new AbortController()

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:      text,
          operation_id: operationId ?? null,
          history,
          model:        getStoredModel(),
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      if (!res.body) throw new Error('Pas de stream')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer      = ''
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

      if (sessionIdRef.current) {
        const save = (role: string, content: string) =>
          fetch(`${API_BASE}/api/chat/messages`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ session_id: sessionIdRef.current, role, content }),
          }).catch(() => {})
        save('user',      text)
        save('assistant', accumulated)
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
            role:    'assistant',
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

  // ── Handlers clavier / boutons ────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }
  const stopStreaming = () => abortRef.current?.abort()

  const clearChat = () => {
    setMessages([])
    setInput('')
    sessionIdRef.current = null
  }

  const closeSession = () => {
    if (sessionIdRef.current) {
      fetch(`${API_BASE}/api/chat/sessions/close`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: sessionIdRef.current, model: getStoredModel() }),
      }).catch(() => {})
      sessionIdRef.current = null
    }
    setMessages([])
    setInput('')
    if (mode === 'float') setOpen(false)
    onClose?.()
  }

  // ── Rendu partagé : zone messages + input ─────────────────────────────────
  const suggestions = operationId
    ? ["Résumé par centrale", "Palettes les plus lourdes", "Vérifier les anomalies", "Combien d'étiquettes ?"]
    : DEFAULT_SUGGESTIONS

  const chatBody = (
    <>
      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 text-center">
              {operationId
                ? `Opération ${operationLabel ?? operationId} chargée. Posez une question ou utilisez les actions rapides.`
                : 'Posez une question sur les règles métier ou la palettisation.'}
            </p>
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
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

        {messages.map((msg, i) => {
          if (msg.role === 'system') return null

          const isUser = msg.role === 'user'
          const isAction = !!msg.actionTag

          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                isUser
                  ? 'bg-gray-900 text-white rounded-br-sm'
                  : isAction && msg.actionTag === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800 rounded-bl-sm'
                  : isAction && msg.actionTag === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-800 rounded-bl-sm'
                  : isAction && msg.actionTag === 'running'
                  ? 'bg-blue-50 border border-blue-200 text-blue-700 rounded-bl-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {/* Icône état pour les messages d'action */}
                {isAction && msg.actionTag === 'success' && (
                  <CheckCircle2 size={11} className="inline mr-1.5 text-green-600" />
                )}
                {isAction && msg.actionTag === 'error' && (
                  <AlertTriangle size={11} className="inline mr-1.5 text-red-500" />
                )}
                {isAction && msg.actionTag === 'running' && (
                  <Loader2 size={11} className="inline mr-1.5 animate-spin text-blue-500" />
                )}

                {msg.content
                  ? msg.content.split('\n').map((line, j) => (
                      <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</span>
                    ))
                  : msg.streaming
                  ? <span className="inline-flex gap-0.5 items-center">
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  : null
                }
                {msg.streaming && msg.content && (
                  <span className="inline-block w-0.5 h-3 bg-gray-500 ml-0.5 animate-pulse" />
                )}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Actions contextuelles (uniquement si operationId + panneau vide) ── */}
      {contextActions.length > 0 && messages.length === 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
          <p className="w-full text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Actions rapides</p>
          {contextActions.map(action => (
            <button
              key={action.id}
              onClick={() => triggerAction(action)}
              disabled={!!actionRunning || streaming}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-purple-50 hover:border-purple-200 text-gray-600 hover:text-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {actionRunning === action.id
                ? <Loader2 size={10} className="animate-spin" />
                : action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div className="px-3 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-purple-300 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Votre question…"
            disabled={streaming || !!actionRunning}
            className="flex-1 text-xs bg-transparent outline-none text-gray-800 placeholder-gray-400 disabled:opacity-50"
          />
          <button
            onClick={() => { activateSelection(); if (mode === 'float') setOpen(false) }}
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
              disabled={!input.trim() || !!actionRunning}
              className="text-purple-500 hover:text-purple-700 disabled:opacity-30 disabled:cursor-default transition-colors flex-shrink-0"
            >
              <Send size={14} />
            </button>
          )}
        </div>
        <div className="text-[10px] text-gray-400 text-center mt-1.5">Entrée pour envoyer · ✕ pour annuler</div>
      </div>
    </>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // MODE PANEL : s'intègre dans son conteneur parent (flex-col, h-full)
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === 'panel') {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 overflow-hidden">

        {/* Header panneau */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
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
              <>
                <button
                  onClick={clearChat}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Effacer la conversation"
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  onClick={closeSession}
                  className="p-1 text-gray-400 hover:text-green-600 transition-colors text-[11px] font-medium leading-none px-1.5"
                  title="Clore et résumer la session"
                >
                  Clore
                </button>
              </>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Fermer le panneau"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {chatBody}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODE FLOAT : comportement historique — bouton fixe + pop-up
  // ─────────────────────────────────────────────────────────────────────────
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

      {/* Panneau pop-up */}
      {open && (
        <div
          className="fixed bottom-16 right-5 z-50 w-[380px] flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xl"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {/* Header pop-up */}
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
                <>
                  <button onClick={clearChat} className="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Effacer">
                    <RotateCcw size={12} />
                  </button>
                  <button onClick={closeSession} className="p-1 text-gray-400 hover:text-green-600 transition-colors text-[11px] font-medium leading-none px-1.5" title="Clore">
                    Clore
                  </button>
                </>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {chatBody}
        </div>
      )}
    </>
  )
}
