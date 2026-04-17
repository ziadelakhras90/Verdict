// supabase/functions/start-game/index.ts
// Host starts the game: choose a matching case, assign deterministic core roles,
// store secret cards, and move room to the role-card phase ('starting').
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type Role = 'defendant' | 'defense_attorney' | 'prosecutor' | 'judge' | 'deputy' | 'witness'

type CaseRoleCard = {
  id: string
  case_id: string
  role: Role
  private_info: string
  win_condition: string
}

function adminClient() {
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(Deno.env.get('SUPABASE_URL')!, serviceKey!)
}

function userClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}

function getRolesForPlayerCount(count: number): Role[] {
  if (count === 4) return ['defendant', 'defense_attorney', 'prosecutor', 'judge']
  if (count === 5) return ['defendant', 'defense_attorney', 'prosecutor', 'judge', 'witness']
  return ['defendant', 'defense_attorney', 'prosecutor', 'judge', 'witness', 'deputy']
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const client = userClient(authHeader)
    const { data: { user }, error: authError } = await client.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { roomId, requesterId } = await req.json()
    if (!roomId) throw new Error('roomId is required')
    if (requesterId && requesterId !== user.id) throw new Error('Requester mismatch')

    const admin = adminClient()

    const { data: room, error: roomErr } = await admin
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single()
    if (roomErr || !room) throw new Error('Room not found')
    if (room.host_id !== user.id) throw new Error('Only host can start game')
    if (room.status !== 'waiting') throw new Error('Game already started')

    const { data: players, error: playersErr } = await admin
      .from('room_players')
      .select('player_id, is_ready')
      .eq('room_id', roomId)
    if (playersErr || !players) throw new Error('Failed to fetch players')

    const playerCount = players.length
    if (playerCount < 4) throw new Error(`Need at least 4 players, have ${playerCount}`)
    if (players.some((p: any) => !p.is_ready)) throw new Error('ليس كل اللاعبين جاهزين')

    const roles = getRolesForPlayerCount(playerCount)

    const { data: cases, error: casesErr } = await admin
      .from('case_templates')
      .select('*')
      .eq('is_active', true)
      .lte('min_players', playerCount)
      .gte('max_players', playerCount)
    if (casesErr) throw new Error('Failed to fetch cases: ' + casesErr.message)
    if (!cases || cases.length === 0) throw new Error(`No cases available for ${playerCount} players`)

    const selectedCase = shuffle(cases)[0]

    const { data: roleCards, error: cardsErr } = await admin
      .from('case_role_cards')
      .select('*')
      .eq('case_id', selectedCase.id)
      .in('role', roles)
      .returns<CaseRoleCard[]>()
    if (cardsErr || !roleCards || roleCards.length === 0) {
      throw new Error('No role cards found for case: ' + selectedCase.id)
    }

    const missingRoles = roles.filter(role => !roleCards.some(card => card.role === role))
    if (missingRoles.length > 0) throw new Error(`Missing role cards: ${missingRoles.join(', ')}`)

    // Clean up any previous state for this room before re-starting
    for (const table of ['player_role_data', 'game_events', 'game_results', 'verdicts'] as const) {
      const { error } = await admin.from(table).delete().eq('room_id', roomId)
      if (error) throw new Error(`Cleanup failed on ${table}: ${error.message}`)
    }

    const shuffledPlayers = shuffle(players)
    const assignments = shuffledPlayers.slice(0, roles.length).map((p: any, idx: number) => {
      const role = roles[idx]
      const card = roleCards.find((c) => c.role === role)!
      return {
        room_id: roomId,
        player_id: p.player_id,
        role,
        private_info: card.private_info,
        win_condition: card.win_condition,
        knows_truth: role === 'defendant' || role === 'defense_attorney',
      }
    })

    for (const a of assignments) {
      const { error } = await admin.from('room_players')
        .update({ role: a.role })
        .eq('room_id', roomId)
        .eq('player_id', a.player_id)
      if (error) throw new Error('Failed to assign room role: ' + error.message)
    }

    const { error: insertErr } = await admin.from('player_role_data').insert(assignments)
    if (insertErr) throw new Error('Failed to insert role data: ' + insertErr.message)

    const { error: updateErr } = await admin
      .from('game_rooms')
      .update({
        case_id: selectedCase.id,
        status: 'starting',
        current_session: 0,
        session_ends_at: null,
      })
      .eq('id', roomId)
    if (updateErr) throw new Error(updateErr.message)

    await admin.from('game_events').insert({
      room_id: roomId,
      player_id: null,
      event_type: 'system',
      session_num: 0,
      content: `تم اختيار القضية: ${selectedCase.title}. اقرأ بطاقتك ثم ابدأ الجلسة الأولى.`,
    })

    return new Response(JSON.stringify({
      ok: true,
      case_title: selectedCase.title,
      room: { id: roomId, status: 'starting', case_id: selectedCase.id },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[start-game]', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
