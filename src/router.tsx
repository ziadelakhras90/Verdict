import { createBrowserRouter, Outlet, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Spinner } from '@/components/ui'
import { AppShell } from '@/components/layout'

import Home       from '@/pages/Home'
import Auth       from '@/pages/Auth'
import CreateRoom from '@/pages/CreateRoom'
import JoinRoom   from '@/pages/JoinRoom'
import Lobby      from '@/pages/Lobby'
import RoleCard   from '@/pages/RoleCard'
import Session    from '@/pages/Session'
import JudgePanel from '@/pages/JudgePanel'
import Verdict    from '@/pages/Verdict'
import Reveal     from '@/pages/Reveal'
import Results    from '@/pages/Results'
import NotFound   from '@/pages/NotFound'

function AuthProvider() {
  const { setUser, setProfile, setLoading } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const { data } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single()
        setProfile(data)
      }
      setLoading(false)
      setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          const { data } = await supabase
            .from('profiles').select('*').eq('id', session.user.id).single()
          setProfile(data)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  if (!ready) return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="text-5xl animate-flicker">⚖️</div>
          <Spinner size={24} />
        </div>
      </div>
    </AppShell>
  )
  return <Outlet />
}

function RequireAuth() {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900">
      <Spinner size={28} />
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  {
    element: <AuthProvider />,
    children: [
      { path: '/',     element: <Home /> },
      { path: '/auth', element: <Auth /> },

      {
        element: <RequireAuth />,
        children: [
          { path: '/create',     element: <CreateRoom /> },
          { path: '/join',       element: <JoinRoom /> },
          { path: '/join/:code', element: <JoinRoom /> },

          {
            path: '/room/:id',
            children: [
              { index: true,     element: <Navigate to="lobby" replace /> },
              { path: 'lobby',   element: <Lobby /> },
              { path: 'card',    element: <RoleCard /> },
              { path: 'session', element: <Session /> },
              { path: 'judge',   element: <JudgePanel /> },
              { path: 'verdict', element: <Verdict /> },
              { path: 'reveal',  element: <Reveal /> },
              { path: 'results', element: <Results /> },
            ],
          },
        ],
      },

      { path: '/404', element: <NotFound /> },
      { path: '*',    element: <Navigate to="/" replace /> },
    ],
  },
])
