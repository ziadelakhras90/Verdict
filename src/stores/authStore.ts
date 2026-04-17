import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'

interface AuthStore {
  user:     User | null
  profile:  Profile | null
  loading:  boolean
  setUser:     (user: User | null) => void
  setProfile:  (profile: Profile | null) => void
  setLoading:  (v: boolean) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user:    null,
  profile: null,
  loading: true,
  setUser:    (user)    => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
}))
