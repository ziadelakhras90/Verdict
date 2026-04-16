import { supabase, callEdgeFunction } from '@/lib/supabase'
import type { VerdictRow, VerdictValue } from '@/lib/types'

// ─── createRoom (atomic RPC) ─────────────────────
export async function createRoom(opts: {
  maxPlayers?: number
  sessionDurationSeconds?: number
}) {
  const { data, error } = await supabase.rpc('create_room_with_host', {
    p_max_players: opts.maxPlayers ?? 6,
    p_session_duration_seconds: opts.sessionDurationSeconds ?? 180,
  })

  if (error) throw error
  return data
}

// ─── joinRoom (atomic RPC) ───────────────────────
export async function joinRoom(roomCode: string) {
  const { data, error } = await supabase.rpc('join_room_by_code', {
    p_room_code: roomCode.toUpperCase().trim(),
  })

  if (error) throw error
  return data
}

// ─── setReady ─────────────────────────────────────
export async function setReady(roomId: string, ready: boolean) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('room_players')
    .update({ is_ready: ready })
    .eq('room_id', roomId)
    .eq('player_id', user.id)

  if (error) throw error
}

// ─── startGame → Edge Function ────────────────────
export async function startGame(roomId: string) {
  return callEdgeFunction('start-game', { roomId })
}

// ─── beginSession → Edge Function ─────────────────
export async function beginSession(roomId: string) {
  return callEdgeFunction('begin-session', { roomId })
}

// ─── advanceSession → Edge Function ───────────────
export async function advanceSession(roomId: string) {
  return callEdgeFunction('advance-session', { roomId })
}

// ─── submitEvent ──────────────────────────────────
export async function submitEvent(
  roomId: string,
  sessionNum: number,
  content: string,
  eventType: 'statement' | 'question' | 'objection' = 'statement',
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('game_events')
    .insert({ room_id: roomId, player_id: user.id, event_type: eventType, session_num: sessionNum, content })

  if (error) throw error
}

// ─── submitVerdict → Edge Function ────────────────
export async function submitVerdict(roomId: string, verdict: VerdictValue) {
  return callEdgeFunction<{
    ok: boolean
    verdict: VerdictRow
  }>('submit-verdict', { roomId, verdict })
}

// ─── revealTruth → Legacy Edge Function ───────────
export async function revealTruth(roomId: string) {
  return callEdgeFunction<{
    ok: boolean
    actual_verdict: string
    hidden_truth: string
    results: Array<{ player_id: string; role: string; did_win: boolean; reason: string }>
  }>('reveal-truth', { roomId })
}

// ─── fetchMyRoleCard ──────────────────────────────
export async function fetchMyRoleCard(roomId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('player_role_data')
    .select('*')
    .eq('room_id', roomId)
    .eq('player_id', user.id)
    .single()

  return data
}

// ─── fetchResults ─────────────────────────────────
export async function fetchResults(roomId: string) {
  const { data, error } = await supabase
    .from('game_results')
    .select('*, profiles(username)')
    .eq('room_id', roomId)

  if (error) throw error
  return data ?? []
}

// ─── fetchVerdictSummary ──────────────────────────
export async function fetchVerdictSummary(roomId: string) {
  const { data, error } = await supabase
    .from('verdicts')
    .select('*')
    .eq('room_id', roomId)
    .single()

  if (error) throw error
  return data as VerdictRow
}

// ─── transferHost (atomic RPC) ────────────────────
export async function transferHost(roomId: string, newHostPlayerId: string) {
  const { data, error } = await supabase.rpc('transfer_room_host', {
    p_room_id: roomId,
    p_new_host_player_id: newHostPlayerId,
  })

  if (error) throw error
  return data
}
