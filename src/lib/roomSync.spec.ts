import { describe, expect, it } from 'vitest'
import {
  attachEventProfile,
  buildPlayerPresenceUpdate,
  shouldClearCaseInfo,
  shouldFallbackRefetchForDeletedPlayer,
  shouldFetchCaseInfo,
  shouldIgnoreStaleFetch,
  shouldRefreshCaseInfoForRoomUpdate,
} from '@/lib/roomSync'

describe('roomSync helpers', () => {
  it('ignores stale fetches when sequence changed', () => {
    expect(shouldIgnoreStaleFetch(1, 2)).toBe(true)
    expect(shouldIgnoreStaleFetch(3, 3)).toBe(false)
  })

  it('fetches case info only when case id changed', () => {
    expect(shouldFetchCaseInfo('case-2', { id: 'case-1' })).toBe(true)
    expect(shouldFetchCaseInfo('case-1', { id: 'case-1' })).toBe(false)
    expect(shouldFetchCaseInfo(null, { id: 'case-1' })).toBe(false)
  })

  it('clears case info when room no longer has a case', () => {
    expect(shouldClearCaseInfo(null)).toBe(true)
    expect(shouldClearCaseInfo(undefined)).toBe(true)
    expect(shouldClearCaseInfo('case-1')).toBe(false)
  })

  it('builds minimal player presence updates for realtime patches', () => {
    expect(buildPlayerPresenceUpdate({
      id: '1',
      room_id: 'room-1',
      player_id: 'player-1',
      role: 'judge',
      is_ready: true,
      is_host: false,
      joined_at: new Date().toISOString(),
      profiles: { username: 'ziad', avatar_url: null },
    })).toEqual({
      is_ready: true,
      role: 'judge',
      is_host: false,
      profiles: { username: 'ziad', avatar_url: null },
    })
  })

  it('falls back to full refetch only when deleted player id is missing', () => {
    expect(shouldFallbackRefetchForDeletedPlayer({ player_id: 'player-1' })).toBe(false)
    expect(shouldFallbackRefetchForDeletedPlayer({})).toBe(true)
  })

  it('attaches event username only when both event player and username exist', () => {
    const baseEvent = {
      id: 'e1',
      room_id: 'room-1',
      player_id: 'player-1',
      event_type: 'statement' as const,
      session_num: 1,
      content: 'hello',
      created_at: new Date().toISOString(),
    }

    expect(attachEventProfile(baseEvent, 'ziad')).toMatchObject({
      profiles: { username: 'ziad' },
    })
    expect(attachEventProfile({ ...baseEvent, player_id: null }, 'ziad')).toEqual({
      ...baseEvent,
      player_id: null,
    })
  })

  it('refreshes case info on room updates only when needed', () => {
    expect(shouldRefreshCaseInfoForRoomUpdate({ case_id: 'case-2' }, { id: 'case-1' })).toBe(true)
    expect(shouldRefreshCaseInfoForRoomUpdate({ case_id: 'case-1' }, { id: 'case-1' })).toBe(false)
    expect(shouldRefreshCaseInfoForRoomUpdate({ case_id: null }, { id: 'case-1' })).toBe(false)
  })
})
