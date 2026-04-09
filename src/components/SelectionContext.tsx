/**
 * SelectionContext.tsx
 * Gère le mode "pointeur" : l'utilisateur peut cliquer
 * sur n'importe quel élément annoté [data-selectable]
 * pour l'injecter comme contexte dans le chat IA.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export interface SelectedElement {
  type: string        // 'palette' | 'centrale' | 'stat' | 'anomalie' | 'recommandation' | ...
  label: string       // Libellé lisible affiché dans le chat
  data: Record<string, any>  // Données structurées
}

interface SelectionContextType {
  active: boolean
  selectedElement: SelectedElement | null
  activate: () => void
  deactivate: () => void
  consume: () => SelectedElement | null  // Lit et réinitialise
}

export const SelectionContext = createContext<SelectionContextType>({
  active: false,
  selectedElement: null,
  activate: () => {},
  deactivate: () => {},
  consume: () => null,
})

export function useSelection() { return useContext(SelectionContext) }

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [active, setActive]                     = useState(false)
  const [selected, setSelected]                 = useState<SelectedElement | null>(null)

  const activate   = useCallback(() => setActive(true), [])
  const deactivate = useCallback(() => { setActive(false) }, [])
  const consume    = useCallback(() => {
    const el = selected
    setSelected(null)
    return el
  }, [selected])

  // Ajouter/retirer la classe CSS sur body
  useEffect(() => {
    if (active) {
      document.body.classList.add('selection-mode')
    } else {
      document.body.classList.remove('selection-mode')
    }
    return () => document.body.classList.remove('selection-mode')
  }, [active])

  // Escape pour quitter
  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') deactivate() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, deactivate])

  // Listener global pour capturer les clics sur [data-selectable]
  useEffect(() => {
    if (!active) return

    const handler = (e: MouseEvent) => {
      // Remonter le DOM pour trouver l'ancêtre [data-selectable] le plus proche
      let target = e.target as HTMLElement | null
      while (target && target !== document.body) {
        if (target.hasAttribute('data-selectable')) {
          e.preventDefault()
          e.stopPropagation()
          try {
            const raw = target.getAttribute('data-selectable') || '{}'
            const parsed: SelectedElement = JSON.parse(raw)
            setSelected(parsed)
          } catch {
            setSelected({ type: 'element', label: target.innerText?.slice(0, 60) || '?', data: {} })
          }
          setActive(false)
          return
        }
        target = target.parentElement
      }
      // Clic dans le vide → quitter le mode
      setActive(false)
    }

    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [active])

  return (
    <SelectionContext.Provider value={{ active, selectedElement: selected, activate, deactivate, consume }}>
      {children}
      {/* Bandeau de guidage quand le mode est actif */}
      {active && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          background: '#6B52C8', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: '10px 16px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 2px 12px rgba(107,82,200,.4)',
        }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          Cliquez sur un élément de la page pour l'ajouter comme contexte au chat
          <button onClick={deactivate}
            style={{
              marginLeft: 8, background: 'rgba(255,255,255,.2)', border: 'none',
              color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            Annuler (Esc)
          </button>
        </div>
      )}
    </SelectionContext.Provider>
  )
}
