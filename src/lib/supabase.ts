import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'courthouse-auth',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

export async function callEdgeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let result: any = null
  try {
    result = text ? JSON.parse(text) : null
  } catch {
    result = { ok: false, error: text || 'Invalid edge function response' }
  }

  if (!response.ok || !result?.ok) {
    throw new Error(result?.error ?? `Edge function error (${response.status})`)
  }

  return result as T
}
