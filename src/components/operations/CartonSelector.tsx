// src/components/operations/CartonSelector.tsx
//
// Sélecteur de type de carton pour l'étape 4 "Logistique" de NewOperation.
//
// Props reçues du parent (NewOperation, étape 3/4) :
//   poidsExKg      — poids unitaire calculé (computedPoidsFormule, en kg)
//   epaisseurExMm  — épaisseur unitaire calculée (physicalLimits.epaisseurEx_mm, en mm)
//   exParPaquet    — exemplaires par paquet (état étape 3)
//   value          — carton_type_id sélectionné (state du parent)
//   exParCarton    — valeur actuelle ex_par_carton (state du parent)
//   onChange       — callback (cartonTypeId, exParCarton, puSnapshot) => void

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CartonType {
  id: string
  reference: string | null
  nom: string
  descriptif: string | null
  longueur_ext_mm: number
  largeur_ext_mm: number
  hauteur_ext_mm: number
  epaisseur_paroi_mm: number
  hauteur_interieure_mm: number   // colonne générée Postgres
  poids_max_kg: number | null
  type_cannelure: string | null
  pu_ht_euros: number | null
  usage_typique: string | null
}

interface CalcResult {
  maxParPoids: number | null      // null si poids_max_kg inconnu
  maxParHauteur: number | null    // null si epaisseurExMm = 0
  exMaxPhysique: number | null
  exParCartonCalc: number | null  // arrondi au multiple de exParPaquet
  facteurLimitant: 'poids' | 'hauteur' | 'inconnu' | null
}

interface CartonSelectorProps {
  poidsExKg: number | null
  epaisseurExMm: number | null
  exParPaquet: number
  value: string | null            // carton_type_id
  exParCarton: number | null      // valeur affichée dans le champ
  onChange: (
    cartonTypeId: string | null,
    exParCarton: number | null,
    puSnapshot: number | null
  ) => void
}

// ─── Formule de calcul ────────────────────────────────────────────────────────

function calculerExParCarton(
  carton: CartonType,
  poidsExKg: number | null,
  epaisseurExMm: number | null,
  exParPaquet: number
): CalcResult {
  let maxParPoids: number | null = null
  let maxParHauteur: number | null = null

  if (carton.poids_max_kg != null && poidsExKg != null && poidsExKg > 0) {
    maxParPoids = Math.floor(carton.poids_max_kg / poidsExKg)
  }

  if (carton.hauteur_interieure_mm != null && epaisseurExMm != null && epaisseurExMm > 0) {
    maxParHauteur = Math.floor(carton.hauteur_interieure_mm / epaisseurExMm)
  }

  if (maxParPoids == null && maxParHauteur == null) {
    return { maxParPoids, maxParHauteur, exMaxPhysique: null, exParCartonCalc: null, facteurLimitant: 'inconnu' }
  }

  const candidates = [maxParPoids, maxParHauteur].filter((v): v is number => v !== null)
  const exMaxPhysique = Math.min(...candidates)

  const facteurLimitant: CalcResult['facteurLimitant'] =
    maxParPoids != null && maxParHauteur != null
      ? maxParPoids <= maxParHauteur ? 'poids' : 'hauteur'
      : maxParPoids == null ? 'hauteur' : 'poids'

  // Arrondi au multiple inférieur de exParPaquet (carton = N paquets entiers)
  const exParCartonCalc = exParPaquet > 0
    ? Math.floor(exMaxPhysique / exParPaquet) * exParPaquet
    : exMaxPhysique

  return { maxParPoids, maxParHauteur, exMaxPhysique, exParCartonCalc, facteurLimitant }
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function CartonSelector({
  poidsExKg,
  epaisseurExMm,
  exParPaquet,
  value,
  exParCarton,
  onChange,
}: CartonSelectorProps) {
  const [cartons, setCartons] = useState<CartonType[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [calc, setCalc] = useState<CalcResult | null>(null)
  const [overrideManuel, setOverrideManuel] = useState(false)

  // ── Chargement du référentiel ──
  useEffect(() => {
    const charger = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('v_types_carton_specs')
        .select('*')

      if (error) {
        setErreur('Impossible de charger les types de cartons.')
        console.error('[CartonSelector]', error)
      } else {
        setCartons(data as CartonType[])
      }
      setLoading(false)
    }
    charger()
  }, [])

  // ── Recalcul à chaque changement de carton ou de specs document ──
  useEffect(() => {
    if (!value) { setCalc(null); return }
    const carton = cartons.find(c => c.id === value)
    if (!carton) { setCalc(null); return }

    const result = calculerExParCarton(carton, poidsExKg, epaisseurExMm, exParPaquet)
    setCalc(result)

    // On ne pré-remplit que si l'utilisateur n'a pas fait d'override manuel
    if (!overrideManuel && result.exParCartonCalc != null) {
      onChange(value, result.exParCartonCalc, carton.pu_ht_euros ?? null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cartons, poidsExKg, epaisseurExMm, exParPaquet])

  // ── Sélection d'un carton ──
  const handleSelectCarton = (id: string) => {
    setOverrideManuel(false)
    const carton = cartons.find(c => c.id === id) ?? null
    if (!carton) {
      onChange(null, null, null)
      return
    }
    const result = calculerExParCarton(carton, poidsExKg, epaisseurExMm, exParPaquet)
    setCalc(result)
    onChange(id, result.exParCartonCalc ?? null, carton.pu_ht_euros ?? null)
  }

  // ── Override manuel de ex_par_carton ──
  const handleExParCartonChange = (v: string) => {
    const parsed = parseInt(v, 10)
    setOverrideManuel(true)
    onChange(value, isNaN(parsed) ? null : parsed, cartonSelectionne?.pu_ht_euros ?? null)
  }

  const cartonSelectionne = cartons.find(c => c.id === value) ?? null

  // ── Badge facteur limitant ──
  const BadgeLimitant = () => {
    if (!calc?.facteurLimitant || calc.facteurLimitant === 'inconnu') return null
    const label = calc.facteurLimitant === 'poids' ? 'limité par le poids' : 'limité par la hauteur'
    const classes = calc.facteurLimitant === 'poids'
      ? 'bg-amber-50 text-amber-700 border border-amber-200'
      : 'bg-blue-50 text-blue-700 border border-blue-200'
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classes}`}>
        {label}
      </span>
    )
  }

  // ── Rendu ──
  if (loading) {
    return (
      <div className="text-sm text-muted-foreground animate-pulse">
        Chargement des types de cartons…
      </div>
    )
  }

  if (erreur) {
    return <p className="text-sm text-destructive">{erreur}</p>
  }

  return (
    <div className="space-y-4">

      {/* Sélecteur principal */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Type de carton
        </label>
        <select
          value={value ?? ''}
          onChange={e => handleSelectCarton(e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1
                     disabled:opacity-50"
        >
          <option value="">— Sélectionner un type de carton —</option>
          {cartons.map(c => (
            <option key={c.id} value={c.id}>
              {c.nom}
              {c.reference ? ` (réf. ${c.reference})` : ''}
              {c.pu_ht_euros != null ? ` — ${c.pu_ht_euros.toFixed(2)} € HT` : ''}
            </option>
          ))}
        </select>

        {/* Description du carton sélectionné */}
        {cartonSelectionne?.usage_typique && (
          <p className="text-xs text-muted-foreground mt-1">
            {cartonSelectionne.usage_typique}
          </p>
        )}
      </div>

      {/* Dimensions du carton sélectionné */}
      {cartonSelectionne && (
        <div className="rounded-md border border-border bg-muted/30 p-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Hauteur intérieure</div>
            <div className="text-sm font-medium">
              {cartonSelectionne.hauteur_interieure_mm.toFixed(0)} mm
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Résistance max</div>
            <div className="text-sm font-medium">
              {cartonSelectionne.poids_max_kg != null
                ? `${cartonSelectionne.poids_max_kg} kg`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Cannelure</div>
            <div className="text-sm font-medium capitalize">
              {cartonSelectionne.type_cannelure ?? '—'}
            </div>
          </div>
        </div>
      )}

      {/* Résultat du calcul */}
      {calc && cartonSelectionne && (
        <div className="rounded-md border border-border bg-background p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Capacité physique :</span>
            {calc.exParCartonCalc != null ? (
              <span className="text-sm font-semibold text-foreground">
                {calc.exParCartonCalc} ex max
              </span>
            ) : (
              <span className="text-sm text-muted-foreground italic">
                indéterminé (specs document manquantes)
              </span>
            )}
            <BadgeLimitant />
          </div>

          {/* Détail des deux contraintes */}
          {(calc.maxParPoids != null || calc.maxParHauteur != null) && (
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                Contrainte poids :{' '}
                <span className="font-medium text-foreground">
                  {calc.maxParPoids != null ? `${calc.maxParPoids} ex` : 'n/a'}
                </span>
                {poidsExKg != null && cartonSelectionne.poids_max_kg != null && (
                  <span className="ml-1">
                    ({cartonSelectionne.poids_max_kg} kg ÷ {poidsExKg.toFixed(4)} kg/ex)
                  </span>
                )}
              </div>
              <div>
                Contrainte hauteur :{' '}
                <span className="font-medium text-foreground">
                  {calc.maxParHauteur != null ? `${calc.maxParHauteur} ex` : 'n/a'}
                </span>
                {epaisseurExMm != null && (
                  <span className="ml-1">
                    ({cartonSelectionne.hauteur_interieure_mm.toFixed(0)} mm ÷ {epaisseurExMm.toFixed(2)} mm/ex)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Champ ex_par_carton — pré-rempli, modifiable manuellement */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Exemplaires par carton
          </label>
          {overrideManuel && (
            <button
              type="button"
              onClick={() => {
                setOverrideManuel(false)
                if (calc?.exParCartonCalc != null) {
                  onChange(value, calc.exParCartonCalc, cartonSelectionne?.pu_ht_euros ?? null)
                }
              }}
              className="text-xs text-primary underline underline-offset-2 hover:no-underline"
            >
              Réinitialiser au calcul
            </button>
          )}
        </div>
        <input
          type="number"
          min={1}
          step={exParPaquet > 0 ? exParPaquet : 1}
          value={exParCarton ?? ''}
          onChange={e => handleExParCartonChange(e.target.value)}
          placeholder="ex : 200"
          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
        />
        <p className="text-xs text-muted-foreground">
          Doit être un multiple de {exParPaquet} ex/paquet.
          {exParCarton != null && exParPaquet > 0 && exParCarton % exParPaquet !== 0 && (
            <span className="ml-1 text-destructive font-medium">
              ⚠ {exParCarton} n'est pas un multiple de {exParPaquet}.
            </span>
          )}
        </p>
      </div>

      {/* Indicateur de coût carton (si prix connu) */}
      {cartonSelectionne?.pu_ht_euros != null && (
        <p className="text-xs text-muted-foreground">
          Prix unitaire carton : <span className="font-medium text-foreground">
            {cartonSelectionne.pu_ht_euros.toFixed(2)} € HT
          </span>
          {' '}— le coût total sera calculé après le bin-packing.
        </p>
      )}

    </div>
  )
}
