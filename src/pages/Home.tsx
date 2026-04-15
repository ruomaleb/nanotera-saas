/**
 * Home.tsx
 * Page portail post-login — choix d'interface UX
 * - Salutation personnalisée (prénom depuis useOrg)
 * - 3 dernières opérations en accès rapide
 * - Carte SaaS (formulaires guidés) vs Carte Chainlit (chat IA)
 * - Lien admin conditionnel (owner/admin uniquement)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import {
  LayoutDashboard,
  MessageSquare,
  ArrowRight,
  Clock,
  CheckCircle2,
  Circle,
  ExternalLink,
  Shield,
  ChevronRight,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

interface RecentOperation {
  id: string
  code_operation: string
  nom_operation: string | null
  statut: string
  date_debut: string | null
  nb_palettes: number | null
  total_exemplaires: number | null
  ref_enseignes?: { nom: string } | null
}

// ── Helpers ───────────────────────────────────────────────────

function statutColor(s: string) {
  if (s === 'termine')   return 'text-emerald-600 bg-emerald-50'
  if (s === 'en_cours')  return 'text-amber-600  bg-amber-50'
  if (s === 'annule')    return 'text-red-500    bg-red-50'
  return 'text-stone-400 bg-stone-100'
}

function statutLabel(s: string) {
  if (s === 'termine')  return 'Terminée'
  if (s === 'en_cours') return 'En cours'
  if (s === 'annule')   return 'Annulée'
  return s
}

function prenom(nom: string) {
  return nom.split(' ')[0]
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

// ── Composant principal ───────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const { org, loading: orgLoading } = useOrg()
  const [operations, setOperations]   = useState<RecentOperation[]>([])
  const [loadingOps, setLoadingOps]   = useState(true)

  useEffect(() => {
    if (!org?.org_id) return
    supabase
      .from('ops_operations')
      .select('id, code_operation, nom_operation, statut, date_debut, nb_palettes, total_exemplaires, ref_enseignes(nom)')
      .eq('org_id', org.org_id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setOperations((data as RecentOperation[]) ?? [])
        setLoadingOps(false)
      })
  }, [org?.org_id])

  const isAdmin = org?.user_role === 'owner' || org?.user_role === 'admin'

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">

      {/* ── Salutation ── */}
      <div>
        {orgLoading ? (
          <div className="h-8 w-48 bg-stone-100 rounded animate-pulse" />
        ) : (
          <>
            <p className="text-sm text-stone-400 mb-1">
              {greeting()},
            </p>
            <h1 className="text-2xl font-medium text-stone-800 tracking-tight">
              {org?.user_nom ? prenom(org.user_nom) : 'bienvenue'} —{' '}
              <span className="text-stone-400 font-normal">par où commencer ?</span>
            </h1>
          </>
        )}
      </div>

      {/* ── Choix d'interface ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Carte SaaS */}
        <button
          onClick={() => navigate('/operations')}
          className="group text-left bg-white border border-stone-200 rounded-xl p-6
                     hover:border-brand-400 hover:shadow-sm transition-all duration-150"
        >
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4
                          group-hover:bg-brand-100 transition-colors">
            <LayoutDashboard size={18} className="text-brand-600" />
          </div>

          <p className="font-medium text-stone-800 text-sm mb-1">Interface guidée</p>
          <p className="text-xs text-stone-400 leading-relaxed mb-4">
            Formulaires structurés, étapes claires, dashboard opérations
          </p>

          <ul className="space-y-1.5 mb-5">
            {['Opérations récurrentes', 'Vue d\'ensemble et historique', 'Gestion des enseignes'].map(t => (
              <li key={t} className="flex items-center gap-2 text-xs text-stone-500">
                <Circle size={4} className="text-stone-300 flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>

          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600
                           group-hover:gap-2.5 transition-all">
            Ouvrir <ArrowRight size={12} />
          </span>
        </button>

        {/* Carte Chainlit */}
        <button
          type="button"
          onClick={() => navigate('/assistant')}
          className="group text-left bg-white border border-stone-200 rounded-xl p-6
                     hover:border-amber-300 hover:shadow-sm transition-all duration-150 block"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4
                          group-hover:bg-amber-100 transition-colors">
            <MessageSquare size={18} className="text-amber-600" />
          </div>

          <p className="font-medium text-stone-800 text-sm mb-1">Assistant conversationnel</p>
          <p className="text-xs text-stone-400 leading-relaxed mb-4">
            Chat IA, gestion des cas atypiques, flexibilité maximale
          </p>

          <ul className="space-y-1.5 mb-5">
            {['Formats de fichiers inconnus', 'Dialogue naturel avec l\'agent', 'Ajustements à la volée'].map(t => (
              <li key={t} className="flex items-center gap-2 text-xs text-stone-500">
                <Circle size={4} className="text-stone-300 flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>

          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600
                           group-hover:gap-2.5 transition-all">
            Ouvrir <ArrowRight size={12} />
          </span>
        </a>
      </div>

      {/* Note SSO (à retirer après Chantier 2) */}
      <p className="text-xs text-stone-300 text-center -mt-6">
        L'assistant s'ouvre dans la même fenêtre avec votre session active.
        L'assistant s'ouvre dans la même fenêtre avec votre session active.
      </p>

      {/* ── Opérations récentes ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-stone-600">Opérations récentes</h2>
          <button
            onClick={() => navigate('/operations')}
            className="text-xs text-stone-400 hover:text-brand-600 flex items-center gap-1 transition-colors"
          >
            Toutes les opérations <ChevronRight size={12} />
          </button>
        </div>

        {loadingOps || orgLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-stone-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : operations.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-stone-200 rounded-xl">
            <p className="text-sm text-stone-400">Aucune opération pour l'instant.</p>
            <button
              onClick={() => navigate('/operations/new')}
              className="mt-2 text-xs text-brand-600 hover:underline"
            >
              Créer la première opération →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {operations.map(op => (
              <button
                key={op.id}
                onClick={() => navigate(`/operations/${op.id}`)}
                className="w-full flex items-center gap-4 bg-white border border-stone-100
                           rounded-lg px-4 py-3 hover:border-stone-300 hover:bg-stone-50
                           transition-all text-left group"
              >
                {/* Icône statut */}
                <div className="flex-shrink-0">
                  {op.statut === 'termine'
                    ? <CheckCircle2 size={16} className="text-emerald-500" />
                    : <Clock size={16} className="text-amber-400" />
                  }
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-700 truncate">
                      {op.code_operation}
                    </span>
                    {op.nom_operation && (
                      <span className="text-xs text-stone-400 truncate hidden sm:block">
                        — {op.nom_operation}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {op.ref_enseignes?.nom && (
                      <span className="text-xs text-stone-400">{op.ref_enseignes.nom}</span>
                    )}
                    {op.total_exemplaires && (
                      <span className="text-xs text-stone-400">
                        {op.total_exemplaires.toLocaleString('fr-FR')} ex.
                      </span>
                    )}
                    {op.nb_palettes && (
                      <span className="text-xs text-stone-400">{op.nb_palettes} palettes</span>
                    )}
                  </div>
                </div>

                {/* Statut badge + flèche */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColor(op.statut)}`}>
                    {statutLabel(op.statut)}
                  </span>
                  <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lien admin ── */}
      {isAdmin && (
        <div className="border-t border-stone-100 pt-6">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            <Shield size={13} />
            Administration — règles métier, prompts IA, types de palettes
          </button>
        </div>
      )}

    </div>
  )
}
