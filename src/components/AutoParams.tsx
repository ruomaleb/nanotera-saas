/**
 * AutoParams.tsx
 * Recommandation IA des paramètres de conditionnement.
 * S'affiche dans la page Paramètres, propose les valeurs
 * optimales basées sur le profil imprimeur et l'historique.
 */

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useModel } from '../hooks/useModel'
import {
  Loader2, AlertCircle, Sparkles, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronRight, Check,
} from 'lucide-react'

interface Justifications {
  ex_par_carton: string
  cartons_par_palette: string
  seuil_pdv: string
  poids_unitaire_kg: string
}

interface AutoParamsResult {
  ex_par_carton: number
  cartons_par_palette: number
  seuil_pdv: number
  poids_unitaire_kg: number
  confiance: 'haute' | 'moyenne' | 'faible'
  justifications: Justifications
  alertes: string[]
}

export interface ParamsValues {
  ex_par_carton: number
  cartons_par_palette: number
  seuil_pdv: number
  poids_unitaire_kg: number
}

interface AutoParamsProps {
  operationId: string
  currentValues: ParamsValues
  onApply: (params: ParamsValues) => void
}

const CONFIANCE_CONFIG = {
  haute:   { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  icon: CheckCircle2,  label: 'Confiance haute' },
  moyenne: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  icon: AlertTriangle, label: 'Confiance moyenne' },
  faible:  { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-600',   icon: AlertCircle,   label: 'Confiance faible' },
}

const PARAM_LABELS: Record<keyof ParamsValues, string> = {
  ex_par_carton:       'Ex/carton',
  cartons_par_palette: 'Cartons/palette',
  seuil_pdv:           'Seuil PDV (ex)',
  poids_unitaire_kg:   'Poids/ex (kg)',
}

export default function AutoParams({ operationId, currentValues, onApply }: AutoParamsProps) {
  const { modelId } = useModel()
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<AutoParamsResult | null>(null)
  const [error, setError]         = useState('')
  const [expanded, setExpanded]   = useState(false)
  const [showJustif, setShowJustif] = useState(false)
  const [applied, setApplied]     = useState(false)

  const fetchParams = () => {
    setLoading(true)
    setError('')
    setResult(null)
    setApplied(false)
    api(`/api/operations/${operationId}/ai/params`, { method: 'POST', body: { model: modelId } })
      .then((data: AutoParamsResult) => { setResult(data); setExpanded(true); setLoading(false) })
      .catch((e: any) => { setError(e.message || 'Erreur IA'); setLoading(false) })
  }

  // Détecter si les valeurs recommandées diffèrent des actuelles
  const hasDiff = result && (
    result.ex_par_carton       !== currentValues.ex_par_carton ||
    result.cartons_par_palette !== currentValues.cartons_par_palette ||
    result.seuil_pdv           !== currentValues.seuil_pdv ||
    result.poids_unitaire_kg   !== currentValues.poids_unitaire_kg
  )

  const handleApply = () => {
    if (!result) return
    onApply({
      ex_par_carton:       result.ex_par_carton,
      cartons_par_palette: result.cartons_par_palette,
      seuil_pdv:           result.seuil_pdv,
      poids_unitaire_kg:   result.poids_unitaire_kg,
    })
    setApplied(true)
  }

  return (
    <div className="border border-purple-200 rounded-xl overflow-hidden">

      {/* Header */}
      <button
        onClick={() => result ? setExpanded(e => !e) : fetchParams()}
        className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-purple-500 flex-shrink-0" />
          <span className="text-xs font-medium text-purple-800">
            Recommandation IA
          </span>
          {result && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${CONFIANCE_CONFIG[result.confiance].bg} ${CONFIANCE_CONFIG[result.confiance].border} ${CONFIANCE_CONFIG[result.confiance].text}`}>
              {CONFIANCE_CONFIG[result.confiance].label}
            </span>
          )}
          {!result && !loading && (
            <span className="text-[10px] text-purple-500">Cliquer pour analyser</span>
          )}
        </div>
        {loading
          ? <Loader2 size={13} className="text-purple-400 animate-spin" />
          : result
          ? expanded
            ? <ChevronDown size={13} className="text-purple-400" />
            : <ChevronRight size={13} className="text-purple-400" />
          : null
        }
      </button>

      {error && (
        <div className="px-4 py-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border-t border-red-200">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {result && expanded && (
        <div className="p-4 space-y-3 bg-white">

          {/* Grille comparaison actuel vs recommandé */}
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PARAM_LABELS) as (keyof ParamsValues)[]).map(key => {
              const current = currentValues[key]
              const recommended = result[key]
              const isDiff = current !== recommended
              return (
                <div key={key} className={`rounded-lg p-3 border ${isDiff ? 'border-purple-200 bg-purple-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                    {PARAM_LABELS[key]}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-lg font-semibold ${isDiff ? 'text-purple-700' : 'text-gray-700'}`}>
                      {recommended}
                    </span>
                    {isDiff && (
                      <span className="text-[10px] text-gray-400 line-through">{current}</span>
                    )}
                    {!isDiff && (
                      <span className="text-[10px] text-green-500 flex items-center gap-0.5">
                        <Check size={9} /> identique
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Alertes */}
          {result.alertes.length > 0 && (
            <div className="space-y-1.5">
              {result.alertes.map((a, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}

          {/* Justifications dépliables */}
          <button
            onClick={() => setShowJustif(j => !j)}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showJustif ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Voir les justifications
          </button>
          {showJustif && (
            <div className="space-y-2 border-t border-gray-100 pt-2">
              {(Object.keys(PARAM_LABELS) as (keyof ParamsValues)[]).map(key => (
                <div key={key} className="text-[11px]">
                  <span className="font-medium text-gray-700">{PARAM_LABELS[key]} : </span>
                  <span className="text-gray-500">{result.justifications[key]}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleApply}
              disabled={applied || !hasDiff}
              className={`flex-1 h-8 text-[11px] font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                applied
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : hasDiff
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-100 text-gray-400 cursor-default'
              }`}
            >
              {applied
                ? <><Check size={12} /> Paramètres appliqués</>
                : hasDiff
                ? <><Sparkles size={12} /> Appliquer les recommandations</>
                : 'Paramètres déjà optimaux'
              }
            </button>
            <button
              onClick={fetchParams}
              className="h-8 px-3 text-[11px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Recalculer
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
