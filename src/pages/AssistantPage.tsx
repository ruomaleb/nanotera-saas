/**
 * AssistantPage.tsx
 * Chainlit intégré en iframe — auth via /login-form (même origin Railway)
 * Le SSO automatique est abandonné au profit d'un login simplifié :
 * l'utilisateur se connecte une fois dans l'iframe, Railway garde la session.
 */

import { useRef, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'

const CHAINLIT_BASE = 'https://nanotera-logistics-agent-production.up.railway.app'

export default function AssistantPage() {
  const [loaded, setLoaded] = useState(false)
  const [error,  setError]  = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // On charge directement /login-form — si déjà connecté (cookie Railway),
  // Chainlit redirige automatiquement vers le chat via header_auth_callback.
  // Si pas connecté, l'utilisateur voit le formulaire de login.
  const src = `${CHAINLIT_BASE}/login-form`

  return (
    <div
      style={{ height: 'calc(100vh - 56px)' }}
      className="flex flex-col"
    >
      {/* Barre contextuelle */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-stone-100 bg-white flex-shrink-0">
        <div className={`w-2 h-2 rounded-full transition-colors ${loaded ? 'bg-emerald-400' : 'bg-stone-200 animate-pulse'}`} />
        <span className="text-xs text-stone-500">
          {loaded ? 'Assistant IA' : 'Chargement…'}
        </span>
        <div className="flex-1" />
        <a
          href={CHAINLIT_BASE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          <ExternalLink size={12} /> Plein écran
        </a>
      </div>

      {/* Zone iframe */}
      <div className="flex-1 relative">
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-50 z-10">
            <Loader2 size={20} className="text-stone-300 animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-50 z-10">
            <div className="text-center space-y-2">
              <p className="text-sm text-stone-500">Assistant temporairement indisponible.</p>
              <a href={CHAINLIT_BASE} target="_blank" rel="noopener noreferrer"
                className="text-xs text-brand-600 hover:underline">
                Ouvrir dans un onglet →
              </a>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={src}
          title="Agent Logistique Nanotera"
          className="w-full h-full border-0"
          allow="clipboard-write"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      </div>
    </div>
  )
}
