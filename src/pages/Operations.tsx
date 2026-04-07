import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEditor } from '../components/Layout'
import { Plus, ChevronRight, ChevronDown } from 'lucide-react'
import type { Operation } from '../types/database'

const STATUT_STYLES: Record<string, string> = {
  termine: 'bg-emerald-50 text-emerald-700',
  import: 'bg-amber-50 text-amber-700',
  analyse: 'bg-blue-50 text-blue-700',
  palettisation: 'bg-blue-50 text-blue-700',
  livrables: 'bg-blue-50 text-blue-700',
  planifie: 'bg-gray-100 text-gray-500',
  annule: 'bg-red-50 text-red-600',
}

const SOUS_CAT_STYLES: Record<string, string> = {
  bal: 'bg-teal-50 text-teal-700',
  adc: 'bg-orange-50 text-orange-700',
  flat: 'bg-purple-50 text-purple-700',
  volume: 'bg-pink-50 text-pink-700',
  mixte: 'bg-blue-50 text-blue-700',
  trade_mktg: 'bg-amber-50 text-amber-700',
}

const SOUS_CAT_LABELS: Record<string, string> = {
  bal: 'Distribution BAL',
  adc: 'Arriere de caisse',
  flat: 'Flat print',
  volume: 'Volume',
  mixte: 'Mixte',
  trade_mktg: 'Trade marketing',
}

export default function Operations() {
  const navigate = useNavigate()
  const [operations, setOperations] = useState<Operation[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCat, setExpandedCat] = useState<string[]>(['prospectus'])
  const [filterCat, setFilterCat] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('ops_operations')
      .select('*, enseigne:ref_enseignes(nom, code_court)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOperations(data ?? [])
        setLoading(false)
      })
  }, [])

  const toggleCat = (cat: string) => {
    setExpandedCat(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const filtered = filterCat
    ? operations.filter(o => o.categorie === filterCat)
    : operations

  const grouped = {
    prospectus: filtered.filter(o => o.categorie === 'prospectus'),
    plv: filtered.filter(o => o.categorie === 'plv'),
  }

  return (
    <div>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Operations</h1>
          <p className="text-xs text-gray-400 mt-0.5">{operations.length} operations — prospectus et PLV</p>
        </div>
        <button onClick={() => navigate('/operations/new')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <Plus size={14} /> Nouvelle operation
        </button>
      </div>

      <div className="p-5">
        <div className="flex gap-2 mb-4">
          {[null, 'prospectus', 'plv'].map(cat => (
            <button
              key={cat ?? 'all'}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filterCat === cat
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {cat === null ? 'Tout' : cat === 'prospectus' ? 'Prospectus' : 'PLV'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 text-center py-12">Chargement...</div>
        ) : (
          Object.entries(grouped).map(([cat, ops]) => {
            if (ops.length === 0) return null
            const isOpen = expandedCat.includes(cat)
            return (
              <div key={cat} className="border border-gray-200 rounded-xl overflow-hidden mb-3">
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="font-medium text-[13px] capitalize">{cat}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ml-1 ${
                    cat === 'prospectus' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'
                  }`}>
                    {ops.length} operation{ops.length > 1 ? 's' : ''}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-200">
                    {ops.map(op => (
                      <div
                        key={op.id}
                        onClick={() => navigate(`/operations/${op.id}`)}
                        className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer text-xs"
                      >
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium min-w-[55px] text-center ${STATUT_STYLES[op.statut] ?? ''}`}>
                          {op.statut === 'termine' ? 'Termine' : op.statut === 'planifie' ? 'Planifie' : op.statut.charAt(0).toUpperCase() + op.statut.slice(1)}
                        </span>
                        <span className="font-mono text-[11px] text-gray-500 w-20">{op.code_operation}</span>
                        <span className="flex-1 text-gray-900">{op.nom_operation ?? op.code_operation}</span>
                        {op.sous_categorie && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SOUS_CAT_STYLES[op.sous_categorie] ?? 'bg-gray-100 text-gray-500'}`}>
                            {SOUS_CAT_LABELS[op.sous_categorie] ?? op.sous_categorie}
                          </span>
                        )}
                        <span className="text-gray-400 text-right w-20">
                          {op.total_exemplaires ? op.total_exemplaires.toLocaleString() + ' ex' : '—'}
                        </span>
                        <span className="text-gray-400 w-12 text-right">
                          {op.nb_palettes ? op.nb_palettes + ' pal' : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
