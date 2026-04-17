// supabase/functions/advance-session/index.ts
// Advance the room from session 1 -> 2 -> 3 -> verdict.
// Only the judge can do this.
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type Room = {
  id: string
  host_id: string
  case_id: string | null
  status: string
  current_session: number
  session_duration_seconds: number
  session_ends_at: string | null
}

type RoomPlayer = {
  id: string
  room_id: string
  player_id: string
  role: string | null
  is_ready: boolean
  is_host: boolean
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    const body = await req.json()
    console.log('advance-session body:', JSON.stringify(body))

    const roomId = body.roomId ?? body.room_id ?? body.id
    const requesterId = body.requesterId ?? body.requester_id ?? body.playerId ?? null

    if (!roomId) {
      return new Response(JSON.stringify({
        ok: false,
        success: false,
        step: 'validate_body',
        error: 'roomId is required',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!requesterId) {
      return new Response(JSON.stringify({
        ok: false,
        success: false,
        step: 'validate_body',
        error: 'requesterId is required',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    const { data: room, error: roomErr } = await admin
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single<Room>()

    if (roomErr || !room) {
      console.error('[advance-session] fetch_room failed:', roomErr)
      return new Response(JSON.stringify({
        ok: false,
        success: false,
        step: 'fetch_room',
        error: roomErr?.message ?? 'Room not found',
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: requesterPlayer, error: requesterErr } = await admin
      .from('room_players')
      .select('*')
      .eq('room_id', roomId)
      .eq('player_id', requesterId)
      .single<RoomPlayer>()

    if (requesterErr || !requesterPlayer) {
      console.error('[advance-session] fetch_requester failed:', requesterErr)
      return new Response(JSON.stringify({
        ok: false,
        success: false,
        step: 'fetch_requester',
        error: requesterErr?.message ?? 'Requester not found in room',
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (requesterPlayer.role !== 'judge') {
      return new Response(JSON.stringify({
        ok: false,
        success: false,
        step: 'judge_check',
        error: 'Only judge can advance the session',
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (room.status !== 'in_session') {
      return new Response(JSON.stringify({
        ok: true,
        success: true,
        idempotent: true,
        step: 'validate_room_status',
        room: room,
        message: 'Room is not currently in session mode',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const currentSession = room.current_session ?? 1
    let nextStatus = 'in_session'
    let nextSession = currentSession
    let nextEndsAt: string | null = null
    let systemMessage = ''

    if (currentSession < 3) {
      nextSession = currentSession + 1
      nextStatus = 'in_session'
      nextEndsAt = new Date(Date.now() + room.session_duration_seconds * 1000).toISOString()
      systemMessage = `بدأت جلسة الاستماع رقم ${nextSession}`
    } else {
      nextSession = 3
      nextStatus = 'verdict'
      nextEndsAt = null
      systemMessage = 'انتهت جلسات الاستماع. انتقلت اللعبة إلى مرحلة الحكم.'
    }

    const { error: updateErr } = await admin
      .from('game_rooms')
      .update({
        status: nextStatus,
        current_session: nextSession,
        session_ends_at: nextEndsAt,
      })
      .eq('id', roomId)

    if (updateErr) {
      console.error('[advance-session] update_room failed:', updateErr)
      return new Response(JSON.stringify({
        ok: false,
        success: false,
        step: 'update_room',
        error: updateErr.message,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const eventSessionNum = nextStatus === 'verdict' ? currentSession : nextSession
    const { error: eventErr } = await admin
      .from('game_events')
      .insert({
        room_id: roomId,
        player_id: null,
        event_type: 'system',
        session_num: eventSessionNum,
        content: systemMessage,
      })

    if (eventErr) {
      console.error('[advance-session] insert_system_event failed:', eventErr)
      return new Response(JSON.stringify({
        ok: false,
        success: false,
        step: 'insert_system_event',
        error: eventErr.message,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: updatedRoom, error: refetchErr } = await admin
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single<Room>()

    if (refetchErr || !updatedRoom) {
      console.error('[advance-session] refetch_room failed:', refetchErr)
      return new Response(JSON.stringify({
        ok: false,
        success: false,
        step: 'refetch_room',
        error: refetchErr?.message ?? 'Could not refetch room',
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      ok: true,
      success: true,
      step: 'done',
      room: updatedRoom,
      moved_to: nextStatus === 'verdict' ? 'verdict' : `session_${nextSession}`,
      message: systemMessage,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[advance-session] catch:', msg)
    return new Response(JSON.stringify({
      ok: false,
      success: false,
      step: 'catch',
      error: msg,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
