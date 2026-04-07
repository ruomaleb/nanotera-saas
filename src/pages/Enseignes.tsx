import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEditor } from '../components/Layout'
import { Plus, ChevronRight } from 'lucide-react'
import type { Enseigne, Centrale } from '../types/database'

function EnseigneEditor({ enseigne, onSaved }: { enseigne?: Enseigne; onSaved: () => void }) {
  const [nom, setNom] = useState(enseigne?.nom ?? '')
  const [codeCourt, setCodeCourt] = useState(enseigne?.code_court ?? '')
  const [format, setFormat] = useState(enseigne?.format_fichier ?? '.xls multi-onglets')
  const [centrales, setCentrales] = useState<Centrale[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (enseigne?.id) {
      supabase
        .from('ref_centrales')
        .select('*, transporteur:ref_transporteurs(nom)')
        .eq('enseigne_id', enseigne.id)
        .order('nom')
        .then(({ data }) => setCentrales(data ?? []))
    }
  }, [enseigne?.id])

  const handleSave = async () => {
    setSaving(true)
    if (enseigne?.id) {
      await supabase.from('ref_enseignes').update({ nom, code_court: codeCourt, format_fichier: format }).eq('id', enseigne.id)
    } else {
      await supabase.from('ref_enseignes').insert({ nom, code_court: codeCourt, format_fichier: format, org_id: enseigne?.org_id })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Nom de l'enseigne</label>
        <input value={nom} onChange={e => setNom(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Code court</label>
        <input value={codeCourt} onChange={e => setCodeCourt(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Format fichier</label>
        <select value={format} onChange={e => setFormat(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300">
          <option>.xls multi-onglets</option>
          <option>.xlsx mono-onglet</option>
          <option>.csv</option>
        </select>
      </div>

      {enseigne?.conditionnement_defaut && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Conditionnement par defaut</label>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400">Ex/paquet</div>
              <div className="text-sm font-medium">{enseigne.conditionnement_defaut.ex_paquet}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400">Ex/carton</div>
              <div className="text-sm font-medium">{enseigne.conditionnement_defaut.ex_carton}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400">Crt/palette</div>
              <div className="text-sm font-medium">{enseigne.conditionnement_defaut.cartons_palette}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-400">Seuil PDV</div>
              <div className="text-sm font-medium">{enseigne.conditionnement_defaut.seuil_pdv?.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {centrales.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Centrales ({centrales.length})</label>
          <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
            {centrales.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <span className="font-medium">{c.nom}</span>
                <span className="text-gray-400">{c.code_postal} {c.ville}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2 bg-indigo-50 text-indigo-700 text-sm rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

export default function Enseignes() {
  const [enseignes, setEnseignes] = useState<Enseigne[]>([])
  const [loading, setLoading] = useState(true)
  const [opCounts, setOpCounts] = useState<Record<string, number>>({})
  const { openEditor, closeEditor } = useEditor()

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ref_enseignes')
      .select('*')
      .eq('actif', true)
      .order('nom')
    setEnseignes(data ?? [])

    // Compter les operations par enseigne
    const { data: ops } = await supabase
      .from('ops_operations')
      .select('enseigne_id')
    const counts: Record<string, number> = {}
    ops?.forEach(op => { counts[op.enseigne_id] = (counts[op.enseigne_id] ?? 0) + 1 })
    setOpCounts(counts)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleEdit = (enseigne: Enseigne) => {
    openEditor('Detail enseigne', (
      <EnseigneEditor enseigne={enseigne} onSaved={() => { loadData(); closeEditor() }} />
    ))
  }

  const COLORS = ['bg-blue-50 text-blue-700', 'bg-emerald-50 text-emerald-700', 'bg-amber-50 text-amber-700', 'bg-purple-50 text-purple-700']

  return (
    <div>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Enseignes</h1>
          <p className="text-xs text-gray-400 mt-0.5">{enseignes.length} enseigne{enseignes.length > 1 ? 's' : ''} configuree{enseignes.length > 1 ? 's' : ''}</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <Plus size={14} /> Nouvelle enseigne
        </button>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-12">Chargement des enseignes...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {enseignes.map((ens, i) => (
              <button
                key={ens.id}
                onClick={() => handleEdit(ens)}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-gray-300 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold ${COLORS[i % COLORS.length]}`}>
                    {ens.code_court ?? ens.nom.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-[13px] text-gray-900">{ens.nom}</div>
                    <div className="text-[11px] text-gray-400">
                      {ens.format_fichier ?? 'Format non defini'}
                    </div>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {ens.actif && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Actif</span>
                  )}
                  {opCounts[ens.id] && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                      {opCounts[ens.id]} operation{opCounts[ens.id] > 1 ? 's' : ''}
                    </span>
                  )}
                  {ens.poids_reel_moyen && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                      {ens.poids_reel_moyen} kg/ex
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
