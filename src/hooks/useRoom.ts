import { useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRoomStore } from '@/stores/roomStore'
import type { GameRoom, RoomPlayer, GameEvent, PublicCaseInfo } from '@/lib/types'

export function useRoom(roomId: string | undefined) {
  const {
    setRoom, updateRoom,
    setPlayers, upsertPlayer, updatePlayer,
    addEvent, setEvents,
    setCaseInfo,
    setConnected, reset,
  } = useRoomStore()

  const fetchAll = useCallback(async () => {
    if (!roomId) return

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

    if (roomRes.data) {
      setRoom(roomRes.data as GameRoom)
      // Also fetch case info if room has a case
      if (roomRes.data.case_id) {
        const { data: caseData } = await supabase
          .from('public_case_info')
          .select('*')
          .eq('id', roomRes.data.case_id)
          .single()
        if (caseData) setCaseInfo(caseData as PublicCaseInfo)
      }
    }
    if (playersRes.data) setPlayers(playersRes.data as RoomPlayer[])
    if (eventsRes.data)  setEvents(eventsRes.data as GameEvent[])
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    fetchAll()

    const channel = supabase
      .channel(`room:${roomId}`)

      // Room status / session changes
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'game_rooms',
        filter: `id=eq.${roomId}`,
      }, async ({ new: updated }) => {
        updateRoom(updated as Partial<GameRoom>)
        // Fetch case info if newly assigned
        const u = updated as Partial<GameRoom>
        if (u.case_id) {
          const { data: caseData } = await supabase
            .from('public_case_info').select('*').eq('id', u.case_id).single()
          if (caseData) setCaseInfo(caseData as PublicCaseInfo)
        }
      })

      // New player joining
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, async ({ new: player }) => {
        const { data: profile } = await supabase
          .from('profiles').select('username, avatar_url')
          .eq('id', (player as RoomPlayer).player_id).single()
        upsertPlayer({ ...(player as RoomPlayer), profiles: profile ?? undefined })
      })

      // Player ready / role update
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, ({ new: updated }) => {
        const p = updated as RoomPlayer
        updatePlayer(p.player_id, { is_ready: p.is_ready, role: p.role })
      })

      // New game event
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'game_events',
        filter: `room_id=eq.${roomId}`,
      }, async ({ new: event }) => {
        const ev = event as GameEvent
        if (ev.player_id) {
          const { data: profile } = await supabase
            .from('profiles').select('username').eq('id', ev.player_id).single()
          addEvent({ ...ev, profiles: profile ?? undefined })
        } else {
          addEvent(ev)
        }
      })

      .subscribe(status => setConnected(status === 'SUBSCRIBED'))

    return () => {
      supabase.removeChannel(channel)
      reset()
    }
  }, [roomId])

  return { fetchAll }
}
