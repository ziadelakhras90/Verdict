import { beforeEach, describe, expect, it } from 'vitest'
import { useRoomStore } from './roomStore'
import type { GameEvent, GameRoom, RoomPlayer } from '@/lib/types'

function makeRoom(overrides: Partial<GameRoom> = {}): GameRoom {
  return {
    id: 'room-1',
    room_code: 'ABC123',
    host_id: 'player-1',
    case_id: null,
    status: 'waiting',
    current_session: 0,
    session_ends_at: null,
    session_duration_seconds: 120,
    max_players: 6,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePlayer(playerId: string, joinedAt: string, overrides: Partial<RoomPlayer> = {}): RoomPlayer {
  return {
    id: `rp-${playerId}`,
    room_id: 'room-1',
    player_id: playerId,
    role: null,
    is_ready: false,
    is_host: false,
    joined_at: joinedAt,
    ...overrides,
  }
}

function makeEvent(id: string, createdAt: string, overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id,
    room_id: 'room-1',
    player_id: null,
    event_type: 'system',
    session_num: 1,
    content: `event-${id}`,
    created_at: createdAt,
    ...overrides,
  }
}

describe('useRoomStore', () => {
  beforeEach(() => {
    useRoomStore.getState().reset()
  })

  it('keeps state when scoping repeatedly to the same room', () => {
    const store = useRoomStore.getState()
    store.scopeToRoom('room-1')
    store.setRoom(makeRoom())
    store.setPlayers([makePlayer('player-1', '2026-01-01T00:00:02.000Z')])
    store.addEvent(makeEvent('ev-1', '2026-01-01T00:00:03.000Z'))

    store.scopeToRoom('room-1')

    const state = useRoomStore.getState()
    expect(state.scopedRoomId).toBe('room-1')
    expect(state.room?.id).toBe('room-1')
    expect(state.players).toHaveLength(1)
    expect(state.events).toHaveLength(1)
  })

  it('resets volatile state when scoping to a different room', () => {
    const store = useRoomStore.getState()
    store.scopeToRoom('room-1')
    store.setRoom(makeRoom())
    store.setPlayers([makePlayer('player-1', '2026-01-01T00:00:02.000Z')])
    store.addEvent(makeEvent('ev-1', '2026-01-01T00:00:03.000Z'))
    store.setConnected(true)

    store.scopeToRoom('room-2')

    const state = useRoomStore.getState()
    expect(state.scopedRoomId).toBe('room-2')
    expect(state.room).toBeNull()
    expect(state.players).toEqual([])
    expect(state.events).toEqual([])
    expect(state.isConnected).toBe(false)
  })

  it('sorts players by join time for setPlayers and upsertPlayer', () => {
    const store = useRoomStore.getState()
    store.setPlayers([
      makePlayer('player-2', '2026-01-01T00:00:05.000Z'),
      makePlayer('player-1', '2026-01-01T00:00:01.000Z'),
    ])

    expect(useRoomStore.getState().players.map((p) => p.player_id)).toEqual(['player-1', 'player-2'])

    store.upsertPlayer(makePlayer('player-3', '2026-01-01T00:00:03.000Z'))
    expect(useRoomStore.getState().players.map((p) => p.player_id)).toEqual(['player-1', 'player-3', 'player-2'])
  })

  it('updates an existing player in place when upserting the same player_id', () => {
    const store = useRoomStore.getState()
    store.setPlayers([
      makePlayer('player-1', '2026-01-01T00:00:01.000Z', { is_ready: false }),
    ])

    store.upsertPlayer(makePlayer('player-1', '2026-01-01T00:00:01.000Z', { is_ready: true }))

    const state = useRoomStore.getState()
    expect(state.players).toHaveLength(1)
    expect(state.players[0]?.is_ready).toBe(true)
  })

  it('deduplicates events by id and keeps them sorted by created_at', () => {
    const store = useRoomStore.getState()
    store.addEvent(makeEvent('ev-2', '2026-01-01T00:00:10.000Z'))
    store.addEvent(makeEvent('ev-1', '2026-01-01T00:00:01.000Z'))
    store.addEvent(makeEvent('ev-2', '2026-01-01T00:00:10.000Z', { content: 'updated-event-2' }))

    const state = useRoomStore.getState()
    expect(state.events.map((event) => event.id)).toEqual(['ev-1', 'ev-2'])
    expect(state.events[1]?.content).toBe('updated-event-2')
  })

  it('deduplicates and sorts setEvents snapshots', () => {
    const store = useRoomStore.getState()
    store.setEvents([
      makeEvent('ev-3', '2026-01-01T00:00:30.000Z'),
      makeEvent('ev-1', '2026-01-01T00:00:10.000Z'),
      makeEvent('ev-1', '2026-01-01T00:00:10.000Z', { content: 'newer copy' }),
      makeEvent('ev-2', '2026-01-01T00:00:20.000Z'),
    ])

    const state = useRoomStore.getState()
    expect(state.events.map((event) => event.id)).toEqual(['ev-1', 'ev-2', 'ev-3'])
    expect(state.events[0]?.content).toBe('newer copy')
  })
})
