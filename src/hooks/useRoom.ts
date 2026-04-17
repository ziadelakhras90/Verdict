import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload, RealtimeStatus } from '@supabase/supabase-js'
import { useRoomStore } from '@/stores/roomStore'
import type { RoomStore } from '@/stores/roomStore'
import type { GameRoom, RoomPlayer, GameEvent, PublicCaseInfo } from '@/lib/types'
import {
  attachEventProfile,
  buildPlayerPresenceUpdate,
  shouldClearCaseInfo,
  shouldFallbackRefetchForDeletedPlayer,
  shouldIgnoreStaleFetch,
  shouldRefreshCaseInfoForRoomUpdate,
} from '@/lib/roomSync'

const POLL_INTERVAL_MS = 2500

export function useRoom(roomId: string | undefined) {
  const {
    scopeToRoom,
    setRoom, updateRoom,
    setPlayers, upsertPlayer, updatePlayer, removePlayer,
    addEvent, setEvents,
    setCaseInfo,
    setConnected,
  } = useRoomStore()

  const fetchSeqRef = useRef(0)

  const fetchAll = useCallback(async () => {
    if (!roomId) return

    const seq = ++fetchSeqRef.current

    const [roomRes, playersRes, eventsRes] = await Promise.all([
      supabase.from('game_rooms').select('*').eq('id', roomId).single(),
      supabase.from('room_players')
        .select('*, profiles(username, avatar_url)')
        .eq('room_id', roomId),
      supabase.from('game_events')
        .select('*, profiles(username)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true }),
    ])

    if (shouldIgnoreStaleFetch(seq, fetchSeqRef.current)) return

    if (roomRes.data) {
      const roomData = roomRes.data as GameRoom
      setRoom(roomData)

      if (roomData.case_id) {
        const { data: caseData } = await supabase
          .from('public_case_info')
          .select('*')
          .eq('id', roomData.case_id)
          .single()

        if (shouldIgnoreStaleFetch(seq, fetchSeqRef.current)) return
        if (caseData) setCaseInfo(caseData as PublicCaseInfo)
      } else {
        setCaseInfo(null)
      }
    }

    if (playersRes.data) setPlayers(playersRes.data as RoomPlayer[])
    if (eventsRes.data) setEvents(eventsRes.data as GameEvent[])
  }, [roomId, setRoom, setPlayers, setEvents, setCaseInfo])

  useEffect(() => {
    if (!roomId) return

    scopeToRoom(roomId)
    void fetchAll()

    const channel: RealtimeChannel = supabase
      .channel(`room:${roomId}`)

      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'game_rooms',
        filter: `id=eq.${roomId}`,
      }, async (payload: RealtimePostgresChangesPayload<GameRoom>) => {
        const updated = payload.new
        updateRoom(updated as Partial<GameRoom>)
        const roomUpdate = updated as Partial<GameRoom>

        if (shouldRefreshCaseInfoForRoomUpdate(roomUpdate, (useRoomStore.getState() as RoomStore).caseInfo)) {
          const { data: caseData } = await supabase
            .from('public_case_info').select('*').eq('id', roomUpdate.case_id).single()
          if (caseData) setCaseInfo(caseData as PublicCaseInfo)
        } else if (shouldClearCaseInfo(roomUpdate.case_id)) {
          setCaseInfo(null)
        }
      })

      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, async (payload: RealtimePostgresChangesPayload<RoomPlayer>) => {
        const player = payload.new
        const basePlayer = player as RoomPlayer
        const { data: profile } = await supabase
          .from('profiles').select('username, avatar_url')
          .eq('id', basePlayer.player_id).single()

        upsertPlayer({ ...basePlayer, profiles: profile ?? undefined })
      })

      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, (payload: RealtimePostgresChangesPayload<RoomPlayer>) => {
        const updated = payload.new
        const p = updated as RoomPlayer
        updatePlayer(p.player_id, buildPlayerPresenceUpdate(p))
      })

      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, (payload: RealtimePostgresChangesPayload<RoomPlayer>) => {
        const old = payload.old
        const deleted = old as Partial<RoomPlayer>
        if (shouldFallbackRefetchForDeletedPlayer(deleted)) void fetchAll()
        else removePlayer(deleted.player_id as string)
      })

      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'game_events',
        filter: `room_id=eq.${roomId}`,
      }, async (payload: RealtimePostgresChangesPayload<GameEvent>) => {
        const event = payload.new
        const ev = event as GameEvent
        if (ev.player_id) {
          const { data: profile } = await supabase
            .from('profiles').select('username').eq('id', ev.player_id).single()
          addEvent(attachEventProfile(ev, profile?.username))
          return
        }

        addEvent(ev)
      })

      .subscribe((status: RealtimeStatus) => {
        setConnected(status === 'SUBSCRIBED')
      })

    const pollId = window.setInterval(() => {
      void fetchAll()
    }, POLL_INTERVAL_MS)

    const onFocus = () => { void fetchAll() }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchAll()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      fetchSeqRef.current += 1
      window.clearInterval(pollId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      setConnected(false)
      supabase.removeChannel(channel)
    }
  }, [roomId, scopeToRoom, fetchAll, updateRoom, upsertPlayer, updatePlayer, removePlayer, addEvent, setCaseInfo, setConnected])

  return { fetchAll }
}
