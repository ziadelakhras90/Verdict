import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoomStore } from '@/stores/roomStore'
import type { RoomStatus } from '@/lib/types'

// Maps each room status to the correct page path
const STATUS_ROUTES: Record<RoomStatus, string> = {
  waiting:    'lobby',
  starting:   'card',      // players read role cards
  in_session: 'session',
  verdict:    'verdict',
  reveal:     'reveal',
  finished:   'results',
}

/**
 * Automatically redirects when the room status no longer matches this page.
 * @param roomId   Room UUID from useParams
 * @param current  The status(es) this page accepts
 */
export function useRoomGuard(roomId: string | undefined, current: RoomStatus | RoomStatus[]) {
  const status   = useRoomStore(s => s.room?.status)
  const navigate = useNavigate()

  useEffect(() => {
    if (!status || !roomId) return
    const allowed = Array.isArray(current) ? current : [current]
    if (allowed.includes(status)) return   // correct page
    const target = STATUS_ROUTES[status]
    if (target) navigate(`/room/${roomId}/${target}`, { replace: true })
  }, [status, roomId])
}
