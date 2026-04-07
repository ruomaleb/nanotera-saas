import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import type { Enseigne, Imprimeur, SupportType } from '../types/database'

type Step = 1 | 2 | 3

interface FormData {
  // Step 1
  enseigne_id: string
  categorie: 'prospectus' | 'plv'
  sous_categorie: string
  // Step 2
  code_operation: string
  nom_operation: string
  date_debut: string
  date_fin: string
  imprimeur_id: string
  support_type_id: string
  // Step 3
  pagination: string
  format_document: string
  grammage: string
  ex_par_paquet: string
  ex_par_carton: string
  cartons_par_palette: string
  seuil_pdv: string
  notes: string
}

const SOUS_CAT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  prospectus: [
    { value: 'bal', label: 'Distribution BAL' },
    { value: 'adc', label: 'Arriere de caisse' },
  ],
  plv: [
    { value: 'flat', label: 'Flat print' },
    { value: 'volume', label: 'Volume' },
    { value: 'mixte', label: 'Mixte' },
    { value: 'trade_mktg', label: 'Trade marketing' },
  ],
}

const STEP_LABELS = ['Enseigne & type', 'Details operation', 'Specs & conditionnement']

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as Step
        const done = step < current
        const active = step === current
        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && <div className={`w-8 h-px ${done || active ? 'bg-indigo-300' : 'bg-gray-200'}`} />}
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium
                ${done ? 'bg-indigo-500 text-white' : active ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300' : 'bg-gray-100 text-gray-400'}`}>
                {done ? <Check size={12} /> : step}
              </div>
              <span className={`text-xs ${active ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FieldGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-gray-400 mt-1">{hint}</div>}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
const selectCls = `${inputCls} bg-white`

export default function NewOperation() {
  const navigate = useNavigate()
  const { org } = useOrg()
  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Reference data
  const [enseignes, setEnseignes] = useState<Enseigne[]>([])
  const [imprimeurs, setImprimeurs] = useState<Imprimeur[]>([])
  const [supportTypes, setSupportTypes] = useState<SupportType[]>([])
  const [linkedImprimeurs, setLinkedImprimeurs] = useState<string[]>([])

  const [form, setForm] = useState<FormData>({
    enseigne_id: '', categorie: 'prospectus', sous_categorie: 'bal',
    code_operation: '', nom_operation: '', date_debut: '', date_fin: '',
    imprimeur_id: '', support_type_id: '',
    pagination: '', format_document: '20x25', grammage: '60',
    ex_par_paquet: '', ex_par_carton: '', cartons_par_palette: '', seuil_pdv: '',
    notes: '',
  })

  const set = (field: keyof FormData, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  // Load reference data
  useEffect(() => {
    Promise.all([
      supabase.from('ref_enseignes').select('*').eq('actif', true).order('nom'),
      supabase.from('ref_imprimeurs').select('*').order('nom'),
      supabase.from('ref_support_types').select('*, sous_categorie:ref_support_sous_categories(nom, code, categorie:ref_support_categories(nom))').order('nom'),
    ]).then(([ens, imp, sup]) => {
      setEnseignes(ens.data ?? [])
      setImprimeurs(imp.data ?? [])
      setSupportTypes(sup.data ?? [])
    })
  }, [])

  // When enseigne changes: pre-fill conditionnement from defaults + load linked imprimeurs
  useEffect(() => {
    if (!form.enseigne_id) return
    const ens = enseignes.find(e => e.id === form.enseigne_id)
    if (ens?.conditionnement_defaut) {
      const cd = ens.conditionnement_defaut
      setForm(prev => ({
        ...prev,
        ex_par_paquet: String(cd.ex_paquet ?? ''),
        ex_par_carton: String(cd.ex_carton ?? ''),
        cartons_par_palette: String(cd.cartons_palette ?? ''),
        seuil_pdv: String(cd.seuil_pdv ?? ''),
      }))
    }
    // Load imprimeurs linked to this enseigne
    supabase
      .from('jct_enseigne_imprimeur')
      .select('imprimeur_id, est_defaut')
      .eq('enseigne_id', form.enseigne_id)
      .then(({ data }) => {
        const ids = data?.map(d => d.imprimeur_id) ?? []
        setLinkedImprimeurs(ids)
        const defaut = data?.find(d => d.est_defaut)
        if (defaut && !form.imprimeur_id) {
          set('imprimeur_id', defaut.imprimeur_id)
        }
      })
  }, [form.enseigne_id])

  const selectedEnseigne = enseignes.find(e => e.id === form.enseigne_id)
  const selectedImprimeur = imprimeurs.find(i => i.id === form.imprimeur_id)

  // Validation per step
  const canNext = (s: Step): boolean => {
    if (s === 1) return !!form.enseigne_id && !!form.categorie
    if (s === 2) return !!form.code_operation.trim()
    return true
  }

  const handleCreate = async () => {
    setSaving(true)
    setError('')

    const payload = {
      org_id: org?.org_id,
      enseigne_id: form.enseigne_id,
      categorie: form.categorie,
      sous_categorie: form.sous_categorie || null,
      code_operation: form.code_operation.trim(),
      nom_operation: form.nom_operation.trim() || null,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
      imprimeur_id: form.imprimeur_id || null,
      support_type_id: form.support_type_id || null,
      statut: 'planifie',
      pagination: form.pagination ? parseInt(form.pagination) : null,
      format_document: form.format_document || null,
      grammage: form.grammage ? parseFloat(form.grammage) : null,
      ex_par_paquet: form.ex_par_paquet ? parseInt(form.ex_par_paquet) : null,
      ex_par_carton: form.ex_par_carton ? parseInt(form.ex_par_carton) : null,
      cartons_par_palette: form.cartons_par_palette ? parseInt(form.cartons_par_palette) : null,
      seuil_pdv: form.seuil_pdv ? parseInt(form.seuil_pdv) : null,
      notes: form.notes.trim() || null,
    }

    const { data, error: err } = await supabase
      .from('ops_operations')
      .insert(payload)
      .select('id')
      .single()

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    navigate('/operations')
  }

  return (
    <div>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-3">
        <button onClick={() => navigate('/operations')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-gray-900">Nouvelle operation</h1>
          <p className="text-xs text-gray-400 mt-0.5">Etape {step} sur 3 — {STEP_LABELS[step - 1]}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6">
        <StepIndicator current={step} />

        {/* Step 1: Enseigne & Type */}
        {step === 1 && (
          <div className="space-y-4">
            <FieldGroup label="Enseigne *">
              <select value={form.enseigne_id} onChange={e => set('enseigne_id', e.target.value)} className={selectCls}>
                <option value="">Selectionner une enseigne</option>
                {enseignes.map(e => (
                  <option key={e.id} value={e.id}>{e.nom} {e.code_court ? `(${e.code_court})` : ''}</option>
                ))}
              </select>
            </FieldGroup>

            {selectedEnseigne && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                <div className="font-medium mb-1">{selectedEnseigne.nom}</div>
                <div className="flex gap-4">
                  <span>Format : {selectedEnseigne.format_fichier ?? 'non defini'}</span>
                  {selectedEnseigne.poids_reel_moyen && <span>Poids reel : {selectedEnseigne.poids_reel_moyen} kg/ex</span>}
                </div>
                {selectedEnseigne.conditionnement_defaut && (
                  <div className="flex gap-4 mt-1 text-gray-400">
                    <span>{selectedEnseigne.conditionnement_defaut.ex_paquet} ex/paq</span>
                    <span>{selectedEnseigne.conditionnement_defaut.ex_carton} ex/crt</span>
                    <span>{selectedEnseigne.conditionnement_defaut.cartons_palette} crt/pal</span>
                    <span>seuil PDV {selectedEnseigne.conditionnement_defaut.seuil_pdv?.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            <FieldGroup label="Categorie *">
              <div className="flex gap-2">
                {(['prospectus', 'plv'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => { set('categorie', cat); set('sous_categorie', SOUS_CAT_OPTIONS[cat][0].value) }}
                    className={`flex-1 py-2.5 rounded-lg text-sm transition-colors border ${
                      form.categorie === cat
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {cat === 'prospectus' ? 'Prospectus' : 'PLV'}
                  </button>
                ))}
              </div>
            </FieldGroup>

            <FieldGroup label="Sous-categorie">
              <div className="flex flex-wrap gap-2">
                {SOUS_CAT_OPTIONS[form.categorie].map(sc => (
                  <button
                    key={sc.value}
                    onClick={() => set('sous_categorie', sc.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                      form.sous_categorie === sc.value
                        ? 'bg-teal-50 border-teal-200 text-teal-700 font-medium'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </FieldGroup>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Code operation *" hint="Ex : 26G307G, CAR-2026-042">
                <input value={form.code_operation} onChange={e => set('code_operation', e.target.value.toUpperCase())}
                  className={inputCls} placeholder="26G307G" />
              </FieldGroup>
              <FieldGroup label="Nom de l'operation">
                <input value={form.nom_operation} onChange={e => set('nom_operation', e.target.value)}
                  className={inputCls} placeholder="Evenement 7" />
              </FieldGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Date de debut (validite)">
                <input type="date" value={form.date_debut} onChange={e => set('date_debut', e.target.value)} className={inputCls} />
              </FieldGroup>
              <FieldGroup label="Date de fin (validite)">
                <input type="date" value={form.date_fin} onChange={e => set('date_fin', e.target.value)} className={inputCls} />
              </FieldGroup>
            </div>

            <FieldGroup label="Imprimeur" hint={linkedImprimeurs.length > 0 ? `${linkedImprimeurs.length} imprimeur(s) lie(s) a cette enseigne` : ''}>
              <select value={form.imprimeur_id} onChange={e => set('imprimeur_id', e.target.value)} className={selectCls}>
                <option value="">Aucun / a definir</option>
                {imprimeurs
                  .sort((a, b) => {
                    const aLinked = linkedImprimeurs.includes(a.id) ? 0 : 1
                    const bLinked = linkedImprimeurs.includes(b.id) ? 0 : 1
                    return aLinked - bLinked
                  })
                  .map(imp => (
                    <option key={imp.id} value={imp.id}>
                      {imp.nom}
                      {linkedImprimeurs.includes(imp.id) ? ' ★' : ''}
                      {imp.type_machine ? ` — ${imp.type_machine}` : ''}
                    </option>
                  ))}
              </select>
            </FieldGroup>

            {selectedImprimeur && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                <div className="font-medium mb-1">{selectedImprimeur.nom}</div>
                <div className="flex gap-4">
                  {selectedImprimeur.type_machine && <span>Machine : {selectedImprimeur.type_machine}</span>}
                  {selectedImprimeur.sortie_native && <span>Sortie : {selectedImprimeur.sortie_native}</span>}
                  {selectedImprimeur.multiple_impose && <span>Multiple : {selectedImprimeur.multiple_impose}</span>}
                </div>
                <div className="flex gap-4 mt-1 text-gray-400">
                  {selectedImprimeur.bijointage && <span>Bijointage possible (≤ {selectedImprimeur.bijointage_seuil_pages} pages)</span>}
                  <span>Ratio poids : {selectedImprimeur.ratio_poids_reel}</span>
                </div>
              </div>
            )}

            <FieldGroup label="Type de support">
              <select value={form.support_type_id} onChange={e => set('support_type_id', e.target.value)} className={selectCls}>
                <option value="">Aucun / a definir</option>
                {supportTypes.map(st => (
                  <option key={st.id} value={st.id}>{st.nom}</option>
                ))}
              </select>
            </FieldGroup>
          </div>
        )}

        {/* Step 3: Specs & Conditionnement */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Specifications du document</h3>
              <div className="grid grid-cols-3 gap-4">
                <FieldGroup label="Pagination (pages)">
                  <input type="number" value={form.pagination} onChange={e => set('pagination', e.target.value)}
                    className={inputCls} placeholder="44" />
                </FieldGroup>
                <FieldGroup label="Format (cm)" hint="LxH : 20x25, 15x21...">
                  <input value={form.format_document} onChange={e => set('format_document', e.target.value)}
                    className={inputCls} placeholder="20x25" />
                </FieldGroup>
                <FieldGroup label="Grammage (g/m2)">
                  <input type="number" value={form.grammage} onChange={e => set('grammage', e.target.value)}
                    className={inputCls} placeholder="60" />
                </FieldGroup>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Conditionnement</h3>
                {selectedEnseigne?.conditionnement_defaut && (
                  <span className="text-[10px] text-indigo-500 font-medium">Pre-rempli depuis {selectedEnseigne.nom}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Exemplaires / paquet" hint="Sortie machine imprimeur">
                  <input type="number" value={form.ex_par_paquet} onChange={e => set('ex_par_paquet', e.target.value)}
                    className={inputCls} placeholder="100" />
                </FieldGroup>
                <FieldGroup label="Exemplaires / carton" hint="Mise sous carton Fretin">
                  <input type="number" value={form.ex_par_carton} onChange={e => set('ex_par_carton', e.target.value)}
                    className={inputCls} placeholder="200" />
                </FieldGroup>
                <FieldGroup label="Cartons / palette (max)">
                  <input type="number" value={form.cartons_par_palette} onChange={e => set('cartons_par_palette', e.target.value)}
                    className={inputCls} placeholder="48" />
                </FieldGroup>
                <FieldGroup label="Seuil PDV (exemplaires)" hint="Au-dela → palette individuelle">
                  <input type="number" value={form.seuil_pdv} onChange={e => set('seuil_pdv', e.target.value)}
                    className={inputCls} placeholder="2800" />
                </FieldGroup>
              </div>
            </div>

            <FieldGroup label="Notes / remarques">
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                className={`${inputCls} h-20 resize-none`} placeholder="Informations complementaires..." />
            </FieldGroup>

            {/* Recap before creation */}
            <div className="bg-gray-50 rounded-xl p-4 text-xs">
              <div className="font-medium text-sm text-gray-900 mb-2">Recapitulatif</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-gray-600">
                <div>Enseigne : <span className="font-medium text-gray-900">{selectedEnseigne?.nom}</span></div>
                <div>Code : <span className="font-medium text-gray-900">{form.code_operation || '—'}</span></div>
                <div>Categorie : <span className="font-medium text-gray-900 capitalize">{form.categorie}</span> / {SOUS_CAT_OPTIONS[form.categorie].find(s => s.value === form.sous_categorie)?.label ?? '—'}</div>
                <div>Nom : <span className="font-medium text-gray-900">{form.nom_operation || '—'}</span></div>
                <div>Imprimeur : <span className="font-medium text-gray-900">{selectedImprimeur?.nom ?? 'A definir'}</span></div>
                <div>Validite : <span className="font-medium text-gray-900">{form.date_debut && form.date_fin ? `${form.date_debut} → ${form.date_fin}` : 'A definir'}</span></div>
                {form.pagination && <div>Document : <span className="font-medium text-gray-900">{form.pagination}p, {form.format_document}, {form.grammage} g/m2</span></div>}
                <div>Conditionnement : <span className="font-medium text-gray-900">{form.ex_par_paquet}/{form.ex_par_carton}/{form.cartons_par_palette}, seuil {form.seuil_pdv}</span></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200">
          <button
            onClick={() => step > 1 ? setStep((step - 1) as Step) : navigate('/operations')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={14} />
            {step === 1 ? 'Annuler' : 'Precedent'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep((step + 1) as Step)}
              disabled={!canNext(step)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              Suivant
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={saving || !form.code_operation.trim()}
              className="flex items-center gap-1.5 px-5 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Creation...' : 'Creer l\'operation'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
