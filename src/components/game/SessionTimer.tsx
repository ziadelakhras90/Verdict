import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useRoomStore } from '@/stores/roomStore'
import { SESSION_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

export function SessionTimer() {
  const { formatted, isUrgent, isExpired } = useSessionTimer()
  const session = useRoomStore(s => s.room?.current_session ?? 1)

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="label-sm">{SESSION_LABELS[session] ?? `الجلسة ${session}`}</p>
      <div
        className={cn(
          'font-mono text-5xl font-bold tabular-nums tracking-widest transition-colors duration-500',
          isExpired ? 'text-ink-600' :
          isUrgent  ? 'text-blood-400 animate-pulse' :
                      'text-gold'
        )}
      >
        {formatted}
      </div>
      {/* Progress dots */}
      <div className="flex gap-1.5 mt-1">
        {[1,2,3].map(n => (
          <div
            key={n}
            className={cn(
              'w-2 h-2 rounded-full border transition-all duration-300',
              session >= n
                ? 'bg-gold border-gold'
                : 'bg-transparent border-ink-600'
            )}
          />
        ))}
      </div>
    </div>
  )
}
