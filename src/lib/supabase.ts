import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession:  true,
    autoRefreshToken: true,
    storageKey: 'courthouse-auth',
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  }
})

export async function callEdgeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(
    `${supabaseUrl}/functions/v1/${name}`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    }
  )

  const result = await response.json()
  if (!result.ok) throw new Error(result.error ?? 'Edge function error')
  return result as T
}
