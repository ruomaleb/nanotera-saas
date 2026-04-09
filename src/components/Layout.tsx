import { useState, createContext, useContext, ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import AIChat from './AIChat'
import {
  Building2, Package, CalendarRange, FileText,
  Upload, Search, BoxesIcon, FileOutput,
  Settings, BotMessageSquare, LogOut
} from 'lucide-react'

interface EditorState {
  open: boolean
  title: string
  content: ReactNode | null
}

interface LayoutContextType {
  openEditor: (title: string, content: ReactNode) => void
  closeEditor: () => void
}

export const LayoutContext = createContext<LayoutContextType>({
  openEditor: () => {},
  closeEditor: () => {},
})

export function useEditor() {
  return useContext(LayoutContext)
}

const NAV_ITEMS = [
  { group: 'Referentiel', items: [
    { path: '/enseignes', label: 'Enseignes', icon: Building2 },
    { path: '/supports', label: 'Supports & condit.', icon: Package },
    { path: '/operations', label: 'Operations', icon: CalendarRange },
    { path: '/modeles', label: 'Modeles documents', icon: FileText },
  ]},
  { group: 'Operation en cours', items: [
    { path: '/import', label: 'Import repartition', icon: Upload },
    { path: '/analyse', label: 'Analyse donnees', icon: Search },
    { path: '/palettisation', label: 'Palettisation', icon: BoxesIcon },
    { path: '/livrables', label: 'Livrables', icon: FileOutput },
  ]},
]

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [aiOpen, setAiOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>({ open: false, title: '', content: null })
  const { org } = useOrg()

  const openEditor = (title: string, content: ReactNode) => {
    setEditor({ open: true, title, content })
  }
  const closeEditor = () => {
    setEditor({ open: false, title: '', content: null })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <LayoutContext.Provider value={{ openEditor, closeEditor }}>
      <div className="h-screen flex overflow-hidden bg-white">
        {/* Colonne 1 — Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-gray-200">
            <div className="font-semibold text-base text-gray-900 tracking-tight">{org?.org_nom ?? 'Nanotera'}</div>
            <div className="text-xs text-gray-400">{org?.user_nom ?? 'Optimisation logistique'}</div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            {NAV_ITEMS.map(group => (
              <div key={group.group}>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 px-3 pt-3 pb-1">
                  {group.group}
                </div>
                {group.items.map(item => {
                  const Icon = item.icon
                  const active = location.pathname.startsWith(item.path)
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                        active
                          ? 'bg-white text-gray-900 font-medium shadow-sm'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                      }`}
                    >
                      <Icon size={15} />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className="p-2 border-t border-gray-200">
            <button
              onClick={() => setAiOpen(!aiOpen)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                aiOpen ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-indigo-500 hover:bg-indigo-50'
              }`}
            >
              <BotMessageSquare size={15} />
              Assistant IA
              {aiOpen && <span className="text-[10px] opacity-60 ml-auto">actif</span>}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <LogOut size={15} />
              Deconnexion
            </button>
          </div>
        </aside>

        {/* Colonne 2 — Contenu principal */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>

        {/* Colonne 3 — Panneau editeur (conditionnel) */}
        {editor.open && (
          <aside className="w-80 flex-shrink-0 border-l border-gray-200 flex flex-col overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="font-medium text-sm">{editor.title}</span>
              <button
                onClick={closeEditor}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded border border-gray-200"
              >
                Fermer
              </button>
            </div>
            <div className="flex-1 p-4">
              {editor.content}
            </div>
          </aside>
        )}

        {/* Panneau IA flottant */}
        {aiOpen && <AIChat onClose={() => setAiOpen(false)} />}
      </div>
    </LayoutContext.Provider>
  )
}
