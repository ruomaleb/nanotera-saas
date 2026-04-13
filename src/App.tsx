import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import { SelectionProvider } from './components/SelectionContext'
import Login from './pages/Login'
import Enseignes from './pages/Enseignes'
import Operations from './pages/Operations'
import NewOperation from './pages/NewOperation'
import OperationDetail from './pages/OperationDetail'
import Supports from './pages/Supports'
import Modeles from './pages/Modeles'
import Import from './pages/Import'
import Analyse from './pages/Analyse'
import Livrables from './pages/Livrables'
import Palettisation from './pages/Palettisation'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import { AdminGlobal, AdminEnseignes, AdminImprimeurs, AdminPrompts } from './pages/AdminPages'
import AdminChatAnalysis from './pages/AdminChatAnalysis'
import AdminTypesPalette from './pages/AdminTypesPalette'
import AiChat from './components/AIChat'

function AiChatWrapper() {
  const location = useLocation()
  // Extraire l'operationId depuis les routes /palettisation/:id, /import, /analyse, /livrables
  const match = location.pathname.match(/\/palettisation\/([a-f0-9-]{36})/)
  const operationId = match?.[1]

  // Extraire un label court depuis les query params ou le pathname
  const pageLabels: Record<string, string> = {
    '/palettisation': 'Palettisation',
    '/import':        'Import',
    '/analyse':       'Analyse',
    '/livrables':     'Livrables',
  }
  const pageBase = '/' + location.pathname.split('/')[1]
  const pageLabel = pageLabels[pageBase]

  if (!pageLabel) return null  // Pas de chat sur les pages admin (Enseignes, Modèles…)

  return (
    <AiChat
      operationId={operationId}
      operationLabel={operationId ? undefined : pageLabel}
    />
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Chargement...</div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <SelectionProvider>
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/enseignes" element={<Enseignes />} />
        <Route path="/supports" element={<Supports />} />
        <Route path="/modeles" element={<Modeles />} />
        <Route path="/operations" element={<Operations />} />
        <Route path="/operations/new" element={<NewOperation />} />
        <Route path="/operations/:operationId" element={<OperationDetail />} />
        <Route path="/import" element={<Import />} />
        <Route path="/analyse" element={<Analyse />} />
        <Route path="/palettisation" element={<Palettisation />} />
        <Route path="/palettisation/:operationId" element={<Palettisation />} />
        <Route path="/livrables" element={<Livrables />} />
        <Route path="/livrables/:operationId" element={<Livrables />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/global" element={<AdminGlobal />} />
        <Route path="/admin/enseignes" element={<AdminEnseignes />} />
        <Route path="/admin/imprimeurs" element={<AdminImprimeurs />} />
        <Route path="/admin/prompts" element={<AdminPrompts />} />
        <Route path="/admin/conversations" element={<AdminChatAnalysis />} />
        <Route path="/admin/palettes" element={<AdminTypesPalette />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AiChatWrapper />
    </Layout>
    </SelectionProvider>
  )
}
