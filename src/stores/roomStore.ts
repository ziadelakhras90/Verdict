import { create } from 'zustand'
import type {
  GameRoom, RoomPlayer, RoleCard, GameEvent,
  GameResult, PublicCaseInfo
} from '@/lib/types'

interface RoomStore {
  room:        GameRoom | null
  players:     RoomPlayer[]
  myCard:      RoleCard | null
  caseInfo:    PublicCaseInfo | null
  events:      GameEvent[]
  results:     GameResult[]
  isConnected: boolean
  revealData:  { actual_verdict: string; hidden_truth: string } | null

  setRoom:       (room: GameRoom) => void
  updateRoom:    (partial: Partial<GameRoom>) => void
  setPlayers:    (players: RoomPlayer[]) => void
  upsertPlayer:  (player: RoomPlayer) => void
  updatePlayer:  (playerId: string, partial: Partial<RoomPlayer>) => void
  removePlayer:  (playerId: string) => void
  setMyCard:     (card: RoleCard) => void
  setCaseInfo:   (info: PublicCaseInfo) => void
  addEvent:      (event: GameEvent) => void
  setEvents:     (events: GameEvent[]) => void
  setResults:    (results: GameResult[]) => void
  setConnected:  (v: boolean) => void
  setRevealData: (data: { actual_verdict: string; hidden_truth: string }) => void
  reset:         () => void
}

const initial = {
  room: null, players: [], myCard: null, caseInfo: null,
  events: [], results: [], isConnected: false, revealData: null,
}

export const useRoomStore = create<RoomStore>((set) => ({
  ...initial,

  setRoom: (room) => set({ room }),
  updateRoom: (partial) => set(s => ({ room: s.room ? { ...s.room, ...partial } : null })),

  setPlayers:   (players) => set({ players }),
  upsertPlayer: (player)  => set(s => ({
    players: [
      ...s.players.filter(p => p.player_id !== player.player_id),
      player,
    ].sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()),
  })),
  updatePlayer: (playerId, partial) => set(s => ({
    players: s.players.map(p => p.player_id === playerId ? { ...p, ...partial } : p),
  })),
  removePlayer: (playerId) => set(s => ({
    players: s.players.filter(p => p.player_id !== playerId),
  })),

  setMyCard:     (myCard)      => set({ myCard }),
  setCaseInfo:   (caseInfo)    => set({ caseInfo }),
  addEvent:      (event)       => set(s => ({ events: [...s.events, event] })),
  setEvents:     (events)      => set({ events }),
  setResults:    (results)     => set({ results }),
  setConnected:  (isConnected) => set({ isConnected }),
  setRevealData: (revealData)  => set({ revealData }),
  reset:         ()            => set(initial),
}))
