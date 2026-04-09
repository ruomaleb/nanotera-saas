/**
 * AdminLayout.tsx
 * Shell de la section admin avec sous-navigation.
 */

import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, Globe, Building2, Printer, FileText } from 'lucide-react'

interface AdminLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
}

const ADMIN_NAV = [
  { to: '/admin',            label: 'Vue d\'ensemble', icon: Globe,     end: true },
  { to: '/admin/global',     label: 'Règles globales', icon: Shield },
  { to: '/admin/enseignes',  label: 'Par enseigne',    icon: Building2 },
  { to: '/admin/imprimeurs', label: 'Par imprimeur',   icon: Printer },
  { to: '/admin/prompts',    label: 'Prompts IA',      icon: FileText },
]

export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen" style={{ background: '#F5F4F1' }}>

      {/* Topbar admin */}
      <div className="bg-white border-b px-5 py-3 flex items-center justify-between"
        style={{ borderColor: '#E8E6E0' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/operations')}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors">
            <ArrowLeft size={14} /> Retour
          </button>
          <div className="w-px h-4 bg-stone-200" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: '#6B52C8' }}>
              <Shield size={12} style={{ color: '#fff' }} />
            </div>
            <span className="text-sm font-medium text-stone-800">Administration</span>
          </div>
        </div>
        <span className="text-xs text-stone-400 bg-stone-100 px-2.5 py-1 rounded-full">
          Accès restreint — Administrateur
        </span>
      </div>

      <div className="flex">

        {/* Sidebar admin */}
        <aside className="w-52 flex-shrink-0 min-h-screen bg-white border-r"
          style={{ borderColor: '#E8E6E0' }}>
          <nav className="py-3">
            <div className="px-4 py-1 text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-1">
              Paramétrage
            </div>
            {ADMIN_NAV.map(item => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-4 py-1.5 text-sm transition-all border-l-2 ${
                      isActive
                        ? 'text-brand-500 bg-brand-50 border-brand-500 font-medium'
                        : 'text-stone-500 border-transparent hover:bg-stone-50 hover:text-stone-800'
                    }`
                  }
                >
                  <Icon size={14} className="flex-shrink-0" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </aside>

        {/* Contenu */}
        <main className="flex-1 p-6">
          {(title || subtitle) && (
            <div className="mb-6">
              {title && <h1 className="text-base font-medium text-stone-900">{title}</h1>}
              {subtitle && <p className="text-sm text-stone-400 mt-0.5">{subtitle}</p>}
            </div>
          )}
          {children}
        </main>

      </div>
    </div>
  )
}
