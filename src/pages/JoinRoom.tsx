import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Button, Input, Card } from '@/components/ui'
import { joinRoom } from '@/actions'

export default function JoinRoom() {
  const navigate = useNavigate()
  const { code: urlCode } = useParams<{ code?: string }>()

  const [code, setCode]     = useState(urlCode?.toUpperCase() ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (urlCode) setCode(urlCode.toUpperCase())
  }, [urlCode])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const room = await joinRoom(code)
      navigate(`/room/${room.id}/lobby`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الانضمام')
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">

          <div className="text-center">
            <div className="text-5xl mb-3">🚪</div>
            <h1 className="font-display text-3xl text-gold mb-1">الانضمام لغرفة</h1>
            <p className="text-ink-400 text-sm">أدخل الكود المكوّن من 6 أحرف</p>
          </div>

          <Card>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <p className="label-sm text-center">كود الغرفة</p>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full bg-ink-900 border border-gold/40 text-gold text-center
                             text-4xl font-mono font-bold tracking-[0.5em] py-4 rounded-xl
                             focus:outline-none focus:border-gold/80 focus:ring-2 focus:ring-gold/20
                             placeholder:text-ink-700 uppercase"
                  dir="ltr"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-blood-300 bg-blood/10 border border-blood/30 rounded-lg px-3 py-2 text-center">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={code.length !== 6}
                className="w-full"
              >
                انضم للغرفة
              </Button>
            </form>
          </Card>

          <button onClick={() => navigate('/')} className="w-full text-xs text-ink-600 hover:text-ink-400 transition-colors">
            ← العودة
          </button>
        </div>
      </div>
    </AppShell>
  )
}
