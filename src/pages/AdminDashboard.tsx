/**
 * AdminDashboard.tsx — Vue d'ensemble administration
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import AdminLayout from '../components/AdminLayout'
import { Globe, Building2, Printer, Shield, ChevronRight, AlertTriangle } from 'lucide-react'

interface Summary {
  total: number
  actives: number
  par_niveau: { global: number; enseigne: number; imprimeur: number }
  enseignes: { id: string; nom: string }[]
  imprimeurs: { id: string; nom: string }[]
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    api('/api/admin/regles/summary').then(setSummary).catch(() => {})
  }, [])

  return (
    <AdminLayout title="Administration" subtitle="Paramétrage du savoir-faire et des règles métier">

      {/* Avertissement */}
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
        <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Zone d'administration</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Les modifications apportées ici affectent le comportement de tous les outils IA de la plateforme.
            Toute règle activée est injectée immédiatement dans les prochains appels.
          </p>
        </div>
      </div>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Règles globales',    value: summary.par_niveau.global,    icon: Globe,     color: '#6B52C8' },
            { label: 'Règles enseigne',    value: summary.par_niveau.enseigne,  icon: Building2, color: '#0F6E56' },
            { label: 'Règles imprimeur',   value: summary.par_niveau.imprimeur, icon: Printer,   color: '#854F0B' },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${s.color}18` }}>
                  <Icon size={15} style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-xl font-medium text-stone-900">{s.value}</div>
                  <div className="text-xs text-stone-400">{s.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Navigation rapide */}
      <div className="space-y-2">

        <button onClick={() => navigate('/admin/global')}
          className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3.5 flex items-center gap-3 hover:border-brand-300 hover:bg-brand-50/30 transition-all text-left group">
          <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Globe size={16} className="text-brand-500" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-stone-800">Règles globales</div>
            <div className="text-xs text-stone-400 mt-0.5">
              Contraintes et prompts qui s'appliquent à toutes les opérations, tous clients confondus
            </div>
          </div>
          <ChevronRight size={14} className="text-stone-300 group-hover:text-brand-400 transition-colors" />
        </button>

        <button onClick={() => navigate('/admin/enseignes')}
          className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3.5 flex items-center gap-3 hover:border-teal-300 hover:bg-teal-50/30 transition-all text-left group">
          <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={16} className="text-teal-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-stone-800">Par enseigne</div>
            <div className="text-xs text-stone-400 mt-0.5">
              Règles spécifiques à chaque client : Galec/E.Leclerc, Carrefour, Intermarché…
              {summary && ` (${summary.enseignes.length} enseigne${summary.enseignes.length > 1 ? 's' : ''})`}
            </div>
          </div>
          <ChevronRight size={14} className="text-stone-300 group-hover:text-teal-400 transition-colors" />
        </button>

        <button onClick={() => navigate('/admin/imprimeurs')}
          className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3.5 flex items-center gap-3 hover:border-amber-300 hover:bg-amber-50/30 transition-all text-left group">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Printer size={16} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-stone-800">Par imprimeur</div>
            <div className="text-xs text-stone-400 mt-0.5">
              Contraintes liées à chaque fournisseur : Stark Druck, APPL Druck, CPI…
              {summary && ` (${summary.imprimeurs.length} imprimeur${summary.imprimeurs.length > 1 ? 's' : ''})`}
            </div>
          </div>
          <ChevronRight size={14} className="text-stone-300 group-hover:text-amber-400 transition-colors" />
        </button>

        <button onClick={() => navigate('/admin/prompts')}
          className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3.5 flex items-center gap-3 hover:border-purple-300 hover:bg-purple-50/30 transition-all text-left group">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-stone-800">Prompts IA</div>
            <div className="text-xs text-stone-400 mt-0.5">
              Fragments injectés dans les prompts d'analyse, de palettisation et de paramétrage
            </div>
          </div>
          <ChevronRight size={14} className="text-stone-300 group-hover:text-purple-400 transition-colors" />
        </button>

      </div>
    </AdminLayout>
  )
}
