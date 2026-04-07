import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
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
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/enseignes" replace />} />
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
        <Route path="*" element={<Navigate to="/enseignes" replace />} />
      </Routes>
    </Layout>
  )
}
