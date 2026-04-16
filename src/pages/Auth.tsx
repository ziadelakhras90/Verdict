import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Button, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'

export default function Auth() {
  const navigate = useNavigate()
  const { user, enterAsGuest, getPreferredName } = useAuth()

  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setUsername(getPreferredName())
  }, [])

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await enterAsGuest(username)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الدخول الآن')
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="text-5xl">⚖️</div>
            <h1 className="font-display text-3xl text-gold">قاعة المحكمة</h1>
            <p className="text-ink-400 text-sm">اكتب اسمك وادخل مباشرة إلى الغرفة</p>
          </div>

          <form onSubmit={handleSubmit} className="card-glass rounded-2xl p-6 space-y-4">
            <Input
              label="اسم اللاعب"
              type="text"
              placeholder="مثال: زياد"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              maxLength={20}
              dir="rtl"
              autoFocus
            />

            <div className="rounded-xl border border-gold/20 bg-ink-900/50 px-4 py-3 text-sm text-ink-300 leading-7">
              <p>• بدون إيميل أو كلمة مرور</p>
              <p>• اسمك سيظهر داخل الغرفة فقط</p>
              <p>• يمكنك إنشاء غرفة أو الانضمام بكود</p>
            </div>

            {error && (
              <div className="text-sm text-blood-300 bg-blood/10 border border-blood/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              ادخل باسمك
            </Button>
          </form>

          <button
            onClick={() => navigate('/')}
            className="w-full text-xs text-ink-600 hover:text-ink-400 transition-colors"
          >
            ← العودة للرئيسية
          </button>
        </div>
      </div>
    </AppShell>
  )
}
