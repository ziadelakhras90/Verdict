import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Button, Card } from '@/components/ui'
import { createRoom } from '@/actions'
import { cn, normalizeErrorMessage } from '@/lib/utils'

export default function CreateRoom() {
  const navigate = useNavigate()
  const [maxPlayers, setMaxPlayers]   = useState(6)
  const [duration, setDuration]       = useState(180)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const DURATION_OPTIONS = [
    { value: 60,  label: '1 دقيقة',   desc: 'سريع جداً' },
    { value: 120, label: '2 دقيقة',   desc: 'سريع' },
    { value: 180, label: '3 دقائق',   desc: 'عادي' },
    { value: 300, label: '5 دقائق',   desc: 'مطوّل' },
  ]

  async function handleCreate() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const room = await createRoom({ maxPlayers, sessionDurationSeconds: duration })
      navigate(`/room/${room.id}/lobby`)
    } catch (err) {
      setError(normalizeErrorMessage(err, 'فشل إنشاء الغرفة'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">

          <div className="text-center">
            <h1 className="font-display text-3xl text-gold mb-1">إنشاء غرفة</h1>
            <p className="text-ink-400 text-sm">اضبط إعدادات جلستك</p>
          </div>

          <Card className="space-y-6">

            {/* Max Players */}
            <div className="space-y-3">
              <p className="label-sm">عدد اللاعبين الأقصى</p>
              <div className="flex gap-2">
                {[4,5,6,7,8].map(n => (
                  <button
                    key={n}
                    onClick={() => setMaxPlayers(n)}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-sm font-body border transition-all duration-150',
                      maxPlayers === n
                        ? 'bg-gold text-ink-900 border-gold font-semibold'
                        : 'border-gold/20 text-ink-300 hover:border-gold/40'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {maxPlayers < 5 && (
                <p className="text-xs text-ink-500">⚠️ مع 4 لاعبين لن يكون هناك نائب أو شاهد</p>
              )}
            </div>

            {/* Session Duration */}
            <div className="space-y-3">
              <p className="label-sm">مدة كل جلسة</p>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className={cn(
                      'p-3 rounded-xl border text-right transition-all duration-150',
                      duration === opt.value
                        ? 'border-gold/60 bg-gold/10'
                        : 'border-gold/20 hover:border-gold/40'
                    )}
                  >
                    <p className={cn('text-sm font-semibold', duration === opt.value ? 'text-gold' : 'text-parch-200')}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-ink-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-ink-800/60 rounded-xl p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-400">اللاعبون</span>
                <span className="text-parch-200">حتى {maxPlayers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">كل جلسة</span>
                <span className="text-parch-200">{DURATION_OPTIONS.find(d => d.value === duration)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-400">إجمالي اللعبة</span>
                <span className="text-parch-200">~{Math.ceil((duration * 3) / 60)} دقيقة</span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-blood-300 bg-blood/10 border border-blood/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button variant="primary" size="lg" loading={loading} onClick={handleCreate} className="w-full">
              إنشاء الغرفة
            </Button>
          </Card>

          <button onClick={() => navigate('/')} className="w-full text-xs text-ink-600 hover:text-ink-400 transition-colors">
            ← العودة
          </button>
        </div>
      </div>
    </AppShell>
  )
}
