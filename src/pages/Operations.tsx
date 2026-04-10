import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, ChevronDown, ChevronUp, ChevronRight, ArrowUpDown } from 'lucide-react'
import type { Operation } from '../types/database'

const STATUT_STYLES: Record<string, string> = {
  termine:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  import:       'bg-amber-50 text-amber-700 border-amber-200',
  analyse:      'bg-blue-50 text-blue-700 border-blue-200',
  palettisation:'bg-brand-50 text-brand-700 border-brand-200',
  livrables:    'bg-purple-50 text-purple-700 border-purple-200',
  planifie:     'bg-stone-100 text-stone-500 border-stone-200',
  annule:       'bg-red-50 text-red-600 border-red-200',
}
const STATUT_LABELS: Record<string, string> = {
  planifie: 'Planifié', import: 'Import', analyse: 'Analyse',
  palettisation: 'Palettisation', livrables: 'Livrables',
  termine: 'Terminé', annule: 'Annulé',
}
const SOUS_CAT_STYLES: Record<string, string> = {
  bal:        'bg-teal-50 text-teal-700',
  adc:        'bg-orange-50 text-orange-700',
  flat:       'bg-purple-50 text-purple-700',
  volume:     'bg-pink-50 text-pink-700',
  mixte:      'bg-blue-50 text-blue-700',
  trade_mktg: 'bg-amber-50 text-amber-700',
}
const SOUS_CAT_LABELS: Record<string, string> = {
  bal: 'BAL', adc: 'Arrière caisse', flat: 'Flat print',
  volume: 'Volume', mixte: 'Mixte', trade_mktg: 'Trade mktg',
}

type SortKey = 'code_operation' | 'statut' | 'total_exemplaires' | 'nb_palettes' | 'created_at'
type SortDir = 'asc' | 'desc'

function ColHeader({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <button onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide select-none transition-colors ${
        active ? 'text-brand-600' : 'text-stone-400 hover:text-stone-600'
      }`}>
      {label}
      {active
        ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
        : <ArrowUpDown size={10} className="opacity-40" />
      }
    </button>
  )
}

export default function Operations() {
  const navigate  = useNavigate()
  const [operations, setOperations] = useState<Operation[]>([])
  const [loading, setLoading]       = useState(true)
  const [expandedCat, setExpandedCat] = useState<string[]>(['prospectus', 'plv'])
  const [filterCat, setFilterCat]   = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState<string | null>(null)
  const [sortKey, setSortKey]       = useState<SortKey>('created_at')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')

  useEffect(() => {
    supabase.from('ops_operations')
      .select('*, enseigne:ref_enseignes(nom, code_court)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setOperations(data ?? []); setLoading(false) })
  }, [])

  const toggleCat = (cat: string) =>
    setExpandedCat(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...operations].sort((a, b) => {
    const av = (a as any)[sortKey] ?? ''
    const bv = (b as any)[sortKey] ?? ''
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const filtered = sorted.filter(o =>
    (!filterCat    || o.categorie === filterCat) &&
    (!filterStatut || o.statut    === filterStatut)
  )

  const grouped = {
    prospectus: filtered.filter(o => o.categorie === 'prospectus'),
    plv:        filtered.filter(o => o.categorie === 'plv'),
  }

  const allStatuts = [...new Set(operations.map(o => o.statut))]

  // Column widths
  const COL = {
    statut: 'w-28 flex-shrink-0',
    code:   'w-28 flex-shrink-0',
    nom:    'flex-1 min-w-0',
    souscat:'w-32 flex-shrink-0',
    ex:     'w-28 flex-shrink-0 text-right',
    pal:    'w-20 flex-shrink-0 text-right',
    dates:  'w-36 flex-shrink-0 text-right',
  }

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-stone-900">Opérations</h1>
          <p className="text-xs text-stone-400 mt-0.5">{operations.length} opération{operations.length > 1 ? 's' : ''} — prospectus et PLV</p>
        </div>
        <button onClick={() => navigate('/operations/new')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-xl hover:opacity-85 transition-all">
          <Plus size={14} /> Nouvelle opération
        </button>
      </div>

      <div className="px-6 py-4">

        {/* Filtres */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex gap-1.5">
            {[null, 'prospectus', 'plv'].map(cat => (
              <button key={cat ?? 'all'} onClick={() => setFilterCat(cat)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${
                  filterCat === cat
                    ? 'bg-stone-900 text-white'
                    : 'border border-stone-200 text-stone-500 hover:border-stone-300 bg-white'
                }`}>
                {cat === null ? 'Toutes' : cat === 'prospectus' ? 'Prospectus' : 'PLV'}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-stone-200" />
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterStatut(null)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                !filterStatut ? 'bg-stone-100 text-stone-700 font-medium' : 'text-stone-400 hover:text-stone-600'
              }`}>
              Tous statuts
            </button>
            {allStatuts.map(s => (
              <button key={s} onClick={() => setFilterStatut(s === filterStatut ? null : s)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                  filterStatut === s
                    ? `${STATUT_STYLES[s]} font-medium`
                    : 'border-stone-200 text-stone-400 hover:border-stone-300'
                }`}>
                {STATUT_LABELS[s] ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* Tableau */}
        {loading ? (
          <div className="text-sm text-stone-400 text-center py-12">Chargement...</div>
        ) : (
          Object.entries(grouped).map(([cat, ops]) => {
            if (ops.length === 0) return null
            const isOpen = expandedCat.includes(cat)
            return (
              <div key={cat} className="bg-white border border-stone-200 rounded-xl overflow-hidden mb-3">

                {/* Groupe header */}
                <button onClick={() => toggleCat(cat)}
                  className="w-full flex items-center gap-2.5 px-5 py-3 text-left hover:bg-stone-50 transition-colors border-b border-stone-100">
                  {isOpen ? <ChevronDown size={13} className="text-stone-400" /> : <ChevronRight size={13} className="text-stone-400" />}
                  <span className="font-semibold text-sm capitalize text-stone-800">{cat}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    cat === 'prospectus' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700'
                  }`}>{ops.length} opération{ops.length > 1 ? 's' : ''}</span>
                </button>

                {isOpen && (
                  <>
                    {/* En-têtes colonnes */}
                    <div className="flex items-center gap-3 px-5 py-2 bg-stone-50 border-b border-stone-100">
                      <div className={COL.statut}>
                        <ColHeader label="Statut" sortKey="statut" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </div>
                      <div className={COL.code}>
                        <ColHeader label="Code" sortKey="code_operation" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </div>
                      <div className={COL.nom}>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Nom</span>
                      </div>
                      <div className={COL.souscat}>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Type</span>
                      </div>
                      <div className={COL.ex}>
                        <ColHeader label="Exemplaires" sortKey="total_exemplaires" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </div>
                      <div className={COL.pal}>
                        <ColHeader label="Palettes" sortKey="nb_palettes" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </div>
                      <div className={COL.dates}>
                        <ColHeader label="Créée le" sortKey="created_at" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </div>
                    </div>

                    {/* Lignes */}
                    {ops.map(op => {
                      const enseigne = op.enseigne as any
                      return (
                        <div key={op.id} onClick={() => navigate(`/operations/${op.id}`)}
                          className="flex items-center gap-3 px-5 py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer transition-colors">

                          <div className={COL.statut}>
                            <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full font-medium border ${STATUT_STYLES[op.statut] ?? ''}`}>
                              {STATUT_LABELS[op.statut] ?? op.statut}
                            </span>
                          </div>

                          <div className={COL.code}>
                            <span className="font-mono text-xs text-stone-500">{op.code_operation}</span>
                          </div>

                          <div className={`${COL.nom} truncate`}>
                            <span className="text-sm text-stone-800">{op.nom_operation ?? op.code_operation}</span>
                            {enseigne?.nom && (
                              <span className="ml-2 text-xs text-stone-400">{enseigne.nom}</span>
                            )}
                          </div>

                          <div className={COL.souscat}>
                            {op.sous_categorie ? (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SOUS_CAT_STYLES[op.sous_categorie] ?? 'bg-stone-100 text-stone-500'}`}>
                                {SOUS_CAT_LABELS[op.sous_categorie] ?? op.sous_categorie}
                              </span>
                            ) : <span className="text-stone-300">—</span>}
                          </div>

                          <div className={`${COL.ex} text-xs text-stone-600 font-mono`}>
                            {op.total_exemplaires ? op.total_exemplaires.toLocaleString('fr-FR') : <span className="text-stone-300">—</span>}
                          </div>

                          <div className={`${COL.pal} text-xs text-stone-600 font-mono`}>
                            {op.nb_palettes
                              ? <span>{op.nb_palettes} <span className="text-stone-400 font-sans text-[10px]">pal</span></span>
                              : <span className="text-stone-300">—</span>}
                          </div>

                          <div className={`${COL.dates} text-[11px] text-stone-400`}>
                            {op.created_at
                              ? new Date(op.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
                              : '—'}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
