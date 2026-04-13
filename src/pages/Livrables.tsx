import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiDownload, triggerDownload } from '../lib/api'
import {
  FileText, FileSpreadsheet, Download, Loader2, Check,
  Clock, AlertCircle, Eye, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useOpContext } from '../components/Layout'

// ── Types ──────────────────────────────────────────────────────────

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
  { id: '1', key: 'fiches_palettes',    label: 'Fiches palettes FRETIN',       type: 'docx', icon: FileText       },
  { id: '2', key: 'bons_livraison',     label: 'Bons de livraison FRETIN',     type: 'docx', icon: FileText       },
  { id: '3', key: 'etiquettes',         label: 'Base etiquettes cartons',      type: 'xlsx', icon: FileSpreadsheet},
  { id: '4', key: 'fiches_appl',        label: 'Fiches palettes APPL',         type: 'docx', icon: FileText       },
  { id: '5', key: 'repartition_appl',   label: 'Repartition APPL',             type: 'xlsx', icon: FileSpreadsheet},
  { id: '6', key: 'repartition_fretin', label: 'Repartition NANOTERA FRETIN',  type: 'xlsx', icon: FileSpreadsheet},
  { id: '7', key: 'global',             label: 'GLOBAL',                       type: 'xlsx', icon: FileSpreadsheet},
  { id: '8', key: 'recap',              label: 'Recap logistique',             type: 'xlsx', icon: FileSpreadsheet},
]

const DESCRIPTIONS: Record<string, (op: any) => string> = {
  fiches_palettes:    op => `${op.nb_palettes_grp ?? 0} fiches — 1 page par palette groupee, detail magasins`,
  bons_livraison:     op => `${op.nb_centrales ?? 16} BL — 1 page par centrale, synthese palettes`,
  etiquettes:         op => `${op.nb_etiquettes ?? '~2 900'} lignes — 1 ligne = 1 carton, 13 colonnes`,
  fiches_appl:        ()  => `Palettes sous lien pour l'imprimeur — destinataire NANOTERA + PDV directs`,
  repartition_appl:   ()  => `Instructions imprimeur — KARTONS groupes + PDV individuels + dispatch`,
  repartition_fretin: ()  => `Magasins groupes avec nb cartons et allocation palette`,
  global:             ()  => `3 onglets : Global + Repartition APPL + Repartition FRETIN`,
  recap:              ()  => `Synthese 16 centrales × palettes FRETIN/APPL, poids, dates enlevement`,
}

// ── Imports statiques — pas de CDN ────────────────────────────────
// npm install docx-preview luckyexcel @fortune-sheet/react
import { renderAsync } from 'docx-preview'
import { transformExcelToLucky } from 'luckyexcel'
import { Workbook } from '@fortune-sheet/react'
import '@fortune-sheet/react/dist/index.css'



// ── Composant Preview ────────────────────────────────────────────────

function PreviewPanel({
  livrable, onClose, onPrev, onNext, hasPrev, hasNext, onGenerate,
}: {
  livrable: Livrable; onClose: () => void
  onPrev: () => void; onNext: () => void
  hasPrev: boolean; hasNext: boolean
  onGenerate: (l: Livrable) => Promise<void>
}) {
  const docxRef               = useRef<HTMLDivElement>(null)
  const [xlsxSheets, setXlsxSheets] = useState<any[]>([])
  const [loading, setLoading]     = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError]         = useState('')

  // ── Rendu docx ──
  const renderDocx = useCallback(async (blob: Blob) => {
    if (!docxRef.current) return
    setLoading(true); setError('')
    docxRef.current.innerHTML = ''
    try {
      const buf = await blob.arrayBuffer()
      await renderAsync(buf, docxRef.current, docxRef.current, {
        inWrapper: true, ignoreWidth: false, ignoreHeight: false,
        breakPages: true, renderHeaders: true, renderFooters: true,
      })
    } catch (e: any) {
      setError(`Erreur docx : ${e.message}`)
    }
    setLoading(false)
  }, [])

  // ── Rendu xlsx ──
  const renderXlsx = useCallback(async (blob: Blob) => {
    setLoading(true); setError(''); setXlsxSheets([])
    try {
      const file = new File([blob], 'preview.xlsx',
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const sheets = await new Promise<any[]>((resolve, reject) => {
        transformExcelToLucky(
          file,
          (exportJson: any) => {
            if (exportJson?.sheets?.length) resolve(exportJson.sheets)
            else reject(new Error('Aucune feuille — format xls non supporté, utilisez xlsx'))
          },
          (err: any) => reject(new Error(String(err)))
        )
      })
      setXlsxSheets(sheets)
    } catch (e: any) {
      setError(`Erreur xlsx : ${e.message}`)
    }
    setLoading(false)
  }, [])

  // Déclencher le bon rendu quand le livrable change
  useEffect(() => {
    setXlsxSheets([]); setError('')
    if (livrable.status !== 'done' || !livrable.blob) return
    if (livrable.type === 'docx') renderDocx(livrable.blob)
    else renderXlsx(livrable.blob)
  }, [livrable.id, livrable.blob])

  // Pour docx, re-rendre quand le ref est disponible
  useEffect(() => {
    if (livrable.type === 'docx' && livrable.blob && docxRef.current && !loading) {
      renderDocx(livrable.blob)
    }
  }, [docxRef.current])

  const handleGenerate = async () => {
    setGenerating(true)
    await onGenerate(livrable)
    setGenerating(false)
  }

  const Icon = livrable.icon
  const isReady = livrable.status === 'done' && livrable.blob

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-[62rem] max-w-[92vw] bg-white flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${livrable.type === 'docx' ? 'bg-blue-50' : 'bg-emerald-50'}`}>
              <Icon size={14} className={livrable.type === 'docx' ? 'text-blue-500' : 'text-emerald-500'} />
            </div>
            <span className="text-sm font-medium text-stone-900 truncate">{livrable.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 flex-shrink-0">.{livrable.type}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isReady && (
              <button onClick={() => livrable.blob && triggerDownload(livrable.blob, livrable.filename ?? livrable.label)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                <Download size={11} /> Télécharger
              </button>
            )}
            <button onClick={onPrev} disabled={!hasPrev} className="p-1.5 rounded hover:bg-stone-100 disabled:opacity-30"><ChevronLeft size={14} /></button>
            <button onClick={onNext} disabled={!hasNext} className="p-1.5 rounded hover:bg-stone-100 disabled:opacity-30"><ChevronRight size={14} /></button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-stone-100 ml-1"><X size={14} /></button>
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-hidden relative bg-stone-100" style={{ minHeight: 0 }}>

          {/* Non généré */}
          {!isReady && !generating && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${livrable.type === 'docx' ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                <Icon size={22} className={livrable.type === 'docx' ? 'text-blue-400' : 'text-emerald-400'} />
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-stone-700">Document non encore généré</div>
                <div className="text-xs text-stone-400 mt-1">{livrable.description}</div>
              </div>
              <button onClick={handleGenerate}
                className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white text-xs rounded-lg hover:opacity-85">
                Générer et prévisualiser
              </button>
            </div>
          )}

          {/* Chargement */}
          {(loading || generating) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-100 z-10">
              <Loader2 size={22} className="animate-spin text-stone-400" />
              <div className="text-xs text-stone-400">
                {generating ? 'Génération…' : livrable.type === 'xlsx' ? 'Conversion Excel…' : 'Rendu Word…'}
              </div>
            </div>
          )}

          {/* Erreur */}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 z-10">
              <AlertCircle size={20} className="text-red-400" />
              <div className="text-xs text-red-600 text-center max-w-md">{error}</div>
            </div>
          )}

          {/* Docx — div de rendu docx-preview */}
          <div
            ref={docxRef}
            className="h-full overflow-auto"
            style={{ display: livrable.type === 'docx' && !loading && !error && isReady ? 'block' : 'none' }}
          />

          {/* Xlsx — Fortune Sheet */}
          {livrable.type === 'xlsx' && xlsxSheets.length > 0 && !error && (
            <div style={{ height: '100%', width: '100%', background: '#fff' }}>
              <Workbook
                data={xlsxSheets}
                showToolbar={false}
                showFormulaBar={false}
                showSheetTabs={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────

export default function Livrables() {
  const navigate = useNavigate()
  const { operationId: paramOpId } = useParams<{ operationId?: string }>()
  const [searchParams] = useSearchParams()
  const { currentOp, setCurrentOp } = useOpContext()
  const [operations, setOperations] = useState<any[]>([])
  const [selectedOp, setSelectedOp]  = useState('')
  const [op, setOp]                  = useState<any>(null)
  const [loading, setLoading]        = useState(true)
  const [livrables, setLivrables]    = useState<Livrable[]>([])
  const [previewIdx, setPreviewIdx]  = useState<number | null>(null)

  useEffect(() => {
    supabase
      .from('ops_operations')
      .select('id, code_operation, nom_operation, statut, nb_palettes, nb_palettes_grp, nb_palettes_pdv, nb_centrales, total_exemplaires, nb_etiquettes')
      .in('statut', ['palettisation', 'livrables', 'termine'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOperations(data ?? [])
        const targetId = paramOpId || searchParams.get('op') || currentOp?.id
        const match = targetId && data?.find((o: any) => o.id === targetId)
        const preselect = match ? (match as any).id : data?.[0]?.id ?? ''
        if (preselect) setSelectedOp(preselect)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const found = operations.find(o => o.id === selectedOp)
    setOp(found ?? null)
    if (found) {
      // Avancer le statut à 'livrables' si l'op est encore en 'palettisation'
      let statut = found.statut
      if (statut === 'palettisation') {
        statut = 'livrables'
        supabase.from('ops_operations').update({ statut: 'livrables' }).eq('id', found.id).then(() => {})
      }
      setCurrentOp({ id: found.id, code: found.code_operation, nom: found.nom_operation ?? '', statut })
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
    setPreviewIdx(null)
  }, [selectedOp, operations])

  const updateLivrable = (id: string, patch: Partial<Livrable>) =>
    setLivrables(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))

  const handleGenerate = async (livrable: Livrable) => {
    if (!op) return
    updateLivrable(livrable.id, { status: 'generating', errorMsg: undefined })
    try {
      const { blob, filename } = await apiDownload(`/api/operations/${op.id}/generate/${livrable.key}`, { method: 'POST' })
      updateLivrable(livrable.id, { status: 'done', blob, filename })
    } catch (e: any) {
      updateLivrable(livrable.id, { status: 'error', errorMsg: e.message || 'Erreur de generation' })
    }
  }

  const handleGenerateAll = async () => {
    for (const l of livrables.filter(l => l.enabled && l.status === 'available')) {
      await handleGenerate(l)
    }
  }

  const nbDone = livrables.filter(l => l.status === 'done').length

  const StatusIcon = (l: Livrable) => {
    if (l.status === 'generating') return <Loader2 size={14} className="text-indigo-500 animate-spin" />
    if (l.status === 'done')       return <Check size={14} className="text-emerald-500" />
    if (l.status === 'error')      return <AlertCircle size={14} className="text-red-500" />
    return <Clock size={14} className="text-gray-400" />
  }

  const currentPreview = previewIdx !== null ? livrables[previewIdx] : null

  return (
    <div>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Génération des livrables</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {op ? `${op.code_operation} — ${nbDone}/${livrables.length} générés` : 'Sélectionner une opération'}
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
              Tout générer
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Chargement...</div>
      ) : !op ? (
        <div className="text-center py-16">
          <FileText size={32} className="mx-auto text-gray-300 mb-3" />
          <div className="text-sm text-gray-500">Aucune opération avec palettisation</div>
          <button onClick={() => navigate('/palettisation')}
            className="mt-4 px-4 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
            Aller à la palettisation
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
              <div className="text-[11px] text-gray-500">Étiquettes</div>
              <div className="text-lg font-semibold">{op.nb_etiquettes ?? '—'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] text-gray-500">Documents</div>
              <div className="text-lg font-semibold">{nbDone}/{livrables.length}</div>
              <div className="text-[10px] text-gray-400">générés</div>
            </div>
          </div>

          {/* Document list */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-medium text-sm">Documents</h3>
              <div className="flex gap-3 text-[10px] text-gray-400">
                <span>{livrables.filter(l => l.type === 'docx').length} Word</span>
                <span>{livrables.filter(l => l.type === 'xlsx').length} Excel</span>
              </div>
            </div>

            {livrables.map((l, idx) => {
              const Icon = l.icon
              return (
                <div key={l.id} className="border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                    {/* Icône type */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      l.type === 'docx' ? 'bg-blue-50' : 'bg-emerald-50'
                    }`}>
                      <Icon size={16} className={l.type === 'docx' ? 'text-blue-500' : 'text-emerald-500'} />
                    </div>

                    {/* Label + description */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900">{l.label}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{l.description}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {StatusIcon(l)}

                      {/* Aperçu — toujours visible */}
                      <button
                        onClick={() => setPreviewIdx(idx)}
                        className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded border transition-colors ${
                          previewIdx === idx
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                        }`}>
                        <Eye size={10} /> Aperçu
                      </button>

                      {/* Générer / Télécharger */}
                      {l.status === 'available' && l.enabled && (
                        <button onClick={() => handleGenerate(l)}
                          className="px-2.5 py-1 text-[10px] bg-gray-100 text-gray-600 rounded border border-gray-200 hover:bg-gray-200 transition-colors font-medium">
                          Générer
                        </button>
                      )}
                      {l.status === 'done' && (
                        <button onClick={() => l.blob && triggerDownload(l.blob, l.filename ?? l.label)}
                          className="px-2.5 py-1 text-[10px] bg-indigo-50 text-indigo-600 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors font-medium flex items-center gap-1">
                          <Download size={10} /> .{l.type}
                        </button>
                      )}
                      {l.status === 'error' && (
                        <button onClick={() => handleGenerate(l)}
                          className="px-2.5 py-1 text-[10px] bg-red-50 text-red-600 rounded border border-red-100 hover:bg-red-100 transition-colors font-medium">
                          Réessayer
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Erreur inline */}
                  {l.status === 'error' && l.errorMsg && (
                    <div className="px-4 pb-3 text-[10px] text-red-600 ml-11">{l.errorMsg}</div>
                  )}
                </div>
              )
            })}
          </div>

          {!op.nb_palettes && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              Cette opération n'a pas encore de palettes. Lancez la palettisation d'abord.
            </div>
          )}
        </div>
      )}

      {/* Preview drawer */}
      {currentPreview !== null && previewIdx !== null && (
        <PreviewPanel
          livrable={currentPreview}
          onClose={() => setPreviewIdx(null)}
          onPrev={() => setPreviewIdx(i => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setPreviewIdx(i => (i !== null && i < livrables.length - 1 ? i + 1 : i))}
          hasPrev={previewIdx > 0}
          hasNext={previewIdx < livrables.length - 1}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  )
}
