import type { ActiveRoomMembership, Role, RoomStatus } from '@/lib/types'

export function getRoomRouteByStatus(status: RoomStatus | string, role?: Role | null): string {
  if (status === 'waiting') return 'lobby'
  if (status === 'starting') return 'card'
  if (status === 'in_session') return role === 'judge' ? 'judge' : 'session'
  if (status === 'verdict') return role === 'judge' ? 'judge' : 'verdict'
  if (status === 'reveal') return 'reveal'
  if (status === 'finished') return 'results'
  return 'lobby'
}

export function getRoomPath(roomId: string, status: RoomStatus | string, role?: Role | null): string {
  return `/room/${roomId}/${getRoomRouteByStatus(status, role)}`
}

export function getActiveRoomPath(activeRoom: ActiveRoomMembership | null | undefined): string | null {
  if (!activeRoom?.game_rooms?.status || !activeRoom.room_id) return null
  return getRoomPath(activeRoom.room_id, activeRoom.game_rooms.status, activeRoom.role)
}

export function shouldResumeActiveRoom(activeRoom: ActiveRoomMembership | null | undefined): boolean {
  return Boolean(activeRoom?.game_rooms && activeRoom.game_rooms.status !== 'finished')
}

export function shouldRedirectToCanonicalRoomPage(params: {
  roomId?: string
  status?: RoomStatus | null
  role?: Role | null
  allowedStatuses: RoomStatus[]
  expectedPages?: string[] | null
}): { shouldRedirect: boolean; canonicalPath?: string } {
  const { roomId, status, role, allowedStatuses, expectedPages } = params

  if (!roomId || !status) return { shouldRedirect: false }

  const canonicalPath = getRoomPath(roomId, status, role)
  const canonicalPage = canonicalPath.split('/').pop()
  const statusAllowed = allowedStatuses.includes(status)
  const pageAllowed = !expectedPages || (canonicalPage ? expectedPages.includes(canonicalPage) : false)

  if (statusAllowed && pageAllowed) {
    return { shouldRedirect: false, canonicalPath }
  }

  return { shouldRedirect: true, canonicalPath }
}
