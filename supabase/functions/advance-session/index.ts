// supabase/functions/advance-session/index.ts
// Only the judge can advance sessions or move the room into verdict phase.
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
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) throw new Error('Unauthorized')

    const { roomId } = await req.json()
    if (!roomId) throw new Error('roomId is required')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: judgeMembership, error: judgeErr } = await admin
      .from('room_players')
      .select('role')
      .eq('room_id', roomId)
      .eq('player_id', user.id)
      .single()
    if (judgeErr || !judgeMembership || judgeMembership.role !== 'judge') {
      throw new Error('Only the judge can advance the session')
    }

    const { data: room, error: roomErr } = await admin
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single()
    if (roomErr || !room) throw new Error('Room not found')
    if (room.status !== 'in_session') {
      return new Response(JSON.stringify({ ok: true, idempotent: true, status: room.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const nextSession = room.current_session + 1
    let update: Record<string, unknown>
    let systemMsg: string
    let responsePhase: string | number

    if (nextSession > 3) {
      update = { status: 'verdict', current_session: 3, session_ends_at: null }
      systemMsg = 'انتهت الجلسات — على القاضي إصدار الحكم الآن'
      responsePhase = 'verdict'
    } else {
      const sessionEndsAt = new Date(Date.now() + room.session_duration_seconds * 1000).toISOString()
      update = { current_session: nextSession, session_ends_at: sessionEndsAt }
      systemMsg = `بدأت الجلسة ${nextSession}`
      responsePhase = nextSession
    }

    const { error: updateErr } = await admin
      .from('game_rooms')
      .update(update)
      .eq('id', roomId)
      .eq('current_session', room.current_session)
      .eq('status', 'in_session')
    if (updateErr) throw updateErr

    await admin.from('game_events').insert({
      room_id: roomId,
      player_id: null,
      event_type: 'system',
      session_num: room.current_session,
      content: systemMsg,
    })

    return new Response(JSON.stringify({ ok: true, next_session: responsePhase }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[advance-session]', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
