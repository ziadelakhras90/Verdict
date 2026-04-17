import { describe, expect, it } from 'vitest'
import {
  getActiveRoomPath,
  getRoomPath,
  getRoomRouteByStatus,
  shouldRedirectToCanonicalRoomPage,
  shouldResumeActiveRoom,
} from '@/lib/gameFlow'
import type { ActiveRoomMembership } from '@/lib/types'

describe('game flow routing', () => {
  it('routes judges to the judge panel during sessions and verdict', () => {
    expect(getRoomRouteByStatus('in_session', 'judge')).toBe('judge')
    expect(getRoomRouteByStatus('verdict', 'judge')).toBe('judge')
  })

  it('routes non-judges to player pages during sessions and verdict', () => {
    expect(getRoomRouteByStatus('in_session', 'witness')).toBe('session')
    expect(getRoomRouteByStatus('verdict', 'prosecutor')).toBe('verdict')
  })

  it('builds canonical room paths', () => {
    expect(getRoomPath('room-123', 'starting', 'judge')).toBe('/room/room-123/card')
    expect(getRoomPath('room-123', 'finished', 'witness')).toBe('/room/room-123/results')
  })

  it('builds the correct resume path for an active room', () => {
    const activeRoom: ActiveRoomMembership = {
      room_id: 'room-42',
      is_host: false,
      role: 'judge',
      game_rooms: {
        id: 'room-42',
        room_code: 'ABCD',
        status: 'in_session',
        current_session: 2,
      },
    }

    expect(getActiveRoomPath(activeRoom)).toBe('/room/room-42/judge')
    expect(shouldResumeActiveRoom(activeRoom)).toBe(true)
  })

  it('does not try to resume when there is no unfinished room', () => {
    expect(getActiveRoomPath(null)).toBeNull()
    expect(shouldResumeActiveRoom(null)).toBe(false)

    expect(
      shouldResumeActiveRoom({
        room_id: 'room-42',
        is_host: true,
        role: 'witness',
        game_rooms: {
          id: 'room-42',
          room_code: 'DONE',
          status: 'finished',
          current_session: 3,
        },
      }),
    ).toBe(false)
  })

  it('does not redirect when the current status and page are valid', () => {
    expect(
      shouldRedirectToCanonicalRoomPage({
        roomId: 'room-1',
        status: 'waiting',
        role: 'judge',
        allowedStatuses: ['waiting'],
        expectedPages: ['lobby'],
      }),
    ).toEqual({
      shouldRedirect: false,
      canonicalPath: '/room/room-1/lobby',
    })
  })

  it('redirects players away from stale URLs after status changes', () => {
    expect(
      shouldRedirectToCanonicalRoomPage({
        roomId: 'room-1',
        status: 'verdict',
        role: 'witness',
        allowedStatuses: ['in_session'],
        expectedPages: ['session'],
      }),
    ).toEqual({
      shouldRedirect: true,
      canonicalPath: '/room/room-1/verdict',
    })
  })

  it('redirects the judge away from player pages', () => {
    expect(
      shouldRedirectToCanonicalRoomPage({
        roomId: 'room-1',
        status: 'in_session',
        role: 'judge',
        allowedStatuses: ['in_session'],
        expectedPages: ['session'],
      }),
    ).toEqual({
      shouldRedirect: true,
      canonicalPath: '/room/room-1/judge',
    })
  })
})
