// supabase/functions/start-game/index.ts
// @ts-ignore deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type PlayerRow = { player_id: string }
type RoomRow = {
  id: string
  host_id: string
  status: string
  case_id: string | null
}
type CaseTemplate = {
  id: string
  title: string
}
type RoleCardRow = {
  role: string
  private_info: string
  win_condition: string
  hints?: Record<string, unknown> | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function enrichPrivateInfo(privateInfo: string, hints: Record<string, unknown> | null | undefined): string {
  if (!hints || typeof hints !== 'object' || Array.isArray(hints)) return privateInfo

  const hintLines = Object.entries(hints)
    .map(([key, value]) => {
      if (typeof value !== 'string' || !value.trim()) return null
      const cleanKey = key.replace(/_/g, ' ').trim()
      return `- ${cleanKey}: ${value.trim()}`
    })
    .filter((line): line is string => Boolean(line))

  if (hintLines.length === 0) return privateInfo

  return `${privateInfo}\n\nأوراق تساعدك في النقاش:\n${hintLines.join('\n')}`
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
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')

    const { roomId, expectedStatus = 'waiting' } = await req.json()
    if (!roomId) throw new Error('roomId is required')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: room, error: roomErr } = await admin
      .from('game_rooms')
      .select('id, host_id, status, case_id')
      .eq('id', roomId)
      .single<RoomRow>()
    if (roomErr || !room) throw new Error('Room not found')
    if (room.host_id !== user.id) throw new Error('Only host can start game')

    if (room.status !== expectedStatus) {
      if (room.status !== 'waiting') {
        const { data: existingCase } = await admin
          .from('case_templates')
          .select('title')
          .eq('id', room.case_id)
          .maybeSingle<{ title: string }>()

        return json({
          ok: true,
          idempotent: true,
          stale_request: true,
          room_status: room.status,
          case_title: existingCase?.title,
        })
      }
      throw new Error(`Room must be ${expectedStatus} to start game`)
    }

    const { data: players, error: playersErr } = await admin
      .from('room_players')
      .select('player_id')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })
      .returns<PlayerRow[]>()
    if (playersErr || !players) throw new Error('Failed to fetch players')

    const uniquePlayerIds = [...new Set(players.map((p) => p.player_id))]
    const playerCount = uniquePlayerIds.length
    if (playerCount < 4) throw new Error(`Need at least 4 players, have ${playerCount}`)
    if (players.length !== playerCount) throw new Error('Duplicate player membership detected')

    const { data: cases, error: casesErr } = await admin
      .from('case_templates')
      .select('id, title')
      .eq('is_active', true)
      .lte('min_players', playerCount)
      .gte('max_players', playerCount)
      .returns<CaseTemplate[]>()
    if (casesErr) throw new Error('Failed to fetch cases: ' + casesErr.message)
    if (!cases || cases.length === 0) {
      throw new Error(`No cases available for ${playerCount} players. Please add cases to the database.`)
    }

    let selectedCase: CaseTemplate | null = null
    let selectedCards: RoleCardRow[] | null = null
    for (const candidate of shuffle(cases)) {
      const { data: roleCards, error: cardsErr } = await admin
        .from('case_role_cards')
        .select('role, private_info, win_condition, hints')
        .eq('case_id', candidate.id)
        .returns<RoleCardRow[]>()

      if (cardsErr) throw new Error('Failed to fetch case role cards: ' + cardsErr.message)
      if (!roleCards) continue
      if (roleCards.length === playerCount) {
        selectedCase = candidate
        selectedCards = roleCards
        break
      }
    }

    if (!selectedCase || !selectedCards) {
      throw new Error(`No case has exactly ${playerCount} role cards. Add a matching case before starting.`)
    }

    const shuffledPlayers = shuffle(uniquePlayerIds)
    const shuffledRoles = shuffle(selectedCards)
    const assignments = shuffledPlayers.map((playerId, index) => ({
      room_id: roomId,
      player_id: playerId,
      role: shuffledRoles[index].role,
      private_info: enrichPrivateInfo(shuffledRoles[index].private_info, shuffledRoles[index].hints),
      win_condition: shuffledRoles[index].win_condition,
      knows_truth: ['defendant', 'defense_attorney'].includes(shuffledRoles[index].role),
    }))

    for (const assignment of assignments) {
      const { error } = await admin
        .from('room_players')
        .update({ role: assignment.role })
        .eq('room_id', roomId)
        .eq('player_id', assignment.player_id)
      if (error) throw new Error('Failed to assign player role: ' + error.message)
    }

    const { error: roleDataErr } = await admin
      .from('player_role_data')
      .upsert(assignments, { onConflict: 'room_id,player_id' })
    if (roleDataErr) throw new Error('Failed to save role data: ' + roleDataErr.message)

    const { data: roomUpdate, error: updateErr } = await admin
      .from('game_rooms')
      .update({ case_id: selectedCase.id, status: 'starting' })
      .eq('id', roomId)
      .eq('status', 'waiting')
      .select('id')
      .maybeSingle<{ id: string }>()

    if (updateErr) throw new Error(updateErr.message)
    if (!roomUpdate) {
      const { data: latestRoom } = await admin
        .from('game_rooms')
        .select('status, case_id')
        .eq('id', roomId)
        .maybeSingle<{ status: string; case_id: string | null }>()

      const { data: latestCase } = latestRoom?.case_id
        ? await admin.from('case_templates').select('title').eq('id', latestRoom.case_id).maybeSingle<{ title: string }>()
        : { data: null }

      return json({
        ok: true,
        idempotent: true,
        stale_request: true,
        room_status: latestRoom?.status,
        case_title: latestCase?.title ?? selectedCase.title,
      })
    }

    return json({ ok: true, case_title: selectedCase.title })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[start-game]', msg)
    return json({ ok: false, error: msg }, 400)
  }
})
