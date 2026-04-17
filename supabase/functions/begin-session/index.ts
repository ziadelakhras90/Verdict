// supabase/functions/begin-session/index.ts
// Called by host after all players have read their role cards.
// Transitions room from 'starting' → 'in_session' and starts the timer.
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function adminClient() {
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(Deno.env.get('SUPABASE_URL')!, serviceKey!)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) throw new Error('Unauthorized')

    const { roomId } = await req.json()
    if (!roomId) throw new Error('roomId is required')

    const admin = adminClient()

    const { data: room, error: roomErr } = await admin
      .from('game_rooms').select('*').eq('id', roomId).single()
    if (roomErr || !room) throw new Error('Room not found')
    if (room.host_id !== user.id) throw new Error('Only host can begin session')
    if (room.status !== 'starting') throw new Error('Room not in starting phase')

    const sessionEndsAt = new Date(Date.now() + room.session_duration_seconds * 1000).toISOString()

    const { error: updateErr } = await admin
      .from('game_rooms')
      .update({ status: 'in_session', current_session: 1, session_ends_at: sessionEndsAt })
      .eq('id', roomId)
    if (updateErr) throw updateErr

    await admin.from('game_events').insert({
      room_id: roomId,
      player_id: null,
      event_type: 'system',
      session_num: 1,
      content: 'انطلقت المحاكمة — الجلسة الأولى تبدأ الآن',
    })

    return new Response(JSON.stringify({ ok: true, session_ends_at: sessionEndsAt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[begin-session]', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
