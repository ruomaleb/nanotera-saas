import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, ArrowRight, Pencil, Trash2, Calendar } from 'lucide-react'
import { useOpContext } from '../components/Layout'
import type { Operation, Palette } from '../types/database'

const STATUT_FLOW = ['planifie', 'import', 'analyse', 'palettisation', 'livrables', 'termine'] as const
const STATUT_LABELS: Record<string, string> = {
  planifie: 'Planifie', import: 'Import', analyse: 'Analyse',
  palettisation: 'Palettisation', livrables: 'Livrables', termine: 'Termine', annule: 'Annule',
}
const STATUT_COLORS: Record<string, string> = {
  planifie: 'bg-gray-100 text-gray-600', import: 'bg-amber-50 text-amber-700',
  analyse: 'bg-blue-50 text-blue-700', palettisation: 'bg-blue-50 text-blue-700',
  livrables: 'bg-purple-50 text-purple-700', termine: 'bg-emerald-50 text-emerald-700',
  annule: 'bg-red-50 text-red-600',
}

function StatCard({ label, value, sub }: { label: string; value: string | number | null; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value ?? '—'}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  )
}

/**
 * Convertit une date en format français jj/mm/aaaa pour l'affichage.
 * Accepte les formats ISO ('YYYY-MM-DD'), Supabase TIMESTAMPTZ, ou null/undefined.
 * Retourne le tiret cadratin '—' si vide ou non parsable (cohérent avec les autres champs nullables).
 */
function formatDateFr(value: string | null | undefined): string {
  if (!value) return '—'
  const s = String(value).trim()
  if (!s) return '—'
  // ISO 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:MM:SS...'
  if (s.length >= 10 && s[4] === '-' && s[7] === '-') {
    return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`
  }
  return s
}

function EditField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-[10px] text-gray-400 block mb-0.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
    </div>
  )
}

interface EditFields {
  pagination: string; format_document: string; grammage: string;
  ex_par_paquet: string; ex_par_carton: string; cartons_par_palette: string; seuil_pdv: string;
}

export default function OperationDetail() {
  const { operationId } = useParams()
  const navigate = useNavigate()
  const { setCurrentOp } = useOpContext()
  const [op, setOp] = useState<Operation | null>(null)
  const [palCount, setPalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editStatut, setEditStatut] = useState('')
  const [editFields, setEditFields] = useState<EditFields>({
    pagination: '', format_document: '', grammage: '',
    ex_par_paquet: '', ex_par_carton: '', cartons_par_palette: '', seuil_pdv: '',
  })

  // ── Étape 2.4.C : édition des dates logistique (bloc séparé des specs) ──
  const [editingLogistics, setEditingLogistics] = useState(false)
  const [logisticsFields, setLogisticsFields] = useState<{
    date_enlevement_fretin: string
    date_livraison_client: string
  }>({ date_enlevement_fretin: '', date_livraison_client: '' })

  const initLogisticsFields = (data: Operation) => {
    // Les inputs type="date" attendent du YYYY-MM-DD ; on tronque l'heure si présente
    const d = (data as any).date_enlevement_fretin
    const l = (data as any).date_livraison_client
    setLogisticsFields({
      date_enlevement_fretin: d ? String(d).slice(0, 10) : '',
      date_livraison_client:  l ? String(l).slice(0, 10) : '',
    })
  }

  const initEditFields = (data: Operation) => {
    setEditFields({
      pagination: data.pagination?.toString() ?? '',
      format_document: data.format_document ?? '',
      grammage: data.grammage?.toString() ?? '',
      ex_par_paquet: data.ex_par_paquet?.toString() ?? '',
      ex_par_carton: data.ex_par_carton?.toString() ?? '',
      cartons_par_palette: data.cartons_par_palette?.toString() ?? '',
      seuil_pdv: data.seuil_pdv?.toString() ?? '',
    })
  }

  useEffect(() => {
    if (!operationId) return
    Promise.all([
      supabase
        .from('ops_operations')
        .select('*, enseigne:ref_enseignes(nom, code_court), imprimeur:ref_imprimeurs(nom, type_machine), support_type:ref_support_types(nom)')
        .eq('id', operationId)
        .single(),
      supabase
        .from('ops_palettes')
        .select('id', { count: 'exact', head: true })
        .eq('operation_id', operationId),
    ]).then(([{ data }, { count }]) => {
      setOp(data)
      setEditStatut(data?.statut ?? '')
      if (data) {
        initEditFields(data)
        initLogisticsFields(data)
        setCurrentOp({ id: data.id, code: data.code_operation, nom: data.nom_operation ?? '', statut: data.statut })
      }
      setPalCount(count ?? 0)
      setLoading(false)
    })
  }, [operationId])

  const handleSaveSpecs = async () => {
    if (!op) return
    const update = {
      pagination: editFields.pagination ? parseInt(editFields.pagination) : null,
      format_document: editFields.format_document || null,
      grammage: editFields.grammage ? parseFloat(editFields.grammage) : null,
      ex_par_paquet: editFields.ex_par_paquet ? parseInt(editFields.ex_par_paquet) : null,
      ex_par_carton: editFields.ex_par_carton ? parseInt(editFields.ex_par_carton) : null,
      cartons_par_palette: editFields.cartons_par_palette ? parseInt(editFields.cartons_par_palette) : null,
      seuil_pdv: editFields.seuil_pdv ? parseInt(editFields.seuil_pdv) : null,
    }
    await supabase.from('ops_operations').update(update).eq('id', op.id)
    setOp({ ...op, ...update })
    setEditing(false)
  }

  // ── Étape 2.4.C : sauvegarde des dates logistique vers Supabase ──
  // Les inputs type="date" retournent YYYY-MM-DD, format directement
  // compatible avec la colonne DATE Supabase. Pas de conversion nécessaire.
  // Validation : warning (non bloquant) si enlèvement > livraison client.
  const handleSaveLogistics = async () => {
    if (!op) return
    const dEnlev = logisticsFields.date_enlevement_fretin || null
    const dLivr  = logisticsFields.date_livraison_client  || null
    if (dEnlev && dLivr && dEnlev > dLivr) {
      const proceed = confirm(
        `⚠️ La date d'enlèvement Frétin (${formatDateFr(dEnlev)}) est postérieure ` +
        `à la date de livraison client (${formatDateFr(dLivr)}). ` +
        `Cohérence temporelle inhabituelle — confirmer ?`
      )
      if (!proceed) return
    }
    const update = {
      date_enlevement_fretin: dEnlev,
      date_livraison_client:  dLivr,
    }
    const { error } = await supabase.from('ops_operations').update(update).eq('id', op.id)
    if (error) {
      alert(`Erreur lors de la sauvegarde : ${error.message}`)
      return
    }
    setOp({ ...op, ...update } as Operation)
    setEditingLogistics(false)
  }

  const handleDelete = async () => {
    if (!op || !confirm(`Supprimer l'operation ${op.code_operation} ? Cette action est irreversible.`)) return
    await supabase.from('ops_palettes').delete().eq('operation_id', op.id)
    await supabase.from('ops_operations').delete().eq('id', op.id)
    navigate('/operations')
  }

  if (loading) return <div className="p-12 text-sm text-gray-400 text-center">Chargement...</div>
  if (!op) return <div className="p-12 text-sm text-red-500 text-center">Operation introuvable</div>

  const stepIndex = STATUT_FLOW.indexOf(op.statut as any)
  const enseigne = op.enseigne as any
  const imprimeur = op.imprimeur as any
  const supportType = op.support_type as any

  return (
    <div>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
        <button onClick={() => navigate('/operations')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-900">{op.nom_operation ?? op.code_operation}</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[op.statut]}`}>
              {STATUT_LABELS[op.statut]}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {enseigne?.nom} · {op.code_operation}
            {op.date_debut && op.date_fin && ` · ${op.date_debut} → ${op.date_fin}`}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={handleDelete}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 size={12} /> Supprimer
          </button>
          {['import','analyse','palettisation','livrables'].includes(op.statut) && (
            <button onClick={() => navigate(
                op.statut === 'import' ? '/analyse' :
                ['analyse','palettisation'].includes(op.statut) ? `/palettisation/${op.id}` :
                `/livrables/${op.id}`
              )}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-lg hover:opacity-85 transition-all">
              Continuer <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <StatCard label="Magasins" value={op.nb_magasins} />
          <StatCard label="Exemplaires" value={op.total_exemplaires?.toLocaleString() ?? null} />
          <StatCard label="Palettes" value={op.nb_palettes} sub={op.nb_palettes_grp != null ? `${op.nb_palettes_grp}G + ${op.nb_palettes_pdv}P` : undefined} />
          <StatCard label="Poids total" value={op.poids_total_kg ? `${op.poids_total_kg.toLocaleString()} kg` : null} />
          <StatCard label="Etiquettes" value={op.nb_etiquettes} />
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="font-medium text-sm mb-3">Informations generales</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Enseigne</span><span className="font-medium">{enseigne?.nom ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Categorie</span><span className="font-medium capitalize">{op.categorie}{op.sous_categorie ? ` / ${op.sous_categorie}` : ''}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Imprimeur</span><span className="font-medium">{imprimeur?.nom ?? 'A definir'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Support</span><span className="font-medium">{supportType?.nom ?? 'A definir'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Mode</span><span className="font-medium capitalize">{op.mode_traitement ?? 'assiste'}</span></div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Specifications</h3>
              {!editing
                ? <button onClick={() => { if(op) initEditFields(op); setEditing(true) }} className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700"><Pencil size={10} /> Modifier</button>
                : <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="text-[10px] text-gray-400">Annuler</button>
                    <button onClick={handleSaveSpecs} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">Enregistrer</button>
                  </div>
              }
            </div>
            {!editing ? (
              <>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Pagination</span><span className="font-medium">{op.pagination ? `${op.pagination} pages` : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Format</span><span className="font-medium">{op.format_document ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Grammage</span><span className="font-medium">{op.grammage ? `${op.grammage} g/m2` : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Poids unitaire</span><span className="font-medium">{op.poids_unitaire_kg ? `${op.poids_unitaire_kg} kg/ex` : '—'}</span></div>
                </div>
                <div className="border-t border-gray-200 mt-3 pt-3">
                  <h4 className="text-[11px] text-gray-500 mb-2">Conditionnement</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Ex/paquet</span><span className="font-medium">{op.ex_par_paquet ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Ex/carton</span><span className="font-medium">{op.ex_par_carton ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Crt/palette</span><span className="font-medium">{op.cartons_par_palette ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Seuil PDV</span><span className="font-medium">{op.seuil_pdv?.toLocaleString() ?? '—'}</span></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <EditField label="Pagination" value={editFields.pagination} onChange={v => setEditFields(p => ({...p, pagination: v}))} type="number" />
                  <EditField label="Format" value={editFields.format_document} onChange={v => setEditFields(p => ({...p, format_document: v}))} />
                  <EditField label="Grammage" value={editFields.grammage} onChange={v => setEditFields(p => ({...p, grammage: v}))} type="number" />
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <h4 className="text-[11px] text-gray-500 mb-2">Conditionnement</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <EditField label="Ex/paquet" value={editFields.ex_par_paquet} onChange={v => setEditFields(p => ({...p, ex_par_paquet: v}))} type="number" />
                    <EditField label="Ex/carton" value={editFields.ex_par_carton} onChange={v => setEditFields(p => ({...p, ex_par_carton: v}))} type="number" />
                    <EditField label="Crt/palette" value={editFields.cartons_par_palette} onChange={v => setEditFields(p => ({...p, cartons_par_palette: v}))} type="number" />
                    <EditField label="Seuil PDV" value={editFields.seuil_pdv} onChange={v => setEditFields(p => ({...p, seuil_pdv: v}))} type="number" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Étape 2.4.C : Bloc Logistique (dates enlèvement Frétin + livraison client) ── */}
        <div className="border border-gray-200 rounded-xl p-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm flex items-center gap-1.5">
              <Calendar size={14} className="text-gray-500" />
              Logistique
            </h3>
            {!editingLogistics
              ? <button
                  onClick={() => { if (op) initLogisticsFields(op); setEditingLogistics(true) }}
                  className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700">
                  <Pencil size={10} /> Modifier
                </button>
              : <div className="flex gap-2">
                  <button onClick={() => setEditingLogistics(false)} className="text-[10px] text-gray-400">Annuler</button>
                  <button onClick={handleSaveLogistics} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">Enregistrer</button>
                </div>
            }
          </div>
          {!editingLogistics ? (
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-500">Enlèvement Frétin</span>
                <span className="font-medium">{formatDateFr((op as any).date_enlevement_fretin)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-gray-500">Livraison client</span>
                <span className="font-medium">{formatDateFr((op as any).date_livraison_client)}</span>
              </div>
              {(op as any).dates_livraison_par_centrale && Object.keys((op as any).dates_livraison_par_centrale).length > 0 && (
                <div className="col-span-2 mt-2 pt-2 border-t border-gray-100">
                  <div className="text-[10px] text-gray-500 mb-1">Overrides par centrale (édition SQL uniquement en V1)</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {Object.entries((op as any).dates_livraison_par_centrale).map(([centrale, date]) => (
                      <div key={centrale} className="flex justify-between text-[11px]">
                        <span className="text-gray-500">{centrale}</span>
                        <span className="font-medium">{formatDateFr(date as string)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Enlèvement Frétin</label>
                <input
                  type="date"
                  value={logisticsFields.date_enlevement_fretin}
                  onChange={e => setLogisticsFields(p => ({ ...p, date_enlevement_fretin: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Livraison client</label>
                <input
                  type="date"
                  value={logisticsFields.date_livraison_client}
                  onChange={e => setLogisticsFields(p => ({ ...p, date_livraison_client: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
              </div>
              <p className="col-span-2 text-[10px] text-gray-400 italic">
                Format affichage : jj/mm/aaaa. Les overrides par centrale (livraisons décalées) sont gérables en V1.5 — saisie SQL directe dans <code className="bg-gray-100 px-1 rounded">dates_livraison_par_centrale</code> en attendant.
              </p>
            </div>
          )}
        </div>



        {op.notes && (
          <div className="mt-4 border border-gray-200 rounded-xl p-4">
            <h3 className="font-medium text-sm mb-2">Notes</h3>
            <p className="text-xs text-gray-600 whitespace-pre-wrap">{op.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
