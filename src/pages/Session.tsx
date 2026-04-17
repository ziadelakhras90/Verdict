import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '@/hooks/useRoom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRoomStore } from '@/stores/roomStore'
import { useRoomGuard } from '@/hooks/useRoomGuard'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useToast } from '@/hooks/useToast'
import { submitEvent } from '@/actions'
import { AppShell } from '@/components/layout'
import { Button, Badge, StatusDot } from '@/components/ui'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { EventFeed } from '@/components/game/EventFeed'
import { SessionTimer } from '@/components/game/SessionTimer'
import { CaseInfoPanel } from '@/components/game/CaseInfoPanel'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS, SESSION_LABELS } from '@/lib/types'
import type { Role, PublicCaseInfo } from '@/lib/types'
import { cn, normalizeErrorMessage } from '@/lib/utils'

type EvType = 'statement' | 'question' | 'objection'

const EV_OPTIONS: { type: EvType; label: string; icon: string }[] = [
  { type: 'statement', label: 'إفادة',   icon: '🗣️' },
  { type: 'question',  label: 'سؤال',   icon: '❓' },
  { type: 'objection', label: 'اعتراض', icon: '✋' },
]

export default function Session() {
  const { id: roomId } = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const currentUserId  = useCurrentUser()
  const toast          = useToast()
  useRoom(roomId)
  useRoomGuard(roomId, 'in_session', 'session')

  const room        = useRoomStore(s => s.room)
  const players     = useRoomStore(s => s.players)
  const events      = useRoomStore(s => s.events)
  const isConnected = useRoomStore(s => s.isConnected)
  const { isExpired, isUrgent } = useSessionTimer()

  const [text, setText]           = useState('')
  const [evType, setEvType]       = useState<EvType>('statement')
  const [sending, setSending]     = useState(false)
  const [caseInfo, setCaseInfo]   = useState<PublicCaseInfo | null>(null)
  const [showCase, setShowCase]   = useState(false)
  const [warnedUrgent, setWarnedUrgent] = useState(false)
  const lastSessionRef = useRef<number | null>(null)

  const me      = players.find(p => p.player_id === currentUserId)
  const isJudge = me?.role === 'judge'
  const charLeft = 300 - text.length

  // Judge gets redirected to their special panel
  useEffect(() => {
    if (isJudge && roomId) navigate(`/room/${roomId}/judge`, { replace: true })
  }, [isJudge, roomId])

  // Fetch case info once
  useEffect(() => {
    if (!room?.case_id || caseInfo) return
    supabase.from('public_case_info').select('*').eq('id', room.case_id).single()
      .then(({ data }) => { if (data) setCaseInfo(data as PublicCaseInfo) })
  }, [room?.case_id])

  // Reset composer when the session changes to avoid sending text to the wrong round
  useEffect(() => {
    if (!room) return

    if (lastSessionRef.current == null) {
      lastSessionRef.current = room.current_session
      return
    }

    if (lastSessionRef.current !== room.current_session) {
      setText('')
      setEvType('statement')
      setShowCase(false)
      setWarnedUrgent(false)
      lastSessionRef.current = room.current_session
    }
  }, [room?.current_session])

  // Warn once when urgent
  useEffect(() => {
    if (isUrgent && !warnedUrgent) {
      toast.warn('تبقّى 30 ثانية على انتهاء الجلسة')
      setWarnedUrgent(true)
    }
    if (!isUrgent) setWarnedUrgent(false)
  }, [isUrgent])

  async function handleSend() {
    if (!roomId || !text.trim() || !room || sending || isExpired) return
    setSending(true)
    try {
      await submitEvent(roomId, room.current_session, text.trim(), evType)
      setText('')
    } catch (err) {
      toast.error(normalizeErrorMessage(err, 'فشل الإرسال'))
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (!room) return null

  return (
    <AppShell>
      <div className="h-screen flex flex-col max-w-2xl mx-auto">

        {/* Top bar */}
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 border-b transition-colors duration-500',
          isUrgent ? 'border-blood/30 bg-blood/5' : 'border-gold/10'
        )}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {me?.role && <Badge label={ROLE_LABELS[me.role as Role]} color="gold" />}
              <StatusDot connected={isConnected} />
            </div>
            <p className="text-xs text-ink-500 mt-0.5 truncate">
              {SESSION_LABELS[room.current_session] ?? `الجلسة ${room.current_session}`}
            </p>
          </div>
          <SessionTimer />
          <button
            onClick={() => setShowCase(v => !v)}
            className="text-xs text-ink-500 hover:text-gold border border-ink-700 hover:border-gold/40 px-2.5 py-1.5 rounded-lg transition-all"
            title="عرض تفاصيل القضية"
          >
            📋
          </button>
        </div>

        {/* Collapsible case info */}
        {showCase && caseInfo && (
          <div className="border-b border-gold/10 px-4 py-3 bg-ink-900/60 animate-fade-up">
            <CaseInfoPanel caseInfo={caseInfo} compact />
          </div>
        )}

        {/* Event feed */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <EventFeed events={events} currentSession={room.current_session} />
        </div>

        {isExpired && (
          <div className="px-4 py-2 bg-ink-800/80 border-t border-ink-700/40 text-center">
            <p className="text-xs text-ink-500 animate-pulse">
              انتهى وقت الجلسة — انتظر تثبيت الانتقال للجلسة التالية
            </p>
          </div>
        )}

        {/* Input area */}
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
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-body',
                  'border rounded-lg transition-all duration-150',
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
              rows={2}
              className={cn(
                'w-full bg-ink-800 border text-parch-100 px-3 py-2.5 rounded-xl',
                'font-body text-sm placeholder:text-ink-600 focus:outline-none resize-none',
                isExpired
                  ? 'border-ink-800 opacity-40 cursor-not-allowed'
                  : 'border-gold/20 focus:border-gold/50 transition-colors'
              )}
              dir="rtl"
            />
            {text.length > 0 && (
              <span className={cn(
                'absolute bottom-2 left-3 text-xs pointer-events-none',
                charLeft < 30 ? 'text-blood-400' : 'text-ink-600'
              )}>
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
      </div>
      <ToastContainer />
    </AppShell>
  )
}
