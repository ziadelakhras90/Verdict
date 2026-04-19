import React, { useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Spinner, Button } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div className="min-h-screen courtroom-bg flex items-center justify-center">
      <Spinner size={32} />
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return children ? <>{children}</> : <Outlet />
}

function HomeShortcut() {
  const location = useLocation()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isHome = location.pathname === '/'
  const isRoomRoute = location.pathname.startsWith('/room/')
  const shouldShow = !isHome
  const helperText = useMemo(() => {
    if (!isRoomRoute) return ''
    return 'سيتم إغلاق شاشة الغرفة والعودة للرئيسية. يمكنك العودة للغرفة لاحقًا من زر العودة إلى الغرفة الحالية طالما اللعبة لم تنتهِ.'
  }, [isRoomRoute])

  if (!shouldShow) return null

  const handleHomeClick = () => {
    if (isRoomRoute) {
      setConfirmOpen(true)
      return
    }
    navigate('/')
  }

  return (
    <>
      <button
        type="button"
        onClick={handleHomeClick}
        title="العودة إلى الصفحة الرئيسية"
        className="fixed top-4 left-4 z-40 w-11 h-11 rounded-full border border-gold/25 bg-ink-900/80 backdrop-blur text-parch-100 shadow-soft hover:border-gold/50 hover:text-gold transition-all"
      >
        <span className="text-lg">🏠</span>
      </button>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="العودة إلى الصفحة الرئيسية" size="sm">
        <div className="space-y-5">
          <p className="text-sm text-parch-200 leading-7">{helperText}</p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmOpen(false)}>
              البقاء في الغرفة
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                setConfirmOpen(false)
                navigate('/')
              }}
            >
              نعم، ارجع للرئيسية
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen courtroom-bg font-body text-parch-100">
      <HomeShortcut />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
