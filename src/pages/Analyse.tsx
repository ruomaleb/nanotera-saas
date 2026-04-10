import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react'
import type { Operation } from '../types/database'

interface QualityCheck {
  name: string
  status: string
  message?: string
  nb_issues?: number
  issues?: any[]
}

interface QualityReport {
  status?: string
  verdict?: string
  summary?: any
  checks?: any
}

const STATUS_LABELS: Record<string, string> = {
  pass: 'OK',
  ok: 'OK',
  warn: 'Avertissement',
  warning: 'Avertissement',
  fail: 'Echec',
  error: 'Echec',
}

const VERDICT_STYLES: Record<string, string> = {
  pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  fail: 'bg-red-50 text-red-700 border-red-200',
  error: 'bg-red-50 text-red-700 border-red-200',
}

const CHECK_LABELS: Record<string, string> = {
  '1_integrite': 'Integrite des donnees',
  '2_coherence_totaux': 'Coherence des totaux',
  '3_anomalies_statistiques': 'Anomalies statistiques',
  '4_observations': 'Observations parsees',
  '5_completude_adresses': 'Completude des adresses',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'pass' || status === 'ok')
    return <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
  if (status === 'warn' || status === 'warning')
    return <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
  return <XCircle size={14} className="text-red-500 flex-shrink-0" />
}

export default function Analyse() {
  const navigate = useNavigate()
  const [operations, setOperations] = useState<any[]>([])
  const [selectedOp, setSelectedOp] = useState('')
  const [op, setOp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('ops_operations')
      .select('id, code_operation, nom_operation, statut, nb_magasins, total_exemplaires, nb_centrales, nb_palettes, nb_palettes_grp, nb_palettes_pdv, rapport_controles, donnees_normalisees, poids_unitaire_kg, ex_par_paquet, ex_par_carton, cartons_par_palette, seuil_pdv')
      .in('statut', ['import', 'analyse', 'palettisation', 'livrables', 'termine'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOperations(data ?? [])
        if (data?.[0]) { setSelectedOp(data[0].id); setOp(data[0]) }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const found = operations.find(o => o.id === selectedOp)
    setOp(found ?? null)
    setExpandedCheck(null)
  }, [selectedOp, operations])

  const rapport: QualityReport = op?.rapport_controles || {}
  const verdict = rapport.verdict || 'ok'
  const checksRaw: any = rapport.checks || {}

  // Backend returns checks as a dict {check_name: {status, warnings, errors, ...}}
  // Convert to a normalized list for rendering
  const normalizedChecks: QualityCheck[] = Array.isArray(checksRaw)
    ? checksRaw.map((c: any) => typeof c === 'string' ? { name: c, status: 'pass' } : c)
    : Object.entries(checksRaw).map(([name, data]: [string, any]) => {
        const warnings = data?.warnings || []
        const errors = data?.errors || []
        const criticalAlerts = data?.critical_alerts || []
        const allIssues = [...errors, ...warnings, ...criticalAlerts]
        // Build a human message from the check data
        let message = ''
        if (data?.status === 'pass') {
          if (data?.nb_total) message = `${data.nb_valid ?? data.nb_total}/${data.nb_total} valides`
          else if (data?.cross_check) message = 'Coherence verifiee'
          else if (data?.taux_completude_pct != null) message = `Taux completude ${data.taux_completude_pct}%`
        } else if (criticalAlerts.length > 0) {
          message = criticalAlerts[0]
          if (typeof message !== 'string') message = JSON.stringify(message)
        } else if (warnings.length > 0) {
          const w = warnings[0]
          message = typeof w === 'string' ? w : (w?.note || w?.type || `${warnings.length} avertissement(s)`)
        }
        return {
          name,
          status: data?.status || 'pass',
          message,
          nb_issues: allIssues.length || undefined,
          issues: allIssues.length > 0 ? allIssues : undefined,
        }
      })

  const sample = (op?.donnees_normalisees as any[])?.slice(0, 5) || []

  return (
    <div>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Analyse des donnees</h1>
          <p className="text-xs text-gray-400 mt-0.5">Resultats des controles qualite et apercu donnees normalisees</p>
        </div>
        <select value={selectedOp} onChange={e => setSelectedOp(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
          {operations.map(o => (
            <option key={o.id} value={o.id}>{o.code_operation} — {o.nom_operation ?? o.code_operation}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Chargement...</div>
      ) : !op ? (
        <div className="text-center py-16">
          <FileSpreadsheet size={32} className="mx-auto text-gray-300 mb-3" />
          <div className="text-sm text-gray-500">Aucune operation analysee</div>
          <div className="text-xs text-gray-400 mt-1">Importez un fichier de repartition pour lancer l'analyse</div>
          <button onClick={() => navigate('/import')}
            className="mt-4 px-4 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
            Importer un fichier
          </button>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-5 py-6 space-y-6">
          {/* Verdict global */}
          <div className={`border rounded-xl p-4 ${VERDICT_STYLES[verdict] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <StatusIcon status={verdict} />
              <span className="font-medium text-sm">
                Verdict global : {STATUS_LABELS[verdict] ?? verdict}
              </span>
            </div>
            {rapport.summary?.nb_critical_alerts !== undefined && rapport.summary.nb_critical_alerts > 0 && (
              <div className="text-[11px] mt-1 opacity-80">
                {rapport.summary.nb_critical_alerts} alerte(s) critique(s)
              </div>
            )}
          </div>

          {/* Stats summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] text-gray-500">Magasins</div>
              <div className="text-xl font-semibold mt-0.5">{op.nb_magasins ?? '—'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] text-gray-500">Exemplaires</div>
              <div className="text-xl font-semibold mt-0.5">{(op.total_exemplaires ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] text-gray-500">Centrales</div>
              <div className="text-xl font-semibold mt-0.5">{op.nb_centrales ?? '—'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] text-gray-500">PDV individuels</div>
              <div className="text-xl font-semibold mt-0.5">{op.nb_palettes_pdv ?? '—'}</div>
            </div>
          </div>

          {/* Controles qualite */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-medium text-sm">Controles qualite</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">{normalizedChecks.length} controle(s) systematique(s)</p>
            </div>
            <div>
              {normalizedChecks.length === 0 && (
                <div className="px-4 py-6 text-xs text-gray-400 text-center">Aucun rapport de controles disponible</div>
              )}
              {normalizedChecks.map((c, i) => {
                const label = CHECK_LABELS[c.name] ?? c.name
                const isExpanded = expandedCheck === c.name
                const hasIssues = (c.issues && c.issues.length > 0) || (c.nb_issues && c.nb_issues > 0)
                return (
                  <div key={i} className="border-b border-gray-100 last:border-0">
                    <div
                      className={`flex items-start gap-3 px-4 py-3 ${hasIssues ? 'cursor-pointer hover:bg-gray-50/50' : ''}`}
                      onClick={() => hasIssues && setExpandedCheck(isExpanded ? null : c.name)}
                    >
                      <StatusIcon status={c.status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900">{label}</div>
                        {c.message && <div className="text-[11px] text-gray-500 mt-0.5">{c.message}</div>}
                      </div>
                      {c.nb_issues !== undefined && c.nb_issues > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                          {c.nb_issues}
                        </span>
                      )}
                      {hasIssues && (
                        isExpanded
                          ? <ChevronDown size={12} className="text-gray-400 mt-0.5" />
                          : <ChevronRight size={12} className="text-gray-400 mt-0.5" />
                      )}
                    </div>
                    {isExpanded && c.issues && c.issues.length > 0 && (
                      <div className="px-4 pb-3 pt-1 bg-gray-50/30">
                        <div className="text-[10px] text-gray-400 mb-1">Premieres anomalies :</div>
                        <pre className="text-[10px] bg-white border border-gray-200 rounded p-2 overflow-x-auto max-h-40 text-gray-600">
                          {JSON.stringify(c.issues.slice(0, 5), null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Apercu donnees normalisees */}
          {sample.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-medium text-sm">Apercu donnees normalisees</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">5 premieres lignes sur {op.nb_magasins ?? 0} magasins</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Centrale</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Code PDV</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Nom</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Ville</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Quantite</th>
                      <th className="text-center px-3 py-2 font-medium text-gray-500">PDV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sample.map((row: any, i: number) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-700">{row.regroupement}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{row.code_pdv}</td>
                        <td className="px-3 py-2 text-gray-900">{row.nom_pdv}</td>
                        <td className="px-3 py-2 text-gray-500">{row.ville}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">{row.quantite?.toLocaleString()}</td>
                        <td className="px-3 py-2 text-center">
                          {row.flag_pdv && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">PDV</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Conditionnement recap */}
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="font-medium text-sm mb-3">Parametres de conditionnement</h3>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Ex/paquet', value: op.ex_par_paquet },
                { label: 'Ex/carton', value: op.ex_par_carton },
                { label: 'Crt/palette', value: op.cartons_par_palette },
                { label: 'Seuil PDV', value: op.seuil_pdv?.toLocaleString() },
                { label: 'Poids unit.', value: op.poids_unitaire_kg ? `${op.poids_unitaire_kg} kg` : null },
              ].map((p, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-400">{p.label}</div>
                  <div className="text-sm font-medium mt-0.5">{p.value ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Next step */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                op.statut === 'import'        ? 'bg-stone-50 text-stone-500 border-stone-200' :
                op.statut === 'analyse'       ? 'bg-amber-50 text-amber-700 border-amber-200' :
                op.statut === 'palettisation' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {op.statut === 'import'        ? 'Importé — analyse en attente' :
                 op.statut === 'analyse'       ? 'Analysé — prêt pour palettisation' :
                 op.statut === 'palettisation' ? 'Palettisé' : 'Terminé'}
              </span>
            </div>
            {op.statut === 'import' ? (
              <button onClick={() => navigate('/import')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                Retour à l'import <ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={() => navigate(`/palettisation/${op.id}`)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                {op.statut === 'palettisation' || op.statut === 'livrables' || op.statut === 'termine'
                  ? 'Voir la palettisation' : 'Lancer la palettisation'}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
