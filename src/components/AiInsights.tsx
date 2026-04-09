/**
 * AiInsights.tsx
 * Analyse IA post-import : anomalies, recommandations, verdict.
 * S'affiche automatiquement après un import réussi.
 */

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useModel } from '../hooks/useModel'
import { Loader2, AlertCircle, AlertTriangle, Info, CheckCircle2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'

interface Anomalie {
  severite: 'info' | 'warning' | 'erreur'
  titre: string
  detail: string
  action: string
}

interface RecoConditionnement {
  ex_par_carton: number
  seuil_pdv: number
  poids_unitaire_kg: number
  justification: string
}

interface InsightsResult {
  verdict: 'ok' | 'attention' | 'probleme'
  resume: string
  anomalies: Anomalie[]
  points_positifs: string[]
  recommandation_conditionnement: RecoConditionnement
}

interface AiInsightsProps {
  operationId: string
  /** Appelé quand l'utilisateur accepte les paramètres recommandés */
  onAcceptParams?: (params: RecoConditionnement) => void
}

const SEVERITE_CONFIG = {
  info:    { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   label: 'Info' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  label: 'Attention' },
  erreur:  { icon: AlertCircle,   bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    label: 'Erreur' },
}

const VERDICT_CONFIG = {
  ok:        { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700',  icon: CheckCircle2 },
  attention: { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700',  icon: AlertTriangle },
  probleme:  { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',    icon: AlertCircle },
}

export default function AiInsights({ operationId, onAcceptParams }: AiInsightsProps) {
  const { modelId } = useModel()
  const [loading, setLoading]   = useState(true)
  const [result, setResult]     = useState<InsightsResult | null>(null)
  const [error, setError]       = useState('')
  const [expanded, setExpanded] = useState(true)
  const [showReco, setShowReco] = useState(false)

  useEffect(() => {
    if (!operationId) return
    setLoading(true)
    setError('')
    api(`/api/operations/${operationId}/ai/analyse`, { method: 'POST', body: { model: modelId } })
      .then((data: InsightsResult) => { setResult(data); setLoading(false) })
      .catch((e: any) => { setError(e.message || 'Erreur analyse IA'); setLoading(false) })
  }, [operationId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700">
        <Loader2 size={13} className="animate-spin flex-shrink-0" />
        <span>Analyse IA en cours — détection d'anomalies et recommandations…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
        <AlertCircle size={13} className="flex-shrink-0" />
        <span>Analyse IA indisponible : {error}</span>
      </div>
    )
  }

  if (!result) return null

  const vc = VERDICT_CONFIG[result.verdict]
  const VIcon = vc.icon

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">

      {/* Header cliquable */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-purple-500 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-800">Analyse IA</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${vc.bg} ${vc.border} ${vc.text}`}>
            {result.verdict === 'ok' ? 'OK' : result.verdict === 'attention' ? 'Attention' : 'Problème'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 text-right max-w-xs truncate hidden sm:block">
            {result.resume}
          </span>
          {expanded ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">

          {/* Résumé verdict */}
          <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${vc.bg} ${vc.border}`}>
            <VIcon size={14} className={`flex-shrink-0 mt-0.5 ${vc.text}`} />
            <p className={`text-xs ${vc.text}`}>{result.resume}</p>
          </div>

          {/* Anomalies */}
          {result.anomalies.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {result.anomalies.length} point{result.anomalies.length > 1 ? 's' : ''} à vérifier
              </div>
              {result.anomalies.map((a, i) => {
                const sc = SEVERITE_CONFIG[a.severite]
                const AIcon = sc.icon
                return (
                  <div key={i} className={`border rounded-lg px-3 py-2.5 ${sc.bg} ${sc.border}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <AIcon size={12} className={`flex-shrink-0 ${sc.text}`} />
                      <span className={`text-xs font-medium ${sc.text}`}>{a.titre}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ml-auto ${sc.text} ${sc.bg}`}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{a.detail}</p>
                    <p className="text-sm text-gray-500 italic">→ {a.action}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Points positifs */}
          {result.points_positifs.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Points positifs</div>
              {result.points_positifs.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" />
                  <span className="text-sm">{p}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommandation conditionnement */}
          {result.recommandation_conditionnement && (
            <div className="border border-purple-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowReco(r => !r)}
                className="w-full flex items-center justify-between px-3 py-2 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} className="text-purple-500" />
                  <span className="text-xs font-medium text-purple-700">Paramètres recommandés</span>
                </div>
                {showReco ? <ChevronDown size={11} className="text-purple-400" /> : <ChevronRight size={11} className="text-purple-400" />}
              </button>
              {showReco && (
                <div className="px-3 py-2.5 bg-white space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Ex/carton',   value: result.recommandation_conditionnement.ex_par_carton },
                      { label: 'Seuil PDV',   value: result.recommandation_conditionnement.seuil_pdv },
                      { label: 'Poids/ex',    value: `${result.recommandation_conditionnement.poids_unitaire_kg} kg` },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                        <div className="text-xs text-gray-400 uppercase">{s.label}</div>
                        <div className="text-sm font-semibold text-gray-900 mt-0.5">{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 italic">
                    {result.recommandation_conditionnement.justification}
                  </p>
                  {onAcceptParams && (
                    <button
                      onClick={() => onAcceptParams(result.recommandation_conditionnement)}
                      className="w-full h-7 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Appliquer ces paramètres
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
