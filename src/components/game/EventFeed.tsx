import { useEffect, useMemo, useRef } from 'react'
import type { GameEvent, EventType } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'
import { Avatar } from '@/components/ui'

const EVENT_STYLE: Record<EventType, { label: string; borderColor: string }> = {
  statement: { label: 'إفادة', borderColor: 'border-gold/30' },
  question: { label: 'سؤال', borderColor: 'border-blue-500/40' },
  objection: { label: 'اعتراض', borderColor: 'border-blood/50' },
  system: { label: 'نظام', borderColor: 'border-ink-600/40' },
}

interface EventFeedProps {
  events: GameEvent[]
  currentSession: number
}

export function EventFeed({ events, currentSession }: EventFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  const sessionEvents = useMemo(
    () => events.filter((event) => event.session_num === currentSession),
    [events, currentSession]
  )

  if (sessionEvents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-500 text-sm font-body">
        لا توجد إفادات بعد في هذه الجلسة
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-3 p-4">
      {sessionEvents.map((event, i) => {
        const style = EVENT_STYLE[event.event_type]
        const isSystem = event.event_type === 'system'
        const username = event.profiles?.username ?? 'مجهول'

        if (isSystem) {
          return (
            <div key={event.id} className="text-center">
              <span className="text-xs text-ink-500 bg-ink-800/60 px-3 py-1 rounded-full border border-ink-700/40">
                {event.content}
              </span>
            </div>
          )
        }

        return (
          <div
            key={event.id}
            className={cn('flex gap-3 animate-fade-up')}
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <Avatar username={username} size={32} />
            <div className={cn('flex-1 rounded-xl p-3 border bg-ink-800/40', style.borderColor)}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-body font-semibold text-parch-200">{username}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-500 border border-ink-700/50 px-2 py-0.5 rounded-full">
                    {style.label}
                  </span>
                  <span className="text-xs text-ink-600">{timeAgo(event.created_at)}</span>
                </div>
              </div>
              <p className="text-sm text-parch-200 leading-relaxed whitespace-pre-wrap">{event.content}</p>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
