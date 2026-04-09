/**
 * useCurrentOperation.ts
 * Partage l'opération active entre sidebar et pages.
 */
import { useState, useCallback } from 'react'

export interface CurrentOp {
  id: string; code: string; nom: string; statut: string
}

const KEY = 'nanotera_current_op'

export function useCurrentOperation() {
  const [op, setOpState] = useState<CurrentOp | null>(() => {
    try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null }
    catch { return null }
  })
  const setOp = useCallback((o: CurrentOp | null) => {
    if (o) localStorage.setItem(KEY, JSON.stringify(o))
    else localStorage.removeItem(KEY)
    setOpState(o)
  }, [])
  return { op, setOp }
}

export const STATUT_ORDER = ['import', 'analyse', 'palettisation', 'livrables', 'termine']
export const statutIndex  = (s: string) => STATUT_ORDER.indexOf(s)
