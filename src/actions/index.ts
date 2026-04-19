import { supabase, callEdgeFunction } from '@/lib/supabase'
import type { ActiveRoomMembership, RoleCard, VerdictRow, VerdictValue } from '@/lib/types'
import { SessionExpiredError, isSessionExpiredResult } from '@/lib/sessionEvent'

type RoomRpcResponse = {
  id: string
  room_code: string
  host_id: string
  status: string
  current_session: number
  session_duration_seconds: number
  max_players: number
  created_at: string
  updated_at: string
}

// ─── createRoom (atomic RPC) ─────────────────────
export async function createRoom(opts: {
  maxPlayers?: number
  sessionDurationSeconds?: number
}) {
  const { data, error } = await supabase.rpc('create_room_with_host', {
    p_max_players: opts.maxPlayers ?? 6,
    p_session_duration_seconds: opts.sessionDurationSeconds ?? 180,
  })

  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object' || !('id' in data) || !data.id) {
    throw new Error('لم يتم إنشاء الغرفة')
  }

  return data as RoomRpcResponse
}

// ─── joinRoom (atomic RPC) ───────────────────────
export async function joinRoom(roomCode: string) {
  const { data, error } = await supabase.rpc('join_room_by_code', {
    p_room_code: roomCode.toUpperCase().trim(),
  })

  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object' || !('id' in data) || !data.id) {
    throw new Error('تعذر الانضمام إلى الغرفة')
  }

  return data as RoomRpcResponse
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
export async function startGame(roomId: string, expectedStatus: 'waiting' | 'starting' = 'waiting') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  return callEdgeFunction<{
    ok: boolean
    case_title?: string
    idempotent?: boolean
    stale_request?: boolean
    room_status?: string
  }>('start-game', { roomId, requesterId: user.id, expectedStatus })
}

// ─── beginSession → Edge Function ─────────────────
export async function beginSession(roomId: string, expectedStatus: 'starting' | 'in_session' = 'starting') {
  return callEdgeFunction<{
    ok: boolean
    idempotent?: boolean
    stale_request?: boolean
    session_ends_at?: string
    room_status?: string
  }>('begin-session', { roomId, expectedStatus })
}

// ─── advanceSession → Edge Function ───────────────
export async function advanceSession(roomId: string, expectedSession?: number, target: 'next' | 'verdict' = 'next') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  return callEdgeFunction('advance-session', { roomId, requesterId: user.id, expectedSession, target })
}

// ─── submitEvent ──────────────────────────────────
export async function submitEvent(
  roomId: string,
  sessionNum: number,
  content: string,
  eventType: 'statement' | 'question' | 'objection' = 'statement',
  sessionEndsAt?: string | null,
) {
  const result = await callEdgeFunction<{
    ok: boolean
    code?: string
    session_ends_at?: string | null
    room_status?: string
  }>('submit-event', { roomId, sessionNum, content, eventType, sessionEndsAt })

  if (isSessionExpiredResult(result)) {
    throw new SessionExpiredError()
  }

  return result
}

// ─── submitVerdict → Edge Function ────────────────
export async function submitVerdict(roomId: string, verdict: VerdictValue, expectedStatus: 'verdict' | 'finished' = 'verdict') {
  return callEdgeFunction<{
    ok: boolean
    verdict: VerdictRow
    idempotent?: boolean
    stale_request?: boolean
    results?: Array<{ player_id: string; role: string; did_win: boolean; reason: string }>
  }>('submit-verdict', { roomId, verdict, expectedStatus })
}

// ─── revealTruth → Legacy Edge Function ───────────
export async function revealTruth(roomId: string, expectedStatus: 'verdict' | 'reveal' | 'finished' = 'reveal') {
  return callEdgeFunction<{
    ok: boolean
    actual_verdict: string
    hidden_truth: string
    results: Array<{ player_id: string; role: string; did_win: boolean; reason: string }>
    idempotent?: boolean
    stale_request?: boolean
  }>('reveal-truth', { roomId, expectedStatus })
}

// ─── fetchMyRoleCard ──────────────────────────────
export async function fetchMyRoleCard(roomId: string): Promise<RoleCard | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('player_role_data')
    .select('*')
    .eq('room_id', roomId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (error) throw error
  return (data as RoleCard | null) ?? null
}

// ─── fetchResults ─────────────────────────────────
export async function fetchResults(roomId: string) {
  const { data, error } = await supabase
    .from('game_results')
    .select('*, profiles(username)')
    .eq('room_id', roomId)
    .order('did_win', { ascending: false })

  if (error) throw error
  return data ?? []
}

// ─── fetchVerdictSummary ──────────────────────────
export async function fetchVerdictSummary(roomId: string) {
  const { data, error } = await supabase
    .from('verdicts')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle()

  if (error) throw error
  return (data as VerdictRow | null) ?? null
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


// ─── fetchActiveRoomForCurrentUser ─────────────────
export async function fetchActiveRoomForCurrentUser(): Promise<ActiveRoomMembership | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('room_players')
    .select(`
      room_id,
      is_host,
      role,
      game_rooms!inner(id, status, current_session, room_code)
    `)
    .eq('player_id', user.id)
    .neq('game_rooms.status', 'finished')
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as ActiveRoomMembership | null) ?? null
}
