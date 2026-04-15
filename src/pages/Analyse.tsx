import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  CheckCircle2, AlertTriangle, XCircle, ArrowRight, FileSpreadsheet,
  ChevronDown, ChevronRight, RefreshCw, Sparkles, Send, Loader2, Info,
} from 'lucide-react'
import { useOpContext } from '../components/Layout'
import { useModel } from '../hooks/useModel'

// ── Types ──────────────────────────────────────────────────

interface QualityCheck {
  name: string
  status: string
  message?: string
  nb_issues?: number
  issues?: any[]
  // Champs bruts selon le check
  [key: string]: any
}

// ── Helpers ────────────────────────────────────────────────

const CHECK_META: Record<string, {
  label: string
  impact: 'bloquant' | 'attention' | 'informatif'
  explain: (data: any) => string
}> = {
  '1_integrite': {
    label: 'Intégrité des données',
    impact: 'bloquant',
    explain: d => d?.nb_total
      ? `${d.nb_valid ?? d.nb_total}/${d.nb_total} magasins valides.${d.errors?.length ? ` ${d.errors.length} erreur(s) détectée(s).` : ' Aucun doublon, aucun champ manquant.'}`
      : 'Structure des données vérifiée.',
  },
  '2_coherence_totaux': {
    label: 'Cohérence des totaux',
    impact: 'attention',
    explain: d => {
      if (d?.ecart && Math.abs(d.ecart) > 0)
        return `Écart de ${Math.abs(d.ecart).toLocaleString('fr-FR')} ex entre le total source (${(d.total_source ?? 0).toLocaleString('fr-FR')}) et le total calculé (${(d.total_calcule ?? 0).toLocaleString('fr-FR')}). Cet écart correspond souvent aux justificatifs Galec — vérifier.`
      return 'Totaux cohérents entre le fichier source et les données normalisées.'
    },
  },
  '3_anomalies_statistiques': {
    label: 'PDV potentiels & anomalies',
    impact: 'attention',
    explain: d => {
      const n = d?.anomalies?.length ?? d?.warnings?.length ?? 0
      return n > 0
        ? `${n} magasin(s) avec quantité supérieure au seuil PDV — ils recevront une palette individuelle.`
        : 'Aucune anomalie statistique détectée.'
    },
  },
  '4_observations': {
    label: 'Observations spéciales',
    impact: 'informatif',
    explain: d => {
      const n = d?.nb_parsed ?? d?.observations?.length ?? 0
      return n > 0
        ? `${n} magasin(s) ont des instructions spéciales (exclusions d'offres, bandeau, repiquage). Transmises aux fiches palettes.`
        : 'Aucune observation particulière détectée.'
    },
  },
  '5_completude_adresses': {
    label: 'Complétude des adresses',
    impact: 'attention',
    explain: d => d?.nb_incomplets
      ? `${d.nb_incomplets} adresse(s) incomplète(s) (${d.taux_completude_pct}% de complétude). Impact sur les bons de livraison.`
      : `Toutes les adresses sont complètes (${d?.taux_completude_pct ?? 100}%).`,
  },
}

const IMPACT_CONFIG = {
  bloquant:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    badge: 'bg-red-50 text-red-700 border-red-200',    icon: XCircle,       dot: 'bg-red-500'    },
  attention:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle, dot: 'bg-amber-500'  },
  informatif: { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   badge: 'bg-blue-50 text-blue-700 border-blue-200',   icon: Info,          dot: 'bg-blue-400'   },
  ok:         { bg: 'bg-stone-50',  border: 'border-stone-200',  text: 'text-stone-700',  badge: 'bg-green-50 text-green-700 border-green-200',  icon: CheckCircle2, dot: 'bg-green-500'  },
}

function IssueRow({ issue, index }: { issue: any; index: number }) {
  if (typeof issue === 'string') return (
    <div className="flex items-start gap-2 py-2 border-b border-stone-100 last:border-0 text-xs">
      <span className="text-stone-400 w-5 flex-shrink-0">{index + 1}</span>
      <span className="text-stone-700">{issue}</span>
    </div>
  )
  const code  = issue.code_pdv || issue.code
  const nom   = issue.nom_pdv  || issue.nom
  const qte   = issue.quantite ?? issue.qty
  const note  = issue.note || issue.message || issue.detail
  const type  = issue.type
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-stone-100 last:border-0 text-xs">
      <span className="text-stone-300 w-5 flex-shrink-0 font-mono">{index + 1}</span>
      {code && <span className="font-mono bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded text-[10px] flex-shrink-0">{code}</span>}
      <span className="flex-1 font-medium text-stone-800 truncate">{nom || note || type || '—'}</span>
      {qte !== undefined && (
        <span className="font-mono font-medium text-amber-700 flex-shrink-0">{Number(qte).toLocaleString('fr-FR')} ex</span>
      )}
    </div>
  )
}

// ── Chat IA ────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  'Puis-je lancer la palettisation tels quels ?',
  'Combien de palettes vais-je obtenir environ ?',
  'Les PDV sont-ils bien identifiés ?',
  'Quel seuil PDV me recommandes-tu ?',
  'Y a-t-il des anomalies bloquantes ?',
]

interface ChatMsg { role: 'user' | 'assistant'; content: string }

function AnalyseChat({ op }: { op: any }) {
  const { modelId } = useModel()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput]       = useState('')
  const [streaming, setStreaming] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const API_BASE = import.meta.env.VITE_API_URL || 'https://nanotera-api-saas-production.up.railway.app'

  // Proactive suggestion au chargement
  useEffect(() => {
    if (!op || initialized) return
    setInitialized(true)

    const exPaquet = op.ex_par_paquet || 100
    const exCarton = op.ex_par_carton || 200
    const crtPal   = op.cartons_par_palette || 48
    const seuilPdv = op.seuil_pdv || 2800
    const poids    = op.poids_unitaire_kg || 0.054
    const exPal    = exCarton * crtPal
    const nbPalEst = op.total_exemplaires ? Math.ceil(op.total_exemplaires / exPal) : null
    const poidsPal = Math.round(exPal * poids)

    const proactive = `Voici mon analyse rapide de l'opération **${op.code_operation}** :

**${(op.total_exemplaires ?? 0).toLocaleString('fr-FR')} ex** · ${op.nb_magasins ?? '?'} magasins · ${op.nb_centrales ?? '?'} centrales

Avec les paramètres actuels (${exPaquet} ex/paquet · ${exCarton} ex/carton · ${crtPal} crt/palette · seuil PDV ${seuilPdv.toLocaleString('fr-FR')} ex) :
- **${exPal.toLocaleString('fr-FR')} ex/palette** · poids estimé **${poidsPal.toLocaleString('fr-FR')} kg/palette**
${nbPalEst ? `- Estimation : **~${nbPalEst} palettes** au total\n` : ''}- Poids/ex calculé : **${poids} kg**

Tu peux me poser des questions sur les anomalies détectées, ajuster le seuil PDV, ou simuler un changement de conditionnement.`

    setMessages([{ role: 'assistant', content: proactive }])
  }, [op?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const send = async (text: string) => {
    if (!text.trim() || streaming) return
    const userMsg: ChatMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    const exPaquet = op.ex_par_paquet || 100
    const exCarton = op.ex_par_carton || 200
    const crtPal   = op.cartons_par_palette || 48
    const seuilPdv = op.seuil_pdv || 2800
    const poids    = op.poids_unitaire_kg || 0.054

    const systemPrompt = `Tu es l'assistant logistique Nanotera. L'utilisateur analyse l'opération ${op.code_operation}.

DONNÉES :
- Total : ${op.total_exemplaires?.toLocaleString('fr-FR')} exemplaires · ${op.nb_magasins} magasins · ${op.nb_centrales} centrales
- Conditionnement : ${exPaquet} ex/paquet · ${exCarton} ex/carton · ${crtPal} crt/palette · seuil PDV ${seuilPdv}
- Poids/ex : ${poids} kg

RAPPORT CONTRÔLES :
${JSON.stringify(op.rapport_controles?.checks || {}, null, 2).slice(0, 1500)}

Réponds de façon concise et pratique en français. Utilise des chiffres concrets. Propose des ajustements si pertinent.`

    try {
      const resp = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text },
          ],
        }),
      })

      if (!resp.body) throw new Error('No stream')
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content || parsed.delta?.text || ''
              if (delta) {
                accumulated += delta
                setMessages(prev => {
                  const next = [...prev]
                  next[next.length - 1] = { role: 'assistant', content: accumulated }
                  return next
                })
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erreur : ${e.message}` }])
    }
    setStreaming(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
              m.role === 'user'
                ? 'bg-stone-800 text-white rounded-br-sm'
                : 'bg-stone-100 text-stone-800 rounded-bl-sm'
            }`}>
              {m.content}
              {streaming && i === messages.length - 1 && m.role === 'assistant' && (
                <span className="inline-block w-1 h-3 bg-stone-400 animate-pulse ml-1 align-middle" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Questions rapides */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="text-[10px] text-stone-400 mb-2 uppercase tracking-wide">Questions rapides</div>
          <div className="flex flex-col gap-1.5">
            {QUICK_QUESTIONS.map(q => (
              <button key={q} onClick={() => send(q)}
                className="text-left text-xs px-3 py-2 border border-stone-200 rounded-lg hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-all">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-stone-200 p-3 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
          placeholder="Poser une question sur les données..."
          className="flex-1 text-sm px-3 py-2 border border-stone-200 rounded-lg outline-none focus:border-brand-400 font-[inherit]" />
        <button onClick={() => send(input)} disabled={streaming || !input.trim()}
          className="w-9 h-9 flex items-center justify-center bg-stone-900 text-white rounded-lg hover:opacity-85 disabled:opacity-30 transition-all flex-shrink-0">
          {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────

export default function Analyse() {
  const navigate = useNavigate()
  const { currentOp, setCurrentOp } = useOpContext()
  const [operations, setOperations] = useState<any[]>([])
  const [selectedOp, setSelectedOp] = useState('')
  const [op, setOp]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null)
  const [showEditParams, setShowEditParams] = useState(false)
  const [editParams, setEditParams] = useState<Record<string,string>>({})
  const [savingParams, setSavingParams] = useState(false)

  useEffect(() => {
    supabase.from('ops_operations')
      .select('id, code_operation, nom_operation, statut, nb_magasins, total_exemplaires, nb_centrales, nb_palettes, nb_palettes_grp, nb_palettes_pdv, rapport_controles, donnees_normalisees, poids_unitaire_kg, ex_par_paquet, ex_par_carton, cartons_par_palette, seuil_pdv, nom_fichier_import, date_import')
      .in('statut', ['import', 'analyse', 'palettisation', 'livrables', 'termine'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOperations(data ?? [])
        const activeId = currentOp?.id
        const preselect = (activeId && data?.find((o: any) => o.id === activeId)) ? activeId : data?.[0]?.id ?? ''
        if (preselect) { setSelectedOp(preselect); setOp(data?.find((o: any) => o.id === preselect) ?? null) }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const found = operations.find(o => o.id === selectedOp)
    setOp(found ?? null)
    setExpandedCheck(null)
  }, [selectedOp, operations])

  useEffect(() => {
    if (op) {
      setCurrentOp({ id: op.id, code: op.code_operation, nom: op.nom_operation ?? '', statut: op.statut })
      setEditParams({
        ex_par_paquet:       String(op.ex_par_paquet ?? 100),
        nb_paquets_carton:   String(op.ex_par_carton && op.ex_par_paquet ? Math.round(op.ex_par_carton / op.ex_par_paquet) : 2),
        cartons_par_palette: String(op.cartons_par_palette ?? 48),
        seuil_pdv:           String(op.seuil_pdv ?? 2800),
      })
    }
  }, [op?.id])

  // Sauvegarder les paramètres de palettisation
  const handleSaveParams = async () => {
    if (!op) return
    setSavingParams(true)
    const exPaq = parseInt(editParams.ex_par_paquet || '100')
    const nbPaq = parseInt(editParams.nb_paquets_carton || '2')
    const update = {
      ex_par_paquet:       exPaq,
      ex_par_carton:       exPaq * nbPaq,
      cartons_par_palette: parseInt(editParams.cartons_par_palette || '48'),
      seuil_pdv:           parseInt(editParams.seuil_pdv || '2800'),
    }
    await supabase.from('ops_operations').update(update).eq('id', op.id)
    setOp((prev: any) => prev ? { ...prev, ...update } : prev)
    setOperations(prev => prev.map((o: any) => o.id === op.id ? { ...o, ...update } : o))
    setSavingParams(false)
    setShowEditParams(false)
  }

  // Parsing des contrôles
  const rapport = op?.rapport_controles || {}
  const verdict = rapport.verdict || 'ok'
  const checksRaw: any = rapport.checks || {}

  const normalizedChecks: QualityCheck[] = Array.isArray(checksRaw)
    ? checksRaw.map((c: any) => typeof c === 'string' ? { name: c, status: 'pass' } : c)
    : Object.entries(checksRaw).map(([name, data]: [string, any]) => ({
        name,
        status: data?.status || 'pass',
        ...data,
        issues: [...(data?.errors || []), ...(data?.warnings || []), ...(data?.criticalAlerts || [])],
      }))

  const nbWarnings = normalizedChecks.filter(c => c.status === 'warn' || c.status === 'warning').length
  const nbErrors   = normalizedChecks.filter(c => c.status === 'fail' || c.status === 'error').length

  const verdictConfig = nbErrors > 0
    ? { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', title: `${nbErrors} erreur(s) bloquante(s) — vérifier avant de continuer`, sub: 'Des erreurs critiques ont été détectées dans les données importées.', textColor: 'text-red-800', subColor: 'text-red-600' }
    : nbWarnings > 0
    ? { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', title: `${nbWarnings} point(s) d'attention — peut procéder à la palettisation`, sub: 'Aucun blocage critique. Les anomalies sont documentées et non bloquantes.', textColor: 'text-amber-800', subColor: 'text-amber-600' }
    : { bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500', title: 'Données valides — prêt pour la palettisation', sub: 'Tous les contrôles sont passés. Vous pouvez lancer la palettisation.', textColor: 'text-green-800', subColor: 'text-green-600' }

  const exPaquet = op?.ex_par_paquet
  const exCarton = op?.ex_par_carton || (exPaquet ? exPaquet * 2 : null)
  const crtPal   = op?.cartons_par_palette
  // Calculer poids à la volée si absent mais specs disponibles
  const poidsStored = op?.poids_unitaire_kg
  const poidsCalc = (() => {
    if (poidsStored) return poidsStored
    const pag = op?.pagination
    const fmt = op?.format_document || ''
    const grm = op?.grammage
    if (!pag || !grm || !fmt.includes('x')) return null
    try {
      const [l, h] = fmt.toLowerCase().split('x').map((v: string) => parseFloat(v) / 100)
      return Math.round((pag / 2) * l * h * grm / 1000 * 10000) / 10000
    } catch { return null }
  })()
  const poids = poidsCalc
  const exPal    = exCarton && crtPal ? exCarton * crtPal : null
  const nbPalEst = op?.total_exemplaires && exPal ? Math.ceil(op.total_exemplaires / exPal) : null
  const poidsPal = poids && exPal ? Math.round(exPal * poids) : null

  return (
    <div className="h-full flex flex-col" style={{ minHeight: 0 }}>

      {/* Header */}
      <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between flex-shrink-0 bg-white">
        <div>
          <h1 className="text-base font-semibold text-stone-900">Analyse des données</h1>
          {op?.nom_fichier_import && (
            <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
              <FileSpreadsheet size={11} />
              {op.nom_fichier_import}
              {op.date_import && <span>· {new Date(op.date_import).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>}
            </div>
          )}
        </div>
        <select value={selectedOp} onChange={e => setSelectedOp(e.target.value)}
          className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg bg-white text-stone-700 outline-none focus:border-brand-400">
          {operations.map(o => (
            <option key={o.id} value={o.id}>{o.code_operation} — {o.nom_operation ?? o.code_operation}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-stone-400 text-center py-12">Chargement...</div>
      ) : !op ? (
        <div className="text-center py-16">
          <FileSpreadsheet size={32} className="mx-auto text-stone-300 mb-3" />
          <div className="text-sm text-stone-500">Aucune opération analysée</div>
          <button onClick={() => navigate('/import')}
            className="mt-4 px-4 py-2 text-xs bg-stone-900 text-white rounded-lg hover:opacity-85 transition-all">
            Importer un fichier
          </button>
        </div>
      ) : (
        /* Layout deux colonnes : analyse | chat */
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* Colonne gauche — analyse */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-w-0">

            {/* Verdict */}
            <div className={`${verdictConfig.bg} border ${verdictConfig.border} rounded-xl p-4 flex items-start gap-3`}>
              <div className={`w-2.5 h-2.5 rounded-full ${verdictConfig.dot} flex-shrink-0 mt-1`} />
              <div>
                <div className={`text-sm font-medium ${verdictConfig.textColor}`}>{verdictConfig.title}</div>
                <div className={`text-xs mt-0.5 ${verdictConfig.subColor}`}>{verdictConfig.sub}</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Magasins',    value: op.nb_magasins?.toLocaleString('fr-FR') },
                { label: 'Exemplaires', value: op.total_exemplaires?.toLocaleString('fr-FR') },
                { label: 'Centrales',   value: op.nb_centrales },
                { label: 'PDV',         value: op.nb_palettes_pdv ?? '—' },
              ].map((s, i) => (
                <div key={i} className="bg-stone-50 rounded-lg p-3">
                  <div className="text-[10px] text-stone-400 mb-0.5">{s.label}</div>
                  <div className="text-xl font-semibold text-stone-900">{s.value ?? '—'}</div>
                </div>
              ))}
            </div>

            {/* Contrôles */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
                <div className="text-xs font-medium text-stone-700">Contrôles qualité</div>
              </div>
              {normalizedChecks.length === 0 ? (
                <div className="px-4 py-6 text-xs text-stone-400 text-center">Aucun rapport disponible</div>
              ) : normalizedChecks.map((c, i) => {
                const meta = CHECK_META[c.name]
                const isOk = c.status === 'pass' || c.status === 'ok'
                const impact = isOk ? 'ok' : (meta?.impact ?? 'attention')
                const cfg = IMPACT_CONFIG[impact]
                const Icon = cfg.icon
                const explanation = meta?.explain(c) ?? c.message ?? ''
                const issues = (c.issues || []).filter(Boolean)
                const isExpanded = expandedCheck === c.name

                return (
                  <div key={i} className="border-b border-stone-100 last:border-0">
                    <div className={`flex items-start gap-3 px-4 py-3.5 ${issues.length > 0 ? 'cursor-pointer hover:bg-stone-50' : ''}`}
                      onClick={() => issues.length > 0 && setExpandedCheck(isExpanded ? null : c.name)}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg} border ${cfg.border}`}>
                        <Icon size={12} className={isOk ? 'text-green-600' : impact === 'bloquant' ? 'text-red-600' : impact === 'informatif' ? 'text-blue-600' : 'text-amber-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-stone-800">{meta?.label ?? c.name}</span>
                          {!isOk && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cfg.badge} font-medium`}>
                              {impact}
                            </span>
                          )}
                          {issues.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500 font-medium">
                              {issues.length}
                            </span>
                          )}
                        </div>
                        {explanation && <div className="text-xs text-stone-500 mt-0.5 leading-relaxed">{explanation}</div>}
                      </div>
                      {issues.length > 0 && (
                        isExpanded ? <ChevronDown size={12} className="text-stone-400 flex-shrink-0 mt-1" />
                                   : <ChevronRight size={12} className="text-stone-400 flex-shrink-0 mt-1" />
                      )}
                    </div>
                    {isExpanded && issues.length > 0 && (
                      <div className="px-4 pb-3">
                        <div className="bg-stone-50 rounded-lg border border-stone-200 px-3 py-1">
                          {issues.slice(0, 8).map((issue, j) => (
                            <IssueRow key={j} issue={issue} index={j} />
                          ))}
                          {issues.length > 8 && (
                            <div className="text-[10px] text-stone-400 py-2 text-center">{issues.length - 8} autres non affichés</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Paramètres de palettisation — panneau inline éditable */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">

              {/* En-tête */}
              <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-100">
                <div className="text-xs font-medium text-stone-700">Paramètres de palettisation</div>
                <button onClick={() => setShowEditParams(v => !v)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    showEditParams
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'text-brand-600 border-brand-200 hover:bg-brand-50'
                  }`}>
                  {showEditParams ? '✕ Fermer' : '✎ Modifier'}
                </button>
              </div>

              {/* Résumé compact (toujours visible) */}
              <div className="grid grid-cols-5 gap-2 p-4">
                {[
                  { label: 'Ex/paquet',   value: exPaquet,  sub: 'machine',      warn: true  },
                  { label: 'Ex/carton',   value: exCarton,  sub: exPaquet ? `${exCarton && exPaquet ? Math.round(exCarton/exPaquet) : '?'} paq.` : 'estimé', warn: true },
                  { label: 'Crt/palette', value: crtPal,    sub: 'Frétin',       warn: true  },
                  { label: 'Seuil PDV',   value: op.seuil_pdv?.toLocaleString('fr-FR'), sub: 'exemplaires', warn: true },
                  { label: 'Poids/ex',    value: poids ? `${Math.round(poids * 10000) / 10} g` : null, sub: 'calculé', warn: false },
                ].map((p, i) => (
                  <div key={i} className={`rounded-lg p-2.5 border ${!p.value && p.warn ? 'bg-amber-50 border-amber-200' : 'bg-stone-50 border-stone-200'}`}>
                    <div className="text-[10px] text-stone-400 mb-0.5">{p.label}</div>
                    <div className={`text-base font-semibold ${!p.value && p.warn ? 'text-amber-600' : !p.value ? 'text-stone-400' : 'text-stone-900'}`}>
                      {p.value ?? (p.warn ? '⚠' : '—')}
                    </div>
                    <div className="text-[10px] text-stone-400">{p.sub}</div>
                  </div>
                ))}
              </div>

              {/* Estimation */}
              {(nbPalEst || poidsPal) && !showEditParams && (
                <div className="px-4 pb-3 text-xs text-stone-400 border-t border-stone-100 pt-3">
                  Estimation :
                  {nbPalEst && <span className="text-stone-700 font-medium ml-1">~{nbPalEst} palettes</span>}
                  {poidsPal && <span className="ml-2">· {poidsPal.toLocaleString('fr-FR')} kg/palette</span>}
                  {exPal && <span className="ml-2">· {exPal.toLocaleString('fr-FR')} ex/palette</span>}
                </div>
              )}

              {/* Panneau d'édition inline */}
              {showEditParams && (() => {
                const epq    = parseInt(editParams.ex_par_paquet || '100')
                const nbPaq  = parseInt(editParams.nb_paquets_carton || '2')
                const ectn   = epq * nbPaq
                const crtPl  = parseInt(editParams.cartons_par_palette || '48')
                const seuil  = parseInt(editParams.seuil_pdv || '2800')
                const exPl   = ectn * crtPl
                const poidsPl = poids && exPl ? Math.round(exPl * poids) : null

                // Génération de scénarios simples
                type Scenario = { id: number; label: string; exPaq: number; nbPaq: number; crtPal: number; seuil: number; nbPalEst: number | null; poidsPalEst: number | null; tag: string }
                const scenarios: Scenario[] = [
                  { id: 1, label: 'Standard',     exPaq: epq,   nbPaq: nbPaq, crtPal: crtPl, seuil, tag: 'actuel' },
                  { id: 2, label: 'Compact',      exPaq: epq,   nbPaq: nbPaq, crtPal: Math.min(crtPl + 12, 60), seuil, tag: '' },
                  { id: 3, label: 'Seuil haut',   exPaq: epq,   nbPaq: nbPaq, crtPal: crtPl, seuil: Math.min(seuil + 2000, 6000), tag: '' },
                ].map(s => {
                  const exPalS = s.exPaq * s.nbPaq * s.crtPal
                  const nbPalS = op.total_exemplaires && exPalS ? Math.ceil(op.total_exemplaires / exPalS) : null
                  const poidsPalS = poids && exPalS ? Math.round(exPalS * poids) : null
                  return { ...s, nbPalEst: nbPalS, poidsPalEst: poidsPalS }
                })

                return (
                  <div className="border-t border-stone-200 p-4 space-y-4">

                    {/* Champs éditables */}
                    <div>
                      <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Ajustement</div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'ex_par_paquet',       label: 'Ex / paquet',       hint: 'Multiple machine', ph: '100' },
                          { key: 'nb_paquets_carton',   label: 'Paquets / carton',   hint: `→ ${ectn} ex/carton`, ph: '2' },
                          { key: 'cartons_par_palette', label: 'Cartons / palette',  hint: 'Max Frétin : 48',   ph: '48' },
                          { key: 'seuil_pdv',           label: 'Seuil PDV (ex)',     hint: 'Palette individuelle', ph: '2800' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="text-[10px] text-stone-400 block mb-0.5">{f.label}</label>
                            <input type="number" value={editParams[f.key] ?? ''}
                              onChange={e => setEditParams(p => ({ ...p, [f.key]: e.target.value }))}
                              className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
                              placeholder={f.ph} />
                            <div className="text-[10px] text-stone-400 mt-0.5">{f.hint}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Scénarios */}
                    <div>
                      <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Scénarios</div>
                      <div className="grid grid-cols-3 gap-2">
                        {scenarios.map(s => (
                          <button key={s.id} onClick={() => setEditParams({
                              ex_par_paquet:       String(s.exPaq),
                              nb_paquets_carton:   String(s.nbPaq),
                              cartons_par_palette: String(s.crtPal),
                              seuil_pdv:           String(s.seuil),
                            })}
                            className={`text-left p-3 rounded-xl border transition-all ${
                              s.tag === 'actuel'
                                ? 'border-brand-300 bg-brand-50'
                                : 'border-stone-200 bg-white hover:border-stone-300'
                            }`}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-xs font-semibold text-stone-800">{s.label}</span>
                              {s.tag === 'actuel' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">actuel</span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-500 space-y-0.5">
                              <div>{s.exPaq * s.nbPaq * s.crtPal} ex/palette</div>
                              {s.nbPalEst && <div className="font-medium text-stone-700">~{s.nbPalEst} palettes</div>}
                              {s.poidsPalEst && <div>{s.poidsPalEst.toLocaleString('fr-FR')} kg/pal</div>}
                              <div className="text-stone-400">Seuil PDV {s.seuil.toLocaleString('fr-FR')} ex</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => setShowEditParams(false)}
                        className="px-3 py-1.5 text-xs text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                        Annuler
                      </button>
                      <button onClick={handleSaveParams} disabled={savingParams}
                        className="px-4 py-1.5 text-xs font-medium bg-stone-700 text-white rounded-lg hover:opacity-85 disabled:opacity-40 transition-all">
                        {savingParams ? 'Enregistrement…' : 'Appliquer'}
                      </button>
                      <button onClick={async () => { await handleSaveParams(); navigate(`/palettisation/${op.id}`) }}
                        disabled={savingParams}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-lg hover:opacity-85 disabled:opacity-40 transition-all ml-auto">
                        Appliquer & lancer la palettisation <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* CTA */}
            <div className="flex items-center justify-between pb-2">
              <button onClick={() => navigate('/import')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                <RefreshCw size={11} /> Re-importer
              </button>
              <button onClick={() => navigate(`/palettisation/${op.id}`)}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-stone-900 text-white rounded-xl hover:opacity-85 transition-all">
                {['palettisation','livrables','termine'].includes(op.statut) ? 'Voir la palettisation' : 'Lancer la palettisation'}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Colonne droite — chat IA */}
          <div className="w-80 flex-shrink-0 border-l border-stone-200 flex flex-col bg-white" style={{ minHeight: 0 }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200 flex-shrink-0">
              <Sparkles size={13} className="text-brand-500" />
              <span className="text-sm font-medium text-stone-800">Assistant analyse</span>
            </div>
            <div className="flex-1 min-h-0">
              <AnalyseChat op={op} />
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
