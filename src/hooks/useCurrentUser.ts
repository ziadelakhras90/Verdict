import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUserId(session?.user?.id ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return userId
}
