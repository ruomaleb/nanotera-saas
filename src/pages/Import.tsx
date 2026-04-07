import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import type { Operation } from '../types/database'

type ImportState = 'idle' | 'uploading' | 'success' | 'error'

export default function Import() {
  const navigate = useNavigate()
  const { org } = useOrg()
  const [operations, setOperations] = useState<Operation[]>([])
  const [selectedOp, setSelectedOp] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [state, setState] = useState<ImportState>('idle')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('ops_operations')
      .select('id, code_operation, nom_operation, statut, total_exemplaires')
      .in('statut', ['planifie', 'import'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setOperations(data ?? []))
  }, [])

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
      <div className="px-5 py-4 border-b border-gray-200">
        <h1 className="text-base font-semibold text-gray-900">Import de repartition</h1>
        <p className="text-xs text-gray-400 mt-0.5">Charger le fichier client pour lancer l'analyse</p>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        {/* Operation selector */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Operation cible *</label>
          <select
            value={selectedOp}
            onChange={e => setSelectedOp(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value="">Selectionner une operation</option>
            {operations.map(op => (
              <option key={op.id} value={op.id}>
                {op.code_operation} — {op.nom_operation ?? 'Sans nom'}
                {op.statut === 'import' ? ' (en cours)' : ''}
              </option>
            ))}
          </select>
          {operations.length === 0 && (
            <div className="text-[10px] text-amber-600 mt-1">
              Aucune operation en statut "planifie" ou "import". Creez d'abord une operation.
            </div>
          )}
        </div>

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
        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
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
