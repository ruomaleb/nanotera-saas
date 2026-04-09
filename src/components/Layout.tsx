import { useState, createContext, useContext, ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import AIChat from './AIChat'
import {
  Building2, Package, CalendarRange, FileText,
  Upload, Search, BoxesIcon, FileOutput,
  BotMessageSquare, LogOut,
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
  { group: 'Référentiel', items: [
    { path: '/enseignes',   label: 'Enseignes',          icon: Building2 },
    { path: '/supports',    label: 'Supports & condit.',  icon: Package },
    { path: '/operations',  label: 'Opérations',          icon: CalendarRange },
    { path: '/modeles',     label: 'Modèles documents',   icon: FileText },
  ]},
  { group: 'Opération en cours', items: [
    { path: '/import',        label: 'Import répartition', icon: Upload },
    { path: '/analyse',       label: 'Analyse données',    icon: Search },
    { path: '/palettisation', label: 'Palettisation',       icon: BoxesIcon },
    { path: '/livrables',     label: 'Livrables',           icon: FileOutput },
  ]},
]

export default function Layout({ children }: { children: ReactNode }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [aiOpen, setAiOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>({ open: false, title: '', content: null })
  const { org } = useOrg()

  const openEditor  = (title: string, content: ReactNode) => setEditor({ open: true, title, content })
  const closeEditor = () => setEditor({ open: false, title: '', content: null })

  const handleLogout = async () => { await supabase.auth.signOut() }

  return (
    <LayoutContext.Provider value={{ openEditor, closeEditor }}>
      <div className="h-screen flex overflow-hidden" style={{ background: '#F5F4F1' }}>

        {/* ── Sidebar ── */}
        <aside className="flex-shrink-0 flex flex-col bg-white border-r overflow-y-auto"
          style={{ width: 224, borderColor: '#E8E6E0' }}>

          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b" style={{ borderColor: '#F0EDE8' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#6B52C8' }}>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>N</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.2 }}>
                {org?.org_nom ?? 'Nanotera'}
              </div>
              <div style={{ fontSize: 10, color: '#aaa' }}>
                {org?.user_nom ?? 'Logistique'}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-2">
            {NAV_ITEMS.map(group => (
              <div key={group.group}>
                {/* Section label */}
                <div style={{
                  padding: '8px 16px 4px',
                  fontSize: 10, fontWeight: 500,
                  color: '#aaa',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {group.group}
                </div>

                {group.items.map(item => {
                  const Icon   = item.icon
                  const active = location.pathname.startsWith(item.path)
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      style={{
                        width: '100%',
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 16px',
                        fontSize: 12,
                        fontWeight: active ? 500 : 400,
                        color:      active ? '#6B52C8' : '#555',
                        background: active ? '#EEECFC' : 'transparent',
                        borderLeft: active ? '2px solid #6B52C8' : '2px solid transparent',
                        border: 'none',
                        borderLeft: active ? '2px solid #6B52C8' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all .1s',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          (e.currentTarget as HTMLButtonElement).style.background = '#F5F4F1'
                          ;(e.currentTarget as HTMLButtonElement).style.color = '#1A1A1A'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                          ;(e.currentTarget as HTMLButtonElement).style.color = '#555'
                        }
                      }}
                    >
                      <Icon size={14} style={{ flexShrink: 0 }} />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* Bas de sidebar */}
          <div className="border-t" style={{ borderColor: '#F0EDE8' }}>
            <button
              onClick={() => setAiOpen(!aiOpen)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', fontSize: 12,
                color: aiOpen ? '#6B52C8' : '#7C68D4',
                background: aiOpen ? '#EEECFC' : 'transparent',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .1s',
              }}
            >
              <BotMessageSquare size={14} style={{ flexShrink: 0 }} />
              Assistant IA
              {aiOpen && <span style={{ fontSize: 10, opacity: .6, marginLeft: 'auto' }}>actif</span>}
            </button>
            <button
              onClick={handleLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', fontSize: 12, color: '#aaa',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'color .1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#aaa' }}
            >
              <LogOut size={14} style={{ flexShrink: 0 }} />
              Déconnexion
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>

        {/* ── Editor panel ── */}
        {editor.open && (
          <aside className="flex-shrink-0 flex flex-col overflow-y-auto border-l"
            style={{ width: 320, borderColor: '#E8E6E0', background: '#fff' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: '#F0EDE8' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{editor.title}</span>
              <button
                onClick={closeEditor}
                style={{
                  fontSize: 11, color: '#888', padding: '2px 8px',
                  border: '1px solid #E8E6E0', borderRadius: 6,
                  background: 'white', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Fermer
              </button>
            </div>
            <div className="flex-1 p-4">{editor.content}</div>
          </aside>
        )}

        {/* ── AI Chat ── */}
        {aiOpen && <AIChat onClose={() => setAiOpen(false)} />}
      </div>
    </LayoutContext.Provider>
  )
}
