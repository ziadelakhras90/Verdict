// supabase/functions/start-game/index.ts
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
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { roomId } = await req.json()
    if (!roomId) throw new Error('roomId is required')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Verify caller is host
    const { data: room, error: roomErr } = await admin
      .from('game_rooms').select('*').eq('id', roomId).single()
    if (roomErr || !room) throw new Error('Room not found')
    if (room.host_id !== user.id) throw new Error('Only host can start game')
    if (room.status !== 'waiting') throw new Error('Game already started')

    // 2. Get players
    const { data: players, error: playersErr } = await admin
      .from('room_players').select('player_id').eq('room_id', roomId)
    if (playersErr || !players) throw new Error('Failed to fetch players')
    const playerCount = players.length
    if (playerCount < 4) throw new Error(`Need at least 4 players, have ${playerCount}`)

    // 3. Select a random eligible case
    const { data: cases, error: casesErr } = await admin
      .from('case_templates')
      .select('*')
      .eq('is_active', true)
      .lte('min_players', playerCount)
      .gte('max_players', playerCount)
    if (casesErr) throw new Error('Failed to fetch cases: ' + casesErr.message)
    if (!cases || cases.length === 0)
      throw new Error(`No cases available for ${playerCount} players. Please add cases to the database.`)

    const selectedCase = cases[Math.floor(Math.random() * cases.length)]

    // 4. Fetch role cards for chosen case
    const { data: roleCards, error: cardsErr } = await admin
      .from('case_role_cards').select('*').eq('case_id', selectedCase.id)
    if (cardsErr || !roleCards || roleCards.length === 0)
      throw new Error('No role cards found for case: ' + selectedCase.id)

    // 5. Shuffle and assign roles
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5)
    const shuffledRoles   = [...roleCards].sort(() => Math.random() - 0.5)
    const count           = Math.min(shuffledPlayers.length, shuffledRoles.length)

    const assignments = shuffledPlayers.slice(0, count).map((p, i) => ({
      room_id:       roomId,
      player_id:     p.player_id,
      role:          shuffledRoles[i].role,
      private_info:  shuffledRoles[i].private_info,
      win_condition: shuffledRoles[i].win_condition,
      knows_truth:   ['defendant', 'defense_attorney'].includes(shuffledRoles[i].role),
    }))

    // 6. Update room_players with roles
    for (const a of assignments) {
      await admin.from('room_players')
        .update({ role: a.role })
        .eq('room_id', roomId).eq('player_id', a.player_id)
    }

    // 7. Write player_role_data (secret cards)
    const { error: insertErr } = await admin.from('player_role_data').insert(assignments)
    if (insertErr) throw new Error('Failed to insert role data: ' + insertErr.message)

    // 8. Set status to 'starting' — players will be redirected to /card
    //    The host then manually kicks off session 1 from the RoleCard page
    const { error: updateErr } = await admin
      .from('game_rooms')
      .update({ case_id: selectedCase.id, status: 'starting' })
      .eq('id', roomId)
    if (updateErr) throw updateErr

    return new Response(
      JSON.stringify({ ok: true, case_title: selectedCase.title }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[start-game]', msg)
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
