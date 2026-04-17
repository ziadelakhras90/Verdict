import { createClient } from '@supabase/supabase-js'
import { normalizeErrorMessage } from '@/lib/utils'

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

  let response: Response
  try {
    response = await fetch(
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
  } catch (error) {
    throw new Error(normalizeErrorMessage(error, 'تعذر الاتصال بالخادم'))
  }

  let result: unknown = null
  try {
    result = await response.json()
  } catch {
    if (!response.ok) {
      throw new Error(`فشل الطلب (${response.status})`)
    }
  }

  if (!response.ok) {
    const message = result && typeof result === 'object' && 'error' in result
      ? normalizeErrorMessage((result as { error?: unknown }).error, `فشل الطلب (${response.status})`)
      : `فشل الطلب (${response.status})`
    throw new Error(message)
  }

  if (result && typeof result === 'object' && 'ok' in result && !(result as { ok?: boolean }).ok) {
    throw new Error(normalizeErrorMessage(result, 'Edge function error'))
  }

  return result as T
}
