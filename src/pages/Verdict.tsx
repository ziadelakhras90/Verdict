import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { submitVerdict } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import type { VerdictValue } from '@/lib/types'
import { cn, normalizeErrorMessage } from '@/lib/utils'
import { getEdgeMutationFeedback } from '@/lib/edgeMutation'

export default function Verdict() {
  const { id: roomId } = useParams<{ id: string }>()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, ['verdict', 'reveal', 'finished'], ['verdict', 'reveal', 'results'])

  const room    = useRoomStore(s => s.room)
  const players = useRoomStore(s => s.players)

  const [selected, setSelected]   = useState<VerdictValue | null>(null)
  const [loading, setLoading]     = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const me      = players.find(p => p.player_id === currentUserId)
  const isJudge = me?.role === 'judge'

  async function handleSubmit() {
    if (!roomId || !selected || loading || submitted || room?.status !== 'verdict') return
    setLoading(true)
    try {
      const result = await submitVerdict(roomId, selected, 'verdict')
      setSubmitted(true)
      const feedback = getEdgeMutationFeedback('submit-verdict', result, {
        message: getEdgeMutationFeedback('submit-verdict', result).isDuplicate ? 'تم إرسال الحكم بالفعل' : 'تم إصدار الحكم',
      })
      toast[feedback.variant](feedback.message)
    } catch (err) {
      toast.error(normalizeErrorMessage(err, 'فشل إصدار الحكم'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">

          <div className="text-center space-y-2">
            <div className="text-6xl animate-gavel">🔨</div>
            <h1 className="font-display text-4xl shimmer-text">لحظة الحكم</h1>
            <p className="text-ink-400 text-sm">
              {isJudge ? 'يا حضرة القاضي — أصدر حكمك النهائي' : 'القاضي يتداول في حكمه...'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 text-gold/20">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/20" />
            <span className="text-sm">⚖️</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/20" />
          </div>

          {isJudge && !submitted ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {(['innocent', 'guilty'] as VerdictValue[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setSelected(v)}
                    className={cn(
                      'p-6 rounded-2xl border-2 text-center transition-all duration-200 active:scale-95',
                      selected === v
                        ? v === 'innocent'
                          ? 'border-blue-400 bg-blue-900/30 scale-[1.02]'
                          : 'border-blood bg-blood/20 scale-[1.02]'
                        : 'border-ink-700 hover:border-ink-500'
                    )}
                  >
                    <div className="text-4xl mb-2">{v === 'innocent' ? '🕊️' : '⛓️'}</div>
                    <p className={cn(
                      'font-display text-xl',
                      selected === v
                        ? v === 'innocent' ? 'text-blue-300' : 'text-blood-300'
                        : 'text-parch-300'
                    )}>
                      {v === 'innocent' ? 'بريء' : 'مذنب'}
                    </p>
                    <p className="text-xs text-ink-500 mt-1">
                      {v === 'innocent' ? 'إطلاق سراحه' : 'إدانته'}
                    </p>
                  </button>
                ))}
              </div>

              <Button
                variant={selected === 'innocent' ? 'ghost' : selected === 'guilty' ? 'danger' : 'primary'}
                size="lg"
                loading={loading}
                disabled={!selected}
                onClick={handleSubmit}
                className="w-full"
              >
                {selected
                  ? `🔨 إصدار الحكم: ${selected === 'innocent' ? 'بريء' : 'مذنب'}`
                  : 'اختر الحكم أولاً'}
              </Button>
            </div>
          ) : submitted ? (
            <Card className="text-center space-y-3 py-8 animate-fade-up">
              <div className="text-5xl">✅</div>
              <p className="font-display text-2xl text-gold">صدر الحكم</p>
              <p className="text-ink-400 text-sm">جارٍ إعلان النتيجة النهائية...</p>
            </Card>
          ) : (
            <Card className="text-center py-10 space-y-4">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-gold/20 animate-ping" />
                <div className="relative flex items-center justify-center w-full h-full text-4xl">⏳</div>
              </div>
              <p className="text-parch-300 font-body">القاضي يفكر في حكمه...</p>
              <p className="text-xs text-ink-500">ستنتقل الصفحة تلقائياً عند إصدار الحكم</p>
            </Card>
          )}
        </div>
      </div>
      <ToastContainer />
    </AppShell>
  )
}
