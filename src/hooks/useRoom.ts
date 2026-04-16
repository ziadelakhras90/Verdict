import { useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRoomStore } from '@/stores/roomStore'
import type { GameRoom, RoomPlayer, GameEvent, PublicCaseInfo } from '@/lib/types'

const POLL_INTERVAL_MS = 2500

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
    if (eventsRes.data) setEvents(eventsRes.data as GameEvent[])
  }, [roomId, setRoom, setPlayers, setEvents, setCaseInfo])

  useEffect(() => {
    if (!roomId) return
    let mounted = true

    void fetchAll()

    const channel = supabase
      .channel(`room:${roomId}`)

      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'game_rooms',
        filter: `id=eq.${roomId}`,
      }, async ({ new: updated }) => {
        if (!mounted) return
        updateRoom(updated as Partial<GameRoom>)
        const u = updated as Partial<GameRoom>
        if (u.case_id) {
          const { data: caseData } = await supabase
            .from('public_case_info').select('*').eq('id', u.case_id).single()
          if (caseData && mounted) setCaseInfo(caseData as PublicCaseInfo)
        }
        void fetchAll()
      })

      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, async ({ new: player }) => {
        if (!mounted) return
        const { data: profile } = await supabase
          .from('profiles').select('username, avatar_url')
          .eq('id', (player as RoomPlayer).player_id).single()
        if (!mounted) return
        upsertPlayer({ ...(player as RoomPlayer), profiles: profile ?? undefined })
        void fetchAll()
      })

      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, ({ new: updated }) => {
        if (!mounted) return
        const p = updated as RoomPlayer
        updatePlayer(p.player_id, { is_ready: p.is_ready, role: p.role })
        void fetchAll()
      })

      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      }, () => {
        if (!mounted) return
        void fetchAll()
      })

      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'game_events',
        filter: `room_id=eq.${roomId}`,
      }, async ({ new: event }) => {
        if (!mounted) return
        const ev = event as GameEvent
        if (ev.player_id) {
          const { data: profile } = await supabase
            .from('profiles').select('username').eq('id', ev.player_id).single()
          if (!mounted) return
          addEvent({ ...ev, profiles: profile ?? undefined })
        } else {
          addEvent(ev)
        }
        void fetchAll()
      })

      .subscribe(status => {
        if (!mounted) return
        setConnected(status === 'SUBSCRIBED')
      })

    const pollId = window.setInterval(() => {
      if (!mounted) return
      void fetchAll()
    }, POLL_INTERVAL_MS)

    const onFocus = () => { if (mounted) void fetchAll() }
    const onVisibility = () => {
      if (mounted && document.visibilityState === 'visible') void fetchAll()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mounted = false
      window.clearInterval(pollId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      supabase.removeChannel(channel)
      reset()
    }
  }, [roomId, fetchAll, updateRoom, upsertPlayer, updatePlayer, addEvent, setCaseInfo, setConnected, reset])

  return { fetchAll }
}
