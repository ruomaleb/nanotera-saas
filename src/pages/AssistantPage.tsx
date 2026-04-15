/**
 * AssistantPage.tsx
 * Page de transition vers l'agent Chainlit.
 * Récupère le JWT Supabase et navigue en pleine page vers /sso?token=<jwt>.
 * Pas d'iframe — évite les restrictions navigateur sur les cookies cross-origin.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2, MessageSquare, ExternalLink } from 'lucide-react'

const CHAINLIT_BASE = 'https://nanotera-logistics-agent-production.up.railway.app'

export default function AssistantPage() {
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'error'>('loading')

  useEffect(() => {
    async function redirect() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setStatus('redirecting')

        const target = session?.access_token
          ? `${CHAINLIT_BASE}/sso?token=${session.access_token}`
          : `${CHAINLIT_BASE}/login-form`

        // Navigation pleine page — contourne les restrictions iframe/cookies
        window.location.href = target
      } catch {
        setStatus('error')
      }
    }
    redirect()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">

      <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
        <MessageSquare size={22} className="text-amber-600" />
      </div>

      {status === 'loading' || status === 'redirecting' ? (
        <>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-stone-700">Ouverture de l'assistant…</p>
            <p className="text-xs text-stone-400">Connexion automatique en cours</p>
          </div>
          <Loader2 size={20} className="text-stone-300 animate-spin" />
        </>
      ) : (
        <>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-stone-700">Impossible d'ouvrir l'assistant</p>
            <p className="text-xs text-stone-400">L'agent est peut-être temporairement indisponible</p>
          </div>
          <a
            href={CHAINLIT_BASE}
            className="flex items-center gap-2 text-xs text-brand-600 hover:underline"
          >
            <ExternalLink size={12} />
            Ouvrir manuellement
          </a>
        </>
      )}
    </div>
  )
}
