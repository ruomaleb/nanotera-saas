import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X, RefreshCw, ArrowRight, Info } from 'lucide-react'
import { useOpContext } from '../components/Layout'
import type { Operation } from '../types/database'

type ImportState = 'idle' | 'uploading' | 'success' | 'error'

export default function Import() {
  const navigate = useNavigate()
  const { org } = useOrg()
  const { currentOp, setCurrentOp } = useOpContext()
  const [operations, setOperations] = useState<Operation[]>([])
  const [selectedOp, setSelectedOp] = useState('')
  const [lastImportInfo, setLastImportInfo] = useState<{nom_fichier?: string; date?: string; nb_magasins?: number; total_exemplaires?: number} | null>(null)
  const [reImportMode, setReImportMode] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [state, setState] = useState<ImportState>('idle')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Charger toutes les opérations actives (pas terminées/annulées)
    supabase
      .from('ops_operations')
      .select('id, code_operation, nom_operation, statut, total_exemplaires, nb_magasins, nom_fichier_import, updated_at')
      .not('statut', 'in', '("termine","annule")')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOperations(data ?? [])
        // Pré-sélectionner l'opération active de la sidebar
        const activeId = currentOp?.id
        if (activeId && data?.find(o => o.id === activeId)) {
          setSelectedOp(activeId)
        } else if (data?.[0]) {
          setSelectedOp(data[0].id)
        }
      })
  }, [currentOp?.id])

  // Charger les infos du dernier import quand l'opération change
  useEffect(() => {
    if (!selectedOp) { setLastImportInfo(null); return }
    const op = operations.find(o => o.id === selectedOp)
    if (!op) return
    const alreadyImported = ['analyse', 'palettisation', 'livrables'].includes(op.statut)
    if (alreadyImported) {
      setLastImportInfo({
        nom_fichier: op.nom_fichier_import,
        date: op.updated_at,
        nb_magasins: op.nb_magasins,
        total_exemplaires: op.total_exemplaires,
      })
      setReImportMode(false)
    } else {
      setLastImportInfo(null)
      setReImportMode(false)
    }
  }, [selectedOp, operations])

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['xls', 'xlsx', 'csv'].includes(ext ?? '')) {
      setError('Format accepte : .xls, .xlsx ou .csv')
      return
    }
    setFile(f)
    setError('')
    setState('idle')
    setResult(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleUpload = async () => {
    if (!file || !selectedOp) return
    setState('uploading')
    setError('')

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

    try {
      const formData = new FormData()
      formData.append('file', file)

      const { data: { session } } = await supabase.auth.getSession()

      const resp = await fetch(`${apiUrl}/api/operations/${selectedOp}/import`, {
        method: 'POST',
        headers: session?.access_token
          ? { 'Authorization': `Bearer ${session.access_token}` }
          : {},
        body: formData,
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail || `Erreur ${resp.status}`)
      }

      const data = await resp.json()
      setResult({
        nb_magasins: data.nb_magasins,
        total_exemplaires: data.total_exemplaires,
        nb_centrales: data.nb_centrales,
        nb_pdv: data.nb_pdv,
        controles: data.controles,
        warnings: data.warnings ?? [],
        sample: data.sample ?? [],
      })
      setState('success')
      // Mettre à jour l'opération active dans la sidebar
      const op = operations.find(o => o.id === selectedOp)
      if (op) setCurrentOp({ id: op.id, code: op.code_operation, nom: op.nom_operation ?? '', statut: 'analyse' })
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion au backend')
      setState('error')
    }
  }

  const clearFile = () => {
    setFile(null)
    setState('idle')
    setResult(null)
    setError('')
  }

  return (
    <div>
      <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-stone-900">Import de répartition</h1>
          <p className="text-xs text-stone-400 mt-0.5">Charger le fichier client pour lancer l'analyse</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

        {/* Sélecteur opération */}
        <div>
          <label className="text-xs text-stone-500 block mb-1">Opération cible *</label>
          <select value={selectedOp} onChange={e => setSelectedOp(e.target.value)}
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-400">
            <option value="">Sélectionner une opération</option>
            {operations.map(op => (
              <option key={op.id} value={op.id}>
                {op.code_operation} — {op.nom_operation ?? 'Sans nom'}
                {' '}({op.statut === 'planifie' ? 'Planifiée' : op.statut === 'import' ? 'Import en cours' : op.statut === 'analyse' ? 'Déjà analysée' : op.statut})
              </option>
            ))}
          </select>
          {operations.length === 0 && (
            <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <Info size={12} /> Aucune opération active. <button onClick={() => navigate('/operations/new')} className="underline">Créer une opération</button>
            </div>
          )}
        </div>

        {/* Bannière opération déjà importée */}
        {lastImportInfo && !reImportMode && (
          <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-sm font-medium text-emerald-700">Import déjà réalisé</span>
              </div>
              <button onClick={() => setReImportMode(true)}
                className="flex items-center gap-1 text-xs text-stone-500 border border-stone-200 bg-white rounded-lg px-2.5 py-1.5 hover:border-stone-300 transition-colors">
                <RefreshCw size={11} /> Re-importer un nouveau fichier
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white border border-emerald-100 rounded-lg p-2.5">
                <div className="text-stone-400 mb-0.5">Magasins importés</div>
                <div className="text-lg font-semibold text-stone-900">{lastImportInfo.nb_magasins?.toLocaleString('fr-FR') ?? '—'}</div>
              </div>
              <div className="bg-white border border-emerald-100 rounded-lg p-2.5">
                <div className="text-stone-400 mb-0.5">Exemplaires</div>
                <div className="text-lg font-semibold text-stone-900">{lastImportInfo.total_exemplaires?.toLocaleString('fr-FR') ?? '—'}</div>
              </div>
            </div>
            {lastImportInfo.date && (
              <div className="text-xs text-stone-400">
                Importé le {new Date(lastImportInfo.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {lastImportInfo.nom_fichier && <span> · <span className="font-mono">{lastImportInfo.nom_fichier}</span></span>}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => navigate('/analyse')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:opacity-85 transition-all">
                Voir l'analyse <ArrowRight size={13} />
              </button>
              <button onClick={() => navigate(`/palettisation/${selectedOp}`)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors">
                Aller à la palettisation <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Zone upload — masquée si déjà importé et pas en mode re-import */}
        {(!lastImportInfo || reImportMode) && (<>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-indigo-400 bg-indigo-50'
              : file
                ? 'border-emerald-300 bg-emerald-50/50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx,.csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet size={28} className="text-emerald-500" />
              <div className="text-left">
                <div className="font-medium text-sm text-gray-900">{file.name}</div>
                <div className="text-xs text-gray-400">{Math.round(file.size / 1024)} Ko</div>
              </div>
              <button onClick={e => { e.stopPropagation(); clearFile() }}
                className="ml-4 p-1 rounded hover:bg-gray-100">
                <X size={14} className="text-gray-400" />
              </button>
            </div>
          ) : (
            <>
              <Upload size={28} className="mx-auto text-gray-300 mb-3" />
              <div className="text-sm text-gray-500">
                Glisser-deposer un fichier .xls, .xlsx ou .csv
              </div>
              <div className="text-xs text-gray-400 mt-1">
                ou cliquer pour parcourir
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Avertissement re-import */}
        {reImportMode && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>Un re-import <strong>remplacera toutes les données normalisées</strong> et invalidera la palettisation existante si elle a déjà été calculée.</span>
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!file || !selectedOp || state === 'uploading'}
          className="w-full py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
        >
          {state === 'uploading' ? (
            <><Loader2 size={14} className="animate-spin" /> Analyse en cours...</>
          ) : (
            <><Upload size={14} /> Lancer l'import et l'analyse</>
          )}
        </button>

        {/* Result */}
        {result && state === 'success' && (
          <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/30 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="font-medium text-sm text-emerald-700">Analyse terminee</span>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 border border-emerald-100">
                <div className="text-[10px] text-gray-400">Magasins</div>
                <div className="text-lg font-semibold">{result.nb_magasins}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-emerald-100">
                <div className="text-[10px] text-gray-400">Exemplaires</div>
                <div className="text-lg font-semibold">{result.total_exemplaires?.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-emerald-100">
                <div className="text-[10px] text-gray-400">Centrales</div>
                <div className="text-lg font-semibold">{result.nb_centrales}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-emerald-100">
                <div className="text-[10px] text-gray-400">PDV individuels</div>
                <div className="text-lg font-semibold">{result.nb_pdv}</div>
              </div>
            </div>

            {result.warnings?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-xs font-medium text-amber-700 mb-1">Avertissements</div>
                {result.warnings.map((w: string, i: number) => (
                  <div key={i} className="text-[11px] text-amber-600 mt-0.5">• {w}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => navigate('/analyse')}
                className="px-4 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors">
                Voir les resultats detailles
              </button>
            </div>
          </div>
        )}

        {/* Info box */}
        </>)}
        <div className="bg-stone-50 rounded-xl p-4 text-xs text-stone-500">
          <div className="font-medium text-gray-700 mb-1.5">Formats de fichier supportes</div>
          <div className="space-y-1">
            <div><span className="font-mono bg-gray-100 px-1 rounded">.xls</span> — Excel multi-onglets (format Galec : 1 onglet = 1 centrale)</div>
            <div><span className="font-mono bg-gray-100 px-1 rounded">.xlsx</span> — Excel mono-onglet</div>
            <div><span className="font-mono bg-gray-100 px-1 rounded">.csv</span> — CSV delimiteur point-virgule</div>
          </div>
          <div className="mt-3 text-[10px] text-gray-400">
            L'import declenche automatiquement : extraction structure → normalisation (13 colonnes) → controles qualite.
            Le pipeline complet est dans ingestion.py + normalisation.py + controles.py.
          </div>
        </div>
      </div>
    </div>
  )
}
