import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { advanceSession, submitVerdict } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { CountdownRing } from '@/components/game/CountdownRing'
import { EventFeed } from '@/components/game/EventFeed'
import { CaseInfoPanel } from '@/components/game/CaseInfoPanel'
import { Modal } from '@/components/ui/Modal'
import { SESSION_LABELS } from '@/lib/types'
import type { VerdictValue } from '@/lib/types'
import { cn, normalizeErrorMessage } from '@/lib/utils'
import { getEdgeMutationFeedback } from '@/lib/edgeMutation'

type AdvanceTarget = 'next' | 'verdict'

export default function JudgePanel() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUserId = useCurrentUser()
  const toast = useToast()
  const { fetchAll } = useRoom(roomId)
  useRoomGuard(roomId, ['in_session', 'verdict'], 'judge')

  const room = useRoomStore(s => s.room)
  const players = useRoomStore(s => s.players)
  const events = useRoomStore(s => s.events)
  const caseInfo = useRoomStore(s => s.caseInfo)
  const { isExpired, secondsLeft } = useSessionTimer()

  const [advancing, setAdvancing] = useState(false)
  const [showVerdict, setShowVerdict] = useState(false)
  const [selectedV, setSelectedV] = useState<VerdictValue | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showForceVerdictConfirm, setShowForceVerdictConfirm] = useState(false)

  const me = useMemo(
    () => players.find((p) => p.player_id === currentUserId),
    [players, currentUserId]
  )
  const isJudge = me?.role === 'judge'
  const lastHandledExpiredSessionRef = useRef<number | null>(null)

  useEffect(() => {
    if (me?.role && me.role !== 'judge') {
      navigate(`/room/${roomId}/session`, { replace: true })
    }
  }, [me?.role, navigate, roomId])

  useEffect(() => {
    if (!room) return
    if (room.status !== 'in_session' || secondsLeft > 0) {
      lastHandledExpiredSessionRef.current = null
    }
  }, [room?.status, room?.current_session, secondsLeft])

  useEffect(() => {
    if (room?.status === 'verdict' && isJudge) setShowVerdict(true)
    if (room?.status !== 'verdict') {
      setShowVerdict(false)
      setSelectedV(null)
    }
  }, [room?.status, isJudge])

  useEffect(() => {
    const currentSession = room?.current_session
    if (!roomId || !room || !isJudge || !isExpired || room.status !== 'in_session' || advancing) return
    if (currentSession == null) return
    if (lastHandledExpiredSessionRef.current === currentSession) return

    lastHandledExpiredSessionRef.current = currentSession
    void handleAdvance('next', currentSession, true)
  }, [isExpired, isJudge, roomId, room?.status, room?.current_session, advancing])

  async function handleAdvance(target: AdvanceTarget, expectedSession?: number, autoTriggered = false) {
    if (!roomId || advancing || room?.status !== 'in_session') return

    const sessionSnapshot = expectedSession ?? room.current_session
    if (!sessionSnapshot) return

    setAdvancing(true)
    try {
      const result = await advanceSession(roomId, sessionSnapshot, target) as {
        idempotent?: boolean
        stale_request?: boolean
        moved_to?: string
        message?: string
      }
      await fetchAll()

      const feedback = getEdgeMutationFeedback('advance-session', result)
      if (feedback.isDuplicate) {
        if (autoTriggered) toast[feedback.variant](feedback.message)
        return
      }

      if (target === 'verdict' || result?.moved_to === 'verdict') {
        toast.info(target === 'verdict' ? 'تم إنهاء الجلسات والانتقال مباشرة إلى الحكم' : 'انتهت الجلسات — أصدر حكمك')
        setShowForceVerdictConfirm(false)
      } else {
        toast.success(`تم إنهاء الجلسة الحالية والانتقال إلى الجلسة ${sessionSnapshot + 1}`)
      }
    } catch (err) {
      if (autoTriggered) {
        lastHandledExpiredSessionRef.current = null
      }
      toast.error(normalizeErrorMessage(err, target === 'verdict' ? 'تعذر الانتقال إلى الحكم' : 'تعذر الانتقال للجلسة التالية'))
    } finally {
      setAdvancing(false)
    }
  }

  async function handleVerdictSubmit() {
    if (!roomId || !selectedV || submitting || room?.status !== 'verdict') return
    setSubmitting(true)
    try {
      const result = await submitVerdict(roomId, selectedV, 'verdict')
      setShowVerdict(false)
      const baseFeedback = getEdgeMutationFeedback('submit-verdict', result)
      const feedback = getEdgeMutationFeedback('submit-verdict', result, {
        message: baseFeedback.isDuplicate ? 'تم حفظ الحكم بالفعل' : 'صدر الحكم',
      })
      toast[feedback.variant](feedback.message)
    } catch (err) {
      toast.error(normalizeErrorMessage(err, 'فشل إصدار الحكم'))
    } finally {
      setSubmitting(false)
    }
  }

  const currentSession = room?.current_session ?? 1
  const sessionDuration = room?.session_duration_seconds ?? 180
  const isLastSession = currentSession >= 3
  const canAdvance = room?.status === 'in_session'
  const sessionEvents = useMemo(
    () => events.filter((event) => event.session_num === currentSession && event.event_type !== 'system'),
    [events, currentSession]
  )
  const speakerMap = useMemo(() => {
    const map = new Map<string, number>()
    sessionEvents.forEach((event) => {
      const username = event.profiles?.username ?? '?'
      map.set(username, (map.get(username) ?? 0) + 1)
    })
    return map
  }, [sessionEvents])

  if (!room) return null

  return (
    <AppShell>
      <div className="h-screen flex flex-col max-w-2xl mx-auto">
        <div className="flex items-center gap-4 px-5 py-4 border-b border-gold/20 bg-judge/10">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">⚖️</span>
              <span className="label-sm">لوحة القاضي</span>
            </div>
            <p className="font-display text-lg text-gold leading-tight">
              {SESSION_LABELS[currentSession] ?? `الجلسة ${currentSession}`}
            </p>
            <p className="text-xs text-ink-500 mt-1">يمكنك إنهاء الجلسة الحالية قبل انتهاء المؤقت أو نقل الجميع مباشرة إلى مرحلة الحكم.</p>
          </div>
          <CountdownRing totalSeconds={sessionDuration} size={80} />
        </div>

        {caseInfo && (
          <div className="px-4 py-2.5 border-b border-gold/10 bg-ink-900/40">
            <CaseInfoPanel caseInfo={caseInfo} compact />
          </div>
        )}

        <div className="px-4 py-2 border-b border-ink-800/40 flex gap-2 flex-wrap">
          {players.map((player) => {
            const name = player.profiles?.username ?? '?'
            const count = speakerMap.get(name) ?? 0
            return (
              <div
                key={player.player_id}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs',
                  player.role === 'judge'
                    ? 'border-gold/50 bg-gold/10 text-gold'
                    : 'border-ink-700 text-ink-400'
                )}
              >
                <span>{name}</span>
                {count > 0 && (
                  <span className="bg-gold/20 text-gold px-1 rounded-full">{count}</span>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <EventFeed events={events} currentSession={currentSession} />
        </div>

        <div className="border-t border-gold/20 p-4 space-y-3 bg-judge/5">
          <p className="label-sm text-center text-gold/60">أدوات القاضي</p>

          {canAdvance && (
            <>
              <Card className="border-gold/10 bg-ink-900/40 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="text-parch-200">{isExpired ? 'انتهى وقت الجلسة الحالية' : 'يمكنك إنهاء الجلسة الحالية مبكرًا'}</p>
                    <p className="text-xs text-ink-500 mt-1">
                      {isLastSession ? 'هذه آخر جلسة قبل مرحلة الحكم.' : `سينتقل الجميع إلى الجلسة ${currentSession + 1} فورًا عند الضغط.`}
                    </p>
                  </div>
                  {isExpired ? <span className="text-gold text-xs">تلقائي</span> : <span className="text-gold text-xs">يدوي</span>}
                </div>
              </Card>

              <Button
                variant="judge"
                size="lg"
                loading={advancing}
                disabled={advancing}
                onClick={() => void handleAdvance('next')}
                className="w-full"
              >
                {isLastSession ? '⚖️ إنهاء الجلسة الحالية والانتقال للحكم' : `⏭️ إنهاء الجلسة الحالية والانتقال إلى الجلسة ${currentSession + 1}`}
              </Button>

              {!isLastSession && (
                <Button
                  variant="ghost"
                  size="md"
                  disabled={advancing}
                  onClick={() => setShowForceVerdictConfirm(true)}
                  className="w-full"
                >
                  ⏩ الانتقال مباشرة إلى مرحلة الحكم
                </Button>
              )}
            </>
          )}

          {room.status === 'verdict' && (
            <Button variant="danger" size="lg" onClick={() => setShowVerdict(true)} className="w-full">
              🔨 إصدار الحكم النهائي
            </Button>
          )}
        </div>
      </div>

      <Modal open={showForceVerdictConfirm} onClose={() => !advancing && setShowForceVerdictConfirm(false)} title="الانتقال إلى الحكم" size="sm">
        <div className="space-y-5">
          <p className="text-sm text-parch-200 leading-7">
            سيتم إنهاء الجلسات الحالية فورًا والانتقال إلى مرحلة الحكم بدون انتظار انتهاء المؤقت أو إكمال الجلسات الثلاث.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setShowForceVerdictConfirm(false)}>
              إلغاء
            </Button>
            <Button variant="judge" className="flex-1" loading={advancing} onClick={() => void handleAdvance('verdict')}>
              نعم، إلى الحكم
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showVerdict} onClose={() => !submitting && setShowVerdict(false)} title="الحكم النهائي" size="sm">
        <div className="space-y-5">
          <p className="text-sm text-ink-400 text-center">
            استمعتَ لجميع الأطراف — أصدر حكمك النهائي
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['innocent', 'guilty'] as VerdictValue[]).map((value) => (
              <button
                key={value}
                onClick={() => setSelectedV(value)}
                className={cn(
                  'p-5 rounded-xl border-2 text-center transition-all duration-150 active:scale-95',
                  selectedV === value
                    ? value === 'innocent' ? 'border-blue-400 bg-blue-900/30' : 'border-blood bg-blood/20'
                    : 'border-ink-700 hover:border-ink-500'
                )}
              >
                <div className="text-3xl mb-1.5">{value === 'innocent' ? '🕊️' : '⛓️'}</div>
                <p className={cn(
                  'font-display text-lg',
                  selectedV === value ? (value === 'innocent' ? 'text-blue-300' : 'text-blood-300') : 'text-parch-300'
                )}>
                  {value === 'innocent' ? 'بريء' : 'مذنب'}
                </p>
              </button>
            ))}
          </div>
          <Button
            variant={selectedV === 'innocent' ? 'ghost' : selectedV === 'guilty' ? 'danger' : 'primary'}
            size="lg"
            loading={submitting}
            disabled={!selectedV}
            onClick={handleVerdictSubmit}
            className="w-full"
          >
            {selectedV ? `تأكيد: ${selectedV === 'innocent' ? 'بريء' : 'مذنب'}` : 'اختر الحكم أولاً'}
          </Button>
        </div>
      </Modal>

      <ToastContainer />
    </AppShell>
  )
}
