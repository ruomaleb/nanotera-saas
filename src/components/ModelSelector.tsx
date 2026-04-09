/**
 * ModelSelector.tsx — Sélecteur de modèle IA
 * Affichage compact pour le header, avec dropdown.
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { useModel, MODELS, ModelOption } from '../hooks/useModel'

const PROVIDER_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  anthropic: { bg: '#EEECFC', text: '#534AB7', dot: '#6B52C8' },
  mistral:   { bg: '#FEF3E2', text: '#854F0B', dot: '#EF9F27' },
}

export default function ModelSelector() {
  const { model, setModelId, models } = useModel()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const colors = PROVIDER_COLORS[model.provider]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 30, padding: '0 10px',
          background: colors.bg,
          border: `1px solid ${colors.dot}40`,
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'opacity .15s',
        }}
      >
        <Sparkles size={11} style={{ color: colors.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: colors.text }}>
          {model.label}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 600, color: colors.dot,
          background: `${colors.dot}20`, padding: '1px 5px', borderRadius: 4,
        }}>
          {model.badge}
        </span>
        <ChevronDown size={10} style={{ color: colors.text, flexShrink: 0, marginLeft: 2 }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 120,
          left: 12,
          width: 220,
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '8px 12px 6px',
            borderBottom: '1px solid #F0EDE8',
            fontSize: 10, fontWeight: 500,
            color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em',
          }}>
            Modèle IA
          </div>

          {/* Groups */}
          {(['anthropic', 'mistral'] as const).map(provider => {
            const group = models.filter(m => m.provider === provider)
            const pc = PROVIDER_COLORS[provider]
            return (
              <div key={provider}>
                <div style={{
                  padding: '6px 12px 3px',
                  fontSize: 10, color: '#bbb',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: pc.dot, flexShrink: 0,
                  }} />
                  {provider === 'anthropic' ? 'Anthropic' : 'Mistral AI'}
                </div>
                {group.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setModelId(m.id); setOpen(false) }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      gap: 8, padding: '7px 12px',
                      background: model.id === m.id ? pc.bg : 'transparent',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left', transition: 'background .1s',
                    }}
                    onMouseEnter={e => {
                      if (model.id !== m.id)
                        (e.currentTarget as HTMLButtonElement).style.background = '#F5F4F1'
                    }}
                    onMouseLeave={e => {
                      if (model.id !== m.id)
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: model.id === m.id ? 500 : 400,
                        color: model.id === m.id ? pc.text : '#333',
                      }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>
                        {m.description}
                      </div>
                    </div>
                    {model.id === m.id && (
                      <span style={{
                        fontSize: 9, fontWeight: 600,
                        background: pc.dot, color: '#fff',
                        padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                      }}>
                        Actif
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )
          })}

          <div style={{
            padding: '8px 12px', borderTop: '1px solid #F0EDE8',
            fontSize: 10, color: '#bbb',
          }}>
            Clé Mistral requise si modèle Mistral sélectionné
          </div>
        </div>
      )}
    </div>
  )
}
