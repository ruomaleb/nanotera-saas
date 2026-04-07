export interface Organization {
  id: string
  nom: string
  slug: string
  plan: 'starter' | 'pro' | 'enterprise'
  logo_url?: string
  settings: Record<string, unknown>
}

export interface Enseigne {
  id: string
  org_id: string
  nom: string
  code_court?: string
  format_fichier?: string
  mapping_colonnes?: Record<string, string>
  conditionnement_defaut?: {
    ex_paquet: number
    ex_carton: number
    cartons_palette: number
    seuil_pdv: number
  }
  poids_reel_moyen?: number
  actif: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export interface Centrale {
  id: string
  enseigne_id: string
  nom: string
  adresse?: string
  code_postal?: string
  ville?: string
  transporteur_id?: string
  contact_nom?: string
  contact_tel?: string
  notes?: string
  // Joined
  transporteur?: Transporteur
}

export interface Transporteur {
  id: string
  org_id: string
  nom: string
  type_vehicule?: string
  hauteur_utile_cm?: number
  poids_max_palette_kg?: number
}

export interface Imprimeur {
  id: string
  org_id: string
  nom: string
  type_machine?: string
  sortie_native?: string
  multiple_impose?: number
  bijointage: boolean
  bijointage_seuil_pages?: number
  ratio_poids_reel: number
}

export interface SupportType {
  id: string
  org_id: string
  sous_categorie_id: string
  nom: string
  pagination_min?: number
  pagination_max?: number
  grammage_min?: number
  grammage_max?: number
  formats_possibles?: string[]
  materiau?: string
  dimensions_cm?: string
  // Joined
  sous_categorie?: SupportSousCategorie
}

export interface SupportCategorie {
  id: string
  org_id: string
  nom: string
  description?: string
  ordre_affichage: number
  sous_categories?: SupportSousCategorie[]
}

export interface SupportSousCategorie {
  id: string
  categorie_id: string
  nom: string
  code: string
  description?: string
  ordre_affichage: number
}

export interface PackagingType {
  id: string
  org_id: string
  nom: string
  niveau: 1 | 2 | 3
  contenance_min?: number
  contenance_max?: number
  poids_max_kg?: number
  dimensions_cm?: string
}

export interface DocumentTemplate {
  id: string
  org_id: string
  nom: string
  type_fichier: 'docx' | 'xlsx' | 'pdf'
  usage: 'publipostage' | 'reference' | 'import_donnees' | 'export'
  storage_path?: string
  description?: string
  champs_fusion?: string[]
  // Joined
  enseignes?: Enseigne[]
}

export interface Operation {
  id: string
  org_id: string
  enseigne_id: string
  support_type_id?: string
  imprimeur_id?: string
  code_operation: string
  nom_operation?: string
  categorie: 'prospectus' | 'plv'
  sous_categorie?: string
  date_debut?: string
  date_fin?: string
  statut: 'planifie' | 'import' | 'analyse' | 'palettisation' | 'livrables' | 'termine' | 'annule'
  pagination?: number
  format_document?: string
  grammage?: number
  poids_unitaire_kg?: number
  ex_par_paquet?: number
  ex_par_carton?: number
  cartons_par_palette?: number
  seuil_pdv?: number
  nb_magasins?: number
  total_exemplaires?: number
  nb_centrales?: number
  nb_palettes?: number
  nb_palettes_grp?: number
  nb_palettes_pdv?: number
  poids_total_kg?: number
  nb_etiquettes?: number
  // Joined
  enseigne?: Enseigne
  support_type?: SupportType
  imprimeur?: Imprimeur
}

export interface Palette {
  id: string
  operation_id: string
  centrale_id?: string
  centrale_nom: string
  numero: number
  type_palette: 'groupee' | 'pdv'
  nb_cartons?: number
  nb_exemplaires: number
  poids_kg: number
  taux_remplissage?: number
  code_pdv?: string
  magasins: Array<{ code_pdv: string; nom?: string; ville?: string; quantite: number; nb_cartons?: number }>
  // Joined (from v_palette_context)
  transporteur_nom?: string
  transporteur_poids_max?: number
  enseigne_nom?: string
  code_operation?: string
  siblings_count?: number
  siblings_grp?: number
  siblings_pdv?: number
}

export interface AIAction {
  id: string
  entity_type: string
  action_id: string
  label: string
  prompt_template: string
  condition_expr?: string
  icon?: string
  ordre: number
}

export type EntityType =
  | 'palette_groupee' | 'palette_pdv' | 'centrale' | 'metrique'
  | 'support_type' | 'conditionnement' | 'magasin' | 'operation'
  | 'enseigne' | 'transporteur' | 'imprimeur' | 'template'

export interface PointableContext {
  entity_type: EntityType
  entity_id: string
  label: string
  data: Record<string, unknown>
  ancestors: Record<string, Record<string, unknown>>
  siblings?: { count: number; summary: string }
}

export type Section =
  | 'enseignes' | 'supports' | 'operations' | 'modeles'
  | 'import' | 'analyse' | 'palettisation' | 'livrables' | 'settings'
