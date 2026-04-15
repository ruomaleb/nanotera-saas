/**
 * RecapPage.tsx
 * Page de confirmation partagée — /recap/:operationId
 * Accessible depuis le SaaS (fin de workflow) et depuis Chainlit (lien en fin de session).
 * Charge ops_operations + ops_livrables, génère les URLs de téléchargement Supabase.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  CheckCircle2, Download, FileText, Table2,
  Package, Users, Layers, Weight,
  ArrowLeft, MessageSquare, Loader2, ExternalLink,
  Calendar, Building2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────

interface Operation {
  id: string
  code_operation: string
  nom_operation: string | null
  statut: string
  date_debut: string | null
  date_fin: string | null
  nb_magasins: number | null
  nb_centrales: number | null
  total_exemplaires: number | null
  nb_palettes: number | null
  nb_palettes_grp: number | null
  nb_palettes_pdv: number | null
  poids_total_kg: number | null
  nb_etiquettes: number | null
  completed_at: string | null
  ref_enseignes?: { nom: string } | null
  ref_imprimeurs?: { nom: string } | null
}

interface Livrable {
  id: string
  type_livrable: string
  nom_fichier: string
  storage_path: string | null
  taille_octets: number | null
  genere_at: string | null
}

// ── Helpers ────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  fiches_palettes: { label: 'Fiches palettes',       icon: Package,   color: 'text-blue-600  bg-blue-50' },
  bon_livraison:   { label: 'Bons de livraison',     icon: FileText,  color: 'text-indigo-600 bg-indigo-50' },
  etiquettes:      { label: 'Étiquettes cartons',    icon: Table2,    color: 'text-emerald-600 bg-emerald-50' },
  repartition:     { label: 'Répartition',           icon: Layers,    color: 'text-amber-600   bg-amber-50' },
  recap:           { label: 'Récapitulatif',          icon: FileText,  color: 'text-stone-600   bg-stone-100' },
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function fmt(n: number | null, suffix = '') {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR') + suffix
}

// ── Composant ──────────────────────────────────────────────────

export default function RecapPage() {
  const { operationId }   = useParams<{ operationId: string }>()
  const [searchParams]    = useSearchParams()
  const navigate          = useNavigate()
  const source            = searchParams.get('from') // 'chainlit' | null

  const [op, setOp]               = useState<Operation | null>(null)
  const [livrables, setLivrables] = useState<Livrable[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (!operationId) return
    Promise.all([
      supabase
        .from('ops_operations')
        .select('*, ref_enseignes(nom), ref_imprimeurs(nom)')
        .eq('id', operationId)
        .single(),
      supabase
        .from('ops_livrables')
        .select('*')
        .eq('operation_id', operationId)
        .order('genere_at', { ascending: true }),
    ]).then(([opRes, livRes]) => {
      if (opRes.error || !opRes.data) {
        setError("Opération introuvable ou accès refusé.")
      } else {
        setOp(opRes.data as Operation)
        setLivrables((livRes.data as Livrable[]) ?? [])
      }
      setLoading(false)
    })
  }, [operationId])

  async function handleDownload(livrable: Livrable) {
    if (!livrable.storage_path) return
    setDownloading(livrable.id)
    try {
      const { data, error } = await supabase.storage
        .from('livrables')
        .createSignedUrl(livrable.storage_path, 300) // 5 min
      if (error || !data?.signedUrl) throw error
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = livrable.nom_fichier
      a.click()
    } catch {
      alert(`Erreur lors du téléchargement de ${livrable.nom_fichier}`)
    }
    setDownloading(null)
  }

  // ── Chargement ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={20} className="animate-spin text-stone-300" />
      </div>
    )
  }

  if (error || !op) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-sm text-stone-500">{error || "Opération introuvable."}</p>
        <button onClick={() => navigate('/')}
          className="text-xs text-brand-600 hover:underline">
          ← Retour à l'accueil
        </button>
      </div>
    )
  }

  // ── Rendu ─────────────────────────────────────────────────────

  const isComplete = op.statut === 'termine'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isComplete ? 'bg-emerald-50' : 'bg-amber-50'
          }`}>
            <CheckCircle2 size={20} className={isComplete ? 'text-emerald-500' : 'text-amber-400'} />
          </div>
          <div>
            <h1 className="text-lg font-medium text-stone-800">{op.code_operation}</h1>
            {op.nom_operation && (
              <p className="text-sm text-stone-400">{op.nom_operation}</p>
            )}
          </div>
        </div>

        {/* Navigation retour */}
        <div className="flex items-center gap-2">
          {source === 'chainlit' ? (
            <button
              onClick={() => navigate('/assistant')}
              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-amber-600 transition-colors"
            >
              <MessageSquare size={13} /> Retour à l'assistant
            </button>
          ) : (
            <button
              onClick={() => navigate(`/operations/${op.id}`)}
              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              <ArrowLeft size={13} /> Fiche opération
            </button>
          )}
        </div>
      </div>

      {/* ── Métadonnées ── */}
      <div className="grid grid-cols-2 gap-3 text-xs text-stone-500">
        {op.ref_enseignes?.nom && (
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-stone-300" />
            {op.ref_enseignes.nom}
          </div>
        )}
        {op.date_debut && op.date_fin && (
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-stone-300" />
            Du {new Date(op.date_debut).toLocaleDateString('fr-FR')} au {new Date(op.date_fin).toLocaleDateString('fr-FR')}
          </div>
        )}
      </div>

      {/* ── Métriques ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Layers,   label: 'Palettes',     value: fmt(op.nb_palettes),
            sub: op.nb_palettes_grp != null ? `${op.nb_palettes_grp}G + ${op.nb_palettes_pdv ?? 0}P` : undefined },
          { icon: Package,  label: 'Exemplaires',  value: fmt(op.total_exemplaires) },
          { icon: Users,    label: 'Magasins',     value: fmt(op.nb_magasins),
            sub: op.nb_centrales ? `${op.nb_centrales} centrales` : undefined },
          { icon: Weight,   label: 'Poids total',  value: op.poids_total_kg ? `${op.poids_total_kg.toLocaleString('fr-FR')} kg` : '—' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label}
            className="bg-stone-50 rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <Icon size={12} /> {label}
            </div>
            <p className="text-xl font-medium text-stone-800">{value}</p>
            {sub && <p className="text-xs text-stone-400">{sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Livrables ── */}
      <div>
        <h2 className="text-sm font-medium text-stone-600 mb-3">
          Livrables générés
          {livrables.length > 0 && (
            <span className="ml-2 text-xs text-stone-400 font-normal">
              {livrables.length} fichier{livrables.length > 1 ? 's' : ''}
            </span>
          )}
        </h2>

        {livrables.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-stone-200 rounded-xl">
            <p className="text-sm text-stone-400">Aucun livrable enregistré pour cette opération.</p>
            {source === 'chainlit' && (
              <p className="text-xs text-stone-300 mt-1">
                Les fichiers générés dans l'assistant sont téléchargeables directement dans le chat.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {livrables.map(liv => {
              const typeInfo = TYPE_LABELS[liv.type_livrable] ?? {
                label: liv.type_livrable, icon: FileText, color: 'text-stone-500 bg-stone-100'
              }
              const Icon = typeInfo.icon
              const ext = liv.nom_fichier.split('.').pop()?.toUpperCase() ?? ''
              return (
                <div key={liv.id}
                  className="flex items-center gap-4 bg-white border border-stone-100 rounded-xl px-4 py-3
                             hover:border-stone-200 transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-700 truncate">{typeInfo.label}</p>
                    <p className="text-xs text-stone-400 truncate">
                      {liv.nom_fichier}
                      {liv.taille_octets ? ` · ${formatSize(liv.taille_octets)}` : ''}
                      {ext && ` · ${ext}`}
                    </p>
                  </div>
                  {liv.storage_path ? (
                    <button
                      onClick={() => handleDownload(liv)}
                      disabled={downloading === liv.id}
                      className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-brand-600
                                 border border-stone-200 hover:border-brand-300 rounded-lg px-3 py-1.5
                                 transition-all disabled:opacity-50"
                    >
                      {downloading === liv.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Download size={12} />
                      }
                      Télécharger
                    </button>
                  ) : (
                    <span className="text-xs text-stone-300 px-3">Non disponible</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Actions bas de page ── */}
      <div className="flex items-center justify-between pt-4 border-t border-stone-100">
        <button
          onClick={() => navigate('/operations')}
          className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft size={12} /> Toutes les opérations
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/assistant')}
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700
                       border border-amber-200 hover:border-amber-300 rounded-lg px-3 py-1.5 transition-all"
          >
            <MessageSquare size={12} /> Ouvrir l'assistant
          </button>
          <button
            onClick={() => navigate('/operations/new')}
            className="flex items-center gap-1.5 text-xs text-white bg-brand-600 hover:bg-brand-700
                       rounded-lg px-3 py-1.5 transition-all"
          >
            Nouvelle opération →
          </button>
        </div>
      </div>

    </div>
  )
}
