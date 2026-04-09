/**
 * PaletteAlerts.tsx — v2
 * - Champ contexte libre avant analyse
 * - Boutons Ignorer / Préciser par recommandation
 * - Mini-chat ancré à chaque recommandation
 */

import { useState } from 'react'
import { api } from '../lib/api'
import { useModel } from '../hooks/useModel'
import {
  Loader2, AlertCircle, AlertTriangle, Info,
  CheckCircle2, Sparkles, ChevronDown, ChevronRight,
  GitMerge, BarChart2, Zap, Send, EyeOff, RotateCcw, MessageSquare,
} from 'lucide-react'

interface Alerte {
  type: 'fusion' | 'desequilibre' | 'surcharge' | 'info'
  severite: 'info' | 'warning' | 'erreur'
  centrale: string
  titre: string
  detail: string
  action: string
}

interface PaletteAlertsResult {
  verdict: 'optimal' | 'ameliorable' | 'probleme'
  resume: string
  alertes: Alerte[]
  nb_palettes_optimisees: number
  gain_palettes: number
}

interface AlerteState {
  ignored: boolean
  chatOpen: boolean
  chatInput: string
  chatLoading: boolean
  chatResponse: string | null
}

interface PaletteAlertsProps {
  operationId: string
  onRelancer?: () => void
}

const VERDICT = {
  optimal:     { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: CheckCircle2,  label: 'Optimal' },
  ameliorable: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: AlertTriangle, label: 'Améliorable' },
  probleme:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: AlertCircle,   label: 'Problème' },
}
const SEV = {
  info:    { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  erreur:  { bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700' },
}
const TYPE_ICON: Record<string, any> = { fusion: GitMerge, desequilibre: BarChart2, surcharge: AlertCircle, info: Info }

export default function PaletteAlerts({ operationId, onRelancer }: PaletteAlertsProps) {
  const { modelId } = useModel()
  const [launched, setLaunched]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<PaletteAlertsResult | null>(null)
  const [error, setError]           = useState('')
  const [expanded, setExpanded]     = useState(true)
  const [contexte, setContexte]     = useState('')
  const [showCtx, setShowCtx]       = useState(false)
  const [states, setStates]         = useState<AlerteState[]>([])

  const upd = (i: number, p: Partial<AlerteState>) =>
    setStates(prev => prev.map((s, idx) => idx === i ? { ...s, ...p } : s))

  const launch = () => {
    setLoading(true); setError(''); setResult(null); setLaunched(true)
    api(`/api/operations/${operationId}/ai/palettes`, {
      method: 'POST',
      body: { model: modelId, contexte_libre: contexte },
    })
      .then((d: PaletteAlertsResult) => {
        setResult(d)
        setStates(d.alertes.map(() => ({ ignored: false, chatOpen: false, chatInput: '', chatLoading: false, chatResponse: null })))
        setLoading(false)
      })
      .catch((e: any) => { setError(e.message || 'Erreur IA'); setLoading(false) })
  }

  const relaunch = () => { setResult(null); setLaunched(false); setExpanded(true) }

  const sendFollowup = async (i: number, a: Alerte) => {
    const q = states[i]?.chatInput?.trim(); if (!q) return
    upd(i, { chatLoading: true, chatInput: '' })
    try {
      const r = await api(`/api/operations/${operationId}/ai/palettes/followup`, {
        method: 'POST',
        body: { model: modelId, alerte: a, question: q, contexte_operation: contexte },
      })
      upd(i, { chatLoading: false, chatResponse: r.response })
    } catch (e: any) { upd(i, { chatLoading: false, chatResponse: `Erreur : ${e.message}` }) }
  }

  const hasGain = (result?.gain_palettes ?? 0) > 0
  const ignoredCount = states.filter(s => s.ignored).length

  if (!launched) return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-purple-500" />
          <span className="text-sm font-medium text-gray-800">Optimisation IA</span>
          <span className="text-xs text-gray-400">Analyse du plan de palettisation</span>
        </div>
        <button onClick={() => setShowCtx(c => !c)}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
          <MessageSquare size={11} />
          {showCtx ? 'Masquer' : 'Ajouter du contexte'}
        </button>
      </div>
      {showCtx && (
        <div className="px-4 pt-3 pb-0 border-t border-gray-100 bg-white">
          <p className="text-xs text-gray-400 mb-1.5">
            Informations qui aideront l'IA à formuler des recommandations pertinentes
          </p>
          <textarea
            value={contexte}
            onChange={e => setContexte(e.target.value)}
            placeholder="Ex: la palette LECASUD #6 est intentionnellement petite (magasins de quartier). Ne pas suggérer de fusion pour SCACHAP car camion complet..."
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none outline-none focus:border-purple-400 placeholder:text-gray-300"
            style={{ fontFamily: 'inherit' }}
          />
        </div>
      )}
      <div className="px-4 py-3 flex justify-end border-t border-gray-100 bg-white">
        <button onClick={launch}
          className="flex items-center gap-1.5 h-8 px-4 text-sm font-medium bg-gray-900 text-white rounded-lg hover:opacity-85 transition-all">
          <Sparkles size={12} /> Analyser le plan
        </button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-700">
      <Loader2 size={13} className="animate-spin flex-shrink-0" />
      Analyse IA du plan de palettisation…
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <AlertCircle size={13} className="flex-shrink-0" />
        Analyse indisponible : {error}
      </div>
      <button onClick={relaunch} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
        <RotateCcw size={11} /> Réessayer
      </button>
    </div>
  )

  if (!result) return null

  const vc = VERDICT[result.verdict]; const VIcon = vc.icon

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">

      {/* Header */}
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles size={13} className="text-purple-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-800">Optimisation IA</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${vc.bg} ${vc.border} ${vc.text}`}>{vc.label}</span>
          {hasGain && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-50 border border-teal-200 text-teal-700 flex items-center gap-1">
              <Zap size={9} /> {result.gain_palettes} palette{result.gain_palettes > 1 ? 's' : ''} économisable{result.gain_palettes > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); relaunch() }}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 transition-colors">
            <RotateCcw size={10} /> Relancer
          </button>
          {expanded ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">

          {/* Verdict */}
          <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${vc.bg} ${vc.border}`}>
            <VIcon size={14} className={`flex-shrink-0 mt-0.5 ${vc.text}`} />
            <div>
              <p className={`text-sm ${vc.text}`}>{result.resume}</p>
              {hasGain && (
                <p className={`text-sm mt-1 ${vc.text} opacity-80`}>
                  Après optimisation : {result.nb_palettes_optimisees} palettes ({result.gain_palettes} économisée{result.gain_palettes > 1 ? 's' : ''})
                </p>
              )}
            </div>
          </div>

          {/* Contexte affiché si fourni */}
          {contexte.trim() && (
            <div className="flex items-start gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
              <MessageSquare size={12} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-purple-700 italic">{contexte}</p>
            </div>
          )}

          {/* Recommandations */}
          {result.alertes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {result.alertes.length - ignoredCount} recommandation{result.alertes.length - ignoredCount > 1 ? 's' : ''}
                {ignoredCount > 0 && ` · ${ignoredCount} ignorée${ignoredCount > 1 ? 's' : ''}`}
              </div>

              {result.alertes.map((a, i) => {
                if (!states[i] || states[i].ignored) return null
                const s = states[i]; const sc = SEV[a.severite]; const TIcon = TYPE_ICON[a.type] || Info
                return (
                  <div key={i} className={`border rounded-lg overflow-hidden ${sc.border}`}>
                    <div className={`px-3 py-2.5 ${sc.bg}`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <TIcon size={12} className={`flex-shrink-0 ${sc.text}`} />
                        <span className={`text-sm font-medium ${sc.text}`}>{a.titre}</span>
                        {a.centrale !== 'Global' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ml-auto ${sc.text} bg-white/60 border ${sc.border}`}>
                            {a.centrale}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-1">{a.detail}</p>
                      <p className="text-sm text-gray-500 italic">→ {a.action}</p>
                      <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-white/50">
                        <button onClick={() => upd(i, { chatOpen: !s.chatOpen })}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors font-medium ${
                            s.chatOpen ? 'bg-white border-gray-300 text-gray-700' : `bg-white/70 ${sc.border} ${sc.text} hover:bg-white`
                          }`}>
                          <MessageSquare size={10} />
                          {s.chatResponse ? 'Voir la réponse' : 'Préciser…'}
                        </button>
                        <button onClick={() => upd(i, { ignored: true })}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-white/60 bg-white/40 text-gray-500 hover:bg-white hover:text-gray-700 transition-colors">
                          <EyeOff size={10} /> Ignorer
                        </button>
                      </div>
                    </div>

                    {s.chatOpen && (
                      <div className="border-t border-gray-200 bg-white px-3 py-3 space-y-2">
                        {s.chatResponse && (
                          <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                            <Sparkles size={12} className="text-purple-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-gray-700">{s.chatResponse}</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input type="text"
                            value={s.chatInput}
                            onChange={e => upd(i, { chatInput: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') sendFollowup(i, a) }}
                            placeholder={s.chatResponse ? "Question complémentaire…" : "Ex: cette palette est intentionnellement petite car…"}
                            className="flex-1 h-8 text-sm border border-gray-200 rounded-lg px-2.5 outline-none focus:border-purple-400 placeholder:text-gray-300"
                            style={{ fontFamily: 'inherit' }}
                            disabled={s.chatLoading}
                          />
                          <button onClick={() => sendFollowup(i, a)}
                            disabled={!s.chatInput.trim() || s.chatLoading}
                            className="h-8 w-8 flex items-center justify-center bg-gray-900 text-white rounded-lg disabled:opacity-30 hover:opacity-85 transition-all flex-shrink-0">
                            {s.chatLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {ignoredCount > 0 && (
                <button onClick={() => setStates(prev => prev.map(s => ({ ...s, ignored: false })))}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  Rétablir les {ignoredCount} recommandation{ignoredCount > 1 ? 's' : ''} ignorée{ignoredCount > 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {hasGain && onRelancer && (
            <button onClick={onRelancer}
              className="w-full h-9 text-sm font-medium bg-gray-900 text-white rounded-lg hover:opacity-85 transition-all flex items-center justify-center gap-1.5">
              <GitMerge size={13} /> Relancer le bin-packing avec consolidation
            </button>
          )}

        </div>
      )}
    </div>
  )
}
