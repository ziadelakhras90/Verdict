import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { fetchMyRoleCard, beginSession } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card, Spinner } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { RoleCardDisplay } from '@/components/game/RoleCardDisplay'
import { CaseInfoPanel } from '@/components/game/CaseInfoPanel'
import type { RoleCard } from '@/lib/types'
import { cn, normalizeErrorMessage } from '@/lib/utils'
import { getEdgeMutationFeedback } from '@/lib/edgeMutation'

export default function RoleCardPage() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  useRoom(roomId)
  // Accept both 'starting' (reading cards) and 'in_session' (already started)
  useRoomGuard(roomId, ['starting', 'in_session'], ['card', 'session', 'judge'])

  const room     = useRoomStore(s => s.room)
  const caseInfo = useRoomStore(s => s.caseInfo)
  const players  = useRoomStore(s => s.players)

  const [card, setCard]           = useState<RoleCard | null>(null)
  const [loading, setLoading]     = useState(true)
  const [beginning, setBeginning] = useState(false)
  const [readyCount, setReadyCount] = useState(0)

  const isHost = room?.host_id === currentUserId

  useEffect(() => {
    if (!roomId || !currentUserId) return
    fetchMyRoleCard(roomId).then(data => {
      if (data) setCard(data as RoleCard)
      setLoading(false)
    })
  }, [roomId, currentUserId])

  // Count how many players have clicked ready (is_ready re-used here as "card read")
  useEffect(() => {
    setReadyCount(players.filter(p => p.is_ready).length)
  }, [players])

  async function handleBeginSession() {
    if (!roomId) return
    setBeginning(true)
    try {
      const result = await beginSession(roomId, 'starting')
      const feedback = getEdgeMutationFeedback('begin-session', result)
      toast[feedback.variant](feedback.message)
      // useRoomGuard will redirect everyone to /session automatically
    } catch (err) {
      toast.error(normalizeErrorMessage(err, 'فشل بدء الجلسة'))
    } finally {
      setBeginning(false)
    }
  }

  function handleGoToSession() {
    navigate(`/room/${roomId}/session`)
  }

  if (loading) return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl animate-flicker">⚖️</div>
          <Spinner size={28} />
          <p className="text-ink-500 text-sm animate-pulse">جارٍ تجهيز بطاقتك السرية...</p>
        </div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="min-h-screen p-4 py-8 pb-24">
        <div className="max-w-md mx-auto space-y-5">

          <div className="text-center space-y-1">
            <h1 className="font-display text-2xl text-gold">بطاقة دورك</h1>
            <p className="text-xs text-ink-500">اقرأها بعناية — لا يراها أحد سواك</p>
          </div>

          {/* Case info */}
          {caseInfo && <CaseInfoPanel caseInfo={caseInfo} />}

          {/* Role card */}
          {card ? (
            <RoleCardDisplay card={card} caseTitle={caseInfo?.title} caseInfo={caseInfo} />
          ) : (
            <Card className="text-center py-10">
              <Spinner size={24} />
              <p className="text-ink-500 text-sm mt-3 animate-pulse">جارٍ تحضير بطاقتك...</p>
            </Card>
          )}

          {/* Actions */}
          {room?.status === 'starting' ? (
            <div className="space-y-3">
              {isHost ? (
                <>
                  <div className="text-center">
                    <p className="text-xs text-ink-500 mb-1">
                      {players.length} لاعبين في الغرفة
                    </p>
                  </div>
                  <Button
                    variant="judge"
                    size="lg"
                    loading={beginning}
                    onClick={handleBeginSession}
                    className="w-full"
                  >
                    {beginning ? 'جارٍ البدء...' : '🔨 ابدأ الجلسة الأولى'}
                  </Button>
                  <p className="text-center text-xs text-ink-500">
                    كمضيف، أنت من يبدأ الجلسة بعد أن يقرأ الجميع بطاقاتهم
                  </p>
                </>
              ) : (
                <Card className="text-center py-5 space-y-2">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                  </div>
                  <p className="text-ink-400 text-sm">المضيف سيبدأ الجلسة قريباً...</p>
                  <p className="text-xs text-ink-600">ستنتقل الصفحة تلقائياً</p>
                </Card>
              )}
            </div>
          ) : room?.status === 'in_session' ? (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleGoToSession}
            >
              انتقل للجلسة ←
            </Button>
          ) : null}

        </div>
      </div>
      <ToastContainer />
    </AppShell>
  )
}
