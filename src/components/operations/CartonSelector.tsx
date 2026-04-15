/**
 * CartonSelector.tsx
 * Sélecteur de type de carton pour NewOperation — Étape 4
 *
 * Logique :
 * - Charge ref_types_carton (actif = true)
 * - Pour chaque carton, calcule le nombre de paquets qui tiennent
 *   en hauteur intérieure et en poids max
 * - Affiche les cartons compatibles (vert), incompatibles (grisés)
 * - Remonte au parent : (carton_type_id, ex_par_carton_calculé, pu_ht_snapshot)
 */

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CheckCircle2, AlertTriangle, Package, ChevronDown, ChevronUp } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface CartonType {
  id: string
  reference: string
  nom: string
  descriptif: string
  longueur_ext_mm: number
  largeur_ext_mm: number
  hauteur_ext_mm: number
  epaisseur_paroi_mm: number
  hauteur_interieure_mm: number
  poids_max_kg: number | null
  type_cannelure: string | null
  usage_typique: string | null
  pu_ht_euros: number | null
  actif: boolean
}

interface CartonResult {
  carton: CartonType
  nb_paquets_max: number | null  // null si épaisseur inconnue
  ex_par_carton: number | null
  compatible: boolean
  raison_incompatible?: string
}

interface Props {
  poidsExKg: number | null
  epaisseurExMm: number | null
  exParPaquet: number
  exParCarton: number | null            // valeur courante (du form)
  value: string | null                 // carton_type_id sélectionné
  onChange: (
    cartonTypeId: string | null,
    exParCarton: number | null,
    puSnapshot: number | null,
  ) => void
}

// ── Helpers ───────────────────────────────────────────────────

function calcResult(
  carton: CartonType,
  poidsExKg: number | null,
  epaisseurExMm: number | null,
  exParPaquet: number,
): CartonResult {
  // Hauteur d'un paquet en mm
  const hauteurPaquet = epaisseurExMm != null ? epaisseurExMm * exParPaquet : null

  // Nombre de paquets qui tiennent en hauteur
  const nb_paquets_max = hauteurPaquet && hauteurPaquet > 0
    ? Math.floor(carton.hauteur_interieure_mm / hauteurPaquet)
    : null

  const ex_par_carton = nb_paquets_max != null && nb_paquets_max > 0
    ? nb_paquets_max * exParPaquet
    : null

  // Compatibilité poids
  const poidsTotalKg = (ex_par_carton != null && poidsExKg != null)
    ? ex_par_carton * poidsExKg
    : null

  const depassePoids = (
    poidsTotalKg != null &&
    carton.poids_max_kg != null &&
    poidsTotalKg > carton.poids_max_kg
  )

  const aucunPaquet = nb_paquets_max != null && nb_paquets_max < 1

  if (aucunPaquet) {
    return {
      carton, nb_paquets_max: 0, ex_par_carton: null,
      compatible: false,
      raison_incompatible: `Hauteur intérieure insuffisante (${carton.hauteur_interieure_mm} mm < ${Math.ceil(hauteurPaquet ?? 0)} mm/paquet)`,
    }
  }

  if (depassePoids) {
    return {
      carton, nb_paquets_max, ex_par_carton,
      compatible: false,
      raison_incompatible: `Poids dépassé (${poidsTotalKg?.toFixed(1)} kg > max ${carton.poids_max_kg} kg)`,
    }
  }

  return { carton, nb_paquets_max, ex_par_carton, compatible: true }
}

// ── Composant ─────────────────────────────────────────────────

export function CartonSelector({
  poidsExKg,
  epaisseurExMm,
  exParPaquet,
  exParCarton,
  value,
  onChange,
}: Props) {
  const [cartons, setCartons]         = useState<CartonType[]>([])
  const [loading, setLoading]         = useState(true)
  const [showAll, setShowAll]         = useState(false)

  useEffect(() => {
    supabase
      .from('ref_types_carton')
      .select('*')
      .eq('actif', true)
      .order('hauteur_ext_mm')
      .then(({ data }) => {
        setCartons((data as CartonType[]) ?? [])
        setLoading(false)
      })
  }, [])

  const results: CartonResult[] = cartons.map(c =>
    calcResult(c, poidsExKg, epaisseurExMm, exParPaquet)
  )

  const compatibles   = results.filter(r => r.compatible)
  const incompatibles = results.filter(r => !r.compatible)
  const displayed     = showAll ? results : compatibles

  const selectedResult = results.find(r => r.carton.id === value)

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-stone-400 py-3">
        <span className="animate-pulse">Chargement des cartons...</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">

      {/* Info contexte */}
      {(poidsExKg == null || epaisseurExMm == null) && (
        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            {poidsExKg == null && epaisseurExMm == null
              ? 'Renseignez le grammage, la pagination et le format pour affiner la sélection.'
              : poidsExKg == null
              ? 'Poids unitaire non calculé — la limite de poids ne peut pas être vérifiée.'
              : 'Épaisseur non calculée — la hauteur de carton ne peut pas être vérifiée.'
            }
          </span>
        </div>
      )}

      {/* Liste cartons */}
      {displayed.length === 0 ? (
        <div className="text-xs text-stone-400 py-2">
          Aucun carton compatible avec ces paramètres.{' '}
          <button onClick={() => setShowAll(true)} className="underline text-brand-500">
            Voir tous les cartons
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayed.map(({ carton, nb_paquets_max, ex_par_carton: exCalc, compatible, raison_incompatible }) => {
            const selected = value === carton.id
            return (
              <button
                key={carton.id}
                type="button"
                onClick={() => {
                  if (selected) {
                    onChange(null, null, null)
                  } else {
                    onChange(carton.id, exCalc, carton.pu_ht_euros ?? null)
                  }
                }}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all
                  ${selected
                    ? 'border-brand-400 bg-brand-50 shadow-sm'
                    : compatible
                    ? 'border-stone-200 hover:border-stone-300 bg-white'
                    : 'border-stone-100 bg-stone-50 opacity-60 cursor-not-allowed'
                  }`}
                disabled={!compatible && !selected}
              >
                <div className="flex items-start gap-2.5">
                  {/* Icône */}
                  <div className={`flex-shrink-0 mt-0.5 ${selected ? 'text-brand-500' : compatible ? 'text-stone-300' : 'text-stone-200'}`}>
                    {selected
                      ? <CheckCircle2 size={15} />
                      : <Package size={15} />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Nom + référence */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium ${selected ? 'text-brand-700' : 'text-stone-700'}`}>
                        {carton.nom}
                      </span>
                      <span className="text-xs text-stone-400 font-mono">{carton.reference}</span>
                      {carton.pu_ht_euros != null && (
                        <span className="text-xs text-stone-400">{carton.pu_ht_euros.toFixed(2)} €</span>
                      )}
                    </div>

                    {/* Capacité calculée */}
                    {compatible && nb_paquets_max != null && (
                      <div className="text-xs text-stone-500 mt-0.5">
                        {nb_paquets_max} paquet{nb_paquets_max > 1 ? 's' : ''} × {exParPaquet} ex
                        {' '}= <span className="font-medium text-stone-700">{exCalc} ex/carton</span>
                        {poidsExKg && exCalc
                          ? <span className="text-stone-400"> — {(poidsExKg * exCalc).toFixed(1)} kg</span>
                          : null
                        }
                      </div>
                    )}

                    {/* Raison incompatibilité */}
                    {!compatible && raison_incompatible && (
                      <div className="text-xs text-red-400 mt-0.5">{raison_incompatible}</div>
                    )}

                    {/* Usage typique */}
                    {carton.usage_typique && (
                      <div className="text-xs text-stone-400 mt-0.5 truncate">{carton.usage_typique}</div>
                    )}
                  </div>

                  {/* Dimensions */}
                  <div className="text-xs text-stone-400 flex-shrink-0 text-right">
                    <div>{carton.longueur_ext_mm}×{carton.largeur_ext_mm}×{carton.hauteur_ext_mm}</div>
                    <div>int. {carton.hauteur_interieure_mm} mm</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Toggle afficher incompatibles */}
      {incompatibles.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 mt-1"
        >
          {showAll
            ? <><ChevronUp size={12} /> Masquer les cartons incompatibles ({incompatibles.length})</>
            : <><ChevronDown size={12} /> Voir aussi les cartons incompatibles ({incompatibles.length})</>
          }
        </button>
      )}

      {/* Résumé sélection */}
      {selectedResult && (
        <div className="mt-2 text-xs bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 text-brand-700 space-y-0.5">
          <div className="font-medium">{selectedResult.carton.nom} sélectionné</div>
          {selectedResult.ex_par_carton != null && (
            <div>{selectedResult.ex_par_carton} ex/carton — {selectedResult.nb_paquets_max} paquet{(selectedResult.nb_paquets_max ?? 0) > 1 ? 's' : ''}</div>
          )}
          {selectedResult.carton.pu_ht_euros != null && (
            <div>{selectedResult.carton.pu_ht_euros.toFixed(2)} € HT/carton</div>
          )}
        </div>
      )}
    </div>
  )
}
