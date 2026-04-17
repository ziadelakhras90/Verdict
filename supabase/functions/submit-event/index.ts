// supabase/functions/submit-event/index.ts
// Guards event submission using room status, current session, and session_ends_at.
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const MAX_EVENT_LENGTH = 300

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

    const { roomId, sessionNum, content, eventType = 'statement', sessionEndsAt } = await req.json()

    if (!roomId) throw new Error('roomId is required')
    if (!sessionNum || typeof sessionNum !== 'number') throw new Error('sessionNum is required')
    if (!['statement', 'question', 'objection'].includes(eventType)) throw new Error('invalid event type')

    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    if (!trimmedContent) throw new Error('content is required')
    if (trimmedContent.length > MAX_EVENT_LENGTH) throw new Error('content exceeds limit')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: membership, error: membershipErr } = await admin
      .from('room_players')
      .select('role')
      .eq('room_id', roomId)
      .eq('player_id', user.id)
      .maybeSingle()

    if (membershipErr) throw membershipErr
    if (!membership) throw new Error('Not a room member')
    if (membership.role === 'judge') throw new Error('Judge cannot submit session events')

    const { data: room, error: roomErr } = await admin
      .from('game_rooms')
      .select('status, current_session, session_ends_at')
      .eq('id', roomId)
      .single()

    if (roomErr || !room) throw new Error('Room not found')

    const endsAt = room.session_ends_at ? new Date(room.session_ends_at).getTime() : null
    const clientEndsAt = typeof sessionEndsAt === 'string' ? Date.parse(sessionEndsAt) : null
    const now = Date.now()

    const closed = (
      room.status !== 'in_session' ||
      room.current_session !== sessionNum ||
      !endsAt ||
      endsAt <= now ||
      (clientEndsAt != null && Number.isFinite(clientEndsAt) && clientEndsAt !== endsAt)
    )

    if (closed) {
      return new Response(
        JSON.stringify({
          ok: true,
          code: 'session_expired',
          session_ends_at: room.session_ends_at,
          room_status: room.status,
          current_session: room.current_session,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: insertErr } = await admin
      .from('game_events')
      .insert({
        room_id: roomId,
        player_id: user.id,
        event_type: eventType,
        session_num: sessionNum,
        content: trimmedContent,
      })

    if (insertErr) throw insertErr

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[submit-event]', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
