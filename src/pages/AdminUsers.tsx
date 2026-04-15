/**
 * AdminUsers.tsx
 * Administration des comptes utilisateurs
 * - Liste tous les comptes (Auth + profil saas_users)
 * - Répare les profils manquants (orphan Auth users)
 * - Invite de nouveaux utilisateurs
 * - Modifie les rôles
 * - Réinitialise les mots de passe
 */

import { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import {
  Users, UserPlus, CheckCircle2, AlertTriangle,
  Mail, Shield, Clock, Loader2, X, ChevronDown,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────

interface AdminUser {
  auth_id:      string
  email:        string
  created_at:   string
  last_sign_in: string | null
  saas_user_id: string | null
  nom:          string | null
  role:         string | null
  org_id:       string | null
  org_nom:      string | null
  has_profile:  boolean
}

const ROLES = ['owner', 'admin', 'member', 'viewer'] as const
type Role = typeof ROLES[number]

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner:  { label: 'Propriétaire', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  admin:  { label: 'Administrateur', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  member: { label: 'Membre',        color: 'text-stone-700 bg-stone-50 border-stone-200' },
  viewer: { label: 'Lecteur',       color: 'text-stone-500 bg-stone-50 border-stone-200' },
}

function ago(dateStr: string | null) {
  if (!dateStr) return 'Jamais connecté'
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 30) return `Il y a ${days} j`
  return d.toLocaleDateString('fr-FR')
}

// ── Composant ──────────────────────────────────────────────────

export default function AdminUsers() {
  const { org }                 = useOrg()
  const [users, setUsers]       = useState<AdminUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  // Modale invitation
  const [showInvite, setShowInvite]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNom, setInviteNom]     = useState('')
  const [inviteRole, setInviteRole]   = useState<Role>('member')
  const [inviting, setInviting]       = useState(false)

  function flash(msg: string, isError = false) {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000) }
    else         { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_admin_users')
    if (error) {
      flash('Impossible de charger les utilisateurs : ' + error.message, true)
    } else {
      setUsers((data as AdminUser[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Réparer un profil orphelin ──────────────────────────────

  async function fixProfile(user: AdminUser) {
    if (!org?.org_id) return
    setSaving(user.auth_id)
    try {
      const nom = user.email.split('@')[0]
      // Générer l'UUID côté client pour éviter le SELECT après INSERT (RLS)
      const newId = crypto.randomUUID()

      const { error: e1 } = await supabase
        .from('saas_users')
        .insert({ id: newId, auth_user_id: user.auth_id, email: user.email, nom })
      if (e1) throw e1

      const { error: e2 } = await supabase
        .from('saas_memberships')
        .insert({ user_id: newId, org_id: org.org_id, role: 'member' })
      if (e2) throw e2

      flash(`Profil créé pour ${user.email}`)
      await load()
    } catch (e: any) {
      flash(e.message ?? 'Erreur lors de la création du profil', true)
    }
    setSaving(null)
  }

  // ── Modifier le rôle ────────────────────────────────────────

  async function changeRole(user: AdminUser, newRole: Role) {
    if (!user.saas_user_id) return
    setSaving(user.auth_id)
    try {
      const { error } = await supabase
        .from('saas_memberships')
        .update({ role: newRole })
        .eq('user_id', user.saas_user_id)
      if (error) throw error
      flash(`Rôle mis à jour`)
      await load()
    } catch (e: any) {
      flash(e.message ?? 'Erreur', true)
    }
    setSaving(null)
  }

  // ── Réinitialiser le mot de passe ───────────────────────────

  async function resetPassword(user: AdminUser) {
    setSaving(user.auth_id)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/`,
      })
      if (error) throw error
      flash(`Email de réinitialisation envoyé à ${user.email}`)
    } catch (e: any) {
      flash(e.message ?? 'Erreur', true)
    }
    setSaving(null)
  }

  // ── Inviter un utilisateur ──────────────────────────────────

  async function handleInvite() {
    if (!inviteEmail || !inviteNom || !org?.org_id) return
    setInviting(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://nanotera-api-saas-production.up.railway.app'
      const resp = await fetch(`${apiUrl}/api/users/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:  inviteEmail,
          nom:    inviteNom,
          role:   inviteRole,
          org_id: org.org_id,
        }),
      })
      if (resp.status === 409) throw new Error('Un compte existe déjà avec cet email')
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail ?? `Erreur ${resp.status}`)
      }
      flash(`Invitation envoyée à ${inviteEmail}`)
      setShowInvite(false)
      setInviteEmail('')
      setInviteNom('')
      setInviteRole('member')
      await load()
    } catch (e: any) {
      flash(e.message ?? "Erreur lors de l'invitation", true)
    }
    setInviting(false)
  }

  // ── Rendu ──────────────────────────────────────────────────

  const orphans   = users.filter(u => !u.has_profile)
  const actives   = users.filter(u => u.has_profile)

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-medium text-stone-800">Utilisateurs</h1>
            <p className="text-xs text-stone-400 mt-0.5">
              {actives.length} compte{actives.length > 1 ? 's' : ''} actif{actives.length > 1 ? 's' : ''}
              {orphans.length > 0 && ` · ${orphans.length} sans profil`}
            </p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 text-xs bg-brand-600 text-white
                       px-3 py-2 rounded-lg hover:bg-brand-700 transition-colors"
          >
            <UserPlus size={13} /> Inviter
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle2 size={13} /> {success}
          </div>
        )}

        {/* Comptes sans profil */}
        {orphans.length > 0 && (
          <div className="border border-amber-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              <span className="text-xs font-medium text-amber-700">
                {orphans.length} compte{orphans.length > 1 ? 's' : ''} sans profil applicatif
              </span>
              <span className="text-xs text-amber-500 ml-1">
                — Ces utilisateurs peuvent se connecter mais n'ont pas accès à l'application.
              </span>
            </div>
            {orphans.map(user => (
              <div key={user.auth_id}
                className="flex items-center gap-4 px-4 py-3 border-t border-amber-100 bg-white">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center
                                text-xs font-medium text-stone-500 flex-shrink-0">
                  {user.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-700 truncate">{user.email}</p>
                  <p className="text-xs text-stone-400">
                    Créé le {new Date(user.created_at).toLocaleDateString('fr-FR')}
                    {user.last_sign_in && ` · Dernière connexion : ${ago(user.last_sign_in)}`}
                  </p>
                </div>
                <button
                  onClick={() => fixProfile(user)}
                  disabled={saving === user.auth_id}
                  className="flex items-center gap-1.5 text-xs text-amber-700 border border-amber-300
                             bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors
                             disabled:opacity-50"
                >
                  {saving === user.auth_id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <UserPlus size={12} />
                  }
                  Créer le profil
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Comptes actifs */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-stone-300" />
          </div>
        ) : (
          <div className="border border-stone-200 rounded-xl overflow-hidden">
            {actives.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-400">
                Aucun utilisateur avec profil complet.
              </div>
            ) : (
              actives.map((user, idx) => {
                const roleInfo = ROLE_LABELS[user.role ?? 'member']
                const initials = (user.nom ?? user.email)
                  .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

                return (
                  <div key={user.auth_id}
                    className={`flex items-center gap-4 px-4 py-3 ${idx > 0 ? 'border-t border-stone-100' : ''}`}>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center
                                    text-xs font-medium text-brand-600 flex-shrink-0">
                      {initials}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-stone-800 truncate">
                          {user.nom ?? user.email}
                        </p>
                        {user.nom && (
                          <span className="text-xs text-stone-400 truncate hidden sm:block">
                            {user.email}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-stone-400">
                          <Clock size={11} /> {ago(user.last_sign_in)}
                        </span>
                      </div>
                    </div>

                    {/* Sélecteur de rôle */}
                    <div className="relative flex-shrink-0">
                      <select
                        value={user.role ?? 'member'}
                        disabled={saving === user.auth_id}
                        onChange={e => changeRole(user, e.target.value as Role)}
                        className={`text-xs border rounded-lg px-2 py-1.5 pr-6 appearance-none
                                    cursor-pointer transition-colors disabled:opacity-50 ${roleInfo.color}`}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                        ))}
                      </select>
                      {saving === user.auth_id
                        ? <Loader2 size={11} className="absolute right-1.5 top-2 animate-spin text-stone-400" />
                        : <ChevronDown size={11} className="absolute right-1.5 top-2 text-stone-400 pointer-events-none" />
                      }
                    </div>

                    {/* Reset password */}
                    <button
                      onClick={() => resetPassword(user)}
                      disabled={saving === user.auth_id}
                      title="Envoyer un email de réinitialisation"
                      className="text-stone-300 hover:text-stone-500 transition-colors disabled:opacity-30"
                    >
                      <Mail size={15} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Légende des rôles */}
        <div className="text-xs text-stone-400 space-y-1">
          <p className="font-medium text-stone-500 mb-2">Rôles</p>
          {ROLES.map(r => (
            <div key={r} className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded border text-xs ${ROLE_LABELS[r].color}`}>
                {ROLE_LABELS[r].label}
              </span>
              <span className="text-stone-400">
                {r === 'owner'  && '— Accès complet, peut gérer les utilisateurs et l\'organisation'}
                {r === 'admin'  && '— Accès complet sauf gestion de l\'organisation'}
                {r === 'member' && '— Peut créer et gérer des opérations'}
                {r === 'viewer' && '— Lecture seule'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modale invitation ─────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4"
             onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="bg-white rounded-xl border border-stone-200 w-full max-w-md p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-800">Inviter un utilisateur</h2>
              <button onClick={() => setShowInvite(false)}
                className="text-stone-400 hover:text-stone-600">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Nom complet</label>
                <input
                  type="text"
                  value={inviteNom}
                  onChange={e => setInviteNom(e.target.value)}
                  placeholder="Céline Luttringer"
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2
                             focus:outline-none focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Adresse email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="c.luttringer@nanotera.eu"
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2
                             focus:outline-none focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Rôle initial</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as Role)}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2"
                >
                  {ROLES.filter(r => r !== 'owner').map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-stone-50 rounded-lg px-3 py-2 text-xs text-stone-500">
              Un email de connexion sera envoyé. L'utilisateur devra cliquer sur le lien
              pour activer son compte. Son profil sera créé automatiquement.
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowInvite(false)}
                className="text-xs text-stone-500 px-3 py-2 rounded-lg border border-stone-200 hover:bg-stone-50">
                Annuler
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail || !inviteNom || inviting}
                className="flex items-center gap-1.5 text-xs bg-brand-600 text-white
                           px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {inviting ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                Envoyer l'invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
