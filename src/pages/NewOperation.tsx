import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react'
import type { Enseigne, Imprimeur, SupportType } from '../types/database'
import { CartonSelector } from '../components/operations/CartonSelector'

type Step = 1 | 2 | 3 | 4

interface FormData {
  // Étape 1 — Enseigne & type
  enseigne_id:   string
  categorie:     'prospectus' | 'plv'
  sous_categorie: string

  // Étape 2 — Opération
  code_operation:  string
  nom_operation:   string
  date_debut:      string
  date_fin:        string
  qte_estimatives: string
  particularites:  string

  // Étape 3 — Document & impression
  format_devise:           string
  bijointage:              boolean
  ex_par_paquet_mode:      string
  optimisation_acceptee:   boolean
  optimisation_cotes:      string
  pagination:              string
  pagination_interieure:   string
  pagination_couverture:   string
  faconnage:               string
  brochage:                string
  type_colle:              string
  grammage:                string
  type_encre:              string
  profil_icc:              string
  pct_fibre_recyclee:      string
  papier_couverture:       string
  grammage_couverture:     string
  pct_fibre_recyclee_couverture: string
  nb_repiquages_noir:      string
  nb_repiquages_quadri:    string
  procede_impression:      string
  pays_impression:         string
  imprimeur_id:            string
  support_type_id:         string
  date_depot_fichier:      string
  date_livraison_maxi:     string

  // Étape 4 — Logistique
  ex_par_paquet:        string
  nb_paquets_carton:    string   // nombre de paquets par carton (ex_par_carton = nb_paquets × ex_par_paquet)
  ex_par_carton:        string   // dérivé — ne pas saisir manuellement
  cartons_par_palette:  string
  seuil_pdv:            string
  poids_unitaire_g:     string   // override manuel en grammes (converti en kg pour Supabase)
  poids_unitaire_kg:    string   // legacy — ne plus utiliser directement dans l'UI
  type_palette_id:      string
  notes:                string
  // Étape 4 — carton (ajout CartonSelector)
  carton_type_id:       string
  pu_carton_snapshot:   string
}

const SOUS_CAT: Record<string, { value: string; label: string }[]> = {
  prospectus: [
    { value: 'bal',  label: 'Distribution BAL' },
    { value: 'adc',  label: 'Arrière de caisse' },
  ],
  plv: [
    { value: 'flat',       label: 'Flat print' },
    { value: 'volume',     label: 'Volume' },
    { value: 'mixte',      label: 'Mixte' },
    { value: 'trade_mktg', label: 'Trade marketing' },
  ],
}

const STEP_LABELS = [
  'Enseigne & type',
  'Opération',
  'Document & impression',
  'Logistique',
]

const inputCls  = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
const selectCls = `${inputCls} bg-white`

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as Step
        const done   = step < current
        const active = step === current
        return (
          <div key={step} className="flex items-center gap-1">
            {i > 0 && <div className={`w-6 h-px ${done || active ? 'bg-brand-300' : 'bg-stone-200'}`} />}
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                done   ? 'bg-brand-500 text-white' :
                active ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300' :
                         'bg-stone-100 text-stone-400'
              }`}>
                {done ? <Check size={12} /> : step}
              </div>
              <span className={`text-xs hidden sm:block ${active ? 'text-stone-900 font-medium' : 'text-stone-400'}`}>{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FieldGroup({ label, children, hint, source }: {
  label: string; children: React.ReactNode; hint?: string; source?: string
}) {
  return (
    <div>
      <label className="text-xs text-stone-500 mb-1 flex items-center gap-1.5">
        {label}
        {source && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 border border-brand-200 font-medium">
            depuis {source}
          </span>
        )}
      </label>
      {children}
      {hint && <div className="text-[10px] text-stone-400 mt-1">{hint}</div>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide pt-2 pb-1 border-b border-stone-100 mb-3">
      {children}
    </div>
  )
}


// ── Calcul limites physiques d'un paquet ────────────────────
const DENSITE_PAPIER: Record<string, number> = {
  'satine': 0.85, 'satine a': 0.85, 'sc paper': 0.85,
  'mwc': 1.05, 'offset': 0.70, 'couche': 0.90, 'default': 0.85,
}

function computePaquetLimits(pagination: number, grammage: number, format: string, typePapier?: string) {
  if (!pagination || !grammage || !format) return null
  const dims = format.toLowerCase().replace('×','x').split('x').map(Number)
  if (dims.length < 2 || !dims[0] || !dims[1]) return null
  const surfaceM2 = (dims[0] / 100) * (dims[1] / 100)
  const nbFeuilles = pagination / 2
  const densite = DENSITE_PAPIER[(typePapier || '').toLowerCase()] ?? DENSITE_PAPIER.default
  const epaisseurFeuille_um = grammage / (densite * 10000) * 10000  // µm
  const epaisseurEx_mm      = nbFeuilles * epaisseurFeuille_um / 1000
  const poidsEx_kg          = nbFeuilles * surfaceM2 * grammage / 1000

  const POIDS_MAX_KG   = 6.0
  const HAUTEUR_MAX_MM = 150

  const maxParPoids   = Math.floor(POIDS_MAX_KG   / poidsEx_kg)
  const maxParHauteur = Math.floor(HAUTEUR_MAX_MM  / epaisseurEx_mm)
  const maxPhysique   = Math.min(maxParPoids, maxParHauteur)

  return {
    poidsEx_kg:      Math.round(poidsEx_kg * 10000) / 10000,
    epaisseurEx_mm:  Math.round(epaisseurEx_mm * 100) / 100,
    maxParPoids,
    maxParHauteur,
    maxPhysique,
    limiteActive: maxParPoids < maxParHauteur ? 'poids' : 'hauteur',
  }
}

function practicalGroupings(maxPhysique: number): number[] {
  // Valeurs rondes pratiques et maniables, indépendantes du multiple imposé
  const ROUND_VALUES = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100, 120, 150, 200]
  const valid = ROUND_VALUES.filter(v => v <= maxPhysique)
  if (valid.length === 0) return [Math.max(1, maxPhysique)]
  return [...valid].reverse() // du plus grand (meilleur remplissage) au plus petit
}

export default function NewOperation() {
  const navigate = useNavigate()
  const { org }  = useOrg()
  const [step, setStep]   = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [enseignes, setEnseignes]   = useState<Enseigne[]>([])
  const [imprimeurs, setImprimeurs] = useState<Imprimeur[]>([])
  const [supportTypes, setSupportTypes]   = useState<SupportType[]>([])
  const [linkedImprimeurs, setLinkedImprimeurs] = useState<string[]>([])
  const [typesPalette, setTypesPalette] = useState<any[]>([])
  const [defaultSources, setDefaultSources] = useState<Record<string, string>>({})
  const [aiOptimizing, setAiOptimizing]   = useState(false)
  const [aiSuggestion, setAiSuggestion]   = useState<any>(null)

  const [form, setForm] = useState<FormData>({
    enseigne_id: '', categorie: 'prospectus', sous_categorie: 'bal',
    code_operation: '', nom_operation: '', date_debut: '', date_fin: '',
    qte_estimatives: '', particularites: '',
    format_devise: '', optimisation_acceptee: false, optimisation_cotes: '',
    bijointage: false, ex_par_paquet_mode: 'imprimeur',
    pagination: '', pagination_interieure: '', pagination_couverture: '0',
    faconnage: '', brochage: '', type_colle: '', grammage: '',
    type_encre: 'Sans huiles minérales', profil_icc: '', pct_fibre_recyclee: '',
    papier_couverture: '', grammage_couverture: '', pct_fibre_recyclee_couverture: '',
    nb_repiquages_noir: '', nb_repiquages_quadri: '0',
    procede_impression: 'Offset', pays_impression: '', imprimeur_id: '',
    support_type_id: '', date_depot_fichier: '', date_livraison_maxi: '',
    ex_par_paquet: '', nb_paquets_carton: '2', ex_par_carton: '',
    cartons_par_palette: '', seuil_pdv: '',
    poids_unitaire_g: '', poids_unitaire_kg: '',
    type_palette_id: '', notes: '',
    carton_type_id: '', pu_carton_snapshot: '',
  })

  const set = (k: keyof FormData, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  // Charger les référentiels
  useEffect(() => {
    Promise.all([
      supabase.from('ref_enseignes').select('*').eq('actif', true).order('nom'),
      supabase.from('ref_imprimeurs').select('*').order('nom'),
      supabase.from('ref_support_types').select('*, sous_categorie:ref_support_sous_categories(nom, code, categorie:ref_support_categories(nom))').order('nom'),
      supabase.from('ref_types_palette').select('id,nom,code,cartons_max,poids_max_kg,hauteur_max_cm,gerbable').eq('actif', true).order('nom'),
    ]).then(([ens, imp, sup, pal]) => {
      setEnseignes(ens.data ?? [])
      setImprimeurs(imp.data ?? [])
      setSupportTypes(sup.data ?? [])
      setTypesPalette(pal.data ?? [])
    })
  }, [])

  // Quand enseigne change : pré-remplir conditionnement depuis config_regles
  useEffect(() => {
    if (!form.enseigne_id) return
    const ens = enseignes.find(e => e.id === form.enseigne_id)

    const loadDefaults = async () => {
      const newSources: Record<string, string> = {}
      const updates: Partial<FormData> = {}

      // Règles globales
      const { data: gRules } = await supabase.from('config_regles').select('contenu')
        .eq('categorie', 'conditionnement_defaut').eq('niveau', 'global').eq('actif', true)
        .order('priorite', { ascending: false }).limit(1)
      if (gRules?.[0]) {
        try {
          const cd = JSON.parse(gRules[0].contenu)
          if (cd.ex_paquet)         { updates.ex_par_paquet       = String(cd.ex_paquet);        newSources.ex_par_paquet       = 'Global' }
          if (cd.ex_carton)         {
            // Dériver nb_paquets_carton depuis ex_carton et ex_paquet
            const exPaq = cd.ex_paquet || 100
            const nbPaq = Math.round(cd.ex_carton / exPaq)
            if (nbPaq >= 1) { updates.nb_paquets_carton = String(nbPaq); newSources.nb_paquets_carton = 'Global' }
          }
          if (cd.cartons_palette)   { updates.cartons_par_palette = String(cd.cartons_palette);  newSources.cartons_par_palette = 'Global' }
          if (cd.seuil_pdv)         { updates.seuil_pdv           = String(cd.seuil_pdv);        newSources.seuil_pdv           = 'Global' }
          // poids_unitaire_kg retiré : calculé par formule depuis pagination/grammage/format
          if (cd.grammage)          { updates.grammage            = String(cd.grammage);         newSources.grammage            = 'Global' }
        } catch {}
      }

      // Règles enseigne (prioritaires)
      const { data: eRules } = await supabase.from('config_regles').select('contenu')
        .eq('categorie', 'conditionnement_defaut').eq('niveau', 'enseigne')
        .eq('ref_id', form.enseigne_id).eq('actif', true)
        .order('priorite', { ascending: false }).limit(1)
      if (eRules?.[0]) {
        try {
          const cd = JSON.parse(eRules[0].contenu)
          const src = ens?.nom ?? 'Enseigne'
          if (cd.ex_paquet)         { updates.ex_par_paquet       = String(cd.ex_paquet);        newSources.ex_par_paquet       = src }
          if (cd.ex_carton)         {
            const exPaq = cd.ex_paquet || parseInt(updates.ex_par_paquet || '100')
            const nbPaq = Math.round(cd.ex_carton / exPaq)
            if (nbPaq >= 1) { updates.nb_paquets_carton = String(nbPaq); newSources.nb_paquets_carton = src }
          }
          if (cd.cartons_palette)   { updates.cartons_par_palette = String(cd.cartons_palette);  newSources.cartons_par_palette = src }
          if (cd.seuil_pdv)         { updates.seuil_pdv           = String(cd.seuil_pdv);        newSources.seuil_pdv           = src }
          // poids_unitaire_kg retiré : calculé par formule
          if (cd.grammage)          { updates.grammage            = String(cd.grammage);         newSources.grammage            = src }
        } catch {}
      }
      if (ens?.poids_reel_moyen && !updates.poids_unitaire_kg) {
        updates.poids_unitaire_kg = String(ens.poids_reel_moyen)
        newSources.poids_unitaire_kg = ens.nom
      }

      if (Object.keys(updates).length > 0) {
        setForm(prev => ({ ...prev, ...updates }))
        setDefaultSources(prev => ({ ...prev, ...newSources }))
      }
    }
    loadDefaults()

    supabase.from('jct_enseigne_imprimeur').select('imprimeur_id, est_defaut')
      .eq('enseigne_id', form.enseigne_id)
      .then(({ data }) => {
        const ids = data?.map(d => d.imprimeur_id) ?? []
        setLinkedImprimeurs(ids)
        const defaut = data?.find(d => d.est_defaut)
        if (defaut && !form.imprimeur_id) set('imprimeur_id', defaut.imprimeur_id)
      })
  }, [form.enseigne_id, enseignes])

  // Quand imprimeur change : règles imprimeur
  useEffect(() => {
    if (!form.imprimeur_id) return
    supabase.from('config_regles').select('contenu')
      .eq('categorie', 'conditionnement_defaut').eq('niveau', 'imprimeur')
      .eq('ref_id', form.imprimeur_id).eq('actif', true)
      .order('priorite', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (!data?.[0]) return
        try {
          const cd = JSON.parse(data[0].contenu)
          const imp = imprimeurs.find(i => i.id === form.imprimeur_id)
          const src = imp?.nom ?? 'Imprimeur'
          const updates: Partial<FormData> = {}
          const newSources: Record<string, string> = {}
          if (cd.ex_paquet)         { updates.ex_par_paquet     = String(cd.ex_paquet);        newSources.ex_par_paquet     = src }
          // poids_unitaire_kg non chargé depuis imprimeur : calculé par formule
          if (Object.keys(updates).length > 0) {
            setForm(prev => ({ ...prev, ...updates }))
            setDefaultSources(prev => ({ ...prev, ...newSources }))
          }
        } catch {}
      })
  }, [form.imprimeur_id, imprimeurs])

  // Calculs dérivés — limites physiques paquet
  const physicalLimits = computePaquetLimits(
    parseInt(form.pagination || '0'),
    parseFloat(form.grammage || '0'),
    form.format_devise || '20x25',
  )

  // Calculs dérivés pour l'étape 4
  // Formule physique — toujours recalculée depuis pagination/grammage/format
  const computedPoidsFormule = (() => {
    const p = parseInt(form.pagination || form.pagination_interieure || '0')
    const g = parseFloat(form.grammage || '0')
    const fmt = form.format_devise || ''
    const [w, h] = fmt.toLowerCase().split(/[x×]/).map(Number)
    if (!p || !g || !w || !h) return null
    const surfaceM2 = (w / 100) * (h / 100)
    // Résultat en kg (6 décimales pour binpacking), affiché en g dans l'UI
    return Math.round(((p / 2) * surfaceM2 * g) * 1000000) / 1000000
  })()

  // Poids effectif : formule en priorité, override en g si formule impossible
  const computedPoids = computedPoidsFormule ?? overridePoidsKg

  // Poids en grammes pour affichage (arrondi à 0.1 g)
  const computedPoidsG = computedPoids != null
    ? Math.round(computedPoids * 10000) / 10
    : null

  const exPaquet     = parseInt(form.ex_par_paquet || '100')
  const nbPaqCarton  = parseInt(form.nb_paquets_carton || '2')
  // ex_par_carton est TOUJOURS dérivé : nb_paquets_carton × ex_par_paquet
  const exCarton     = nbPaqCarton * exPaquet
  // Validation : cohérence paquets/carton
  const cartonCoherent = nbPaqCarton >= 1 && exCarton >= exPaquet
  const crtPalette   = parseInt(form.cartons_par_palette || '48')
  const seuilPdv     = parseInt(form.seuil_pdv || '2800')
  // Poids override : champ saisi en GRAMMES par l'utilisateur, converti en kg
  const overridePoidsG  = form.poids_unitaire_g ? parseFloat(form.poids_unitaire_g) : null
  const overridePoidsKg = overridePoidsG != null ? overridePoidsG / 1000 : null
  const qteTotal    = parseInt(form.qte_estimatives || '0')
  const exPalette   = exCarton * crtPalette
  const poidsPalette = computedPoids && exPalette ? Math.round(exPalette * computedPoids) : null
  const nbPalEstim  = qteTotal && exPalette ? Math.ceil(qteTotal / exPalette) : null

  const selectedEnseigne  = enseignes.find(e => e.id === form.enseigne_id)
  const selectedImprimeur = imprimeurs.find(i => i.id === form.imprimeur_id)

  const canNext = (s: Step) => {
    if (s === 1) return !!form.enseigne_id && !!form.categorie
    if (s === 2) return !!form.code_operation.trim()
    return true
  }

  const handleAiOptimize = async () => {
    setAiOptimizing(true)
    setAiSuggestion(null)
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'https://nanotera-api-saas-production.up.railway.app'}/api/ai/optimize-conditionnement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagination:       parseInt(form.pagination || '0'),
          grammage:         parseFloat(form.grammage || '0'),
          format:           form.format_devise,
          qte_estimatives:  parseInt(form.qte_estimatives || '0'),
          ex_par_paquet:    exPaquet,
          ex_par_carton:    exCarton,
          crt_palette:      crtPalette,
          seuil_pdv:        seuilPdv,
          poids_unitaire:   computedPoids,
          imprimeur:        selectedImprimeur?.nom,
          multiple_impose:  selectedImprimeur?.multiple_impose,
          bijointage:       form.bijointage,
        })
      })
      const data = await resp.json()
      setAiSuggestion(data)
    } catch {
      setAiSuggestion({ error: 'Impossible de contacter l\'IA. Vérifiez votre connexion.' })
    } finally {
      setAiOptimizing(false)
    }
  }

  const applyAiSuggestion = () => {
    if (!aiSuggestion?.conditionnement) return
    const s = aiSuggestion.conditionnement
    if (s.ex_par_paquet)       set('ex_par_paquet',       String(s.ex_par_paquet))
    if (s.ex_par_carton)       set('ex_par_carton',       String(s.ex_par_carton))
    if (s.cartons_par_palette) set('cartons_par_palette', String(s.cartons_par_palette))
    if (s.seuil_pdv)           set('seuil_pdv',           String(s.seuil_pdv))
    if (s.poids_unitaire_kg)   set('poids_unitaire_kg',   String(s.poids_unitaire_kg))
    setAiSuggestion(null)
  }

  const handleCreate = async () => {
    setSaving(true); setError('')
    const payload = {
      org_id:        org?.org_id,
      enseigne_id:   form.enseigne_id,
      categorie:     form.categorie,
      sous_categorie: form.sous_categorie || null,
      statut:        'planifie',
      // Étape 2
      code_operation:  form.code_operation.trim(),
      nom_operation:   form.nom_operation.trim() || null,
      date_debut:      form.date_debut || null,
      date_fin:        form.date_fin || null,
      qte_estimatives: form.qte_estimatives ? parseInt(form.qte_estimatives) : null,
      particularites:  form.particularites.trim() || null,
      // Étape 3 — document
      format_document:        form.format_devise || null,
      format_devise:          form.format_devise || null,
      optimisation_acceptee:  form.optimisation_acceptee,
      optimisation_cotes:     form.optimisation_cotes.trim() || null,
      pagination:             form.pagination ? parseInt(form.pagination) : null,
      pagination_interieure:  form.pagination_interieure ? parseInt(form.pagination_interieure) : null,
      pagination_couverture:  form.pagination_couverture ? parseInt(form.pagination_couverture) : 0,
      faconnage:              form.faconnage || null,
      brochage:               form.brochage || null,
      type_colle:             form.type_colle || null,
      grammage:               form.grammage ? parseFloat(form.grammage) : null,
      type_encre:             form.type_encre || null,
      profil_icc:             form.profil_icc || null,
      pct_fibre_recyclee:     form.pct_fibre_recyclee ? parseInt(form.pct_fibre_recyclee) : null,
      papier_couverture:      form.papier_couverture || null,
      grammage_couverture:    form.grammage_couverture ? parseFloat(form.grammage_couverture) : null,
      pct_fibre_recyclee_couverture: form.pct_fibre_recyclee_couverture ? parseInt(form.pct_fibre_recyclee_couverture) : null,
      nb_repiquages_noir:     form.nb_repiquages_noir ? parseInt(form.nb_repiquages_noir) : 0,
      nb_repiquages_quadri:   form.nb_repiquages_quadri ? parseInt(form.nb_repiquages_quadri) : 0,
      procede_impression:     form.procede_impression || null,
      pays_impression:        form.pays_impression || null,
      imprimeur_id:           form.imprimeur_id || null,
      support_type_id:        form.support_type_id || null,
      date_depot_fichier:     form.date_depot_fichier || null,
      date_livraison_maxi:    form.date_livraison_maxi || null,
      // Étape 4 — logistique
      ex_par_paquet:          form.ex_par_paquet ? parseInt(form.ex_par_paquet) : null,
      // ex_par_carton géré ci-dessus (dérivé)
      cartons_par_palette:    form.cartons_par_palette ? parseInt(form.cartons_par_palette) : null,
      seuil_pdv:              form.seuil_pdv ? parseInt(form.seuil_pdv) : null,
      // ex_par_carton : toujours dérivé de nb_paquets_carton × ex_par_paquet
      ex_par_carton:          exCarton || null,
      nb_paquets_carton:      nbPaqCarton || null,
      // poids en kg : formule en priorité, override (saisi en g) en fallback
      poids_unitaire_kg:      computedPoidsFormule ?? overridePoidsKg ?? null,
      type_palette_id:        form.type_palette_id || null,
      notes:                  form.notes.trim() || null,
      // Carton
      carton_type_id:         form.carton_type_id || null,
      pu_carton_snapshot:     form.pu_carton_snapshot ? parseFloat(form.pu_carton_snapshot) : null,
    }

    const { data, error: err } = await supabase.from('ops_operations').insert(payload).select('id').single()
    if (err) { setError(err.message); setSaving(false); return }
    navigate('/operations')
  }

  return (
    <div>
      <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep((step - 1) as Step) : navigate('/operations')}
          className="text-stone-400 hover:text-stone-600">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-stone-900">Nouvelle opération</h1>
          <p className="text-xs text-stone-400 mt-0.5">Étape {step} / 4 — {STEP_LABELS[step - 1]}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6">
        <StepIndicator current={step} />

        {/* ── Étape 1 : Enseigne & type ── */}
        {step === 1 && (
          <div className="space-y-4">
            <FieldGroup label="Enseigne *">
              <select value={form.enseigne_id} onChange={e => set('enseigne_id', e.target.value)} className={selectCls}>
                <option value="">Sélectionner une enseigne</option>
                {enseignes.map(e => (
                  <option key={e.id} value={e.id}>{e.nom} {e.code_court ? `(${e.code_court})` : ''}</option>
                ))}
              </select>
            </FieldGroup>

            {selectedEnseigne && (
              <div className="bg-stone-50 rounded-lg p-3 text-xs text-stone-600">
                <div className="font-medium mb-1">{selectedEnseigne.nom}</div>
                <div className="text-stone-400">Format fichier : {selectedEnseigne.format_fichier ?? 'non défini'}</div>
              </div>
            )}

            <FieldGroup label="Catégorie *">
              <div className="flex gap-2">
                {(['prospectus', 'plv'] as const).map(cat => (
                  <button key={cat} type="button"
                    onClick={() => set('categorie', cat)}
                    className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                      form.categorie === cat
                        ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium'
                        : 'border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}>
                    {cat === 'prospectus' ? 'Prospectus' : 'PLV'}
                  </button>
                ))}
              </div>
            </FieldGroup>

            <FieldGroup label="Sous-catégorie">
              <div className="flex gap-2 flex-wrap">
                {SOUS_CAT[form.categorie].map(sc => (
                  <button key={sc.value} type="button"
                    onClick={() => set('sous_categorie', sc.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                      form.sous_categorie === sc.value
                        ? 'border-brand-400 bg-brand-50 text-brand-700 font-medium'
                        : 'border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}>
                    {sc.label}
                  </button>
                ))}
              </div>
            </FieldGroup>
          </div>
        )}

        {/* ── Étape 2 : Opération ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Code opération *" hint="Ex : 26G306G, CAR-2026-042">
                <input value={form.code_operation}
                  onChange={e => set('code_operation', e.target.value.toUpperCase())}
                  className={inputCls} placeholder="26G307G" />
              </FieldGroup>
              <FieldGroup label="Nom de l'opération">
                <input value={form.nom_operation} onChange={e => set('nom_operation', e.target.value)}
                  className={inputCls} placeholder="Événement 7" />
              </FieldGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Date de début (validité)">
                <input type="date" value={form.date_debut} onChange={e => set('date_debut', e.target.value)} className={inputCls} />
              </FieldGroup>
              <FieldGroup label="Date de fin (validité)">
                <input type="date" value={form.date_fin} onChange={e => set('date_fin', e.target.value)} className={inputCls} />
              </FieldGroup>
            </div>

            <FieldGroup label="Quantité estimative (exemplaires)">
              <input type="number" value={form.qte_estimatives}
                onChange={e => set('qte_estimatives', e.target.value)}
                className={inputCls} placeholder="660 000" />
            </FieldGroup>

            <FieldGroup label="Particularités" hint="Ex: France en 3 => 2X 4/4 — Ouvert aux Espaces Culturels">
              <textarea value={form.particularites} onChange={e => set('particularites', e.target.value)}
                className={`${inputCls} h-16 resize-none`}
                placeholder="Informations spécifiques à cette opération..." />
            </FieldGroup>
          </div>
        )}

        {/* ── Étape 3 : Document & impression ── */}
        {step === 3 && (
          <div className="space-y-4">

            <SectionTitle>Format & pagination</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <FieldGroup label="Format (cm)" hint="Format devisé après façonnage" source={defaultSources.format_document}>
                <input value={form.format_devise} onChange={e => set('format_devise', e.target.value)}
                  className={inputCls} placeholder="20x25" />
              </FieldGroup>
              <FieldGroup label="Pagination globale">
                <input type="number" value={form.pagination} onChange={e => set('pagination', e.target.value)}
                  className={inputCls} placeholder="44" />
              </FieldGroup>
              <FieldGroup label="Pagination intérieure">
                <input type="number" value={form.pagination_interieure}
                  onChange={e => set('pagination_interieure', e.target.value)}
                  className={inputCls} placeholder="44" />
              </FieldGroup>
              <FieldGroup label="Pagination couverture">
                <input type="number" value={form.pagination_couverture}
                  onChange={e => set('pagination_couverture', e.target.value)}
                  className={inputCls} placeholder="0" />
              </FieldGroup>
            </div>

            {/* Optimisation format */}
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
              <input type="checkbox" id="optim" checked={form.optimisation_acceptee}
                onChange={e => set('optimisation_acceptee', e.target.checked)}
                className="w-4 h-4 accent-brand-500 flex-shrink-0" />
              <div className="flex-1">
                <label htmlFor="optim" className="text-sm text-stone-700 cursor-pointer">
                  Optimisation de format acceptée
                </label>
                <div className="text-xs text-stone-400 mt-0.5">L'imprimeur peut adapter les cotes dans une plage définie</div>
              </div>
            </div>
            {form.optimisation_acceptee && (
              <FieldGroup label="Plage d'optimisation (cm)" hint="Ex: L : 19,5-20 | H : 25-26">
                <input value={form.optimisation_cotes}
                  onChange={e => set('optimisation_cotes', e.target.value)}
                  className={inputCls} placeholder="L : 19,5-20 | H : 25-26" />
              </FieldGroup>
            )}

            <SectionTitle>Finition</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Façonnage">
                <select value={form.faconnage} onChange={e => set('faconnage', e.target.value)} className={selectCls}>
                  <option value="">— Sélectionner —</option>
                  {['Brut de roto', 'Rogné', 'Autre'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FieldGroup>
              <FieldGroup label="Brochage">
                <select value={form.brochage} onChange={e => set('brochage', e.target.value)} className={selectCls}>
                  <option value="">— Sélectionner —</option>
                  {['Piqué', 'Collé', 'Plié'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FieldGroup>
              {form.brochage === 'Collé' && (
                <FieldGroup label="Type de colle">
                  <input value={form.type_colle} onChange={e => set('type_colle', e.target.value)}
                    className={inputCls} placeholder="Colle séparable ou dispersable" />
                </FieldGroup>
              )}
            </div>

            <SectionTitle>Papier & encre</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <FieldGroup label="Grammage (g/m²)" source={defaultSources.grammage}>
                <input type="number" value={form.grammage} onChange={e => set('grammage', e.target.value)}
                  className={inputCls} placeholder="49" />
              </FieldGroup>
              <FieldGroup label="% fibre recyclée">
                <input type="number" value={form.pct_fibre_recyclee}
                  onChange={e => set('pct_fibre_recyclee', e.target.value)}
                  className={inputCls} placeholder="50" />
              </FieldGroup>
              <FieldGroup label="Type d'encre">
                <select value={form.type_encre} onChange={e => set('type_encre', e.target.value)} className={selectCls}>
                  <option value="Sans huiles minérales">Sans huiles minérales</option>
                  <option value="Standard">Standard</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Profil ICC">
                <select value={form.profil_icc} onChange={e => set('profil_icc', e.target.value)} className={selectCls}>
                  <option value="">— Sélectionner —</option>
                  {['SC Paper', 'Iso Coated V2', 'Fogra 39', 'Autre'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FieldGroup>
            </div>

            <SectionTitle>Couverture (si différente du cahier)</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <FieldGroup label="Type papier couverture">
                <select value={form.papier_couverture} onChange={e => set('papier_couverture', e.target.value)} className={selectCls}>
                  <option value="">Identique au cahier</option>
                  {['Satiné A', 'MWC', 'Couché mat', 'Offset', 'Autre'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FieldGroup>
              {form.papier_couverture && <>
                <FieldGroup label="Grammage couverture (g/m²)">
                  <input type="number" value={form.grammage_couverture}
                    onChange={e => set('grammage_couverture', e.target.value)}
                    className={inputCls} placeholder="135" />
                </FieldGroup>
                <FieldGroup label="% fibre recyclée couv.">
                  <input type="number" value={form.pct_fibre_recyclee_couverture}
                    onChange={e => set('pct_fibre_recyclee_couverture', e.target.value)}
                    className={inputCls} placeholder="0" />
                </FieldGroup>
              </>}
            </div>

            <SectionTitle>Repiquages</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Nb repiquages au noir">
                <input type="number" value={form.nb_repiquages_noir}
                  onChange={e => set('nb_repiquages_noir', e.target.value)}
                  className={inputCls} placeholder="15" />
              </FieldGroup>
              <FieldGroup label="Nb repiquages quadri">
                <input type="number" value={form.nb_repiquages_quadri}
                  onChange={e => set('nb_repiquages_quadri', e.target.value)}
                  className={inputCls} placeholder="0" />
              </FieldGroup>
            </div>

            <SectionTitle>Impression</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Imprimeur" hint={linkedImprimeurs.length > 0 ? `${linkedImprimeurs.length} lié(s) à cette enseigne` : ''}>
                <select value={form.imprimeur_id} onChange={e => set('imprimeur_id', e.target.value)} className={selectCls}>
                  <option value="">Aucun / à définir</option>
                  {imprimeurs
                    .sort((a, b) => (linkedImprimeurs.includes(a.id) ? 0 : 1) - (linkedImprimeurs.includes(b.id) ? 0 : 1))
                    .map(imp => (
                      <option key={imp.id} value={imp.id}>
                        {imp.nom}{linkedImprimeurs.includes(imp.id) ? ' ★' : ''}{imp.type_machine ? ` — ${imp.type_machine}` : ''}
                      </option>
                    ))}
                </select>
              </FieldGroup>
              <FieldGroup label="Procédé">
                <select value={form.procede_impression} onChange={e => set('procede_impression', e.target.value)} className={selectCls}>
                  {['Offset', 'Héliogravure', 'Numérique', 'Flexographie'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </FieldGroup>
              <FieldGroup label="Pays d'impression">
                <input value={form.pays_impression} onChange={e => set('pays_impression', e.target.value)}
                  className={inputCls} placeholder="France" />
              </FieldGroup>
              <FieldGroup label="Type de support">
                <select value={form.support_type_id} onChange={e => set('support_type_id', e.target.value)} className={selectCls}>
                  <option value="">Aucun / à définir</option>
                  {supportTypes.map(st => <option key={st.id} value={st.id}>{st.nom}</option>)}
                </select>
              </FieldGroup>
            </div>

            {selectedImprimeur && (
              <div className="bg-stone-50 rounded-lg p-3 text-xs text-stone-500 grid grid-cols-3 gap-2">
                <span>Machine : {selectedImprimeur.type_machine ?? '—'}</span>
                <span>Sortie : {selectedImprimeur.sortie_native ?? '—'}</span>
                <span>Multiple : {selectedImprimeur.multiple_impose ?? '—'} ex/paquet</span>
                {selectedImprimeur.bijointage && (
                  <span className="col-span-3">Bijointage possible ≤ {selectedImprimeur.bijointage_seuil_pages} pages</span>
                )}
              </div>
            )}

            {/* ── Conditionnement sortie machine ── */}
            {(() => {
              const imp = selectedImprimeur
              if (!imp) return null

              const multiple = imp.multiple_impose || 100
              // Bijointage : proposé quelle que soit la pagination (demande Céline 13/04)
              const canBijointage = !!imp.bijointage

              // Options valides selon le multiple imposé
              const options: { value: string; label: string; hint: string }[] = []
              // Standard : multiples du multiple_impose jusqu'à 200
              for (const n of [multiple, multiple * 2, multiple * 3]) {
                if (n <= 300) options.push({
                  value: String(n),
                  label: `${n} ex/paquet`,
                  hint: n === multiple ? 'Standard imprimeur' : `${n / multiple}× le multiple`,
                })
              }
              // Bijointage si applicable
              if (canBijointage) options.push({
                value: String(multiple),
                label: `${multiple} ex/paquet en bijointage`,
                hint: `${multiple/2 || multiple} tête + ${multiple/2 || multiple} bêche (pagination ≤ ${imp.bijointage_seuil_pages} pages)`,
              })

              const currentVal = form.ex_par_paquet || String(multiple)

              return (
                <div>
                  <SectionTitle>Conditionnement sortie machine</SectionTitle>
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                    {/* Info imprimeur + physique */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-xs text-stone-500 flex-wrap">
                        <span className="font-medium text-stone-700">{imp.nom}</span>
                        <span>·</span>
                        <span>Multiple imposé : <strong className="text-stone-800">{multiple} ex</strong></span>
                        {imp.bijointage && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            canBijointage ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-stone-100 text-stone-400 border-stone-200'
                          }`}>
                            Bijointage disponible ✓
                          </span>
                        )}
                      </div>
                      {/* Limites physiques */}
                      {physicalLimits && (
                        <div className={`flex items-center gap-3 text-xs px-3 py-2 rounded-lg border flex-wrap ${
                          physicalLimits.maxPhysique < multiple
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-stone-50 border-stone-200 text-stone-500'
                        }`}>
                          <span>Poids/ex : <strong className="text-stone-800">{Math.round(physicalLimits.poidsEx_kg * 10000) / 10} g</strong></span>
                          <span>·</span>
                          <span>Épaisseur/ex : <strong className="text-stone-800">{physicalLimits.epaisseurEx_mm} mm</strong></span>
                          <span>·</span>
                          <span>Max physique : <strong className={physicalLimits.maxPhysique < multiple ? 'text-red-700' : 'text-stone-800'}>{physicalLimits.maxPhysique} ex/paquet</strong>
                            <span className="ml-1 opacity-70">(limite : {physicalLimits.limiteActive === 'poids' ? `poids ${(physicalLimits.maxPhysique * physicalLimits.poidsEx_kg).toFixed(1)} kg` : `hauteur ${(physicalLimits.maxPhysique * physicalLimits.epaisseurEx_mm / 10).toFixed(1)} cm`})</span>
                          </span>
                          {physicalLimits.maxPhysique < multiple && (
                            <span className="font-medium">⚠ {multiple} ex/paquet (multiple machine) impossible à ce grammage/pagination — voir options ci-dessous</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Sélection ex/paquet : select + champ libre ── */}
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-stone-500 mb-1.5">Exemplaires par paquet</div>
                        <div className="flex gap-2">
                          <select
                            value={form.ex_par_paquet_mode === 'custom' ? 'custom' : (form.ex_par_paquet || String(multiple))}
                            onChange={e => {
                              if (e.target.value === 'custom') {
                                set('ex_par_paquet_mode', 'custom')
                              } else {
                                set('ex_par_paquet_mode', e.target.value)
                                set('ex_par_paquet', e.target.value)
                              }
                            }}
                            className={`${selectCls} flex-1`}>
                            {(() => {
                              const maxPhys = physicalLimits?.maxPhysique ?? 9999
                              const groups = practicalGroupings(maxPhys)
                              return groups.map(n => {
                                const poidsG = physicalLimits ? Math.round(n * physicalLimits.poidsEx_kg * 10000) / 10 : null
                                const hautCm = physicalLimits ? (n * physicalLimits.epaisseurEx_mm / 10).toFixed(1) : null
                                const isMultiple = n % multiple === 0
                                const tag = isMultiple ? ` · multiple ${multiple} ✓` : ''
                                const physInfo = poidsG != null ? ` — ${poidsG} g · ${hautCm} cm${tag}` : ''
                                return (
                                  <option key={n} value={String(n)}>
                                    {n} ex/paquet{physInfo}
                                  </option>
                                )
                              })
                            })()}
                            <option value="custom">Quantité libre…</option>
                          </select>
                        </div>

                        {/* Champ libre si "custom" */}
                        {form.ex_par_paquet_mode === 'custom' && (
                          <div className="mt-2 space-y-1.5">
                            <input
                              type="number"
                              value={form.ex_par_paquet}
                              onChange={e => set('ex_par_paquet', e.target.value)}
                              className={inputCls}
                              placeholder={`Multiple de ${multiple} recommandé — ex: ${multiple}, ${multiple * 2}...`}
                            />
                            {form.ex_par_paquet && physicalLimits && (() => {
                              const n = parseInt(form.ex_par_paquet)
                              const poidsG = Math.round(n * physicalLimits.poidsEx_kg * 10000) / 10
                              const hautCm = (n * physicalLimits.epaisseurEx_mm / 10).toFixed(1)
                              const overMax = n > physicalLimits.maxPhysique
                              const isMultiple = n % multiple === 0
                              return (
                                <div className={`text-xs px-3 py-2 rounded-lg border ${
                                  overMax ? 'bg-red-50 border-red-200 text-red-700' : 'bg-stone-50 border-stone-200 text-stone-500'
                                }`}>
                                  {overMax
                                    ? `⚠ ${n} ex dépasse le max physique (${physicalLimits.maxPhysique} ex) — risque de casse`
                                    : `${poidsG} g · ${hautCm} cm${isMultiple ? ` · multiple de ${multiple} ✓` : ` — à confirmer avec ${imp.nom}`}`}
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>

                      {/* ── Toggle bijointage — indépendant du nombre de paquets ── */}
                      {canBijointage && (
                        <div className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                          form.bijointage ? 'border-teal-300 bg-teal-50' : 'border-stone-200 bg-white'
                        }`}
                          onClick={() => set('bijointage', !form.bijointage)}>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${form.bijointage ? 'text-teal-700' : 'text-stone-700'}`}>
                                Bijointage
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded border bg-teal-50 text-teal-700 border-teal-200 font-medium">
                                disponible
                              </span>
                            </div>
                            <div className="text-xs text-stone-400 mt-0.5">
                              2 piles tête-bêche par paquet — {form.ex_par_paquet
                                ? `${parseInt(form.ex_par_paquet) * 2} ex/paquet bijointé`
                                : `${multiple * 2} ex/paquet bijointé`}
                            </div>
                          </div>
                          {/* Toggle visuel */}
                          <div className={`w-10 h-6 rounded-full transition-all flex items-center px-1 ${
                            form.bijointage ? 'bg-teal-500 justify-end' : 'bg-stone-200 justify-start'
                          }`}>
                            <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            <SectionTitle>Dates de production</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Date dépôt fichiers (BAT)">
                <input type="date" value={form.date_depot_fichier}
                  onChange={e => set('date_depot_fichier', e.target.value)} className={inputCls} />
              </FieldGroup>
              <FieldGroup label="Date livraison maxi prospectus">
                <input type="date" value={form.date_livraison_maxi}
                  onChange={e => set('date_livraison_maxi', e.target.value)} className={inputCls} />
              </FieldGroup>
            </div>
          </div>
        )}

        {/* ── Étape 4 : Logistique & calculs ── */}
        {step === 4 && (
          <div className="space-y-5">

            {/* Valeurs calculées */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>Valeurs calculées</SectionTitle>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Poids / exemplaire',
                    value: computedPoidsG != null ? `${computedPoidsG} g` : '—',
                    sub: computedPoidsFormule != null
                      ? `Calculé — ${form.pagination}p · ${form.grammage} g/m² · ${form.format_devise}`
                      : overridePoidsG != null
                        ? `Override manuel — ${overridePoidsG} g`
                        : 'Renseigner pagination, grammage et format',
                    ok: computedPoidsG != null,
                  },
                  {
                    label: 'Exemplaires / palette',
                    value: exPalette ? exPalette.toLocaleString('fr-FR') : '—',
                    sub: `${exCarton} ex/crt × ${crtPalette} crt`,
                    ok: !!exPalette,
                  },
                  {
                    label: 'Poids / palette estimé',
                    value: poidsPalette ? `${poidsPalette.toLocaleString('fr-FR')} kg` : '—',
                    sub: poidsPalette ? (poidsPalette > 750 ? '⚠ Dépasse 750 kg standard' : '✓ Dans la norme') : '',
                    ok: poidsPalette ? poidsPalette <= 750 : null,
                  },
                  {
                    label: 'Nb palettes estimé',
                    value: nbPalEstim ? `~${nbPalEstim}` : '—',
                    sub: qteTotal ? `${qteTotal.toLocaleString('fr-FR')} ex total` : 'quantité estimative non renseignée',
                    ok: !!nbPalEstim,
                  },
                  {
                    label: 'Seuil palette individuelle',
                    value: seuilPdv ? `${seuilPdv.toLocaleString('fr-FR')} ex` : '—',
                    sub: computedPoids && seuilPdv ? `≈ ${Math.round(seuilPdv * computedPoids)} kg / palette PDV` : '',
                    ok: !!seuilPdv,
                  },
                  {
                    label: 'Ex / paquet',
                    value: (() => {
                      const n = parseInt(form.ex_par_paquet || '0')
                      if (!n) return '—'
                      return form.bijointage ? `${n} ex · bijointé` : `${n} ex`
                    })(),
                    sub: (() => {
                      const n = parseInt(form.ex_par_paquet || '0')
                      const max = physicalLimits?.maxPhysique
                      if (n && max && n > max) return `⚠ Dépasse le max physique (${max} ex)`
                      if (physicalLimits && n) {
                        const poidsG = Math.round(n * physicalLimits.poidsEx_kg * 10000) / 10
                        const hautCm = (n * physicalLimits.epaisseurEx_mm / 10).toFixed(1)
                        return `${poidsG} g · ${hautCm} cm${form.bijointage ? ' · bijointé' : ''}`
                      }
                      return selectedImprimeur ? `multiple ${selectedImprimeur.multiple_impose || 100}` : ''
                    })(),
                    ok: (() => {
                      const n = parseInt(form.ex_par_paquet || '0')
                      const max = physicalLimits?.maxPhysique
                      if (n && max && n > max) return false
                      return !!form.ex_par_paquet
                    })(),
                  },
                ].map((item, i) => (
                  <div key={i} className={`rounded-xl p-3 border ${
                    item.ok === false ? 'bg-amber-50 border-amber-200' :
                    item.ok === true  ? 'bg-white border-stone-200' :
                    'bg-stone-50 border-stone-200'
                  }`}>
                    <div className="text-xs text-stone-500 mb-1">{item.label}</div>
                    <div className="text-lg font-semibold text-stone-900">{item.value}</div>
                    {item.sub && <div className={`text-[11px] mt-0.5 ${item.ok === false ? 'text-amber-600' : 'text-stone-400'}`}>{item.sub}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Type de carton */}
            <div>
              <SectionTitle>Type de carton</SectionTitle>
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
                <CartonSelector
                  poidsExKg={computedPoidsFormule}
                  epaisseurExMm={physicalLimits?.epaisseurEx_mm ?? null}
                  exParPaquet={exPaquet}
                  value={form.carton_type_id || null}
                  exParCarton={exCarton || null}
                  onChange={(cartonTypeId, exParCartonCalc, puSnapshot) => {
                    const updates: Partial<FormData> = {
                      carton_type_id:     cartonTypeId ?? '',
                      pu_carton_snapshot: puSnapshot != null ? String(puSnapshot) : '',
                    }
                    // Rétro-calcul nb_paquets_carton depuis ex_par_carton calculé
                    if (exParCartonCalc != null && exPaquet > 0) {
                      const nbPaq = Math.round(exParCartonCalc / exPaquet)
                      if (nbPaq >= 1) updates.nb_paquets_carton = String(nbPaq)
                    }
                    setForm(prev => ({ ...prev, ...updates }))
                  }}
                />
              </div>
            </div>

            {/* Optimisation IA */}
            <div className="border border-brand-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-brand-50">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-brand-500" />
                  <span className="text-sm font-medium text-brand-700">Optimisation IA</span>
                  <span className="text-xs text-brand-400">— analyse le conditionnement selon vos contraintes</span>
                </div>
                <button onClick={handleAiOptimize} disabled={aiOptimizing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-500 text-white rounded-lg hover:opacity-85 disabled:opacity-40 transition-all">
                  {aiOptimizing
                    ? <><Loader2 size={12} className="animate-spin" /> Analyse…</>
                    : <><RefreshCw size={12} /> Analyser</>}
                </button>
              </div>

              {aiSuggestion && !aiSuggestion.error && (
                <div className="px-4 py-3 border-t border-brand-100 space-y-3">
                  {aiSuggestion.analyse && (
                    <p className="text-sm text-stone-700 leading-relaxed">{aiSuggestion.analyse}</p>
                  )}
                  {aiSuggestion.conditionnement && (
                    <div>
                      <div className="text-xs font-medium text-stone-500 mb-2">Valeurs suggérées</div>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(aiSuggestion.conditionnement).map(([k, v]: [string, any]) => (
                          <div key={k} className="bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                            <div className="text-[10px] text-brand-500">{k.replace(/_/g, ' ')}</div>
                            <div className="text-sm font-semibold text-brand-800">{v}</div>
                          </div>
                        ))}
                      </div>
                      <button onClick={applyAiSuggestion}
                        className="mt-3 flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-brand-500 text-white rounded-lg hover:opacity-85 transition-all">
                        <Check size={12} /> Appliquer ces valeurs
                      </button>
                    </div>
                  )}
                  {aiSuggestion.alertes?.length > 0 && (
                    <div className="space-y-1.5">
                      {aiSuggestion.alertes.map((a: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" /> {a}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {aiSuggestion?.error && (
                <div className="px-4 py-3 text-xs text-red-600 border-t border-red-100">{aiSuggestion.error}</div>
              )}
            </div>

            {/* Ajustement manuel */}
            <div>
              <SectionTitle>Ajustement manuel</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Ex / paquet" hint={form.ex_par_paquet_mode !== 'custom' ? "Défini étape 3 — modifiable" : "Saisie libre"} source={defaultSources.ex_par_paquet}>
                  <input type="number" value={form.ex_par_paquet} onChange={e => { set('ex_par_paquet', e.target.value); set('ex_par_paquet_mode', 'custom') }}
                    className={inputCls} placeholder="100" />
                </FieldGroup>

                {/* Paquets / carton → ex_par_carton calculé */}
                <FieldGroup
                  label="Paquets / carton"
                  hint={`→ ${exCarton} ex/carton${!cartonCoherent ? ' ⚠ incohérent' : ''}`}
                  source={defaultSources.nb_paquets_carton}>
                  <input type="number" min="1" value={form.nb_paquets_carton}
                    onChange={e => set('nb_paquets_carton', e.target.value)}
                    className={`${inputCls} ${!cartonCoherent ? 'border-amber-400' : ''}`}
                    placeholder="2" />
                  {/* Alerte si ex_par_carton < ex_par_paquet */}
                  {!cartonCoherent && (
                    <div className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                      <AlertTriangle size={11} />
                      {exCarton} ex/carton &lt; {exPaquet} ex/paquet — impossible (un carton doit contenir au moins 1 paquet entier)
                    </div>
                  )}
                  {cartonCoherent && (
                    <div className="mt-1 text-[11px] text-stone-400">
                      = {nbPaqCarton} × {exPaquet} ex = {exCarton} ex/carton
                      {computedPoids && ` · ${Math.round(exCarton * computedPoids * 1000) / 1000} kg/carton`}
                      {' '}— hors poids emballage carton
                    </div>
                  )}
                </FieldGroup>

                <FieldGroup label="Cartons / palette (max)" source={defaultSources.cartons_par_palette}>
                  <input type="number" value={form.cartons_par_palette} onChange={e => set('cartons_par_palette', e.target.value)}
                    className={inputCls} placeholder="48" />
                </FieldGroup>
                <FieldGroup label="Seuil PDV (ex)" hint="Au-delà → palette individuelle" source={defaultSources.seuil_pdv}>
                  <input type="number" value={form.seuil_pdv} onChange={e => set('seuil_pdv', e.target.value)}
                    className={inputCls} placeholder="2800" />
                </FieldGroup>

                {/* Override poids — saisi en GRAMMES */}
                <FieldGroup
                  label="Poids unitaire — override (g/ex)"
                  hint={computedPoidsFormule != null
                    ? `Formule active : ${computedPoidsG} g — laisser vide`
                    : "Saisir en grammes si pagination/grammage indisponibles"}
                  source={defaultSources.poids_unitaire_g}>
                  <input type="number" step="0.1" value={form.poids_unitaire_g}
                    onChange={e => set('poids_unitaire_g', e.target.value)}
                    className={inputCls}
                    placeholder={computedPoidsG != null ? `${computedPoidsG} g (formule)` : "ex: 14.7"} />
                </FieldGroup>
              </div>
            </div>

            {/* Type palette + notes */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <SectionTitle>Palette</SectionTitle>
                <FieldGroup label="Type de palette" hint="Standard = défini par le transporteur">
                  <select value={form.type_palette_id} onChange={e => set('type_palette_id', e.target.value)} className={selectCls}>
                    <option value="">Standard (défini par transporteur)</option>
                    {typesPalette.map(tp => (
                      <option key={tp.id} value={tp.id}>
                        {tp.nom} — {tp.cartons_max} crt, {tp.poids_max_kg} kg{tp.gerbable ? ' · gerbable' : ''}
                      </option>
                    ))}
                  </select>
                </FieldGroup>
              </div>
              <div>
                <SectionTitle>Notes</SectionTitle>
                <FieldGroup label="Remarques">
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                    className={`${inputCls} h-20 resize-none`} placeholder="Informations complémentaires..." />
                </FieldGroup>
              </div>
            </div>

          </div>
        )}

        {error && (
          <div className="mt-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-stone-200">
          <button
            onClick={() => step > 1 ? setStep((step - 1) as Step) : navigate('/operations')}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            <ArrowLeft size={14} />
            {step === 1 ? 'Annuler' : 'Précédent'}
          </button>

          {step < 4 ? (
            <button onClick={() => setStep((step + 1) as Step)} disabled={!canNext(step)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-stone-900 text-white rounded-lg hover:opacity-85 disabled:opacity-40 transition-all">
              Suivant <ArrowRight size={14} />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={saving || !form.code_operation.trim()}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-brand-500 text-white rounded-lg hover:opacity-85 disabled:opacity-40 transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Création...' : 'Créer l\'opération'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
