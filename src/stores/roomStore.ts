import { create } from 'zustand'
import type {
  GameRoom, RoomPlayer, RoleCard, GameEvent,
  GameResult, PublicCaseInfo
} from '@/lib/types'

export interface RoomStore {
  scopedRoomId: string | null
  room:        GameRoom | null
  players:     RoomPlayer[]
  myCard:      RoleCard | null
  caseInfo:    PublicCaseInfo | null
  events:      GameEvent[]
  results:     GameResult[]
  isConnected: boolean
  revealData:  { actual_verdict: string; hidden_truth: string } | null

  scopeToRoom:   (roomId: string) => void
  setRoom:       (room: GameRoom) => void
  updateRoom:    (partial: Partial<GameRoom>) => void
  setPlayers:    (players: RoomPlayer[]) => void
  upsertPlayer:  (player: RoomPlayer) => void
  updatePlayer:  (playerId: string, partial: Partial<RoomPlayer>) => void
  removePlayer:  (playerId: string) => void
  setMyCard:     (card: RoleCard | null) => void
  setCaseInfo:   (info: PublicCaseInfo | null) => void
  addEvent:      (event: GameEvent) => void
  setEvents:     (events: GameEvent[]) => void
  setResults:    (results: GameResult[]) => void
  setConnected:  (v: boolean) => void
  setRevealData: (data: { actual_verdict: string; hidden_truth: string } | null) => void
  reset:         () => void
}

const initialState = {
  scopedRoomId: null,
  room: null,
  players: [],
  myCard: null,
  caseInfo: null,
  events: [],
  results: [],
  isConnected: false,
  revealData: null,
}

function sortPlayers(players: RoomPlayer[]) {
  return [...players].sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
}

function mergeUniqueEvents(events: GameEvent[]) {
  const byId = new Map<string, GameEvent>()
  for (const event of events) byId.set(event.id, event)
  return [...byId.values()].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

export const useRoomStore = create<RoomStore>((set) => ({
  ...initialState,

  scopeToRoom: (roomId) => set((state) => {
    if (state.scopedRoomId === roomId) return state
    return { ...initialState, scopedRoomId: roomId }
  }),

  setRoom: (room) => set({ room, scopedRoomId: room.id }),
  updateRoom: (partial) => set(s => ({ room: s.room ? { ...s.room, ...partial } : null })),

  setPlayers:   (players) => set({ players: sortPlayers(players) }),
  upsertPlayer: (player)  => set(s => ({
    players: sortPlayers([
      ...s.players.filter(p => p.player_id !== player.player_id),
      player,
    ]),
  })),
  updatePlayer: (playerId, partial) => set(s => ({
    players: s.players.map(p => p.player_id === playerId ? { ...p, ...partial } : p),
  })),
  removePlayer: (playerId) => set(s => ({
    players: s.players.filter(p => p.player_id !== playerId),
  })),

  setMyCard:     (myCard)      => set({ myCard }),
  setCaseInfo:   (caseInfo)    => set({ caseInfo }),
  addEvent:      (event)       => set(s => ({ events: mergeUniqueEvents([...s.events, event]) })),
  setEvents:     (events)      => set({ events: mergeUniqueEvents(events) }),
  setResults:    (results)     => set({ results }),
  setConnected:  (isConnected) => set({ isConnected }),
  setRevealData: (revealData)  => set({ revealData }),
  reset:         ()            => set(initialState),
}))
