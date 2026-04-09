/**
 * RegleEditor.tsx — v2
 * + Dupliquer vers (copie vers autre niveau/entité)
 * + Déplacer vers (transfert vers autre niveau/entité)
 */

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import {
  Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, AlertTriangle, Loader2, GripVertical,
  Copy, MoveRight,
} from 'lucide-react'

export interface Regle {
  id: string
  niveau: string
  ref_id: string | null
  ref_label: string | null
  categorie: string
  titre: string
  description: string | null
  contenu: string
  actif: boolean
  priorite: number
  updated_at: string
}

export const CATEGORIES: Record<string, { label: string; color: string; desc: string }> = {
  contraintes_palettisation: {
    label: 'Contrainte palettisation',
    color: 'bg-red-100 text-red-700 border-red-200',
    desc: 'Injectée dans tous les prompts IA palettes comme règle absolue',
  },
  prompt_analyse: {
    label: 'Prompt — Analyse',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    desc: 'Fragment ajouté au prompt d\'analyse post-import',
  },
  prompt_palettes: {
    label: 'Prompt — Palettes',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    desc: 'Fragment ajouté au prompt d\'optimisation des palettes',
  },
  prompt_params: {
    label: 'Prompt — Paramètres',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    desc: 'Fragment ajouté au prompt de recommandation des paramètres',
  },
  conditionnement_defaut: {
    label: 'Conditionnement par défaut',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    desc: 'Valeurs par défaut (JSON : ex_par_carton, cartons_par_palette…)',
  },
  regles_binpacking: {
    label: 'Règle bin-packing',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    desc: 'Contrainte injectée dans l\'algorithme de composition des palettes',
  },
  notes_operateur: {
    label: 'Note opérateur',
    color: 'bg-stone-100 text-stone-600 border-stone-200',
    desc: 'Information affichée dans l\'interface pour les opérateurs',
  },
}

interface RegleEditorProps {
  niveau: 'global' | 'enseigne' | 'imprimeur'
  refId?: string
  refLabel?: string
  filterCategorie?: string
}

interface Entity { id: string; nom: string }

interface TransferModalProps {
  regle: Regle
  mode: 'duplicate' | 'move'
  onClose: () => void
  onDone: () => void
}

const EMPTY_FORM = {
  categorie: 'contraintes_palettisation',
  titre: '', description: '', contenu: '', actif: true, priorite: 10,
}

// ── Modal Dupliquer/Déplacer ─────────────────────────────────

function TransferModal({ regle, mode, onClose, onDone }: TransferModalProps) {
  const [niveau, setNiveau]         = useState<'global' | 'enseigne' | 'imprimeur'>('global')
  const [refId, setRefId]           = useState('')
  const [entities, setEntities]     = useState<Entity[]>([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    api('/api/admin/regles/summary').then((s: any) => {
      if (niveau === 'enseigne') setEntities(s.enseignes || [])
      if (niveau === 'imprimeur') setEntities(s.imprimeurs || [])
    })
  }, [niveau])

  const refLabel = entities.find(e => e.id === refId)?.nom || null

  const submit = async () => {
    if ((niveau === 'enseigne' || niveau === 'imprimeur') && !refId) {
      setError('Sélectionner une entité cible'); return
    }
    setLoading(true); setError('')
    try {
      const endpoint = mode === 'duplicate'
        ? `/api/admin/regles/${regle.id}/duplicate`
        : `/api/admin/regles/${regle.id}/move`
      await api(endpoint, {
        method: mode === 'duplicate' ? 'POST' : 'PUT',
        body: { niveau, ref_id: refId || null, ref_label: refLabel },
      })
      onDone()
      onClose()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const title = mode === 'duplicate' ? 'Dupliquer la règle vers…' : 'Déplacer la règle vers…'
  const actionLabel = mode === 'duplicate' ? 'Dupliquer' : 'Déplacer'
  const actionColor = mode === 'duplicate'
    ? 'bg-brand-500 text-white hover:opacity-85'
    : 'bg-stone-900 text-white hover:opacity-85'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div className="bg-white rounded-xl border border-stone-200 p-5 w-96 space-y-4"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-stone-800">{title}</div>
            <div className="text-xs text-stone-400 mt-0.5 truncate max-w-xs">« {regle.titre} »</div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X size={15} />
          </button>
        </div>

        {mode === 'duplicate' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            Une copie sera créée à destination. Elle sera <strong>inactive par défaut</strong> — vous pourrez l'adapter avant de l'activer.
          </div>
        )}

        {mode === 'move' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            La règle originale sera déplacée. Elle n'apparaîtra plus dans l'espace actuel.
          </div>
        )}

        {/* Niveau cible */}
        <div>
          <label className="text-xs text-stone-500 mb-1.5 block">Niveau cible</label>
          <div className="grid grid-cols-3 gap-2">
            {(['global', 'enseigne', 'imprimeur'] as const).map(n => (
              <button key={n} onClick={() => { setNiveau(n); setRefId('') }}
                className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                  niveau === n
                    ? 'bg-brand-50 border-brand-300 text-brand-700'
                    : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                }`}>
                {n === 'global' ? '🌐 Global' : n === 'enseigne' ? '🏪 Enseigne' : '🖨️ Imprimeur'}
              </button>
            ))}
          </div>
        </div>

        {/* Entité cible si enseigne ou imprimeur */}
        {(niveau === 'enseigne' || niveau === 'imprimeur') && (
          <div>
            <label className="text-xs text-stone-500 mb-1.5 block">
              {niveau === 'enseigne' ? 'Enseigne' : 'Imprimeur'} cible
            </label>
            <select value={refId} onChange={e => setRefId(e.target.value)}
              className="nnt-select w-full text-sm">
              <option value="">— Sélectionner —</option>
              {entities.map(e => (
                <option key={e.id} value={e.id}>{e.nom}</option>
              ))}
            </select>
            {entities.length === 0 && (
              <p className="text-xs text-stone-400 mt-1">
                Aucune entité trouvée dans le référentiel.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={loading}
            className={`flex items-center gap-1.5 h-8 px-4 text-sm font-medium rounded-lg transition-all disabled:opacity-40 ${actionColor}`}>
            {loading
              ? <Loader2 size={12} className="animate-spin" />
              : mode === 'duplicate' ? <Copy size={12} /> : <MoveRight size={12} />
            }
            {actionLabel}
          </button>
          <button onClick={onClose}
            className="h-8 px-3 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Composant principal ──────────────────────────────────────

export default function RegleEditor({ niveau, refId, refLabel, filterCategorie }: RegleEditorProps) {
  const [regles, setRegles]               = useState<Regle[]>([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')
  const [expanded, setExpanded]           = useState<Set<string>>(new Set())
  const [editing, setEditing]             = useState<string | null>(null)
  const [creating, setCreating]           = useState(false)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [transferModal, setTransferModal] = useState<{ regle: Regle; mode: 'duplicate' | 'move' } | null>(null)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams({ niveau })
    if (refId) params.set('ref_id', refId)
    if (filterCategorie) params.set('categorie', filterCategorie)
    api(`/api/admin/regles?${params}`)
      .then((data: Regle[]) => { setRegles(data); setLoading(false) })
      .catch(() => { setError('Erreur chargement'); setLoading(false) })
  }

  useEffect(() => { load() }, [niveau, refId, filterCategorie])

  const toggleExpand  = (id: string) => setExpanded(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next
  })

  const startEdit = (r: Regle) => {
    setEditing(r.id); setCreating(false)
    setForm({ categorie: r.categorie, titre: r.titre, description: r.description || '',
              contenu: r.contenu, actif: r.actif, priorite: r.priorite })
  }
  const cancelEdit = () => { setEditing(null); setCreating(false); setForm(EMPTY_FORM) }

  const save = async () => {
    if (!form.titre.trim() || !form.contenu.trim()) { setError('Titre et contenu requis'); return }
    setSaving(true); setError('')
    try {
      if (creating) {
        await api('/api/admin/regles', {
          method: 'POST',
          body: { niveau, ref_id: refId || null, ref_label: refLabel || null, ...form },
        })
      } else if (editing) {
        await api(`/api/admin/regles/${editing}`, { method: 'PUT', body: form })
      }
      cancelEdit(); load()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const toggleActif  = async (r: Regle) => {
    try { await api(`/api/admin/regles/${r.id}`, { method: 'PUT', body: { actif: !r.actif } }); load() } catch {}
  }
  const deleteRegle  = async (id: string) => {
    try { await api(`/api/admin/regles/${id}`, { method: 'DELETE' }); setConfirmDelete(null); load() } catch {}
  }

  const grouped = regles.reduce<Record<string, Regle[]>>((acc, r) => {
    (acc[r.categorie] ??= []).push(r); return acc
  }, {})
  const formIsEdit = editing !== null || creating

  return (
    <div className="space-y-4">

      {/* Modal transfert */}
      {transferModal && (
        <TransferModal
          regle={transferModal.regle}
          mode={transferModal.mode}
          onClose={() => setTransferModal(null)}
          onDone={load}
        />
      )}

      {/* Bouton créer */}
      {!formIsEdit && (
        <div className="flex justify-end">
          <button onClick={() => { setCreating(true); setEditing(null) }}
            className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium bg-stone-900 text-white rounded-lg hover:opacity-85 transition-all">
            <Plus size={13} /> Nouvelle règle
          </button>
        </div>
      )}

      {/* Formulaire */}
      {formIsEdit && (
        <div className="bg-white border-2 border-brand-300 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-brand-700">
              {creating ? 'Nouvelle règle' : 'Modifier la règle'}
            </span>
            <button onClick={cancelEdit} className="text-stone-400 hover:text-stone-600"><X size={14} /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Catégorie</label>
              <select value={form.categorie}
                onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                className="nnt-select w-full text-xs h-8">
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              {CATEGORIES[form.categorie] && (
                <p className="text-[10px] text-stone-400 mt-1">{CATEGORIES[form.categorie].desc}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Titre</label>
              <input value={form.titre}
                onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                placeholder="Nom court de la règle"
                className="nnt-input text-xs h-8" />
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500 mb-1 block">Description interne</label>
            <input value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Explication pour les admins (optionnel)"
              className="nnt-input text-xs h-8" />
          </div>

          <div>
            <label className="text-xs text-stone-500 mb-1 flex items-center justify-between">
              <span>Contenu <span className="text-red-500">*</span></span>
              <span className="text-stone-400">Injecté tel quel dans le prompt</span>
            </label>
            <textarea value={form.contenu}
              onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))}
              rows={4}
              placeholder="Ex: Ne jamais proposer de fusionner des palettes de centrales différentes..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-brand-400 placeholder:text-stone-300 font-[inherit]" />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-stone-500">Priorité</label>
              <input type="number" value={form.priorite} min={1} max={100}
                onChange={e => setForm(f => ({ ...f, priorite: parseInt(e.target.value) || 10 }))}
                className="nnt-input w-16 text-xs h-7 text-center" />
              <span className="text-[10px] text-stone-400">1–100</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer ml-auto">
              <span className="text-xs text-stone-500">Active</span>
              <input type="checkbox" checked={form.actif}
                onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))}
                className="w-4 h-4 rounded accent-brand-500" />
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={12} /> {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 h-8 px-4 text-sm font-medium bg-stone-900 text-white rounded-lg hover:opacity-85 disabled:opacity-40 transition-all">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Enregistrer
            </button>
            <button onClick={cancelEdit}
              className="h-8 px-3 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-stone-400 py-4">
          <Loader2 size={14} className="animate-spin" /> Chargement…
        </div>
      ) : regles.length === 0 ? (
        <div className="text-center py-10 text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl">
          Aucune règle définie pour ce niveau.
          <br />
          <button onClick={() => setCreating(true)} className="text-brand-500 hover:underline mt-1 block mx-auto">
            Créer la première règle →
          </button>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => {
          const cfg = CATEGORIES[cat] ?? { label: cat, color: 'bg-stone-100 text-stone-600 border-stone-200', desc: '' }
          return (
            <div key={cat} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-stone-100 bg-stone-50">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="text-xs text-stone-400">{items.length} règle{items.length > 1 ? 's' : ''}</span>
              </div>

              {items.map(r => {
                const isExpanded = expanded.has(r.id)
                return (
                  <div key={r.id} className={`border-b border-stone-100 last:border-0 transition-colors ${!r.actif ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 px-4 py-2.5">
                      <GripVertical size={12} className="text-stone-300 flex-shrink-0" />

                      <button onClick={() => toggleActif(r)} className="flex-shrink-0">
                        {r.actif
                          ? <ToggleRight size={18} className="text-brand-500" />
                          : <ToggleLeft size={18} className="text-stone-300" />
                        }
                      </button>

                      <button onClick={() => toggleExpand(r.id)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0">
                        <span className="text-sm font-medium text-stone-800 truncate">{r.titre}</span>
                        <span className="text-[10px] text-stone-400 flex-shrink-0">p={r.priorite}</span>
                        {isExpanded
                          ? <ChevronDown size={12} className="text-stone-400 flex-shrink-0" />
                          : <ChevronRight size={12} className="text-stone-400 flex-shrink-0" />
                        }
                      </button>

                      {/* Actions — avec Dupliquer et Déplacer */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => setTransferModal({ regle: r, mode: 'duplicate' })}
                          title="Dupliquer vers…"
                          className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => setTransferModal({ regle: r, mode: 'move' })}
                          title="Déplacer vers…"
                          className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <MoveRight size={13} />
                        </button>
                        <button onClick={() => startEdit(r)}
                          title="Modifier"
                          className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setConfirmDelete(r.id)}
                          title="Supprimer"
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-10 pb-3 space-y-2">
                        {r.description && (
                          <p className="text-xs text-stone-400 italic">{r.description}</p>
                        )}
                        <pre className="text-xs text-stone-700 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2 whitespace-pre-wrap font-[inherit] leading-relaxed">
                          {r.contenu}
                        </pre>
                        <p className="text-[10px] text-stone-400">
                          Modifié le {new Date(r.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )}

                    {confirmDelete === r.id && (
                      <div className="px-4 pb-3 flex items-center gap-2">
                        <span className="text-xs text-red-600">Supprimer définitivement ?</span>
                        <button onClick={() => deleteRegle(r.id)}
                          className="text-xs font-medium text-red-600 border border-red-200 bg-red-50 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors">
                          Supprimer
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs text-stone-500 hover:text-stone-700">
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
