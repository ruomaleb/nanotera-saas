/**
 * AdminTypesPalette.tsx
 * Gestion des types de palettes : dimensions, poids, préparation.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AdminLayout from '../components/AdminLayout'
import {
  Plus, Pencil, Trash2, Save, X, Loader2, Check,
  AlertTriangle, ToggleLeft, ToggleRight,
} from 'lucide-react'

interface TypePalette {
  id: string
  nom: string
  code: string | null
  description: string | null
  longueur_cm: number
  largeur_cm: number
  hauteur_max_cm: number
  poids_max_kg: number
  poids_palette_kg: number
  cartons_max: number
  type_plateau: string
  emballage: string
  protection_dessus: string
  gerbable: boolean
  nb_couches_max: number | null
  actif: boolean
}

const EMPTY: Omit<TypePalette, 'id' | 'actif'> = {
  nom: '', code: '', description: '',
  longueur_cm: 120, largeur_cm: 80, hauteur_max_cm: 150,
  poids_max_kg: 750, poids_palette_kg: 25, cartons_max: 48,
  type_plateau: 'EPAL', emballage: 'film',
  protection_dessus: 'carton', gerbable: false, nb_couches_max: null,
}

const FIELD = (label: string, hint?: string, children?: React.ReactNode) => ({ label, hint, children })

export default function AdminTypesPalette() {
  const [types, setTypes]   = useState<TypePalette[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm]     = useState<typeof EMPTY>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    supabase.from('ref_types_palette').select('*').order('nom')
      .then(({ data }) => { setTypes(data ?? []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const startEdit = (t: TypePalette) => {
    setEditing(t.id); setCreating(false)
    const { id, actif, ...rest } = t
    setForm(rest)
  }
  const cancelEdit = () => { setEditing(null); setCreating(false); setForm(EMPTY); setError('') }

  const save = async () => {
    if (!form.nom.trim()) { setError('Nom requis'); return }
    setSaving(true); setError('')
    try {
      if (creating) {
        await supabase.from('ref_types_palette').insert({ ...form, actif: true })
      } else if (editing) {
        await supabase.from('ref_types_palette').update(form).eq('id', editing)
      }
      cancelEdit(); load()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const toggleActif = async (t: TypePalette) => {
    await supabase.from('ref_types_palette').update({ actif: !t.actif }).eq('id', t.id)
    load()
  }
  const del = async (id: string) => {
    await supabase.from('ref_types_palette').delete().eq('id', id)
    setConfirmDel(null); load()
  }

  const f = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked
      : e.target.type === 'number' ? (parseFloat(e.target.value) || 0)
      : e.target.value
    setForm(prev => ({ ...prev, [k]: val }))
  }

  const inputCls = "w-full h-9 border border-stone-200 rounded-lg px-3 text-sm outline-none focus:border-brand-400 font-[inherit]"
  const selectCls = `${inputCls} bg-white appearance-none cursor-pointer`

  const formIsEdit = editing !== null || creating

  return (
    <AdminLayout title="Types de palettes" subtitle="Dimensions, poids max, préparation et contraintes de manutention">

      {!formIsEdit && (
        <div className="flex justify-end mb-4">
          <button onClick={() => { setCreating(true); setEditing(null) }}
            className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-stone-900 text-white rounded-xl hover:opacity-85 transition-all">
            <Plus size={14} /> Nouveau type
          </button>
        </div>
      )}

      {/* Formulaire */}
      {formIsEdit && (
        <div className="bg-white border-2 border-brand-300 rounded-xl p-5 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-brand-700">
              {creating ? 'Nouveau type de palette' : 'Modifier le type'}
            </span>
            <button onClick={cancelEdit} className="text-stone-400 hover:text-stone-600"><X size={14} /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Nom *</label>
              <input value={form.nom} onChange={f('nom')} placeholder="EPAL Frétin standard" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">Code court</label>
              <input value={form.code ?? ''} onChange={f('code')} placeholder="EPAL-FRETIN" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500 mb-1 block">Description</label>
            <textarea value={form.description ?? ''} onChange={f('description')} rows={2}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-brand-400 font-[inherit]" />
          </div>

          {/* Dimensions */}
          <div>
            <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Dimensions physiques</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: 'longueur_cm',     label: 'Longueur (cm)' },
                { k: 'largeur_cm',      label: 'Largeur (cm)' },
                { k: 'hauteur_max_cm',  label: 'Hauteur max (cm)' },
                { k: 'poids_max_kg',    label: 'Poids max chgt (kg)' },
                { k: 'poids_palette_kg',label: 'Tare palette (kg)' },
                { k: 'cartons_max',     label: 'Cartons max' },
              ].map(({ k, label }) => (
                <div key={k}>
                  <label className="text-xs text-stone-500 mb-1 block">{label}</label>
                  <input type="number" value={(form as any)[k]} onChange={f(k as keyof typeof EMPTY)} className={inputCls} />
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-stone-400">
              Poids utile max = {(form.poids_max_kg - form.poids_palette_kg).toFixed(0)} kg
            </div>
          </div>

          {/* Préparation */}
          <div>
            <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Préparation & manutention</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Type plateau</label>
                <select value={form.type_plateau} onChange={f('type_plateau')} className={selectCls}>
                  {['EPAL', 'demi-palette', 'americaine', 'sur-mesure', 'autre'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Emballage</label>
                <select value={form.emballage} onChange={f('emballage')} className={selectCls}>
                  {['film', 'cerclage', 'film+cerclage', 'aucun'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Protection dessus</label>
                <select value={form.protection_dessus} onChange={f('protection_dessus')} className={selectCls}>
                  {['carton', 'film', 'aucune'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block flex items-center gap-2">
                  Gerbable
                  <input type="checkbox" checked={form.gerbable} onChange={f('gerbable')} className="w-4 h-4 accent-brand-500" />
                </label>
                {form.gerbable && (
                  <input type="number" value={form.nb_couches_max ?? ''} onChange={f('nb_couches_max')}
                    placeholder="Nb couches max" className={inputCls} />
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-stone-900 text-white rounded-lg hover:opacity-85 disabled:opacity-40 transition-all">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Enregistrer
            </button>
            <button onClick={cancelEdit}
              className="h-9 px-3 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-stone-400 py-4"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
      ) : types.length === 0 ? (
        <div className="text-center py-10 text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl">
          Aucun type de palette défini.
        </div>
      ) : (
        <div className="space-y-3">
          {types.map(t => (
            <div key={t.id} className={`bg-white border border-stone-200 rounded-xl overflow-hidden ${!t.actif ? 'opacity-55' : ''}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => toggleActif(t)} className="flex-shrink-0">
                  {t.actif
                    ? <ToggleRight size={20} className="text-brand-500" />
                    : <ToggleLeft size={20} className="text-stone-300" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-stone-800">{t.nom}</span>
                    {t.code && <span className="text-xs font-mono px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded">{t.code}</span>}
                    <span className="text-xs text-stone-400">{t.longueur_cm}×{t.largeur_cm} cm</span>
                    <span className="text-xs text-stone-400">·</span>
                    <span className="text-xs text-stone-400">{t.cartons_max} crt max</span>
                    <span className="text-xs text-stone-400">·</span>
                    <span className="text-xs text-stone-400">{t.poids_max_kg} kg max</span>
                    <span className="text-xs text-stone-400">·</span>
                    <span className="text-xs text-stone-400">{t.hauteur_max_cm} cm max</span>
                    {t.gerbable && <span className="text-xs px-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full">gerbable ×{t.nb_couches_max}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-400">
                    <span>{t.type_plateau}</span>
                    <span>· {t.emballage}</span>
                    <span>· protection {t.protection_dessus}</span>
                    {t.description && <span>· {t.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => startEdit(t)} className="p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setConfirmDel(t.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {confirmDel === t.id && (
                <div className="px-4 pb-3 flex items-center gap-2 text-xs">
                  <span className="text-red-600">Supprimer définitivement ?</span>
                  <button onClick={() => del(t.id)} className="text-red-600 border border-red-200 bg-red-50 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors font-medium">Supprimer</button>
                  <button onClick={() => setConfirmDel(null)} className="text-stone-500 hover:text-stone-700">Annuler</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
