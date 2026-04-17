import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { Button } from '@/components/ui'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <AppShell>
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-5 max-w-sm">
          <div className="text-7xl">🔍</div>
          <h1 className="font-display text-4xl text-gold">الصفحة مفقودة</h1>
          <p className="text-ink-400 text-sm">هذه الصفحة لا وجود لها أو انتهت صلاحيتها</p>
          <Button variant="primary" onClick={() => navigate('/')} className="mx-auto">
            العودة للرئيسية
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
