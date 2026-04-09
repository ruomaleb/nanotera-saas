/**
 * Dashboard.tsx — Page d'accueil
 * Créer/reprendre une opération + opérations récentes
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOpContext } from '../components/Layout'
import { Plus, ArrowRight, Clock, CheckCircle2, Loader2, Upload, Layers, Download, ScanLine } from 'lucide-react'

interface Operation {
  id: string
  code_operation: string
  nom_operation: string | null
  statut: string
  total_exemplaires: number | null
  nb_palettes: number | null
  created_at: string
}

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  import:        { label: 'Import',        color: '#854F0B', bg: '#FEF3E2', icon: Upload },
  analyse:       { label: 'Analyse',       color: '#185FA5', bg: '#E6F1FB', icon: ScanLine },
  palettisation: { label: 'Palettisation', color: '#534AB7', bg: '#EEECFC', icon: Layers },
  livrables:     { label: 'Livrables',     color: '#1B7A35', bg: '#E5F5E8', icon: Download },
  termine:       { label: 'Terminé',       color: '#5F5E5A', bg: '#F0EDE8', icon: CheckCircle2 },
}

const WORKFLOW_ROUTES: Record<string, (id: string) => string> = {
  import:        () => '/import',
  analyse:       () => '/analyse',
  palettisation: (id) => `/palettisation/${id}`,
  livrables:     () => '/livrables',
  termine:       () => '/livrables',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { setCurrentOp } = useOpContext()
  const [ops, setOps]     = useState<Operation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('ops_operations')
      .select('id, code_operation, nom_operation, statut, total_exemplaires, nb_palettes, created_at')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => { setOps(data ?? []); setLoading(false) })
  }, [])

  const openOp = (op: Operation) => {
    setCurrentOp({ id: op.id, code: op.code_operation, nom: op.nom_operation ?? '', statut: op.statut })
    const route = WORKFLOW_ROUTES[op.statut]?.(op.id) ?? '/operations'
    navigate(route)
  }

  const inProgress = ops.filter(o => o.statut !== 'termine')
  const done       = ops.filter(o => o.statut === 'termine')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A', margin: 0 }}>Accueil</h1>
        <p style={{ fontSize: 14, color: '#888', marginTop: 4 }}>Créer une opération ou reprendre où vous en étiez.</p>
      </div>

      {/* CTA principal */}
      <button onClick={() => navigate('/operations/new')}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 16,
          padding: '20px 24px', borderRadius: 12,
          background: '#1A1A1A', border: 'none', cursor: 'pointer',
          marginBottom: 24, transition: 'opacity .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Plus size={20} style={{ color: '#fff' }} />
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>Nouvelle opération</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>Importer un fichier de répartition et générer les livrables</div>
        </div>
        <ArrowRight size={18} style={{ color: 'rgba(255,255,255,.4)', flexShrink: 0 }} />
      </button>

      {/* Opérations en cours */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 13, padding: '16px 0' }}>
          <Loader2 size={14} className="animate-spin" /> Chargement…
        </div>
      ) : (
        <>
          {inProgress.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Clock size={14} style={{ color: '#888' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  En cours — {inProgress.length} opération{inProgress.length > 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {inProgress.map(op => {
                  const cfg = STATUT_CONFIG[op.statut] ?? STATUT_CONFIG.import
                  const Icon = cfg.icon
                  return (
                    <button key={op.id} onClick={() => openOp(op)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 10,
                        background: '#fff', border: '1px solid #E8E6E0',
                        cursor: 'pointer', textAlign: 'left', transition: 'all .1s',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6B52C8'; (e.currentTarget as HTMLButtonElement).style.background = '#FAFAF8' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E8E6E0'; (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={16} style={{ color: cfg.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>{op.code_operation}</div>
                        {op.nom_operation && (
                          <div style={{ fontSize: 12, color: '#888', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.nom_operation}</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {op.total_exemplaires && (
                          <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>
                            {op.total_exemplaires.toLocaleString()} ex
                          </div>
                        )}
                      </div>
                      <ArrowRight size={14} style={{ color: '#D5D2CA', flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <CheckCircle2 size={14} style={{ color: '#888' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Récemment terminées
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {done.slice(0, 3).map(op => (
                  <button key={op.id} onClick={() => openOp(op)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px', borderRadius: 8,
                      background: '#fff', border: '1px solid #F0EDE8',
                      cursor: 'pointer', textAlign: 'left', opacity: .75,
                      fontFamily: 'inherit', transition: 'opacity .1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '.75')}
                  >
                    <CheckCircle2 size={15} style={{ color: '#0F6E56', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', flex: 1 }}>{op.code_operation}</span>
                    {op.nb_palettes && <span style={{ fontSize: 12, color: '#888' }}>{op.nb_palettes} palettes</span>}
                    <span style={{ fontSize: 11, color: '#aaa' }}>{new Date(op.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                  </button>
                ))}
              </div>
              {done.length > 3 && (
                <button onClick={() => navigate('/operations')}
                  style={{ fontSize: 12, color: '#6B52C8', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, padding: 0, fontFamily: 'inherit' }}>
                  Voir toutes les opérations →
                </button>
              )}
            </section>
          )}

          {ops.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#aaa', fontSize: 14 }}>
              Aucune opération pour l'instant.<br />
              <button onClick={() => navigate('/operations/new')}
                style={{ color: '#6B52C8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginTop: 8, fontFamily: 'inherit' }}>
                Créer la première opération →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
