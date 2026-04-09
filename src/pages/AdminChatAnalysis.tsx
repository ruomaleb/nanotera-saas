/**
 * AdminChatAnalysis.tsx
 * Espace admin : analyse des conversations IA
 * - Liste des sessions avec résumés
 * - Extraction de règles métier suggérées par l'IA
 * - Promotion en règle config_regles en 1 clic
 */

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import AdminLayout from '../components/AdminLayout'
import { CATEGORIES } from '../components/RegleEditor'
import { useModel } from '../hooks/useModel'
import {
  MessageSquare, Sparkles, ChevronDown, ChevronRight,
  Loader2, Plus, Check, Filter, Bot, User,
  AlertTriangle, ArrowRight, RefreshCw,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface ChatSession {
  id: string
  operation_id: string | null
  page_url: string | null
  model: string | null
  resume: string | null
  nb_messages: number
  created_at: string
  closed_at: string | null
  code_operation?: string
  nom_operation?: string
  ops_operations?: { code_operation: string; nom_operation: string }
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  element_context: any
  created_at: string
}

interface SuggestedRule {
  titre: string
  categorie: string
  niveau: 'global' | 'enseigne' | 'imprimeur'
  ref_label: string | null
  contenu: string
  justification: string
  priorite: number
}

interface Entity { id: string; nom: string }

// ── Sous-composant : carte session ────────────────────────────

function SessionRow({
  session,
  onExtract,
  selected,
  onSelect,
}: {
  session: ChatSession
  onExtract: (s: ChatSession) => void
  selected: boolean
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded]   = useState(false)
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [loadingMsg, setLoadingMsg] = useState(false)

  const opLabel = session.ops_operations?.code_operation
    ?? session.code_operation ?? 'Sans opération'

  const loadMessages = async () => {
    if (messages.length > 0) { setExpanded(e => !e); return }
    setLoadingMsg(true)
    try {
      const data = await api(`/api/chat/sessions/${session.id}/messages`)
      setMessages(data)
      setExpanded(true)
    } catch {}
    finally { setLoadingMsg(false) }
  }

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${
      selected ? 'border-brand-300 ring-1 ring-brand-200' : 'border-stone-200'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox sélection */}
        <button onClick={() => onSelect(session.id)}
          className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            selected
              ? 'bg-brand-500 border-brand-500'
              : 'border-stone-300 hover:border-brand-300'
          }`}>
          {selected && <Check size={11} style={{ color: '#fff' }} />}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={loadMessages}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-stone-800">
              {new Date(session.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' à '}
              {new Date(session.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-xs text-stone-400">·</span>
            <span className="text-xs text-stone-500 font-mono">{opLabel}</span>
            <span className="text-xs text-stone-400">·</span>
            <span className="text-xs text-stone-400">{session.nb_messages} msg</span>
            {session.page_url && (
              <span className="text-xs text-stone-400">· {session.page_url}</span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              session.closed_at
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {session.closed_at ? 'Résumée' : 'Ouverte'}
            </span>
          </div>
          {session.resume && (
            <p className="text-xs text-stone-500 mt-1 line-clamp-2">{session.resume}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onExtract(session)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors font-medium"
          >
            <Sparkles size={11} /> Extraire règles
          </button>
          {loadingMsg
            ? <Loader2 size={13} className="text-stone-400 animate-spin" />
            : expanded
            ? <ChevronDown size={13} className="text-stone-400 cursor-pointer" onClick={loadMessages} />
            : <ChevronRight size={13} className="text-stone-400 cursor-pointer" onClick={loadMessages} />
          }
        </div>
      </div>

      {/* Résumé complet */}
      {session.resume && expanded && (
        <div className="px-4 pb-2">
          <div className="bg-brand-50 border border-brand-200 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={11} className="text-brand-400" />
              <span className="text-xs font-medium text-brand-700">Résumé IA</span>
            </div>
            <p className="text-sm text-stone-700 whitespace-pre-line">{session.resume}</p>
          </div>
        </div>
      )}

      {/* Messages */}
      {expanded && messages.length > 0 && (
        <div className="border-t border-stone-100 max-h-64 overflow-y-auto px-4 py-3 space-y-2.5">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                m.role === 'user' ? 'bg-stone-200' : 'bg-brand-100'
              }`}>
                {m.role === 'user'
                  ? <User size={10} className="text-stone-600" />
                  : <Bot size={10} className="text-brand-600" />
                }
              </div>
              <div className={`text-sm px-3 py-2 rounded-xl max-w-[85%] ${
                m.role === 'user'
                  ? 'bg-stone-800 text-white rounded-br-sm'
                  : 'bg-stone-100 text-stone-800 rounded-bl-sm'
              }`}>
                {m.element_context && (
                  <div className="text-xs opacity-60 mb-1 font-mono">🎯 {m.element_context.label}</div>
                )}
                {m.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sous-composant : règle suggérée ──────────────────────────

function SuggestedRuleCard({
  rule,
  enseignes,
  imprimeurs,
  onPromote,
  promoted,
}: {
  rule: SuggestedRule
  enseignes: Entity[]
  imprimeurs: Entity[]
  onPromote: (rule: SuggestedRule, refId: string | null) => void
  promoted: boolean
}) {
  const [refId, setRefId] = useState('')
  const catCfg = CATEGORIES[rule.categorie] ?? { label: rule.categorie, color: 'bg-stone-100 text-stone-600 border-stone-200' }
  const needsRef = rule.niveau !== 'global'
  const entities = rule.niveau === 'enseigne' ? enseignes : imprimeurs

  return (
    <div className={`border rounded-xl p-4 transition-all ${
      promoted
        ? 'bg-green-50 border-green-200 opacity-60'
        : 'bg-white border-stone-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${catCfg.color}`}>
              {catCfg.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${
              rule.niveau === 'global'   ? 'bg-stone-100 text-stone-600 border-stone-200' :
              rule.niveau === 'enseigne' ? 'bg-teal-50 text-teal-700 border-teal-200' :
              'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {rule.niveau === 'global' ? '🌐 Global' : rule.niveau === 'enseigne' ? '🏪 Enseigne' : '🖨️ Imprimeur'}
              {rule.ref_label ? ` — ${rule.ref_label}` : ''}
            </span>
            <span className="text-xs text-stone-400">p={rule.priorite}</span>
          </div>

          <div>
            <div className="text-sm font-medium text-stone-800">{rule.titre}</div>
            <p className="text-sm text-stone-600 mt-1 leading-relaxed">{rule.contenu}</p>
            <p className="text-xs text-stone-400 mt-1.5 italic">→ {rule.justification}</p>
          </div>

          {/* Sélecteur entité si enseigne/imprimeur */}
          {needsRef && !promoted && (
            <select
              value={refId}
              onChange={e => setRefId(e.target.value)}
              className="nnt-select w-full text-xs h-8 mt-1"
            >
              <option value="">— {rule.niveau === 'enseigne' ? 'Sélectionner une enseigne' : 'Sélectionner un imprimeur'} —</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          )}
        </div>

        {promoted ? (
          <div className="flex items-center gap-1 text-green-600 flex-shrink-0">
            <Check size={14} /> <span className="text-xs font-medium">Ajoutée</span>
          </div>
        ) : (
          <button
            onClick={() => onPromote(rule, needsRef ? refId || null : null)}
            disabled={needsRef && !refId}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-stone-900 text-white rounded-lg hover:opacity-85 disabled:opacity-30 disabled:cursor-default transition-all flex-shrink-0"
          >
            <Plus size={11} /> Ajouter
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────

export default function AdminChatAnalysis() {
  const { modelId } = useModel()
  const [sessions, setSessions]       = useState<ChatSession[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [extracting, setExtracting]   = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestedRule[]>([])
  const [promoted, setPromoted]       = useState<Set<number>>(new Set())
  const [promotingIdx, setPromotingIdx] = useState<number | null>(null)
  const [enseignes, setEnseignes]     = useState<Entity[]>([])
  const [imprimeurs, setImprimeurs]   = useState<Entity[]>([])
  const [filterClosed, setFilterClosed] = useState<'all' | 'closed' | 'open'>('all')
  const [error, setError]             = useState('')

  useEffect(() => {
    loadSessions()
    api('/api/admin/regles/summary').then((s: any) => {
      setEnseignes(s.enseignes || [])
      setImprimeurs(s.imprimeurs || [])
    }).catch(() => {})
  }, [])

  const loadSessions = () => {
    setLoading(true)
    api('/api/chat/sessions?limit=50')
      .then((data: ChatSession[]) => { setSessions(data); setLoading(false) })
      .catch(() => { setLoading(false) })
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(s => s.id)))
  }

  // Extraction IA : une session ou plusieurs sélectionnées
  const extractRules = async (targetSessions: ChatSession[]) => {
    setExtracting(true)
    setError('')
    setSuggestions([])

    try {
      // Charger les messages de chaque session
      const allContent: string[] = []
      for (const s of targetSessions) {
        const msgs = await api(`/api/chat/sessions/${s.id}/messages`) as ChatMessage[]
        if (msgs.length === 0) continue
        const opLabel = s.ops_operations?.code_operation ?? 'Sans opération'
        allContent.push(`\n--- Session du ${new Date(s.created_at).toLocaleDateString('fr-FR')} (${opLabel}) ---`)
        if (s.resume) allContent.push(`Résumé : ${s.resume}`)
        for (const m of msgs) {
          allContent.push(`${m.role === 'user' ? 'Opérateur' : 'IA'} : ${m.content.slice(0, 400)}`)
        }
      }

      if (allContent.length === 0) {
        setError('Aucun message à analyser dans les sessions sélectionnées.')
        setExtracting(false)
        return
      }

      const transcript = allContent.join('\n')

      const resp = await api('/api/admin/chat/extract-rules', {
        method: 'POST',
        body: { transcript, model: modelId },
      })

      setSuggestions(resp.suggestions || [])
    } catch (e: any) {
      setError(e.message || 'Erreur extraction')
    } finally {
      setExtracting(false)
    }
  }

  const promoteRule = async (rule: SuggestedRule, refId: string | null, idx: number) => {
    setPromotingIdx(idx)
    try {
      const entity = refId
        ? (rule.niveau === 'enseigne' ? enseignes : imprimeurs).find(e => e.id === refId)
        : null
      await api('/api/admin/regles', {
        method: 'POST',
        body: {
          niveau:    rule.niveau,
          ref_id:    refId,
          ref_label: entity?.nom ?? rule.ref_label,
          categorie: rule.categorie,
          titre:     rule.titre,
          contenu:   rule.contenu,
          description: `Extrait automatiquement depuis les conversations IA — ${new Date().toLocaleDateString('fr-FR')}`,
          actif:     false,  // Inactive par défaut : l'admin doit valider
          priorite:  rule.priorite,
        },
      })
      setPromoted(prev => new Set([...prev, idx]))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPromotingIdx(null)
    }
  }

  const filtered = sessions.filter(s => {
    if (filterClosed === 'closed') return !!s.closed_at
    if (filterClosed === 'open')   return !s.closed_at
    return true
  })

  return (
    <AdminLayout
      title="Analyse des conversations"
      subtitle="Historique des échanges IA et extraction de règles métier"
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Colonne gauche : Sessions ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Filtre */}
              {(['all', 'closed', 'open'] as const).map(f => (
                <button key={f} onClick={() => setFilterClosed(f)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    filterClosed === f
                      ? 'bg-stone-900 text-white border-transparent'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                  }`}>
                  {f === 'all' ? 'Toutes' : f === 'closed' ? 'Résumées' : 'Ouvertes'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={selectAll}
                className="text-xs text-stone-500 hover:text-stone-700 transition-colors">
                {selected.size === filtered.length ? 'Désélectionner' : 'Tout sélectionner'}
              </button>
              <button onClick={loadSessions}
                className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Bouton extraction multi-sessions */}
          {selected.size > 0 && (
            <button
              onClick={() => extractRules(filtered.filter(s => selected.has(s.id)))}
              disabled={extracting}
              className="w-full flex items-center justify-center gap-2 h-9 text-sm font-medium bg-brand-500 text-white rounded-xl hover:opacity-85 disabled:opacity-40 transition-all"
            >
              {extracting
                ? <><Loader2 size={13} className="animate-spin" /> Analyse en cours…</>
                : <><Sparkles size={13} /> Extraire les règles de {selected.size} session{selected.size > 1 ? 's' : ''}</>
              }
            </button>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-stone-400 py-4">
              <Loader2 size={14} className="animate-spin" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl">
              Aucune conversation enregistrée.
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {filtered.map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  selected={selected.has(s.id)}
                  onSelect={toggleSelect}
                  onExtract={s => extractRules([s])}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Colonne droite : Suggestions ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-brand-500" />
              <span className="text-sm font-medium text-stone-800">Règles suggérées</span>
              {suggestions.length > 0 && (
                <span className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full">
                  {suggestions.length}
                </span>
              )}
            </div>
            {suggestions.length > 0 && (
              <span className="text-xs text-stone-400">
                {promoted.size} ajoutée{promoted.size > 1 ? 's' : ''} (inactives, à valider)
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {extracting && (
            <div className="flex items-center gap-2 px-4 py-4 bg-brand-50 border border-brand-200 rounded-xl text-sm text-brand-700">
              <Loader2 size={14} className="animate-spin flex-shrink-0" />
              Analyse des conversations en cours…
            </div>
          )}

          {!extracting && suggestions.length === 0 && (
            <div className="text-center py-12 text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl space-y-2">
              <Sparkles size={24} className="mx-auto text-stone-300" />
              <p>Sélectionnez des conversations et cliquez sur<br />"Extraire les règles" pour obtenir des suggestions.</p>
              <p className="text-xs text-stone-300">L'IA analysera les échanges pour identifier<br />des règles métier réutilisables.</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {suggestions.map((rule, i) => (
                <SuggestedRuleCard
                  key={i}
                  rule={rule}
                  enseignes={enseignes}
                  imprimeurs={imprimeurs}
                  promoted={promoted.has(i)}
                  onPromote={(r, refId) => promoteRule(r, refId, i)}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  )
}
