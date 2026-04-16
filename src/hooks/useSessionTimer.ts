import { useState, useEffect } from 'react'
import { useRoomStore } from '@/stores/roomStore'

export function useSessionTimer() {
  const sessionEndsAt = useRoomStore(s => s.room?.session_ends_at)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!sessionEndsAt) { setSecondsLeft(0); return }

    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(sessionEndsAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [sessionEndsAt])

  return {
    secondsLeft,
    minutes:   Math.floor(secondsLeft / 60),
    seconds:   secondsLeft % 60,
    isExpired: secondsLeft === 0 && !!sessionEndsAt,
    isUrgent:  secondsLeft > 0 && secondsLeft <= 30,
    formatted: `${String(Math.floor(secondsLeft / 60)).padStart(2,'0')}:${String(secondsLeft % 60).padStart(2,'0')}`,
  }
}
