import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { Boxes, Loader2, Play, AlertCircle, ArrowRight, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import PaletteEditor from '../components/PaletteEditor'
import PaletteAlerts from '../components/PaletteAlerts'
import AutoParams, { ParamsValues } from '../components/AutoParams'

// ── Carte palette avec toggle détail magasins ─────────────────

interface PaletteCardProps {
  p: any
  isPdv: boolean
  magasins: any[]
  exParCarton: number
}

function PaletteCard({ p, isPdv, magasins, exParCarton }: PaletteCardProps) {
  const [showDetail, setShowDetail] = useState(false)

  const nbCartons = p.nb_cartons != null
    ? p.nb_cartons
    : Math.ceil(p.nb_exemplaires / exParCarton)

  const hasMagasins = magasins.length > 0

  return (
    <div
      className={`border rounded-lg overflow-hidden ${isPdv ? 'bg-amber-50/40 border-amber-200' : 'bg-blue-50/40 border-blue-200'}`}
      data-selectable={JSON.stringify({
        type: isPdv ? 'palette_pdv' : 'palette_groupee',
        label: `Palette ${isPdv ? 'PDV' : 'GRP'} #${p.numero} — ${p.centrale_nom}`,
        data: {
          centrale: p.centrale_nom, numero: p.numero, type: p.type_palette,
          nb_exemplaires: p.nb_exemplaires, nb_cartons: nbCartons,
          poids_kg: Math.round(p.poids_kg), taux_remplissage: p.taux_remplissage,
          code_pdv: p.code_pdv, nb_magasins: magasins.length,
        }
      })}
      data-selectable-label={`Palette ${isPdv ? 'PDV' : 'GRP'} #${p.numero}`}
    >
      {/* Header carte */}
      <div className="p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isPdv ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {isPdv ? 'PDV' : 'GRP'}
            </span>
            <span className="text-sm font-semibold text-gray-900">#{p.numero}</span>
          </div>
          {isPdv && p.code_pdv ? (
            <span className="text-xs font-mono font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              {p.code_pdv}
            </span>
          ) : p.taux_remplissage != null ? (
            <span className={`text-xs font-medium ${p.taux_remplissage < 0.5 ? 'text-amber-600' : 'text-gray-500'}`}>
              {Math.round(p.taux_remplissage * 100)}%
            </span>
          ) : null}
        </div>

        {/* Métriques résumé */}
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Exemplaires</span>
            <span className="font-mono font-medium">{p.nb_exemplaires.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Cartons</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono">{nbCartons}</span>
              {!isPdv && exParCarton > 0 && (() => {
                const exTheo = nbCartons * exParCarton
                const fill = exTheo > 0 ? Math.round(p.nb_exemplaires / exTheo * 100) : 100
                return fill < 95
                  ? <span className="text-[10px] text-amber-600 font-medium">{fill}% plein</span>
                  : null
              })()}
            </div>
          </div>
          <div className="flex justify-between">
            <span>Poids</span>
            <span className="font-mono">{Math.round(p.poids_kg)} kg</span>
          </div>
          {hasMagasins && (
            <div className="flex justify-between">
              <span>Magasins</span>
              <span className="font-mono">{magasins.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Toggle détail */}
      {hasMagasins && (
        <>
          <button
            onClick={() => setShowDetail(d => !d)}
            className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium border-t transition-colors ${
              isPdv
                ? 'border-amber-200 text-amber-700 bg-amber-50/60 hover:bg-amber-100/60'
                : 'border-blue-200 text-blue-700 bg-blue-50/60 hover:bg-blue-100/60'
            }`}
          >
            <span>Détail magasins</span>
            {showDetail ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          {showDetail && (
            <div className="bg-white border-t border-gray-100 max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <th className="text-left px-3 py-1.5 text-gray-500 font-medium">Code</th>
                    <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Magasin</th>
                    <th className="text-right px-2 py-1.5 text-gray-500 font-medium">Ex</th>
                    <th className="text-right px-3 py-1.5 text-gray-500 font-medium">Crt</th>
                  </tr>
                </thead>
                <tbody>
                  {magasins.map((mag: any, i: number) => {
                    const crt = mag.nb_cartons ?? Math.ceil((mag.quantite || mag.nb_exemplaires || 0) / exParCarton)
                    return (
                      <tr key={i} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                        <td className="px-3 py-1.5 font-mono text-gray-500">{mag.code_pdv || mag.code_mag || '—'}</td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[100px] truncate">{mag.nom_pdv || mag.nom_mag || mag.nom || '—'}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-gray-700">{(mag.quantite || mag.nb_exemplaires || 0).toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-500">{crt}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={2} className="px-3 py-1.5 text-xs font-medium text-gray-500">Total</td>
                    <td className="px-2 py-1.5 text-right font-mono font-medium text-gray-700 text-xs">
                      {p.nb_exemplaires.toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium text-gray-700 text-xs">
                      {nbCartons}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}



interface PaletteRow {
  id: string
  operation_id: string
  centrale_nom: string
  numero: number
  type_palette: string
  nb_cartons: number | null
  nb_exemplaires: number
  poids_kg: number
  taux_remplissage: number | null
  code_pdv: string | null
  magasins: any
}

type Mode = 'view' | 'edit'

export default function Palettisation() {
  const { operationId } = useParams()
  const navigate = useNavigate()
  const [operations, setOperations]     = useState<any[]>([])
  const [selectedOp, setSelectedOp]     = useState(operationId || '')
  const [op, setOp]                     = useState<any>(null)
  const [palettes, setPalettes]         = useState<PaletteRow[]>([])
  const [loading, setLoading]           = useState(true)
  const [running, setRunning]           = useState(false)
  const [error, setError]               = useState('')
  const [mode, setMode]                 = useState<Mode>('view')
  const [expandedCentrales, setExpandedCentrales] = useState<Set<string>>(new Set())

  // Chargement liste opérations
  useEffect(() => {
    supabase
      .from('ops_operations')
      .select('id, code_operation, nom_operation, statut, nb_palettes, nb_palettes_grp, nb_palettes_pdv, total_exemplaires, poids_total_kg, ex_par_carton, cartons_par_palette, seuil_pdv, poids_unitaire_kg')
      .in('statut', ['analyse', 'palettisation', 'livrables', 'termine'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOperations(data ?? [])
        if (!operationId && data?.[0]) setSelectedOp(data[0].id)
      })
  }, [operationId])

  // Chargement palettes
  const loadPalettes = useCallback(async () => {
    if (!selectedOp) return
    setLoading(true)
    setError('')
    setMode('view')

    const [opResp, palResp] = await Promise.all([
      supabase
        .from('ops_operations')
        .select('id, code_operation, nom_operation, statut, nb_palettes, nb_palettes_grp, nb_palettes_pdv, total_exemplaires, poids_total_kg, ex_par_carton, cartons_par_palette, seuil_pdv, poids_unitaire_kg')
        .eq('id', selectedOp)
        .single(),
      supabase
        .from('ops_palettes')
        .select('*')
        .eq('operation_id', selectedOp)
        .order('centrale_nom')
        .order('numero'),
    ])

    setOp(opResp.data)
    setPalettes(palResp.data ?? [])
    if (palResp.data) {
      setExpandedCentrales(new Set(palResp.data.map((p: any) => p.centrale_nom)))
    }
    setLoading(false)
  }, [selectedOp])

  useEffect(() => { loadPalettes() }, [loadPalettes])

  const handleRunBinpacking = async () => {
    if (!op) return
    setRunning(true)
    setError('')
    try {
      await api(`/api/operations/${op.id}/binpacking`, {
        method: 'POST',
        body: {
          ex_par_carton:       op.ex_par_carton       ?? 200,
          cartons_par_palette: op.cartons_par_palette  ?? 48,
          seuil_pdv:           op.seuil_pdv            ?? 2800,
          poids_unitaire_kg:   op.poids_unitaire_kg    ?? 0.054,
        },
      })
      await loadPalettes()
    } catch (e: any) {
      setError(e.message || 'Erreur lors du bin-packing')
    } finally {
      setRunning(false)
    }
  }

  const toggleCentrale = (c: string) => {
    setExpandedCentrales(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  const grouped = palettes.reduce<Record<string, PaletteRow[]>>((acc, p) => {
    (acc[p.centrale_nom] ??= []).push(p)
    return acc
  }, {})

  // Conditionnement pour l'éditeur
  const conditionnement = {
    ex_par_carton:       op?.ex_par_carton       ?? 200,
    cartons_par_palette: op?.cartons_par_palette  ?? 48,
    poids_unitaire_kg:   op?.poids_unitaire_kg    ?? 0.054,
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Palettisation</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {op
              ? `${op.code_operation} — ${palettes.length} palettes${op.nb_palettes_grp != null ? ` (${op.nb_palettes_grp}G + ${op.nb_palettes_pdv}P)` : ''}`
              : 'Sélectionner une opération'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {palettes.length > 0 && (
            <button
              onClick={() => setMode(m => m === 'edit' ? 'view' : 'edit')}
              className={`flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border transition-colors ${
                mode === 'edit'
                  ? 'bg-gray-900 text-white border-transparent'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Pencil size={12} />
              {mode === 'edit' ? 'Terminer l\'édition' : 'Éditer les palettes'}
            </button>
          )}
          <select
            value={selectedOp}
            onChange={e => { setSelectedOp(e.target.value); navigate(`/palettisation/${e.target.value}`) }}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
          >
            {operations.map(o => (
              <option key={o.id} value={o.id}>
                {o.code_operation} — {o.nom_operation ?? o.code_operation}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Chargement...</div>
      ) : !op ? (
        <div className="text-center py-16">
          <Boxes size={32} className="mx-auto text-gray-300 mb-3" />
          <div className="text-sm text-gray-500">Aucune opération</div>
        </div>
      ) : palettes.length === 0 ? (

        /* ── Aucune palette : lancer le bin-packing ── */
        <div className="max-w-2xl mx-auto px-5 py-12">
          <div className="border border-gray-200 rounded-xl p-6 text-center">
            <Boxes size={32} className="mx-auto text-gray-300 mb-3" />
            <div className="text-sm font-medium text-gray-900">Aucune palette générée</div>
            <div className="text-xs text-gray-500 mt-1">
              Lancez l'algorithme de bin-packing pour composer les palettes à partir des données normalisées
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2 text-left">
              {[
                { label: 'Ex/carton',   value: op.ex_par_carton       ?? 200 },
                { label: 'Crt/palette', value: op.cartons_par_palette  ?? 48 },
                { label: 'Seuil PDV',   value: (op.seuil_pdv ?? 2800).toLocaleString() },
                { label: 'Poids/ex',    value: `${op.poids_unitaire_kg ?? 0.054} kg` },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-400">{s.label}</div>
                  <div className="text-sm font-medium">{s.value}</div>
                </div>
              ))}
            </div>
            {error && (
              <div className="mt-4 flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 text-left">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> <span>{error}</span>
              </div>
            )}
            <button
              onClick={handleRunBinpacking}
              disabled={running}
              className="mt-5 px-5 py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2 mx-auto"
            >
              {running
                ? <><Loader2 size={14} className="animate-spin" /> Bin-packing en cours...</>
                : <><Play size={14} /> Lancer le bin-packing</>}
            </button>
          </div>
        </div>

      ) : mode === 'edit' ? (

        /* ── Mode éditeur ── */
        <div className="max-w-5xl mx-auto px-5 py-6">
          <PaletteEditor
            operationId={op.id}
            rawPalettes={palettes}
            conditionnement={conditionnement}
            onSaved={loadPalettes}
          />
        </div>

      ) : (

        /* ── Mode vue ── */
        <div className="max-w-5xl mx-auto px-5 py-6 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Total palettes</div>
              <div className="text-xl font-semibold">{palettes.length}</div>
              <div className="text-xs text-gray-400">{op.nb_palettes_grp ?? 0}G + {op.nb_palettes_pdv ?? 0}P</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Centrales</div>
              <div className="text-xl font-semibold">{Object.keys(grouped).length}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Exemplaires</div>
              <div className="text-xl font-semibold">{(op.total_exemplaires ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Poids total</div>
              <div className="text-xl font-semibold">
                {op.poids_total_kg ? `${Math.round(op.poids_total_kg).toLocaleString()} kg` : '—'}
              </div>
            </div>
          </div>
          <PaletteAlerts
            operationId={op.id}
            onRelancer={handleRunBinpacking}
          />

          {/* Relancer */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleRunBinpacking}
              disabled={running}
              className="text-[11px] text-gray-500 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded transition-colors flex items-center gap-1"
            >
              {running
                ? <><Loader2 size={11} className="animate-spin" /> Recalcul...</>
                : 'Relancer le bin-packing'}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" /> <span>{error}</span>
            </div>
          )}

          {/* Groupes par centrale */}
          {Object.entries(grouped).map(([centrale, pals]) => {
            const isExpanded = expandedCentrales.has(centrale)
            const totalEx    = pals.reduce((s, p) => s + p.nb_exemplaires, 0)
            const totalKg    = pals.reduce((s, p) => s + p.poids_kg, 0)
            const nbGrp      = pals.filter(p => p.type_palette === 'groupee').length
            const nbPdv      = pals.filter(p => p.type_palette === 'pdv').length

            return (
              <div key={centrale} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCentrale(centrale)}
                  className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
                  data-selectable={JSON.stringify({
                    type: 'centrale',
                    label: `Centrale ${centrale}`,
                    data: {
                      centrale,
                      nb_palettes: pals.length,
                      nb_palettes_groupees: nbGrp,
                      nb_palettes_pdv: nbPdv,
                      total_exemplaires: totalEx,
                      poids_total_kg: Math.round(totalKg),
                    }
                  })}
                  data-selectable-label={`Centrale ${centrale}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-gray-900">{centrale}</span>
                    <span className="text-xs text-gray-400">{pals.length} palettes ({nbGrp}G + {nbPdv}P)</span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{totalEx.toLocaleString()} ex</span>
                    <span>{Math.round(totalKg).toLocaleString()} kg</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-3">
                    {pals.map(p => {
                      const isPdv = p.type_palette === 'pdv'
                      const magasins: any[] = (() => {
                        if (!p.magasins) return []
                        try { return typeof p.magasins === 'string' ? JSON.parse(p.magasins) : p.magasins }
                        catch { return [] }
                      })()
                      return (
                        <PaletteCard
                          key={p.id}
                          p={p}
                          isPdv={isPdv}
                          magasins={magasins}
                          exParCarton={conditionnement.ex_par_carton}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Suivant */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => navigate('/livrables')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Générer les livrables <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
