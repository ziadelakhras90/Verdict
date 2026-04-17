import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useToast } from '@/hooks/useToast'
import { submitEvent } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Badge, StatusDot, Card } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { EventFeed } from '@/components/game/EventFeed'
import { SessionTimer } from '@/components/game/SessionTimer'
import { CaseInfoPanel } from '@/components/game/CaseInfoPanel'
import { RoleCardDisplay } from '@/components/game/RoleCardDisplay'
import { ROLE_LABELS, SESSION_LABELS } from '@/lib/types'
import type { Role } from '@/lib/types'
import { cn } from '@/lib/utils'

type EvType = 'statement' | 'question' | 'objection'

const EV_OPTIONS: { type: EvType; label: string; icon: string }[] = [
  { type: 'statement', label: 'إفادة', icon: '🗣️' },
  { type: 'question', label: 'سؤال', icon: '❓' },
  { type: 'objection', label: 'اعتراض', icon: '✋' },
]

export default function Session() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUserId = useCurrentUser()
  const toast = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, 'in_session')

  const room = useRoomStore(s => s.room)
  const players = useRoomStore(s => s.players)
  const events = useRoomStore(s => s.events)
  const caseInfo = useRoomStore(s => s.caseInfo)
  const myCard = useRoomStore(s => s.myCard)
  const isConnected = useRoomStore(s => s.isConnected)
  const { isExpired, isUrgent } = useSessionTimer()

  const [text, setText] = useState('')
  const [evType, setEvType] = useState<EvType>('statement')
  const [sending, setSending] = useState(false)
  const [showCase, setShowCase] = useState(false)
  const [warnedUrgent, setWarnedUrgent] = useState(false)

  const me = players.find(p => p.player_id === currentUserId)
  const isJudge = me?.role === 'judge'
  const charLeft = 300 - text.length

  useEffect(() => {
    if (isJudge && roomId) navigate(`/room/${roomId}/judge`, { replace: true })
  }, [isJudge, roomId, navigate])

  useEffect(() => {
    if (isUrgent && !warnedUrgent) {
      toast.warn('تبقّى 30 ثانية على انتهاء الجلسة')
      setWarnedUrgent(true)
    }
    if (!isUrgent) setWarnedUrgent(false)
  }, [isUrgent, warnedUrgent, toast])

  async function handleSend() {
    if (!roomId || !text.trim() || !room) return
    setSending(true)
    try {
      await submitEvent(roomId, room.current_session, text.trim(), evType)
      setText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل الإرسال')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  if (!room) return null

  return (
    <AppShell>
      <div className="min-h-screen max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
        <aside className="space-y-4">
          <Card className={cn('transition-colors', isUrgent && 'border-blood/30 bg-blood/5')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {me?.role && <Badge label={ROLE_LABELS[me.role as Role]} color="gold" />}
                  <StatusDot connected={isConnected} />
                </div>
                <p className="font-display text-xl text-gold">
                  {SESSION_LABELS[room.current_session] ?? `الجلسة ${room.current_session}`}
                </p>
              </div>
              <SessionTimer />
            </div>
          </Card>

          {myCard ? (
            <RoleCardDisplay card={myCard} compact />
          ) : (
            <Card className="text-center text-sm text-ink-400">جارٍ تحميل بطاقة الدور...</Card>
          )}

          {caseInfo && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="label-sm">ملف القضية</p>
                <button
                  onClick={() => setShowCase(v => !v)}
                  className="text-xs text-ink-500 hover:text-gold border border-ink-700 hover:border-gold/40 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  {showCase ? 'إخفاء' : 'إظهار'}
                </button>
              </div>
              {showCase && <CaseInfoPanel caseInfo={caseInfo} />}
            </div>
          )}

          {isExpired && (
            <Card className="text-center border-ink-700 bg-ink-900/70">
              <p className="text-xs text-ink-500 animate-pulse">
                انتهى وقت الجلسة — القاضي سيبدأ المرحلة التالية
              </p>
            </Card>
          )}
        </aside>

        <section className="min-h-[70vh] flex flex-col rounded-3xl border border-gold/10 bg-ink-900/70 overflow-hidden">
          <div className="border-b border-gold/10 px-4 py-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-parch-200">سجل الجلسة</p>
              <p className="text-xs text-ink-500">كل الرسائل الجديدة ستظهر هنا تلقائيًا</p>
            </div>
            <div className="text-xs text-ink-500">{events.filter(e => e.session_num === room.current_session).length} حدث</div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <EventFeed events={events} currentSession={room.current_session} />
          </div>

          <div className={cn(
            'border-t p-4 space-y-3 transition-colors duration-300',
            isExpired ? 'border-ink-800 bg-ink-900/60' : 'border-gold/10 bg-ink-900/80'
          )}>
            <div className="flex gap-2">
              {EV_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => setEvType(opt.type)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-body border rounded-lg transition-all duration-150',
                    evType === opt.type
                      ? 'border-gold/50 bg-gold/10 text-gold'
                      : 'border-ink-700/50 text-ink-500 hover:border-ink-600'
                  )}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="relative">
              <textarea
                value={text}
                onChange={e => setText(e.target.value.slice(0, 300))}
                onKeyDown={onKeyDown}
                placeholder={isExpired ? 'الجلسة انتهت' : 'اكتب هنا... (Enter للإرسال، Shift+Enter لسطر جديد)'}
                disabled={isExpired}
                rows={3}
                className={cn(
                  'w-full bg-ink-800 border text-parch-100 px-3 py-2.5 rounded-xl font-body text-sm placeholder:text-ink-600 focus:outline-none resize-none',
                  isExpired
                    ? 'border-ink-800 opacity-40 cursor-not-allowed'
                    : 'border-gold/20 focus:border-gold/50 transition-colors'
                )}
                dir="rtl"
              />
              {text.length > 0 && (
                <span className={cn('absolute bottom-2 left-3 text-xs pointer-events-none', charLeft < 30 ? 'text-blood-400' : 'text-ink-600')}>
                  {charLeft}
                </span>
              )}
            </div>

            <Button
              variant="primary"
              onClick={handleSend}
              loading={sending}
              disabled={!text.trim() || isExpired}
              className="w-full"
            >
              إرسال {evType === 'objection' ? '✋' : evType === 'question' ? '❓' : '🗣️'}
            </Button>
          </div>
        </section>
      </div>
      <ToastContainer />
    </AppShell>
  )
}
