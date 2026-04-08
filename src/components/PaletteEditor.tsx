/**
 * PaletteEditor.tsx
 * Éditeur interactif du plan de palettisation avec drag & drop.
 * Déplacer les magasins entre palettes groupées, undo illimité,
 * journal des modifications, sauvegarde via API PUT.
 */

import { useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import {
  Loader2, AlertCircle, CheckCircle2,
  RotateCcw, Undo2, Plus, Trash2, Save,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Magasin {
  code_pdv:   string
  nom_pdv:    string
  ville:      string
  quantite:   number
  nb_cartons: number
}

interface PaletteGroupee {
  id:             string
  numero:         number
  nb_cartons:     number
  nb_exemplaires: number
  poids_kg:       number
  magasins:       Magasin[]
}

interface PalettePdv {
  id:             string
  numero:         number
  code_pdv:       string
  nb_exemplaires: number
  poids_kg:       number
  magasins:       Magasin[]
}

interface CentraleState {
  groupees: PaletteGroupee[]
  pdvs:     PalettePdv[]
}

export interface PaletteEditorProps {
  operationId:     string
  rawPalettes:     any[]
  conditionnement: {
    ex_par_carton:       number
    cartons_par_palette: number
    poids_unitaire_kg:   number
  }
  onSaved?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

function parseMagasins(raw: any): Magasin[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

function buildState(rawPalettes: any[]): Record<string, CentraleState> {
  const state: Record<string, CentraleState> = {}
  for (const p of rawPalettes) {
    const c = p.centrale_nom as string
    if (!state[c]) state[c] = { groupees: [], pdvs: [] }
    const mags = parseMagasins(p.magasins)
    if (p.type_palette === 'groupee') {
      state[c].groupees.push({
        id:             p.id,
        numero:         p.numero,
        nb_cartons:     p.nb_cartons ?? Math.ceil(p.nb_exemplaires / 200),
        nb_exemplaires: p.nb_exemplaires,
        poids_kg:       p.poids_kg,
        magasins:       mags,
      })
    } else {
      state[c].pdvs.push({
        id:             p.id,
        numero:         p.numero,
        code_pdv:       p.code_pdv ?? '',
        nb_exemplaires: p.nb_exemplaires,
        poids_kg:       p.poids_kg,
        magasins:       mags,
      })
    }
  }
  for (const c of Object.values(state)) {
    c.groupees.sort((a, b) => a.numero - b.numero)
    c.pdvs.sort((a, b) => a.numero - b.numero)
  }
  return state
}

function fillColor(pct: number): string {
  if (pct > 100) return 'bg-red-400'
  if (pct >= 90)  return 'bg-green-400'
  if (pct >= 60)  return 'bg-yellow-400'
  return 'bg-blue-400'
}

function fillTextColor(pct: number): string {
  if (pct > 100) return 'text-red-600'
  if (pct >= 90)  return 'text-green-600'
  if (pct >= 60)  return 'text-yellow-600'
  return 'text-blue-500'
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PaletteEditor({
  operationId,
  rawPalettes,
  conditionnement,
  onSaved,
}: PaletteEditorProps) {
  const CARTONS_MAX   = conditionnement.cartons_par_palette
  const EX_PAR_CARTON = conditionnement.ex_par_carton
  const POIDS_U       = conditionnement.poids_unitaire_kg

  const initialState = buildState(rawPalettes)
  const [state, setState]       = useState<Record<string, CentraleState>>(() => deepClone(initialState))
  const original                = useRef<Record<string, CentraleState>>(deepClone(initialState))
  const [history, setHistory]   = useState<Record<string, CentraleState>[]>([])
  const [mods, setMods]         = useState<string[]>([])
  const [currentTab, setTab]    = useState<string>(() => Object.keys(initialState)[0] ?? '')
  const [search, setSearch]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [saveOk, setSaveOk]     = useState(false)
  const [saveErr, setSaveErr]   = useState('')
  const [alertMsg, setAlertMsg] = useState('')
  const [journalOpen, setJournalOpen] = useState(false)

  // Drag state
  const dragSrc = useRef<{
    centrale: string; palIdx: number; magIdx: number; mag: Magasin
  } | null>(null)
  const [dragOverPal, setDragOverPal] = useState<{ centrale: string; idx: number } | null>(null)

  const pushHistory = useCallback((prev: Record<string, CentraleState>) => {
    setHistory(h => [...h.slice(-49), deepClone(prev)])
  }, [])

  const showAlert = (msg: string) => {
    setAlertMsg(msg)
    setTimeout(() => setAlertMsg(''), 5000)
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const onDragStart = (
    e: React.DragEvent,
    centrale: string,
    palIdx: number,
    magIdx: number,
    mag: Magasin,
  ) => {
    dragSrc.current = { centrale, palIdx, magIdx, mag }
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragEnd = () => {
    dragSrc.current = null
    setDragOverPal(null)
  }

  const onDragOver = (e: React.DragEvent, centrale: string, palIdx: number) => {
    e.preventDefault()
    if (!dragSrc.current) return
    if (dragSrc.current.palIdx === palIdx && dragSrc.current.centrale === centrale) return
    setDragOverPal({ centrale, idx: palIdx })
    e.dataTransfer.dropEffect = 'move'
  }

  const onDragLeave = (e: React.DragEvent) => {
    if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverPal(null)
    }
  }

  const onDrop = (e: React.DragEvent, targetCentrale: string, targetPalIdx: number) => {
    e.preventDefault()
    setDragOverPal(null)
    const src = dragSrc.current
    if (!src) return
    if (src.palIdx === targetPalIdx && src.centrale === targetCentrale) return

    const targetPal = state[targetCentrale]?.groupees[targetPalIdx]
    if (!targetPal) return

    if (targetPal.nb_cartons + src.mag.nb_cartons > CARTONS_MAX) {
      showAlert(
        `Impossible : palette #${targetPalIdx + 1} dépasserait ${CARTONS_MAX} cartons ` +
        `(${targetPal.nb_cartons} + ${src.mag.nb_cartons} = ${targetPal.nb_cartons + src.mag.nb_cartons})`
      )
      dragSrc.current = null
      return
    }

    setState(prev => {
      pushHistory(prev)
      const next = deepClone(prev)
      const srcPal = next[src.centrale].groupees[src.palIdx]
      const tgtPal = next[targetCentrale].groupees[targetPalIdx]

      srcPal.magasins.splice(src.magIdx, 1)
      srcPal.nb_cartons     -= src.mag.nb_cartons
      srcPal.nb_exemplaires  = srcPal.magasins.reduce((s, m) => s + m.nb_cartons * EX_PAR_CARTON, 0)
      srcPal.poids_kg        = Math.round(srcPal.nb_exemplaires * POIDS_U)

      tgtPal.magasins.push(src.mag)
      tgtPal.nb_cartons     += src.mag.nb_cartons
      tgtPal.nb_exemplaires  = tgtPal.magasins.reduce((s, m) => s + m.nb_cartons * EX_PAR_CARTON, 0)
      tgtPal.poids_kg        = Math.round(tgtPal.nb_exemplaires * POIDS_U)

      const srcLabel = `#${src.palIdx + 1}`
      const tgtLabel = `#${targetPalIdx + 1}`

      if (srcPal.magasins.length === 0) {
        next[src.centrale].groupees.splice(src.palIdx, 1)
        setMods(m => [...m,
          `${src.centrale} — ${src.mag.nom_pdv} (${src.mag.code_pdv}) : palette ${srcLabel} → ${tgtLabel} (${srcLabel} vide supprimée)`,
        ])
      } else {
        setMods(m => [...m,
          `${src.centrale} — ${src.mag.nom_pdv} (${src.mag.code_pdv}) : palette ${srcLabel} → ${tgtLabel}`,
        ])
      }

      return next
    })

    dragSrc.current = null
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const addPalette = () => {
    setState(prev => {
      pushHistory(prev)
      const next = deepClone(prev)
      const c = next[currentTab]
      const maxNum = c.groupees.reduce((m, p) => Math.max(m, p.numero), 0)
      c.groupees.push({
        id: `new-${Date.now()}`,
        numero: maxNum + 1,
        nb_cartons: 0,
        nb_exemplaires: 0,
        poids_kg: 0,
        magasins: [],
      })
      setMods(m => [...m, `${currentTab} — Palette vide ajoutée`])
      return next
    })
  }

  const deletePalette = (palIdx: number) => {
    if (state[currentTab]?.groupees[palIdx]?.magasins.length) return
    setState(prev => {
      pushHistory(prev)
      const next = deepClone(prev)
      next[currentTab].groupees.splice(palIdx, 1)
      setMods(m => [...m, `${currentTab} — Palette vide #${palIdx + 1} supprimée`])
      return next
    })
  }

  const undo = () => {
    if (!history.length) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setMods(m => m.slice(0, -1))
    setState(prev)
  }

  const reset = () => {
    if (!window.confirm('Réinitialiser toutes les modifications ?')) return
    setState(deepClone(original.current))
    setHistory([])
    setMods([])
  }

  const save = async () => {
    setSaving(true)
    setSaveErr('')
    setSaveOk(false)
    try {
      const palettes: any[] = []
      for (const [centrale, c] of Object.entries(state)) {
        c.groupees.forEach(p => palettes.push({
          id: p.id,
          centrale_nom: centrale,
          type_palette: 'groupee',
          numero: p.numero,
          nb_cartons: p.nb_cartons,
          nb_exemplaires: p.nb_exemplaires,
          poids_kg: p.poids_kg,
          magasins: p.magasins,
        }))
        c.pdvs.forEach(p => palettes.push({
          id: p.id,
          centrale_nom: centrale,
          type_palette: 'pdv',
          numero: p.numero,
          nb_cartons: null,
          nb_exemplaires: p.nb_exemplaires,
          poids_kg: p.poids_kg,
          magasins: p.magasins,
        }))
      }
      await api(`/api/operations/${operationId}/palettes`, {
        method: 'PUT',
        body: { palettes },
      })
      setSaveOk(true)
      setMods([])
      setHistory([])
      original.current = deepClone(state)
      setTimeout(() => setSaveOk(false), 3000)
      onSaved?.()
    } catch (e: any) {
      setSaveErr(e.message || 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ── Stats globales ────────────────────────────────────────────────────────

  const gs = (() => {
    let palGrp = 0, palPdv = 0, totalEx = 0, totalKg = 0
    for (const c of Object.values(state)) {
      palGrp  += c.groupees.length
      palPdv  += c.pdvs.length
      totalEx += [...c.groupees, ...c.pdvs].reduce((s, p) => s + p.nb_exemplaires, 0)
      totalKg += [...c.groupees, ...c.pdvs].reduce((s, p) => s + p.poids_kg, 0)
    }
    return { palGrp, palPdv, total: palGrp + palPdv, totalEx, totalKg }
  })()

  const q = search.toLowerCase()
  const centrales = Object.keys(state)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Alerte capacité */}
      {alertMsg && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="flex-shrink-0" />
          <span className="flex-1">{alertMsg}</span>
          <button onClick={() => setAlertMsg('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Palettes', value: gs.total, sub: `${gs.palGrp}G + ${gs.palPdv}P` },
          { label: 'Centrales', value: centrales.length },
          { label: 'Exemplaires', value: gs.totalEx.toLocaleString('fr') },
          { label: 'Poids', value: `${Math.round(gs.totalKg).toLocaleString('fr')} kg` },
          { label: 'Modifications', value: mods.length, sub: 'en attente' },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-lg p-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</div>
            <div className="text-lg font-semibold text-gray-900 mt-0.5">{s.value}</div>
            {s.sub && <div className="text-[10px] text-gray-400">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">⌕</span>
          <input
            type="text"
            placeholder="Rechercher un magasin…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 pl-7 pr-3 text-xs border border-gray-200 rounded-lg bg-white"
          />
        </div>
        <button onClick={addPalette}
          className="h-8 px-3 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-1.5 text-gray-700 transition-colors">
          <Plus size={12} /> Palette
        </button>
        <button onClick={undo} disabled={!history.length}
          className="h-8 px-3 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-1.5 text-gray-700 disabled:opacity-40 transition-colors">
          <Undo2 size={12} /> Annuler
        </button>
        <button onClick={reset}
          className="h-8 px-3 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50 flex items-center gap-1.5 text-gray-600 transition-colors">
          <RotateCcw size={12} /> Reset
        </button>
        <button onClick={save} disabled={saving || mods.length === 0}
          className="h-8 px-3 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1.5 transition-colors">
          {saving
            ? <><Loader2 size={12} className="animate-spin" /> Sauvegarde…</>
            : saveOk
            ? <><CheckCircle2 size={12} /> Sauvegardé</>
            : <><Save size={12} /> Sauvegarder{mods.length > 0 ? ` (${mods.length})` : ''}</>}
        </button>
      </div>

      {saveErr && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle size={13} /> {saveErr}
        </div>
      )}

      {/* Onglets centrales */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {centrales.map(name => {
          const c = state[name]
          const overloaded = c.groupees.some(p => p.nb_cartons > CARTONS_MAX)
          return (
            <button key={name} onClick={() => setTab(name)}
              className={`flex-shrink-0 h-7 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                name === currentTab
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {name}
              <span className="ml-1.5 opacity-60 text-[10px]">{c.groupees.length + c.pdvs.length}</span>
              {overloaded && <span className="ml-1 text-red-400">⚠</span>}
            </button>
          )
        })}
      </div>

      {/* Grille palettes */}
      {state[currentTab] && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">

          {/* Palettes groupées */}
          {state[currentTab].groupees.map((pal, pi) => {
            const pct = CARTONS_MAX > 0 ? (pal.nb_cartons / CARTONS_MAX) * 100 : 0
            const isOver = dragOverPal?.centrale === currentTab && dragOverPal?.idx === pi
            const src = dragSrc.current
            const wouldOverload = isOver && src && pal.nb_cartons + src.mag.nb_cartons > CARTONS_MAX

            return (
              <div key={pal.id}
                className={`border rounded-xl overflow-hidden transition-all ${
                  wouldOverload ? 'border-red-300 ring-2 ring-red-100'
                  : isOver      ? 'border-blue-300 ring-2 ring-blue-100'
                                : 'border-gray-200'
                }`}
                onDragOver={e => onDragOver(e, currentTab, pi)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, currentTab, pi)}
              >
                {/* En-tête */}
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700">GRP</span>
                      <span className="text-xs font-semibold text-gray-900">#{pi + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium tabular-nums ${fillTextColor(pct)}`}>
                        {pal.nb_cartons}/{CARTONS_MAX}
                      </span>
                      {pal.magasins.length === 0 && (
                        <button onClick={() => deletePalette(pi)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Barre de remplissage */}
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${fillColor(pct)}`}
                      style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>{pal.nb_exemplaires.toLocaleString('fr')} ex</span>
                    <span>{Math.round(pal.poids_kg)} kg</span>
                  </div>
                </div>

                {/* Indicateur drop */}
                {isOver && !wouldOverload && (
                  <div className="mx-2 mb-2 h-7 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center text-[10px] text-blue-500 bg-blue-50">
                    Déposer ici
                  </div>
                )}
                {isOver && wouldOverload && (
                  <div className="mx-2 mb-2 h-7 border-2 border-dashed border-red-300 rounded-lg flex items-center justify-center text-[10px] text-red-500 bg-red-50">
                    Capacité dépassée
                  </div>
                )}

                {/* Magasins */}
                <div className="px-2 pb-2 space-y-0.5">
                  {pal.magasins.map((mag, mi) => {
                    const isDragging = src?.palIdx === pi && src?.centrale === currentTab && src?.magIdx === mi
                    const isMatch = q && (
                      mag.nom_pdv.toLowerCase().includes(q) ||
                      mag.code_pdv.toLowerCase().includes(q) ||
                      (mag.ville ?? '').toLowerCase().includes(q)
                    )
                    return (
                      <div key={mag.code_pdv + mi}
                        draggable
                        onDragStart={e => onDragStart(e, currentTab, pi, mi, mag)}
                        onDragEnd={onDragEnd}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing select-none transition-colors ${
                          isDragging ? 'opacity-30'
                          : isMatch  ? 'bg-yellow-50'
                                     : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-gray-300 text-xs">⠿</span>
                        <span className="text-[10px] text-gray-400 w-9 flex-shrink-0 font-mono">{mag.code_pdv}</span>
                        <span className="text-[11px] text-gray-700 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                          title={`${mag.nom_pdv} — ${mag.ville}`}>{mag.nom_pdv}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">{mag.nb_cartons}c</span>
                      </div>
                    )
                  })}
                  {pal.magasins.length === 0 && !isOver && (
                    <div className="text-[10px] text-gray-300 text-center py-3">Palette vide</div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Palettes PDV */}
          {state[currentTab].pdvs.map(pdv => (
            <div key={pdv.id} className="border border-amber-200 bg-amber-50/40 rounded-xl">
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700">PDV</span>
                  <span className="text-xs font-semibold text-gray-900">#{pdv.numero}</span>
                  <span className="text-[10px] text-amber-500 ml-auto">🔒 vrac</span>
                </div>
                <div className="text-[11px] font-medium text-amber-800 truncate">
                  {pdv.magasins[0]?.nom_pdv ?? pdv.code_pdv}
                </div>
                <div className="text-[10px] text-amber-600 mt-0.5 tabular-nums">
                  {pdv.nb_exemplaires.toLocaleString('fr')} ex · {Math.round(pdv.poids_kg)} kg
                </div>
              </div>
            </div>
          ))}

        </div>
      )}

      {/* Journal */}
      {mods.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button onClick={() => setJournalOpen(o => !o)}
            className="w-full px-4 py-2.5 bg-gray-50 flex items-center justify-between text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            <span>Journal — {mods.length} modification{mods.length > 1 ? 's' : ''}</span>
            <span className="text-gray-400">{journalOpen ? '▾' : '▸'}</span>
          </button>
          {journalOpen && (
            <div className="max-h-36 overflow-y-auto divide-y divide-gray-100">
              {[...mods].reverse().map((m, i) => (
                <div key={i} className="px-4 py-1.5 text-[11px] text-gray-500">{m}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
