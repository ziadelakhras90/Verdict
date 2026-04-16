import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useToast } from '@/hooks/useToast'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { advanceSession, submitVerdict } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Card, Badge } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { CountdownRing } from '@/components/game/CountdownRing'
import { EventFeed } from '@/components/game/EventFeed'
import { CaseInfoPanel } from '@/components/game/CaseInfoPanel'
import { Modal } from '@/components/ui/Modal'
import { SESSION_LABELS, ROLE_LABELS } from '@/lib/types'
import type { VerdictValue, Role } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function JudgePanel() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, ['in_session', 'verdict'])

  const room     = useRoomStore(s => s.room)
  const players  = useRoomStore(s => s.players)
  const events   = useRoomStore(s => s.events)
  const caseInfo = useRoomStore(s => s.caseInfo)
  const { isExpired } = useSessionTimer()

  const [advancing, setAdvancing]       = useState(false)
  const [showVerdict, setShowVerdict]   = useState(false)
  const [selectedV, setSelectedV]       = useState<VerdictValue | null>(null)
  const [submitting, setSubmitting]     = useState(false)

  const me      = players.find(p => p.player_id === currentUserId)
  const isJudge = me?.role === 'judge'

  // Redirect non-judges back to session
  useEffect(() => {
    if (me?.role && me.role !== 'judge') {
      navigate(`/room/${roomId}/session`, { replace: true })
    }
  }, [me?.role])

  // Show verdict modal when status becomes verdict
  useEffect(() => {
    if (room?.status === 'verdict' && isJudge) setShowVerdict(true)
  }, [room?.status, isJudge])

  // Auto-advance when timer expires (judge triggers)
  useEffect(() => {
    if (isExpired && isJudge && room?.status === 'in_session') {
      handleAdvance()
    }
  }, [isExpired])

  async function handleAdvance() {
    if (!roomId || advancing) return
    setAdvancing(true)
    try {
      await advanceSession(roomId)
      const next = (room?.current_session ?? 0) + 1
      if (next > 3) toast.info('انتهت الجلسات — أصدر حكمك')
      else toast.success(`انتقلنا للجلسة ${next}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطأ')
    } finally {
      setAdvancing(false)
    }
  }

  async function handleVerdictSubmit() {
    if (!roomId || !selectedV) return
    setSubmitting(true)
    try {
      await submitVerdict(roomId, selectedV)
      setShowVerdict(false)
      toast.success('صدر الحكم')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل إصدار الحكم')
      setSubmitting(false)
    }
  }

  if (!room) return null

  const currentSession  = room.current_session
  const sessionDuration = room.session_duration_seconds
  const isLastSession   = currentSession >= 3
  const canAdvance      = room.status === 'in_session'

  // Speaker activity this session
  const sessionEvents = events.filter(e => e.session_num === currentSession && e.event_type !== 'system')
  const speakerMap = new Map<string, number>()
  sessionEvents.forEach(e => {
    const u = e.profiles?.username ?? '?'
    speakerMap.set(u, (speakerMap.get(u) ?? 0) + 1)
  })

  return (
    <AppShell>
      <div className="h-screen flex flex-col max-w-2xl mx-auto">

        {/* Judge header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-gold/20 bg-judge/10">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">⚖️</span>
              <span className="label-sm">لوحة القاضي</span>
            </div>
            <p className="font-display text-lg text-gold leading-tight">
              {SESSION_LABELS[currentSession] ?? `الجلسة ${currentSession}`}
            </p>
          </div>
          <CountdownRing totalSeconds={sessionDuration} size={80} />
        </div>

        {/* Case strip */}
        {caseInfo && (
          <div className="px-4 py-2.5 border-b border-gold/10 bg-ink-900/40">
            <CaseInfoPanel caseInfo={caseInfo} compact />
          </div>
        )}

        {/* Speaker activity */}
        <div className="px-4 py-2 border-b border-ink-800/40 flex gap-2 flex-wrap">
          {players.map(p => {
            const name  = p.profiles?.username ?? '?'
            const count = speakerMap.get(name) ?? 0
            return (
              <div
                key={p.player_id}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs',
                  p.role === 'judge'
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

        {/* Event feed */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <EventFeed events={events} currentSession={currentSession} />
        </div>

        {/* Judge controls */}
        <div className="border-t border-gold/20 p-4 space-y-3 bg-judge/5">
          <p className="label-sm text-center text-gold/60">أدوات القاضي</p>

          {canAdvance && (
            <Button
              variant="judge"
              size="lg"
              loading={advancing}
              onClick={handleAdvance}
              className="w-full"
            >
              {isLastSession ? '⚖️ إنهاء الجلسات والانتقال للحكم' : `← الجلسة ${currentSession + 1}`}
            </Button>
          )}

          {room.status === 'verdict' && (
            <Button variant="danger" size="lg" onClick={() => setShowVerdict(true)} className="w-full">
              🔨 إصدار الحكم النهائي
            </Button>
          )}
        </div>
      </div>

      {/* Verdict Modal */}
      <Modal open={showVerdict} onClose={() => !submitting && setShowVerdict(false)} title="الحكم النهائي" size="sm">
        <div className="space-y-5">
          <p className="text-sm text-ink-400 text-center">
            استمعتَ لجميع الأطراف — أصدر حكمك النهائي
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['innocent', 'guilty'] as VerdictValue[]).map(v => (
              <button
                key={v}
                onClick={() => setSelectedV(v)}
                className={cn(
                  'p-5 rounded-xl border-2 text-center transition-all duration-150 active:scale-95',
                  selectedV === v
                    ? v === 'innocent' ? 'border-blue-400 bg-blue-900/30' : 'border-blood bg-blood/20'
                    : 'border-ink-700 hover:border-ink-500'
                )}
              >
                <div className="text-3xl mb-1.5">{v === 'innocent' ? '🕊️' : '⛓️'}</div>
                <p className={cn(
                  'font-display text-lg',
                  selectedV === v ? (v === 'innocent' ? 'text-blue-300' : 'text-blood-300') : 'text-parch-300'
                )}>
                  {v === 'innocent' ? 'بريء' : 'مذنب'}
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
