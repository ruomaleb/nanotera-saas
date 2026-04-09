/**
 * PaletteAlerts.tsx
 * Analyse IA du plan de palettisation : fusions possibles,
 * déséquilibres, palettes sous-remplies.
 * S'affiche dans la page Palettisation après le bin-packing.
 */

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useModel } from '../hooks/useModel'
import {
  Loader2, AlertCircle, AlertTriangle, Info,
  CheckCircle2, Sparkles, ChevronDown, ChevronRight,
  GitMerge, BarChart2, Zap,
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

interface PaletteAlertsProps {
  operationId: string
  /** Appelé si l'utilisateur veut relancer le bin-packing après les recommandations */
  onRelancer?: () => void
}

const VERDICT_CONFIG = {
  optimal:     { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: CheckCircle2,   label: 'Optimal' },
  ameliorable: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: AlertTriangle,  label: 'Améliorable' },
  probleme:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: AlertCircle,    label: 'Problème' },
}

const SEVERITE_CONFIG = {
  info:    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
  warning: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700' },
  erreur:  { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700' },
}

const TYPE_ICON = {
  fusion:       GitMerge,
  desequilibre: BarChart2,
  surcharge:    AlertCircle,
  info:         Info,
}

export default function PaletteAlerts({ operationId, onRelancer }: PaletteAlertsProps) {
  const { modelId } = useModel()
  const [loading, setLoading]   = useState(true)
  const [result, setResult]     = useState<PaletteAlertsResult | null>(null)
  const [error, setError]       = useState('')
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (!operationId) return
    setLoading(true)
    setError('')
    api(`/api/operations/${operationId}/ai/palettes`, { method: 'POST', body: { model: modelId } })
      .then((data: PaletteAlertsResult) => { setResult(data); setLoading(false) })
      .catch((e: any) => { setError(e.message || 'Erreur analyse IA'); setLoading(false) })
  }, [operationId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700">
        <Loader2 size={13} className="animate-spin flex-shrink-0" />
        <span>Analyse IA du plan de palettisation…</span>
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
  const hasGain = (result.gain_palettes ?? 0) > 0

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">

      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-purple-500 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-800">Optimisation IA</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${vc.bg} ${vc.border} ${vc.text}`}>
            {vc.label}
          </span>
          {hasGain && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-teal-50 border border-teal-200 text-teal-700 flex items-center gap-1">
              <Zap size={9} />
              {result.gain_palettes} palette{result.gain_palettes > 1 ? 's' : ''} économisable{result.gain_palettes > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500 hidden sm:block max-w-xs truncate">
            {result.resume}
          </span>
          {expanded
            ? <ChevronDown size={13} className="text-gray-400" />
            : <ChevronRight size={13} className="text-gray-400" />
          }
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">

          {/* Verdict + résumé */}
          <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${vc.bg} ${vc.border}`}>
            <VIcon size={14} className={`flex-shrink-0 mt-0.5 ${vc.text}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs ${vc.text}`}>{result.resume}</p>
              {hasGain && (
                <p className={`text-[11px] mt-1 ${vc.text} opacity-80`}>
                  En fusionnant les palettes sous-remplies : {result.nb_palettes_optimisees} palettes
                  au lieu de {(result.nb_palettes_optimisees ?? 0) + (result.gain_palettes ?? 0)} ({result.gain_palettes} économisée{result.gain_palettes > 1 ? 's' : ''})
                </p>
              )}
            </div>
          </div>

          {/* Alertes */}
          {result.alertes.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                {result.alertes.length} recommandation{result.alertes.length > 1 ? 's' : ''}
              </div>
              {result.alertes.map((a, i) => {
                const sc = SEVERITE_CONFIG[a.severite]
                const TIcon = TYPE_ICON[a.type] || Info
                return (
                  <div key={i} className={`border rounded-lg px-3 py-2.5 ${sc.bg} ${sc.border}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <TIcon size={12} className={`flex-shrink-0 ${sc.text}`} />
                      <span className={`text-[11px] font-medium ${sc.text}`}>{a.titre}</span>
                      {a.centrale !== 'Global' && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ml-auto ${sc.text} opacity-80`}>
                          {a.centrale}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 mb-1">{a.detail}</p>
                    <p className="text-[11px] text-gray-500 italic">→ {a.action}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* CTA relancer si gain possible */}
          {hasGain && onRelancer && (
            <button
              onClick={onRelancer}
              className="w-full h-8 text-[11px] font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <GitMerge size={12} />
              Relancer le bin-packing avec consolidation
            </button>
          )}

        </div>
      )}
    </div>
  )
}
