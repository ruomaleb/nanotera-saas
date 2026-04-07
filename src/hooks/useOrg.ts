import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface OrgInfo {
  org_id: string
  org_nom: string
  org_plan: string
  user_role: string
  user_nom: string
  saas_user_id: string
}

let cachedOrg: OrgInfo | null = null

export function useOrg() {
  const [org, setOrg] = useState<OrgInfo | null>(cachedOrg)
  const [loading, setLoading] = useState(!cachedOrg)

  useEffect(() => {
    if (cachedOrg) return

    async function resolve() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('saas_users')
        .select(`
          id, nom,
          memberships:saas_memberships(
            role,
            org:saas_organizations(id, nom, plan)
          )
        `)
        .eq('auth_user_id', user.id)
        .single()

      if (data?.memberships?.[0]?.org) {
        const m = data.memberships[0] as any
        const info: OrgInfo = {
          org_id: m.org.id,
          org_nom: m.org.nom,
          org_plan: m.org.plan,
          user_role: m.role,
          user_nom: data.nom,
          saas_user_id: data.id,
        }
        cachedOrg = info
        setOrg(info)
      }
      setLoading(false)
    }

    resolve()
  }, [])

  return { org, loading }
}
