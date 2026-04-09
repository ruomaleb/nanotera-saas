import { useState, createContext, useContext, ReactNode } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import AIChat from './AIChat'
import ModelSelector from './ModelSelector'
import {
  Home, List, Upload, ScanLine, Layers, Download,
  BotMessageSquare, LogOut, Shield, ChevronRight, Check, ArrowRight, X,
} from 'lucide-react'
import { useCurrentOperation, statutIndex, CurrentOp } from '../hooks/useCurrentOperation'

interface LayoutContextType {
  currentOp: CurrentOp | null
  setCurrentOp: (op: CurrentOp | null) => void
  openEditor: (title: string, content: ReactNode) => void
  closeEditor: () => void
}

export const LayoutContext = createContext<LayoutContextType>({
  currentOp: null, setCurrentOp: () => {},
  openEditor: () => {}, closeEditor: () => {},
})

export function useEditor()    { return useContext(LayoutContext) }
export function useOpContext() { return useContext(LayoutContext) }

const WORKFLOW = [
  { statut: 'import',        label: 'Import',       icon: Upload,   to: (id: string) => '/import' },
  { statut: 'analyse',       label: 'Analyse',      icon: ScanLine, to: (id: string) => '/analyse' },
  { statut: 'palettisation', label: 'Palettisation', icon: Layers,   to: (id: string) => `/palettisation/${id}` },
  { statut: 'livrables',     label: 'Livrables',    icon: Download, to: (id: string) => '/livrables' },
]

function WorkflowStepper({ op }: { op: CurrentOp }) {
  const navigate = useNavigate()
  const location = useLocation()
  const doneIdx  = statutIndex(op.statut)

  return (
    <div style={{ paddingBottom: 4 }}>
      {WORKFLOW.map((step, i) => {
        const isDone   = i < doneIdx
        const isActive = location.pathname.startsWith(i === 2 ? '/palettisation' : step.to(op.id))
        const isLocked = i > doneIdx + 1

        return (
          <button key={step.statut}
            onClick={() => !isLocked && navigate(step.to(op.id))}
            disabled={isLocked}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 16px 7px 14px', border: 'none', fontFamily: 'inherit',
              cursor: isLocked ? 'default' : 'pointer',
              background: isActive ? '#EEECFC' : 'transparent',
              borderLeft: `2px solid ${isActive ? '#6B52C8' : 'transparent'}`,
              transition: 'all .1s', opacity: isLocked ? 0.3 : 1,
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isDone || isActive ? '#6B52C8' : '#F0EDE8',
              border: isDone || isActive ? 'none' : '1.5px solid #D5D2CA',
            }}>
              {isDone
                ? <Check size={10} style={{ color: '#fff' }} />
                : <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? '#fff' : '#B4B2A9' }}>{i + 1}</span>
              }
            </div>
            <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, color: isActive ? '#6B52C8' : isDone ? '#3D3C3A' : '#888', flex: 1, textAlign: 'left' }}>
              {step.label}
            </span>
            {isDone && !isActive && <span style={{ fontSize: 11, color: '#0F6E56' }}>✓</span>}
            {!isDone && !isActive && !isLocked && <ChevronRight size={12} style={{ color: '#D5D2CA' }} />}
          </button>
        )
      })}
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { org }  = useOrg()
  const [aiOpen, setAiOpen] = useState(false)
  const [editor, setEditor] = useState<{ open: boolean; title: string; content: ReactNode | null }>({ open: false, title: '', content: null })
  const { op: currentOp, setOp: setCurrentOp } = useCurrentOperation()

  const openEditor  = (title: string, content: ReactNode) => setEditor({ open: true, title, content })
  const closeEditor = () => setEditor({ open: false, title: '', content: null })
  const handleLogout = async () => { await supabase.auth.signOut() }

  const isWorkflowPage = ['/import', '/analyse', '/palettisation', '/livrables'].some(p => location.pathname.startsWith(p))

  const navItemStyle = (isActive: boolean) => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 16px', fontSize: 13,
    fontWeight: isActive ? 500 : 400,
    color: isActive ? '#6B52C8' : '#555',
    background: isActive ? '#EEECFC' : 'transparent',
    borderLeft: `2px solid ${isActive ? '#6B52C8' : 'transparent'}`,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none',
    transition: 'all .1s', display: 'flex',
  } as React.CSSProperties)

  return (
    <LayoutContext.Provider value={{ currentOp, setCurrentOp, openEditor, closeEditor }}>
      <div className="h-screen flex overflow-hidden" style={{ background: '#F5F4F1' }}>

        {/* ── Sidebar ── */}
        <aside className="flex-shrink-0 flex flex-col bg-white border-r overflow-y-auto"
          style={{ width: 224, borderColor: '#E8E6E0' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #F0EDE8' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#6B52C8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>N</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.2 }}>{org?.org_nom ?? 'Nanotera'}</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>Logistique prospectus</div>
            </div>
          </div>

          {/* Nav principale */}
          <nav style={{ padding: '8px 0' }}>
            <NavLink to="/" end style={({ isActive }) => navItemStyle(isActive)}>
              <Home size={15} style={{ flexShrink: 0 }} /> Accueil
            </NavLink>
            <NavLink to="/operations" style={({ isActive }) => navItemStyle(isActive || location.pathname.startsWith('/operations/new'))}>
              <List size={15} style={{ flexShrink: 0 }} /> Opérations
            </NavLink>
          </nav>

          {/* Separator */}
          <div style={{ borderTop: '1px solid #F0EDE8', margin: '0' }} />

          {/* Workflow contextuel */}
          {currentOp ? (
            <div>
              {/* Chip opération */}
              <div style={{ padding: '10px 12px 6px' }}>
                <div style={{ fontSize: 11, color: '#aaa', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                  Opération active
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F5F4F1', borderRadius: 8, padding: '7px 10px', border: '1px solid #E8E6E0' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentOp.code}</div>
                    {currentOp.nom && (
                      <div style={{ fontSize: 11, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentOp.nom}</div>
                    )}
                  </div>
                  <button onClick={() => setCurrentOp(null)}
                    style={{ color: '#D5D2CA', background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 1 }}>
                    <X size={13} />
                  </button>
                </div>
              </div>
              <WorkflowStepper op={currentOp} />
            </div>
          ) : isWorkflowPage ? (
            <button onClick={() => navigate('/operations')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, margin: '10px 12px',
                padding: '9px 12px', border: '1.5px dashed #D5D2CA', borderRadius: 8,
                background: 'none', cursor: 'pointer', color: '#888', fontSize: 12,
                fontFamily: 'inherit', width: 'calc(100% - 24px)',
              }}>
              <ArrowRight size={13} style={{ flexShrink: 0 }} />
              <span>Sélectionner une opération</span>
            </button>
          ) : null}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Bas sidebar */}
          <div style={{ borderTop: '1px solid #F0EDE8' }}>
            <div style={{ padding: '8px 12px 6px' }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 500 }}>Modèle IA</div>
              <ModelSelector />
            </div>
            {[
              { label: 'Assistant IA', icon: BotMessageSquare, onClick: () => setAiOpen(!aiOpen), active: aiOpen, color: aiOpen ? '#6B52C8' : '#7C68D4' },
              { label: 'Administration', icon: Shield, onClick: () => navigate('/admin'), active: false, color: '#aaa' },
              { label: 'Déconnexion', icon: LogOut, onClick: handleLogout, active: false, color: '#aaa' },
            ].map(item => (
              <button key={item.label} onClick={item.onClick}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 16px', fontSize: 13, color: item.color,
                  background: item.active ? '#EEECFC' : 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .1s',
                }}>
                <item.icon size={15} style={{ flexShrink: 0 }} />
                {item.label}
                {item.label === 'Assistant IA' && aiOpen && (
                  <span style={{ fontSize: 11, opacity: .6, marginLeft: 'auto' }}>actif</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>

        {/* Editor panel */}
        {editor.open && (
          <aside className="flex-shrink-0 flex flex-col overflow-y-auto border-l"
            style={{ width: 320, borderColor: '#E8E6E0', background: '#fff' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#F0EDE8' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{editor.title}</span>
              <button onClick={closeEditor} style={{ fontSize: 12, color: '#888', padding: '2px 8px', border: '1px solid #E8E6E0', borderRadius: 6, background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                Fermer
              </button>
            </div>
            <div className="flex-1 p-4">{editor.content}</div>
          </aside>
        )}

        {aiOpen && <AIChat onClose={() => setAiOpen(false)} />}
      </div>
    </LayoutContext.Provider>
  )
}
