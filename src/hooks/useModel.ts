/**
 * useModel.ts — Hook de sélection du modèle IA
 * Persiste le choix en localStorage.
 */

import { useState, useCallback } from 'react'

export interface ModelOption {
  id:       string
  label:    string
  provider: 'anthropic' | 'mistral'
  badge:    string
  description: string
}

export const MODELS: ModelOption[] = [
  {
    id:          'claude-sonnet-4-5',
    label:       'Claude Sonnet',
    provider:    'anthropic',
    badge:       'Sonnet',
    description: 'Meilleur équilibre qualité/vitesse',
  },
  {
    id:          'claude-haiku-4-5-20251001',
    label:       'Claude Haiku',
    provider:    'anthropic',
    badge:       'Haiku',
    description: 'Rapide et économique',
  },
  {
    id:          'mistral-large-latest',
    label:       'Mistral Large',
    provider:    'mistral',
    badge:       'Large',
    description: 'Modèle Mistral le plus puissant',
  },
  {
    id:          'mistral-small-latest',
    label:       'Mistral Small',
    provider:    'mistral',
    badge:       'Small',
    description: 'Rapide et léger',
  },
  {
    id:          'open-mistral-nemo',
    label:       'Mistral Nemo',
    provider:    'mistral',
    badge:       'Nemo',
    description: 'Open source, multilingue',
  },
]

const STORAGE_KEY = 'nanotera_ai_model'
const DEFAULT_MODEL = 'claude-sonnet-4-5'

export function useModel() {
  const [modelId, setModelIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MODEL
  })

  const setModelId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setModelIdState(id)
  }, [])

  const model = MODELS.find(m => m.id === modelId) ?? MODELS[0]

  return { modelId, model, setModelId, models: MODELS }
}
