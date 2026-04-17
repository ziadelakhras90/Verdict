import type { GameEvent, GameRoom, PublicCaseInfo, RoomPlayer } from '@/lib/types'

export function shouldIgnoreStaleFetch(seq: number, latestSeq: number): boolean {
  return seq !== latestSeq
}

export function shouldFetchCaseInfo(nextCaseId: string | null | undefined, currentCaseInfo: Pick<PublicCaseInfo, 'id'> | null): boolean {
  if (!nextCaseId) return false
  return currentCaseInfo?.id !== nextCaseId
}

export function shouldClearCaseInfo(nextCaseId: string | null | undefined): boolean {
  return !nextCaseId
}

export function buildPlayerPresenceUpdate(player: RoomPlayer): Partial<RoomPlayer> {
  return {
    is_ready: player.is_ready,
    role: player.role,
    is_host: player.is_host,
    profiles: player.profiles,
  }
}

export function shouldFallbackRefetchForDeletedPlayer(player: Partial<RoomPlayer>): boolean {
  return !player.player_id
}

export function attachEventProfile(event: GameEvent, username: string | null | undefined): GameEvent {
  if (!event.player_id || !username) return event
  return {
    ...event,
    profiles: { username },
  }
}

export function shouldRefreshCaseInfoForRoomUpdate(
  roomUpdate: Partial<GameRoom>,
  currentCaseInfo: Pick<PublicCaseInfo, 'id'> | null,
): boolean {
  return shouldFetchCaseInfo(roomUpdate.case_id, currentCaseInfo)
}
