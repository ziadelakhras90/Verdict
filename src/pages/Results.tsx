import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { fetchResults, fetchVerdictSummary } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card, Avatar, Badge, Spinner } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { ROLE_LABELS, ROLE_EMOJI } from '@/lib/types'
import type { GameResult, Role, VerdictRow } from '@/lib/types'
import { cn, normalizeErrorMessage } from '@/lib/utils'

const RESULTS_POLL_MS = 1500

export default function Results() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUserId = useCurrentUser()

  useRoom(roomId)
  useRoomGuard(roomId, ['reveal', 'finished'], 'results')

  const room = useRoomStore(s => s.room)
  const results = useRoomStore(s => s.results)
  const setResults = useRoomStore(s => s.setResults)
  const revealData = useRoomStore(s => s.revealData)
  const setRevealData = useRoomStore(s => s.setRevealData)

  const [loading, setLoading] = useState(true)
  const [verdict, setVerdict] = useState<VerdictRow | null>(null)
  const [error, setError] = useState('')
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (!roomId) return

    const activeRoomId = roomId
    let cancelled = false

    async function loadResultsPage() {
      try {
        setError('')
        const [resultsData, verdictData] = await Promise.all([
          fetchResults(activeRoomId),
          fetchVerdictSummary(activeRoomId),
        ])

        if (cancelled) return

        setResults(resultsData as GameResult[])
        setVerdict(verdictData)

        if (verdictData?.actual_verdict && verdictData.hidden_truth) {
          setRevealData({
            actual_verdict: verdictData.actual_verdict,
            hidden_truth: verdictData.hidden_truth,
          })
        }
      } catch (err) {
        if (cancelled) return
        setError(normalizeErrorMessage(err, 'تعذر تحميل النتائج'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadResultsPage()

    return () => {
      cancelled = true
    }
  }, [roomId, setResults, setRevealData])

  const shouldPoll = !!roomId && (results.length === 0 || !revealData) && room?.status === 'finished'

  useEffect(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }

    if (!shouldPoll || !roomId) return

    const activeRoomId = roomId
    pollRef.current = window.setInterval(async () => {
      try {
        const [resultsData, verdictData] = await Promise.all([
          fetchResults(activeRoomId),
          fetchVerdictSummary(activeRoomId),
        ])

        if (resultsData.length > 0) setResults(resultsData as GameResult[])
        setVerdict(verdictData)

        if (verdictData?.actual_verdict && verdictData.hidden_truth) {
          setRevealData({
            actual_verdict: verdictData.actual_verdict,
            hidden_truth: verdictData.hidden_truth,
          })
        }

        if (resultsData.length > 0 && (verdictData?.actual_verdict || revealData)) {
          if (pollRef.current) {
            window.clearInterval(pollRef.current)
            pollRef.current = null
          }
        }
      } catch {
        // retry on next poll tick
      }
    }, RESULTS_POLL_MS)

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [shouldPoll, roomId, revealData, setRevealData, setResults])

  const winners = useMemo(() => results.filter(r => r.did_win), [results])
  const losers = useMemo(() => results.filter(r => !r.did_win), [results])
  const myResult = useMemo(() => results.find(r => r.player_id === currentUserId), [results, currentUserId])

  if (loading && results.length === 0) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center">
          <Spinner size={32} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen px-4 py-10 pb-24">
        <div className="max-w-md mx-auto space-y-6">

          {myResult && (
            <div className={cn(
              'rounded-2xl p-6 text-center border-2 animate-card-reveal',
              myResult.did_win ? 'border-gold bg-gold/10' : 'border-ink-700 bg-ink-800/60'
            )}>
              <div className={cn('text-6xl mb-3 transition-transform', myResult.did_win && 'animate-gavel')}>
                {myResult.did_win ? '🏆' : '💀'}
              </div>
              <p className={cn('font-display text-3xl mb-1', myResult.did_win ? 'shimmer-text' : 'text-ink-400')}>
                {myResult.did_win ? 'فزتَ!' : 'خسرتَ'}
              </p>
              <p className="text-sm text-ink-400">{myResult.reason}</p>
              <div className="mt-3">
                <Badge
                  label={`${ROLE_EMOJI[myResult.role as Role]} ${ROLE_LABELS[myResult.role as Role]}`}
                  color={myResult.did_win ? 'gold' : 'gray'}
                />
              </div>
            </div>
          )}

          <div className="text-center space-y-2">
            <h1 className="font-display text-2xl text-gold">النتائج الكاملة</h1>
            {verdict && (
              <p className="text-sm text-ink-400">
                القاضي حكم بأن المتهم <span className={cn(verdict.verdict === 'innocent' ? 'text-blue-300' : 'text-blood-300')}>
                  {verdict.verdict === 'innocent' ? 'بريء' : 'مذنب'}
                </span>
              </p>
            )}
          </div>

          {revealData && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="label-sm">الحقيقة الفعلية</p>
                <span className={cn(
                  'font-display text-sm',
                  revealData.actual_verdict === 'innocent' ? 'text-blue-300' : 'text-blood-300'
                )}>
                  {revealData.actual_verdict === 'innocent' ? '🕊️ بريء' : '⛓️ مذنب'}
                </span>
              </div>
              {verdict?.judge_was_correct !== null && verdict?.judge_was_correct !== undefined && (
                <p className={cn(
                  'text-xs rounded-lg px-3 py-2',
                  verdict.judge_was_correct ? 'bg-green-900/20 text-green-300' : 'bg-blood/10 text-blood-300'
                )}>
                  {verdict.judge_was_correct ? 'القاضي أصاب الحقيقة.' : 'القاضي لم يطابق الحقيقة.'}
                </p>
              )}
              <p className="text-xs text-parch-400 leading-relaxed border-t border-ink-700/50 pt-3">
                {revealData.hidden_truth}
              </p>
            </Card>
          )}

          {error && (
            <Card className="border border-blood/30 bg-blood/10 text-center">
              <p className="text-sm text-blood-300">{error}</p>
            </Card>
          )}

          {!loading && !error && results.length === 0 && (
            <Card className="text-center py-8">
              <p className="text-sm text-ink-400">جاري انتظار احتساب النتائج النهائية...</p>
            </Card>
          )}

          {winners.length > 0 && (
            <Card>
              <p className="label-sm text-green-400 mb-3">🏆 الفائزون ({winners.length})</p>
              <div className="space-y-2">
                {winners.map((r, i) => (
                  <ResultRow key={r.player_id} result={r} isMe={r.player_id === currentUserId} won index={i} />
                ))}
              </div>
            </Card>
          )}

          {losers.length > 0 && (
            <Card>
              <p className="label-sm text-ink-500 mb-3">الخاسرون ({losers.length})</p>
              <div className="space-y-2">
                {losers.map((r, i) => (
                  <ResultRow key={r.player_id} result={r} isMe={r.player_id === currentUserId} won={false} index={i} />
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="primary" onClick={() => navigate('/create')} className="w-full">
              🎮 لعبة جديدة
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
              🏠 الرئيسية
            </Button>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppShell>
  )
}

function ResultRow({
  result, isMe, won, index,
}: { result: GameResult; isMe: boolean; won: boolean; index: number }) {
  const username = (result as any).profiles?.username ?? 'لاعب'
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-all',
        'animate-fade-up',
        isMe ? 'border-gold/30 bg-gold/5' : 'border-ink-700/30 bg-ink-800/20'
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Avatar username={username} size={38} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-parch-200 truncate">{username}</span>
          {isMe && <span className="text-xs text-gold">(أنت)</span>}
        </div>
        <p className="text-xs text-ink-400">
          {ROLE_EMOJI[result.role as Role]} {ROLE_LABELS[result.role as Role]}
        </p>
        {result.reason && <p className="text-xs text-ink-500 truncate mt-0.5">{result.reason}</p>}
      </div>
      <span className={cn('text-xl flex-shrink-0', won ? 'text-gold' : 'text-ink-600')}>
        {won ? '🏆' : '💀'}
      </span>
    </div>
  )
}
