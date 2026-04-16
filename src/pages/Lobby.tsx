import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { setReady, startGame } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card, StatusDot } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { PlayerList } from '@/components/room/PlayerList'
import { cn } from '@/lib/utils'

export default function Lobby() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  const { fetchAll }   = useRoom(roomId)
  // When status changes away from 'waiting', useRoomGuard redirects automatically
  useRoomGuard(roomId, 'waiting')

  const room         = useRoomStore(s => s.room)
  const players      = useRoomStore(s => s.players)
  const isConnected  = useRoomStore(s => s.isConnected)
  const updatePlayer = useRoomStore(s => s.updatePlayer)

  const [startLoading, setStartLoading] = useState(false)
  const [readyLoading, setReadyLoading] = useState(false)
  const [copied, setCopied]             = useState(false)

  const me       = players.find(p => p.player_id === currentUserId)
  const isHost   = room?.host_id === currentUserId
  const allReady = players.length >= 4 && players.every(p => p.is_ready)
  const canStart = isHost && allReady
  const readyCount = players.filter(p => p.is_ready).length

  function copyCode() {
    if (!room) return
    navigator.clipboard.writeText(room.room_code)
    setCopied(true)
    toast.success('تم نسخ كود الغرفة')
    setTimeout(() => setCopied(false), 2000)
  }

  function shareLink() {
    if (!room) return
    navigator.clipboard.writeText(`${window.location.origin}/join/${room.room_code}`)
    setCopied(true)
    toast.success('تم نسخ الرابط')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleReady() {
    if (!roomId || !me || !currentUserId) return

    const nextReady = !me.is_ready
    setReadyLoading(true)

    // optimistic update so the UI changes immediately even if realtime is delayed
    updatePlayer(currentUserId, { is_ready: nextReady })

    try {
      await setReady(roomId, nextReady)
      await fetchAll()
    } catch (err) {
      // rollback on failure
      updatePlayer(currentUserId, { is_ready: me.is_ready })
      toast.error(err instanceof Error ? err.message : 'خطأ')
    } finally {
      setReadyLoading(false)
    }
  }

  async function handleStart() {
    if (!roomId || !canStart) return
    setStartLoading(true)
    try {
      await startGame(roomId)
      // useRoomGuard will redirect to /card when status becomes 'starting'
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل بدء اللعبة')
      setStartLoading(false)
    }
  }

  if (!room) return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-ink-400 animate-pulse">جارٍ التحميل...</p>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="min-h-screen p-4 py-8">
        <div className="max-w-md mx-auto space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-gold">غرفة الانتظار</h1>
              <p className="text-xs text-ink-500 mt-0.5">
                {players.length}/{room.max_players} لاعبين · {readyCount} جاهز
              </p>
            </div>
            <StatusDot connected={isConnected} />
          </div>

          {/* Room Code */}
          <Card className="text-center space-y-3">
            <p className="label-sm">شارك كود الغرفة مع أصدقائك</p>
            <div
              className="text-5xl font-mono font-bold tracking-[0.3em] text-gold cursor-pointer hover:text-gold-300 transition-colors select-all"
              onClick={copyCode}
              title="اضغط للنسخ"
            >
              {room.room_code}
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={copyCode}
                className="text-xs text-ink-400 hover:text-parch-200 border border-ink-700 hover:border-ink-500 px-3 py-1.5 rounded-lg transition-all"
              >
                {copied ? '✓ تم' : 'نسخ الكود'}
              </button>
              <button
                onClick={shareLink}
                className="text-xs text-ink-400 hover:text-parch-200 border border-ink-700 hover:border-ink-500 px-3 py-1.5 rounded-lg transition-all"
              >
                🔗 مشاركة الرابط
              </button>
            </div>
          </Card>

          {/* Room stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'اللاعبون', value: `${players.length}/${room.max_players}` },
              { label: 'مدة الجلسة', value: `${Math.floor(room.session_duration_seconds/60)}د` },
              { label: 'الجلسات', value: '3' },
            ].map(s => (
              <div key={s.label} className="card-glass rounded-xl p-3 text-center">
                <p className="label-sm mb-1">{s.label}</p>
                <p className="text-gold font-mono text-lg font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Players */}
          <Card>
            <p className="label-sm mb-3">اللاعبون</p>
            <PlayerList players={players} currentUserId={currentUserId} />
            {players.length < 4 && (
              <div className="mt-4 py-3 border border-dashed border-ink-700 rounded-xl text-center">
                <p className="text-xs text-ink-500">
                  في انتظار {4 - players.length} لاعبين إضافيين على الأقل
                </p>
              </div>
            )}
          </Card>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant={me?.is_ready ? 'ghost' : 'primary'}
              size="lg"
              loading={readyLoading}
              onClick={handleReady}
              className="w-full"
            >
              {me?.is_ready ? '✓ جاهز — اضغط للإلغاء' : 'أنا جاهز'}
            </Button>

            {isHost && (
              <Button
                variant="judge"
                size="lg"
                loading={startLoading}
                disabled={!canStart}
                onClick={handleStart}
                className={cn('w-full', canStart && 'animate-pulse-slow')}
              >
                {!allReady
                  ? `انتظار الجاهزية (${readyCount}/${players.length})`
                  : '🔨 ابدأ المحاكمة'}
              </Button>
            )}
          </div>

          {isHost && players.length >= 4 && !allReady && (
            <p className="text-center text-xs text-ink-600">
              يجب أن يضغط الجميع على "جاهز" قبل البدء
            </p>
          )}

        </div>
      </div>
      <ToastContainer />
    </AppShell>
  )
}
