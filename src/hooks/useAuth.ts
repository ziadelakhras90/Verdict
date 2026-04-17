import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useAuthStore } from '@/stores/authStore'

const PREFERRED_NAME_KEY = 'courthouse-preferred-name'

async function safeFetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export function getPreferredNameValue() {
  return localStorage.getItem(PREFERRED_NAME_KEY) ?? ''
}

export function useAuth() {
  const { user, profile, loading, setUser, setProfile, setLoading } = useAuthStore()

  useEffect(() => {
    let mounted = true

    const syncSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        setUser(session?.user ?? null)
        setLoading(false)

        if (session?.user) {
          try {
            const profileData = await safeFetchProfile(session.user.id)
            if (!mounted) return
            setProfile(profileData)
          } catch {
            if (!mounted) return
            setProfile(null)
          }
        } else {
          setProfile(null)
        }
      } catch {
        if (!mounted) return
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    }

    void syncSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!mounted) return

      setUser(session?.user ?? null)
      setLoading(false)

      if (!session?.user) {
        setProfile(null)
        return
      }

      setTimeout(async () => {
        if (!mounted) return
        try {
          const profileData = await safeFetchProfile(session.user.id)
          if (!mounted) return
          setProfile(profileData)
        } catch {
          if (!mounted) return
          setProfile(null)
        }
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [setLoading, setProfile, setUser])

  async function enterAsGuest(username: string) {
    const trimmed = username.trim()
    if (!trimmed) throw new Error('اسم اللاعب مطلوب')

    const { data: existingSession } = await supabase.auth.getSession()

    if (!existingSession.session) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) {
        if (error.message?.toLowerCase().includes('anonymous')) {
          throw new Error('فعّل Anonymous Sign-Ins من إعدادات Supabase Auth ثم حاول مرة أخرى')
        }
        throw error
      }
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!userData.user) throw new Error('تعذر إنشاء جلسة ضيف')

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userData.user.id,
          username: trimmed,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single()

    if (error) throw error

    localStorage.setItem(PREFERRED_NAME_KEY, trimmed)
    setUser(userData.user)
    setProfile(data)
    setLoading(false)
    return data
  }

  function getPreferredName() {
    return getPreferredNameValue()
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setLoading(false)
  }

  return { user, profile, loading, enterAsGuest, getPreferredName, signOut }
}
