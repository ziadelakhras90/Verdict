import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  return userId
}
