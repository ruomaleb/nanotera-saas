import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiDownload, triggerDownload } from '../lib/api'
import { FileText, FileSpreadsheet, Download, Loader2, Check, Clock, AlertCircle } from 'lucide-react'

interface Livrable {
  id: string
  key: string
  label: string
  description: string
  type: 'docx' | 'xlsx'
  icon: typeof FileText
  enabled: boolean
  status: 'available' | 'generating' | 'done' | 'error'
  blob?: Blob
  filename?: string
  errorMsg?: string
}

const LIVRABLES_CONFIG: Omit<Livrable, 'status' | 'enabled' | 'description' | 'filename'>[] = [
  { id: '1', key: 'fiches_palettes', label: 'Fiches palettes FRETIN', type: 'docx', icon: FileText },
  { id: '2', key: 'bons_livraison', label: 'Bons de livraison FRETIN', type: 'docx', icon: FileText },
  { id: '3', key: 'etiquettes', label: 'Base etiquettes cartons', type: 'xlsx', icon: FileSpreadsheet },
  { id: '4', key: 'fiches_appl', label: 'Fiches palettes APPL', type: 'docx', icon: FileText },
  { id: '5', key: 'repartition_appl', label: 'Repartition APPL', type: 'xlsx', icon: FileSpreadsheet },
  { id: '6', key: 'repartition_fretin', label: 'Repartition NANOTERA FRETIN', type: 'xlsx', icon: FileSpreadsheet },
  { id: '7', key: 'global', label: 'GLOBAL', type: 'xlsx', icon: FileSpreadsheet },
  { id: '8', key: 'recap', label: 'Recap logistique', type: 'xlsx', icon: FileSpreadsheet },
]

const DESCRIPTIONS: Record<string, (op: any) => string> = {
  fiches_palettes: op => `${op.nb_palettes_grp ?? 0} fiches — 1 page par palette groupee, detail magasins`,
  bons_livraison: op => `${op.nb_centrales ?? 16} BL — 1 page par centrale, synthese palettes`,
  etiquettes: op => `${op.nb_etiquettes ?? '~2 900'} lignes — 1 ligne = 1 carton, 16 colonnes CamelCase`,
  fiches_appl: () => `Palettes sous lien pour l'imprimeur — destinataire NANOTERA + PDV directs`,
  repartition_appl: () => `Instructions imprimeur — KARTONS groupes + PDV individuels + dispatch`,
  repartition_fretin: () => `Magasins groupes avec nb cartons et allocation palette`,
  global: () => `3 onglets : Global + Repartition APPL + Repartition FRETIN`,
  recap: () => `Synthese 16 centrales × palettes FRETIN/APPL, poids, dates enlevement`,
}

export default function Livrables() {
  const navigate = useNavigate()
  const [operations, setOperations] = useState<any[]>([])
  const [selectedOp, setSelectedOp] = useState('')
  const [op, setOp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [livrables, setLivrables] = useState<Livrable[]>([])

  useEffect(() => {
    supabase
      .from('ops_operations')
      .select('id, code_operation, nom_operation, statut, nb_palettes, nb_palettes_grp, nb_palettes_pdv, nb_centrales, total_exemplaires, nb_etiquettes')
      .in('statut', ['palettisation', 'livrables', 'termine'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOperations(data ?? [])
        if (data?.[0]) setSelectedOp(data[0].id)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const found = operations.find(o => o.id === selectedOp)
    setOp(found ?? null)
    if (found) {
      const hasPal = (found.nb_palettes ?? 0) > 0
      setLivrables(LIVRABLES_CONFIG.map(l => ({
        ...l,
        enabled: hasPal,
        status: 'available',
        description: DESCRIPTIONS[l.key]?.(found) ?? '',
      })))
    } else {
      setLivrables([])
    }
  }, [selectedOp, operations])

  const updateLivrable = (id: string, patch: Partial<Livrable>) => {
    setLivrables(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  const handleGenerate = async (livrable: Livrable) => {
    if (!op) return
    updateLivrable(livrable.id, { status: 'generating', errorMsg: undefined })

    try {
      const { blob, filename } = await apiDownload(`/api/operations/${op.id}/generate/${livrable.key}`, {
        method: 'POST',
      })
      updateLivrable(livrable.id, { status: 'done', blob, filename })
    } catch (e: any) {
      updateLivrable(livrable.id, { status: 'error', errorMsg: e.message || 'Erreur de generation' })
    }
  }

  const handleDownload = (livrable: Livrable) => {
    if (livrable.blob && livrable.filename) {
      triggerDownload(livrable.blob, livrable.filename)
    }
  }

  const handleGenerateAll = async () => {
    for (const l of livrables.filter(l => l.enabled && l.status === 'available')) {
      await handleGenerate(l)
    }
  }

  const STATUS_ICON = (l: Livrable) => {
    if (l.status === 'generating') return <Loader2 size={14} className="text-indigo-500 animate-spin" />
    if (l.status === 'done') return <Check size={14} className="text-emerald-500" />
    if (l.status === 'error') return <AlertCircle size={14} className="text-red-500" />
    return <Clock size={14} className="text-gray-400" />
  }

  const nbDone = livrables.filter(l => l.status === 'done').length

  return (
    <div>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Generation des livrables</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {op ? `${op.code_operation} — ${nbDone}/${livrables.length} generes` : 'Selectionner une operation'}
          </p>
        </div>
        <div className="flex gap-2">
          <select value={selectedOp} onChange={e => setSelectedOp(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white">
            {operations.map(o => (
              <option key={o.id} value={o.id}>{o.code_operation} — {o.nom_operation ?? o.code_operation}</option>
            ))}
          </select>
          {op && (
            <button onClick={handleGenerateAll}
              disabled={livrables.every(l => l.status !== 'available')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors">
              Tout generer
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Chargement...</div>
      ) : !op ? (
        <div className="text-center py-16">
          <FileText size={32} className="mx-auto text-gray-300 mb-3" />
          <div className="text-sm text-gray-500">Aucune operation avec palettisation</div>
          <div className="text-xs text-gray-400 mt-1">Completez d'abord la palettisation pour generer les livrables</div>
          <button onClick={() => navigate('/palettisation')}
            className="mt-4 px-4 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
            Aller a la palettisation
          </button>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-5 py-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] text-gray-500">Palettes</div>
              <div className="text-lg font-semibold">{op.nb_palettes ?? '—'}</div>
              <div className="text-[10px] text-gray-400">{op.nb_palettes_grp ?? 0}G + {op.nb_palettes_pdv ?? 0}P</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] text-gray-500">Exemplaires</div>
              <div className="text-lg font-semibold">{(op.total_exemplaires ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] text-gray-500">Etiquettes</div>
              <div className="text-lg font-semibold">{op.nb_etiquettes ?? '—'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] text-gray-500">Documents</div>
              <div className="text-lg font-semibold">{livrables.length}</div>
              <div className="text-[10px] text-gray-400">{livrables.filter(l => l.type === 'docx').length} docx, {livrables.filter(l => l.type === 'xlsx').length} xlsx</div>
            </div>
          </div>

          {/* Document list */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-medium text-sm">Documents a generer</h3>
              <div className="flex gap-3 text-[10px] text-gray-400">
                <span>{livrables.filter(l => l.type === 'docx').length} Word</span>
                <span>{livrables.filter(l => l.type === 'xlsx').length} Excel</span>
              </div>
            </div>
            {livrables.map(l => {
              const Icon = l.icon
              return (
                <div key={l.id} className="border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      l.type === 'docx' ? 'bg-blue-50' : 'bg-emerald-50'
                    }`}>
                      <Icon size={16} className={l.type === 'docx' ? 'text-blue-500' : 'text-emerald-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900">{l.label}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{l.description}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {STATUS_ICON(l)}
                      {l.status === 'available' && l.enabled && (
                        <button onClick={() => handleGenerate(l)}
                          className="px-3 py-1 text-[10px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors font-medium">
                          Generer
                        </button>
                      )}
                      {l.status === 'done' && (
                        <button onClick={() => handleDownload(l)}
                          className="px-3 py-1 text-[10px] bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors font-medium flex items-center gap-1">
                          <Download size={10} /> .{l.type}
                        </button>
                      )}
                      {l.status === 'error' && (
                        <button onClick={() => handleGenerate(l)}
                          className="px-3 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors font-medium">
                          Reessayer
                        </button>
                      )}
                    </div>
                  </div>
                  {l.status === 'error' && l.errorMsg && (
                    <div className="px-4 pb-3 text-[10px] text-red-600 ml-11">
                      {l.errorMsg}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!op.nb_palettes && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              Cette operation n'a pas encore de palettes. Lancez la palettisation d'abord depuis la page Palettisation.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
