// supabase/functions/begin-session/index.ts
// Called by host after all players have read their role cards.
// Transitions room from 'starting' → 'in_session' and starts the timer.
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

    const { roomId, expectedStatus = 'starting' } = await req.json()
    if (!roomId) throw new Error('roomId is required')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: room, error: roomErr } = await admin
      .from('game_rooms').select('*').eq('id', roomId).single()
    if (roomErr || !room) throw new Error('Room not found')
    if (room.host_id !== user.id) throw new Error('Only host can begin session')

    if (room.status === 'in_session') {
      return new Response(
        JSON.stringify({
          ok: true,
          idempotent: true,
          stale_request: expectedStatus !== 'in_session',
          session_ends_at: room.session_ends_at,
          room_status: room.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (expectedStatus && room.status !== expectedStatus) {
      return new Response(
        JSON.stringify({
          ok: true,
          idempotent: true,
          stale_request: true,
          session_ends_at: room.session_ends_at,
          room_status: room.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (room.status !== 'starting') throw new Error('Room not in starting phase')

    const sessionEndsAt = new Date(Date.now() + room.session_duration_seconds * 1000).toISOString()

    const { data: updatedRooms, error: updateErr } = await admin
      .from('game_rooms')
      .update({ status: 'in_session', current_session: 1, session_ends_at: sessionEndsAt })
      .eq('id', roomId)
      .eq('status', 'starting')
      .select('id')

    if (updateErr) throw updateErr
    if (!updatedRooms || updatedRooms.length === 0) {
      const { data: latestRoom } = await admin
        .from('game_rooms')
        .select('status, session_ends_at')
        .eq('id', roomId)
        .single()

      return new Response(
        JSON.stringify({
          ok: true,
          idempotent: true,
          stale_request: true,
          session_ends_at: latestRoom?.session_ends_at ?? room.session_ends_at,
          room_status: latestRoom?.status ?? room.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: existingSystemEvent } = await admin
      .from('game_events')
      .select('id')
      .eq('room_id', roomId)
      .eq('event_type', 'system')
      .eq('session_num', 1)
      .eq('content', 'انطلقت المحاكمة — الجلسة الأولى تبدأ الآن')
      .limit(1)
      .maybeSingle()

    if (!existingSystemEvent) {
      await admin.from('game_events').insert({
        room_id: roomId, player_id: null, event_type: 'system',
        session_num: 1, content: 'انطلقت المحاكمة — الجلسة الأولى تبدأ الآن',
      })
    }

    return new Response(
      JSON.stringify({ ok: true, session_ends_at: sessionEndsAt, room_status: 'in_session' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[begin-session]', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
