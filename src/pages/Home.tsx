import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Button } from '@/components/ui'
import { getPreferredNameValue, useAuth } from '@/hooks/useAuth'

export default function Home() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

        {/* Background decorative columns */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[15,85].map(x => (
            <div key={x} className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gold/10 to-transparent"
              style={{ left: `${x}%` }} />
          ))}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-md space-y-10 text-center">

          {/* Logo */}
          <div className="space-y-3">
            <div className="text-7xl animate-flicker">⚖️</div>
            <h1 className="font-display text-5xl shimmer-text leading-tight">
              قاعة المحكمة
            </h1>
            <p className="text-ink-400 font-body text-sm tracking-wide">
              لعبة أدوار اجتماعية — هل ستصل إلى الحقيقة؟
            </p>
          </div>

          {/* Ornament */}
          <div className="flex items-center justify-center gap-3 text-gold/30">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/30" />
            <span className="text-xs">◆ ◆ ◆</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/30" />
          </div>

          {/* CTA */}
          {!user ? (
            <div className="space-y-3">
              <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/auth')}>
                ادخل باسمك
              </Button>
              <p className="text-xs text-ink-500">
                بدون حسابات — اكتب اسمك وابدأ فورًا
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-400">
                مرحباً، <span className="text-gold font-semibold">{profile?.username ?? getPreferredNameValue() ?? 'لاعب'}</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="primary" onClick={() => navigate('/create')} className="w-full">
                  إنشاء غرفة
                </Button>
                <Button variant="ghost" onClick={() => navigate('/join')} className="w-full">
                  الانضمام
                </Button>
              </div>
              <button onClick={signOut} className="text-xs text-ink-600 hover:text-ink-400 transition-colors">
                تسجيل الخروج
              </button>
            </div>
          )}

          {/* How to play */}
          <div className="gold-border rounded-2xl p-5 text-right space-y-3 bg-ink-900/40">
            <p className="label-sm text-center">كيف تلعب</p>
            {[
              ['⚖️', 'يُختار دور سري لكل لاعب'],
              ['🗣️', 'ثلاث جلسات للنقاش والتحقيق'],
              ['🔨', 'القاضي يصدر حكمه'],
              ['✨', 'تُكشف الحقيقة — من فاز؟'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 text-sm text-parch-300">
                <span>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
