import { Avatar, Badge } from '@/components/ui'
import { ROLE_LABELS } from '@/lib/types'
import type { RoomPlayer, Role } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PlayerListProps {
  players: RoomPlayer[]
  currentUserId: string | null
  showRoles?: boolean
}

export function PlayerList({ players, currentUserId, showRoles = false }: PlayerListProps) {
  return (
    <div className="space-y-2">
      {players.map((p, i) => {
        const username = p.profiles?.username ?? 'لاعب'
        const isMe = p.player_id === currentUserId
        return (
          <div
            key={p.id}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
              isMe
                ? 'border-gold/40 bg-gold/5'
                : 'border-ink-700/50 bg-ink-800/40'
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <Avatar username={username} size={38} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-body font-medium text-parch-100 text-sm">
                  {username}
                </span>
                {isMe && <Badge label="أنت" color="gold" />}
                {p.is_host && <Badge label="المضيف" color="purple" />}
              </div>
              {showRoles && p.role && (
                <span className="text-xs text-ink-400">
                  {ROLE_LABELS[p.role as Role]}
                </span>
              )}
            </div>
            <div className={cn(
              'flex items-center gap-1.5 text-xs font-body px-2.5 py-1 rounded-full border',
              p.is_ready
                ? 'text-green-400 border-green-700/40 bg-green-900/20'
                : 'text-ink-500 border-ink-700/40'
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', p.is_ready ? 'bg-green-400' : 'bg-ink-600')} />
              {p.is_ready ? 'جاهز' : 'انتظار'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
