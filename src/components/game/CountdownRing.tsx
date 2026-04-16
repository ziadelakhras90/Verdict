import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useRoomStore } from '@/stores/roomStore'
import { cn } from '@/lib/utils'

interface CountdownRingProps {
  totalSeconds: number
  size?: number
}

export function CountdownRing({ totalSeconds, size = 120 }: CountdownRingProps) {
  const { secondsLeft, isUrgent, isExpired } = useSessionTimer()
  const session = useRoomStore(s => s.room?.current_session ?? 1)

  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0
  const dashOffset = circumference * (1 - progress)

  const minutes = Math.floor(secondsLeft / 60)
  const secs    = secondsLeft % 60

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(201,168,76,0.1)" strokeWidth={6}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={isExpired ? '#352E28' : isUrgent ? '#8B1A1A' : '#C9A84C'}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
        />
        {/* Inner text — counter-rotate */}
        <g style={{ transform: `rotate(90deg) translate(0, 0)`, transformOrigin: `${size/2}px ${size/2}px` }}>
          <text
            x={size / 2} y={size / 2 - 4}
            textAnchor="middle" dominantBaseline="middle"
            className={cn(
              'font-mono font-bold',
              isExpired ? 'fill-ink-600' : isUrgent ? 'fill-blood-400' : 'fill-gold'
            )}
            style={{ fontSize: size * 0.22 }}
          >
            {String(minutes).padStart(2,'0')}:{String(secs).padStart(2,'0')}
          </text>
          <text
            x={size / 2} y={size / 2 + size * 0.16}
            textAnchor="middle"
            fill="rgba(201,168,76,0.5)"
            style={{ fontSize: size * 0.1 }}
          >
            جلسة {session}/3
          </text>
        </g>
      </svg>
    </div>
  )
}
