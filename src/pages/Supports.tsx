import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEditor } from '../components/Layout'
import { Plus, ChevronRight, ChevronDown } from 'lucide-react'

type Tab = 'supports' | 'conditionnements'

export default function Supports() {
  const [tab, setTab] = useState<Tab>('supports')
  const [categories, setCategories] = useState<any[]>([])
  const [packagings, setPackagings] = useState<any[]>([])
  const [palettes, setPalettes] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('ref_support_categories').select('*, sous_categories:ref_support_sous_categories(*, support_types:ref_support_types(*))').order('ordre_affichage'),
      supabase.from('ref_packaging_types').select('*').order('niveau'),
      supabase.from('ref_palette_types').select('*').order('nom'),
    ]).then(([cats, pkgs, pals]) => {
      setCategories(cats.data ?? [])
      setPackagings(pkgs.data ?? [])
      setPalettes(pals.data ?? [])
      if (cats.data?.[0]) setExpanded([cats.data[0].id])
      setLoading(false)
    })
  }, [])

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Supports & conditionnements</h1>
          <p className="text-xs text-gray-400 mt-0.5">Base de donnees referentielle</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <Plus size={14} /> Ajouter
        </button>
      </div>

      <div className="border-b border-gray-200 px-5 flex gap-0">
        {(['supports', 'conditionnements'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs transition-colors border-b-2 ${
              tab === t ? 'text-gray-900 font-medium border-indigo-500' : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            {t === 'supports' ? 'Types de supports' : 'Conditionnements'}
          </button>
        ))}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-12">Chargement...</div>
        ) : tab === 'supports' ? (
          <div className="space-y-3">
            {categories.map(cat => {
              const isOpen = expanded.includes(cat.id)
              const allTypes = cat.sous_categories?.flatMap((sc: any) => sc.support_types ?? []) ?? []
              return (
                <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => toggleExpand(cat.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="font-medium text-[13px]">{cat.nom}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium ml-1">
                      {allTypes.length} type{allTypes.length > 1 ? 's' : ''}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-200">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500">
                            <th className="text-left px-4 py-2 font-medium">Nom</th>
                            <th className="text-left px-4 py-2 font-medium">Sous-categorie</th>
                            <th className="text-left px-4 py-2 font-medium">Pagination</th>
                            <th className="text-left px-4 py-2 font-medium">Grammage</th>
                            <th className="text-left px-4 py-2 font-medium">Materiau</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.sous_categories?.flatMap((sc: any) =>
                            (sc.support_types ?? []).map((st: any) => (
                              <tr key={st.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                                <td className="px-4 py-2 font-medium text-gray-900">{st.nom}</td>
                                <td className="px-4 py-2">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">{sc.nom}</span>
                                </td>
                                <td className="px-4 py-2 text-gray-500">
                                  {st.pagination_min && st.pagination_max ? `${st.pagination_min} — ${st.pagination_max} p` : '—'}
                                </td>
                                <td className="px-4 py-2 text-gray-500">
                                  {st.grammage_min && st.grammage_max ? `${st.grammage_min} — ${st.grammage_max} g/m2` : '—'}
                                </td>
                                <td className="px-4 py-2 text-gray-500">{st.materiau ?? '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-sm mb-2">Niveaux d'emballage</h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-4 py-2 font-medium">Niveau</th>
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-left px-4 py-2 font-medium">Contenance</th>
                    <th className="text-left px-4 py-2 font-medium">Poids max</th>
                  </tr></thead>
                  <tbody>
                    {packagings.map(p => (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-2 font-medium">N{p.niveau} — {p.nom}</td>
                        <td className="px-4 py-2 text-gray-500">{p.dimensions_cm ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{p.contenance_min}–{p.contenance_max}</td>
                        <td className="px-4 py-2 text-gray-500">{p.poids_max_kg ? p.poids_max_kg + ' kg' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-sm mb-2">Types de palettes</h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 text-gray-500">
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-left px-4 py-2 font-medium">Dimensions</th>
                    <th className="text-left px-4 py-2 font-medium">Charge max</th>
                    <th className="text-left px-4 py-2 font-medium">Cartons max</th>
                  </tr></thead>
                  <tbody>
                    {palettes.map(p => (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-2 font-medium">{p.nom}</td>
                        <td className="px-4 py-2 text-gray-500">{p.largeur_cm} x {p.longueur_cm} cm</td>
                        <td className="px-4 py-2 text-gray-500">{p.charge_max_kg} kg</td>
                        <td className="px-4 py-2 text-gray-500">{p.cartons_max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
