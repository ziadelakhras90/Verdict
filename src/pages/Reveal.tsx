import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { revealTruth, fetchResults, fetchVerdictSummary } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card, Spinner } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import type { VerdictRow, GameResult } from '@/lib/types'
import { cn, normalizeErrorMessage } from '@/lib/utils'
import { getEdgeMutationFeedback } from '@/lib/edgeMutation'

const REVEAL_POLL_MS = 1500

export default function Reveal() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUserId = useCurrentUser()
  const toast = useToast()

  useRoom(roomId)
  useRoomGuard(roomId, ['verdict', 'reveal', 'finished'], ['reveal', 'results'])

  const room = useRoomStore(s => s.room)
  const revealData = useRoomStore(s => s.revealData)
  const setRevealData = useRoomStore(s => s.setRevealData)
  const results = useRoomStore(s => s.results)
  const setResults = useRoomStore(s => s.setResults)

  const [verdict, setVerdict] = useState<VerdictRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [revealing, setRevealing] = useState(false)
  const [error, setError] = useState('')
  const revealPollRef = useRef<number | null>(null)

  const isHost = room?.host_id === currentUserId

  const phase = useMemo<'loading' | 'waiting' | 'revealed'>(() => {
    if (loading) return 'loading'
    return revealData ? 'revealed' : 'waiting'
  }, [loading, revealData])

  useEffect(() => {
    return () => {
      if (revealPollRef.current) window.clearInterval(revealPollRef.current)
    }
  }, [])

  useEffect(() => {
    if (!roomId) return

    const activeRoomId = roomId
    let cancelled = false

    async function syncRevealState() {
      try {
        setError('')
        const verdictData = await fetchVerdictSummary(activeRoomId)
        if (cancelled) return

        setVerdict(verdictData)

        if (verdictData?.actual_verdict && verdictData.hidden_truth) {
          setRevealData({
            actual_verdict: verdictData.actual_verdict,
            hidden_truth: verdictData.hidden_truth,
          })

          if (results.length === 0 || room?.status === 'finished') {
            const resultsData = await fetchResults(activeRoomId)
            if (cancelled) return
            setResults(resultsData as GameResult[])
          }
        }
      } catch (err) {
        if (cancelled) return
        setError(normalizeErrorMessage(err, 'تعذر تحميل حالة الكشف'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void syncRevealState()

    return () => {
      cancelled = true
    }
  }, [roomId, room?.status, results.length, setRevealData, setResults])

  useEffect(() => {
    if (revealPollRef.current) {
      window.clearInterval(revealPollRef.current)
      revealPollRef.current = null
    }

    if (!roomId || revealData || !room?.status || !['reveal', 'finished'].includes(room.status)) return

    const activeRoomId = roomId
    revealPollRef.current = window.setInterval(async () => {
      try {
        const verdictData = await fetchVerdictSummary(activeRoomId)
        if (!verdictData?.actual_verdict || !verdictData.hidden_truth) return

        setVerdict(verdictData)
        setRevealData({
          actual_verdict: verdictData.actual_verdict,
          hidden_truth: verdictData.hidden_truth,
        })

        const resultsData = await fetchResults(activeRoomId)
        setResults(resultsData as GameResult[])

        if (revealPollRef.current) {
          window.clearInterval(revealPollRef.current)
          revealPollRef.current = null
        }
      } catch {
        // retry on next poll tick
      }
    }, REVEAL_POLL_MS)

    return () => {
      if (revealPollRef.current) {
        window.clearInterval(revealPollRef.current)
        revealPollRef.current = null
      }
    }
  }, [room?.status, roomId, revealData, setRevealData, setResults])

  useEffect(() => {
    if (!roomId) return

    if (room?.status === 'finished' && revealData && results.length > 0) {
      navigate(`/room/${roomId}/results`, { replace: true })
    }
  }, [navigate, revealData, results.length, room?.status, roomId])

  async function handleReveal() {
    if (!roomId || revealing || phase === 'revealed') return

    setRevealing(true)
    setError('')

    try {
      const result = await revealTruth(roomId, room?.status === 'finished' ? 'finished' : 'reveal')
      setRevealData({ actual_verdict: result.actual_verdict, hidden_truth: result.hidden_truth })
      setVerdict(current => current ? {
        ...current,
        actual_verdict: result.actual_verdict as VerdictRow['actual_verdict'],
        hidden_truth: result.hidden_truth,
        judge_was_correct: current.verdict === result.actual_verdict,
      } : current)

      const resultsData = result.results?.length ? result.results : await fetchResults(roomId)
      setResults(resultsData as GameResult[])
      const feedback = getEdgeMutationFeedback('reveal-truth', result)
      toast[feedback.variant](feedback.message)
    } catch (err) {
      const message = normalizeErrorMessage(err, 'خطأ في كشف الحقيقة')
      setError(message)
      toast.error(message)
    } finally {
      setRevealing(false)
      setLoading(false)
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

          {error && (
            <Card className="border border-blood/30 bg-blood/10 text-center">
              <p className="text-sm text-blood-300">{error}</p>
            </Card>
          )}

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
