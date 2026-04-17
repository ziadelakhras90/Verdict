import React, { useEffect } from 'react'
import type { MouseEvent } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open:      boolean
  onClose:   () => void
  title?:    string
  children:  React.ReactNode
  size?:     'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-900/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full bg-ink-800 border border-gold/20 rounded-2xl p-6 shadow-2xl',
          'animate-fade-up',
          widths[size]
        )}
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl text-gold">{title}</h2>
            <button onClick={onClose} className="text-ink-500 hover:text-parch-200 transition-colors text-xl leading-none">×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
