/**
 * AssistantPage.tsx
 * Page /assistant dans le SaaS — Chainlit intégré en iframe pleine hauteur
 * - Récupère le JWT Supabase actif
 * - Charge Chainlit via /sso?token=<jwt>
 * - Pleine hauteur, zéro chrome superflu
 */

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react'

const CHAINLIT_BASE = 'https://nanotera-logistics-agent-production.up.railway.app'

export default function AssistantPage() {
  const [src, setSrc]         = useState<string | null>(null)
  const [error, setError]     = useState(false)
  const [loaded, setLoaded]   = useState(false)
  const iframeRef             = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    async function buildUrl() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          setSrc(`${CHAINLIT_BASE}/sso?token=${session.access_token}`)
        } else {
          // Pas de session → Chainlit affiche son propre login
          setSrc(CHAINLIT_BASE)
        }
      } catch {
        setSrc(CHAINLIT_BASE)
      }
    }
    buildUrl()
  }, [])

  return (
    <div
      style={{ height: 'calc(100vh - 56px)' }}   // 56px = hauteur du header Layout
      className="flex flex-col"
    >
      {/* Barre contextuelle minimale */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-stone-100 bg-white flex-shrink-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${loaded ? 'bg-emerald-400' : 'bg-stone-200'}`} />
        <span className="text-xs text-stone-500">
          {loaded ? 'Agent connecté' : 'Connexion en cours…'}
        </span>
        <div className="flex-1" />
        <a
          href={CHAINLIT_BASE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          title="Ouvrir dans un nouvel onglet"
        >
          <ExternalLink size={12} />
          Plein écran
        </a>
      </div>

      {/* Zone iframe */}
      <div className="flex-1 relative">

        {/* Loader */}
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-50 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={24} className="text-stone-300 animate-spin" />
              <p className="text-xs text-stone-400">Chargement de l'assistant…</p>
            </div>
          </div>
        )}

        {/* Erreur */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-50 z-10">
            <div className="flex flex-col items-center gap-3 text-center max-w-xs">
              <AlertTriangle size={24} className="text-amber-400" />
              <p className="text-sm text-stone-600">L'assistant est temporairement indisponible.</p>
              <a
                href={CHAINLIT_BASE}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-600 hover:underline"
              >
                Ouvrir dans un onglet →
              </a>
            </div>
          </div>
        )}

        {/* L'iframe elle-même */}
        {src && (
          <iframe
            ref={iframeRef}
            src={src}
            title="Agent Logistique Nanotera"
            className="w-full h-full border-0"
            allow="clipboard-write"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            // Sécurité : pas de sandbox pour que Chainlit puisse fonctionner pleinement
          />
        )}
      </div>
    </div>
  )
}
