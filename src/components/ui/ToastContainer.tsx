import { useToastStore } from '@/hooks/useToast'
import type { ToastItem } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

const STYLES = {
  info:    'bg-ink-700 border-gold/30 text-parch-200',
  success: 'bg-green-900/60 border-green-600/40 text-green-200',
  error:   'bg-blood/25 border-blood/50 text-blood-200',
  warn:    'bg-yellow-900/40 border-yellow-600/40 text-yellow-200',
}

const ICONS = { info: 'ℹ️', success: '✓', error: '✗', warn: '⚠️' }

export function ToastContainer() {
  const { toasts, remove } = useToastStore()
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((t: ToastItem) => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className={cn(
            'w-full px-4 py-3 rounded-xl border text-sm font-body',
            'animate-fade-up shadow-2xl pointer-events-auto cursor-pointer',
            'flex items-center gap-2',
            STYLES[t.type]
          )}
        >
          <span className="flex-shrink-0">{ICONS[t.type]}</span>
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
