import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoomStore } from '@/stores/roomStore'
import type { RoomStore } from '@/stores/roomStore'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { shouldRedirectToCanonicalRoomPage } from '@/lib/gameFlow'
import type { RoomStatus } from '@/lib/types'

type ExpectedPage = string | string[]

/**
 * Redirects the user to the canonical page for the current room state and role.
 * It protects against stale refreshes, manual URL edits, and judge/player page mixups.
 */
export function useRoomGuard(
  roomId: string | undefined,
  current: RoomStatus | RoomStatus[],
  expectedPage?: ExpectedPage,
) {
  const room = useRoomStore((s: RoomStore) => s.room)
  const players = useRoomStore((s: RoomStore) => s.players)
  const navigate = useNavigate()
  const currentUserId = useCurrentUser()

  const status = room?.status
  const myRole = players.find(p => p.player_id === currentUserId)?.role

  useEffect(() => {
    if (!status || !roomId) return

    const allowedStatuses = Array.isArray(current) ? current : [current]
    const expectedPages = expectedPage ? (Array.isArray(expectedPage) ? expectedPage : [expectedPage]) : null
    const decision = shouldRedirectToCanonicalRoomPage({
      roomId,
      status,
      role: myRole,
      allowedStatuses,
      expectedPages,
    })

    if (!decision.shouldRedirect || !decision.canonicalPath) return

    navigate(decision.canonicalPath, { replace: true })
  }, [status, roomId, myRole, navigate, current, expectedPage])
}
