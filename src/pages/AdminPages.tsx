/**
 * AdminPages.tsx
 * Exporte les 4 sous-pages admin :
 * - AdminGlobal
 * - AdminEnseignes
 * - AdminImprimeurs
 * - AdminPrompts
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import AdminLayout from '../components/AdminLayout'
import RegleEditor from '../components/RegleEditor'
import { Building2, Printer, ChevronRight, ArrowLeft } from 'lucide-react'

// ── RÈGLES GLOBALES ──────────────────────────────────────────

export function AdminGlobal() {
  return (
    <AdminLayout title="Règles globales" subtitle="S'appliquent à toutes les opérations, tous clients confondus">
      <RegleEditor niveau="global" />
    </AdminLayout>
  )
}

// ── RÈGLES PAR ENSEIGNE ──────────────────────────────────────

interface Entity { id: string; nom: string }

export function AdminEnseignes() {
  const [enseignes, setEnseignes]     = useState<Entity[]>([])
  const [selected, setSelected]       = useState<Entity | null>(null)

  useEffect(() => {
    api('/api/admin/regles/summary').then((s: any) => setEnseignes(s.enseignes || [])).catch(() => {})
  }, [])

  if (selected) return (
    <AdminLayout
      title={`Règles — ${selected.nom}`}
      subtitle="Règles spécifiques à cette enseigne, s'ajoutent aux règles globales"
    >
      <button
        onClick={() => setSelected(null)}
        className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 mb-4 transition-colors"
      >
        <ArrowLeft size={13} /> Toutes les enseignes
      </button>
      <RegleEditor niveau="enseigne" refId={selected.id} refLabel={selected.nom} />
    </AdminLayout>
  )

  return (
    <AdminLayout title="Règles par enseigne" subtitle="Paramètres spécifiques à chaque client">
      <div className="space-y-2">
        {enseignes.length === 0 && (
          <div className="text-center py-10 text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl">
            Aucune enseigne trouvée dans le référentiel.
          </div>
        )}
        {enseignes.map(e => (
          <button key={e.id} onClick={() => setSelected(e)}
            className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-teal-300 hover:bg-teal-50/20 transition-all text-left group">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={14} className="text-teal-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-stone-800">{e.nom}</div>
              <div className="text-xs text-stone-400 mt-0.5">Cliquer pour gérer les règles</div>
            </div>
            <ChevronRight size={13} className="text-stone-300 group-hover:text-teal-400 transition-colors" />
          </button>
        ))}
      </div>
    </AdminLayout>
  )
}

// ── RÈGLES PAR IMPRIMEUR ─────────────────────────────────────

export function AdminImprimeurs() {
  const [imprimeurs, setImprimeurs]   = useState<Entity[]>([])
  const [selected, setSelected]       = useState<Entity | null>(null)

  useEffect(() => {
    api('/api/admin/regles/summary').then((s: any) => setImprimeurs(s.imprimeurs || [])).catch(() => {})
  }, [])

  if (selected) return (
    <AdminLayout
      title={`Règles — ${selected.nom}`}
      subtitle="Contraintes spécifiques à cet imprimeur, s'ajoutent aux règles globales"
    >
      <button
        onClick={() => setSelected(null)}
        className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 mb-4 transition-colors"
      >
        <ArrowLeft size={13} /> Tous les imprimeurs
      </button>
      <RegleEditor niveau="imprimeur" refId={selected.id} refLabel={selected.nom} />
    </AdminLayout>
  )

  return (
    <AdminLayout title="Règles par imprimeur" subtitle="Contraintes et paramètres propres à chaque fournisseur d'impression">
      <div className="space-y-2">
        {imprimeurs.length === 0 && (
          <div className="text-center py-10 text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl">
            Aucun imprimeur trouvé dans le référentiel.
          </div>
        )}
        {imprimeurs.map(imp => (
          <button key={imp.id} onClick={() => setSelected(imp)}
            className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50/20 transition-all text-left group">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Printer size={14} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-stone-800">{imp.nom}</div>
              <div className="text-xs text-stone-400 mt-0.5">Cliquer pour gérer les règles</div>
            </div>
            <ChevronRight size={13} className="text-stone-300 group-hover:text-amber-400 transition-colors" />
          </button>
        ))}
      </div>
    </AdminLayout>
  )
}

// ── PROMPTS IA ───────────────────────────────────────────────

const PROMPT_CATS = [
  { key: 'contraintes_palettisation', label: 'Contraintes palettisation', desc: 'Injectées dans tous les prompts IA liés aux palettes' },
  { key: 'prompt_analyse',            label: 'Prompt — Analyse',          desc: 'Fragment ajouté à l\'analyse post-import' },
  { key: 'prompt_palettes',           label: 'Prompt — Palettes',         desc: 'Fragment ajouté à l\'optimisation des palettes' },
  { key: 'prompt_params',             label: 'Prompt — Paramètres',       desc: 'Fragment ajouté aux recommandations de conditionnement' },
]

export function AdminPrompts() {
  const [selected, setSelected] = useState<string | null>(null)

  if (selected) {
    const cat = PROMPT_CATS.find(c => c.key === selected)!
    return (
      <AdminLayout title={cat.label} subtitle={cat.desc}>
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 mb-4 transition-colors"
        >
          <ArrowLeft size={13} /> Tous les prompts
        </button>
        <RegleEditor niveau="global" filterCategorie={selected} />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Prompts IA" subtitle="Fragments de texte injectés dans les appels IA au moment de l'exécution">
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
          <p className="text-xs text-stone-500">
            Chaque règle activée est concaténée et injectée dans le prompt correspondant, dans l'ordre de priorité (plus haute en premier). Les règles d'enseigne et d'imprimeur s'ajoutent aux règles globales.
          </p>
        </div>
        <div className="divide-y divide-stone-100">
          {PROMPT_CATS.map(cat => (
            <button key={cat.key} onClick={() => setSelected(cat.key)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors text-left group">
              <div className="flex-1">
                <div className="text-sm font-medium text-stone-800">{cat.label}</div>
                <div className="text-xs text-stone-400 mt-0.5">{cat.desc}</div>
              </div>
              <ChevronRight size={13} className="text-stone-300 group-hover:text-brand-400 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
