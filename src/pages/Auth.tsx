import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Button, Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'

type Mode = 'signin' | 'signup'

export default function Auth() {
  const navigate  = useNavigate()
  const { signIn, signUp } = useAuth()

  const [mode, setMode]         = useState<Mode>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') {
        if (!username.trim()) throw new Error('اسم المستخدم مطلوب')
        await signUp(email, password, username.trim())
      } else {
        await signIn(email, password)
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
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
            <p className="text-ink-400 text-sm">
              {mode === 'signin' ? 'سجّل الدخول للمتابعة' : 'أنشئ حسابًا جديدًا'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card-glass rounded-2xl p-6 space-y-4">
            {mode === 'signup' && (
              <Input
                label="اسم المستخدم"
                type="text"
                placeholder="اختر اسمك في اللعبة"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                maxLength={20}
                dir="rtl"
              />
            )}
            <Input
              label="البريد الإلكتروني"
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              dir="ltr"
            />
            <Input
              label="كلمة المرور"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              dir="ltr"
            />

            {error && (
              <div className="text-sm text-blood-300 bg-blood/10 border border-blood/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              {mode === 'signin' ? 'دخول' : 'إنشاء حساب'}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-ink-400 hover:text-gold transition-colors"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
            >
              {mode === 'signin'
                ? 'ليس لديك حساب؟ سجّل الآن'
                : 'لديك حساب؟ سجّل الدخول'}
            </button>
          </div>

          <button onClick={() => navigate('/')} className="w-full text-xs text-ink-600 hover:text-ink-400 transition-colors">
            ← العودة للرئيسية
          </button>
        </div>
      </div>
    </AppShell>
  )
}
