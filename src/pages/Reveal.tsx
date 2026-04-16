import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { revealTruth, fetchResults } from '@/actions'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout'
import { Button, Card, Spinner } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import type { VerdictRow, GameResult } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function Reveal() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, ['verdict', 'reveal', 'finished'])

  const room          = useRoomStore(s => s.room)
  const players       = useRoomStore(s => s.players)
  const revealData    = useRoomStore(s => s.revealData)
  const setRevealData = useRoomStore(s => s.setRevealData)
  const setResults    = useRoomStore(s => s.setResults)

  const [verdict, setVerdict]     = useState<VerdictRow | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [phase, setPhase]         = useState<'loading' | 'waiting' | 'revealed'>('loading')

  const isHost = room?.host_id === currentUserId

  // Load verdict and existing reveal data
  useEffect(() => {
    if (!roomId) return
    Promise.all([
      supabase.from('verdicts').select('*').eq('room_id', roomId).single(),
      revealData ? Promise.resolve(null) : null,
    ]).then(([vRes]) => {
      if (vRes.data) setVerdict(vRes.data as VerdictRow)
      setPhase(revealData ? 'revealed' : 'waiting')
    })
  }, [roomId])

  // If room goes to 'reveal' status and we don't have data yet, re-fetch
  useEffect(() => {
    if (room?.status === 'reveal' && !revealData) {
      fetchResults(roomId!).then(data => {
        if (data.length) setResults(data as GameResult[])
      })
    }
    if (room?.status === 'finished') navigate(`/room/${roomId}/results`)
  }, [room?.status])

  async function handleReveal() {
    if (!roomId) return
    setRevealing(true)
    try {
      const result = await revealTruth(roomId)
      setRevealData({ actual_verdict: result.actual_verdict, hidden_truth: result.hidden_truth })
      const results = await fetchResults(roomId)
      setResults(results as GameResult[])
      setPhase('revealed')
      toast.success('تم كشف الحقيقة!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطأ في كشف الحقيقة')
      setRevealing(false)
    }
  }

  if (phase === 'loading') return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    </AppShell>
  )

  const verdictMatch = verdict && revealData
    ? verdict.verdict === revealData.actual_verdict
    : null

  return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-5">

          <div className="text-center space-y-1">
            <div className="text-6xl">🔍</div>
            <h1 className="font-display text-4xl text-gold">كشف الحقيقة</h1>
          </div>

          {/* Judge's verdict card */}
          {verdict && (
            <Card className="text-center space-y-2 animate-fade-up">
              <p className="label-sm">حكم القاضي</p>
              <p className={cn(
                'font-display text-4xl',
                verdict.verdict === 'innocent' ? 'text-blue-300' : 'text-blood-300'
              )}>
                {verdict.verdict === 'innocent' ? '🕊️ بريء' : '⛓️ مذنب'}
              </p>
            </Card>
          )}

          {/* Revealed truth */}
          {phase === 'revealed' && revealData ? (
            <div className="space-y-4 animate-fade-up">
              <Card className="text-center space-y-3">
                <p className="label-sm">الحقيقة الفعلية</p>
                <p className={cn(
                  'font-display text-4xl',
                  revealData.actual_verdict === 'innocent' ? 'text-blue-300' : 'text-blood-300'
                )}>
                  {revealData.actual_verdict === 'innocent' ? '🕊️ بريء فعلاً' : '⛓️ مذنب فعلاً'}
                </p>
              </Card>

              <Card className="space-y-2">
                <p className="label-sm">ما جرى فعلاً</p>
                <p className="text-sm text-parch-200 leading-relaxed">{revealData.hidden_truth}</p>
              </Card>

              {verdictMatch !== null && (
                <div className={cn(
                  'rounded-2xl p-4 text-center border animate-card-reveal',
                  verdictMatch
                    ? 'border-green-600/40 bg-green-900/20'
                    : 'border-blood/40 bg-blood/10'
                )}>
                  <p className={cn('font-display text-xl', verdictMatch ? 'text-green-300' : 'text-blood-300')}>
                    {verdictMatch ? '✓ القاضي أصاب الهدف' : '✗ القاضي أخطأ التقدير'}
                  </p>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate(`/room/${roomId}/results`)}
                className="w-full"
              >
                عرض النتائج الكاملة →
              </Button>
            </div>
          ) : isHost ? (
            <Button
              variant="judge"
              size="lg"
              loading={revealing}
              onClick={handleReveal}
              className="w-full"
            >
              🔍 اكشف الحقيقة للجميع
            </Button>
          ) : (
            <Card className="text-center py-10">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
              </div>
              <p className="text-ink-400 text-sm">المضيف يكشف الحقيقة...</p>
            </Card>
          )}
        </div>
      </div>
      <ToastContainer />
    </AppShell>
  )
}
