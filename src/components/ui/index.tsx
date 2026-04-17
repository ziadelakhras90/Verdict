import React from 'react'
import { cn, getInitials, avatarColor } from '@/lib/utils'

// ─── Button ───────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'judge'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'primary', size = 'md', loading, children, className, disabled, ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-body font-semibold rounded-lg transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100'
  const variants = {
    primary: 'bg-gold text-ink-900 hover:bg-gold-300',
    ghost:   'border border-gold/30 text-parch-200 hover:border-gold/60 hover:bg-gold/5',
    danger:  'bg-blood text-parch-100 hover:bg-blood-500',
    judge:   'bg-judge text-parch-100 hover:bg-judge-600 border border-judge-500/50',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-7 py-3.5 text-lg',
  }
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
      {loading ? <Spinner size={size === 'sm' ? 14 : 18} /> : null}
      {children}
    </button>
  )
}

// ─── Badge ────────────────────────────────────────
interface BadgeProps { label: string; color?: 'gold' | 'green' | 'red' | 'purple' | 'gray' }

export function Badge({ label, color = 'gray' }: BadgeProps) {
  const colors = {
    gold:   'bg-gold/20 text-gold border-gold/30',
    green:  'bg-green-900/40 text-green-400 border-green-700/30',
    red:    'bg-blood/30 text-blood-300 border-blood/30',
    purple: 'bg-judge/30 text-purple-300 border-purple-700/30',
    gray:   'bg-ink-700/50 text-ink-300 border-ink-600/30',
  }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-body border', colors[color])}>
      {label}
    </span>
  )
}

// ─── Avatar ───────────────────────────────────────
interface AvatarProps { username: string; size?: number }

export function Avatar({ username, size = 36 }: AvatarProps) {
  const bg = avatarColor(username)
  return (
    <div
      className="rounded-full flex items-center justify-center font-body font-bold text-parch-100 flex-shrink-0 border border-white/10"
      style={{ width: size, height: size, fontSize: size * 0.35, background: bg }}
    >
      {getInitials(username)}
    </div>
  )
}

// ─── Input ────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="label-sm">{label}</label>}
      <input
        className={cn(
          'w-full bg-ink-800 border text-parch-100 px-4 py-3 rounded-lg font-body',
          'placeholder:text-ink-500 focus:outline-none transition-all duration-150',
          error ? 'border-blood/70 focus:border-blood' : 'border-gold/30 focus:border-gold/70 focus:ring-1 focus:ring-gold/20',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-blood-300">{error}</p>}
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ─── Card ─────────────────────────────────────────
interface CardProps { children: React.ReactNode; className?: string }

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('card-glass rounded-2xl p-5', className)}>
      {children}
    </div>
  )
}

// ─── Divider ──────────────────────────────────────
export function GoldDivider({ label }: { label?: string }) {
  return (
    <div className="ornament-separator text-xs tracking-widest uppercase text-gold/40">
      {label ?? '◆'}
    </div>
  )
}

// ─── Toast ────────────────────────────────────────
export function Toast({ message, type = 'info' }: { message: string; type?: 'info' | 'error' | 'success' }) {
  const colors = {
    info:    'bg-ink-700 border-gold/30 text-parch-200',
    error:   'bg-blood/20 border-blood/40 text-blood-300',
    success: 'bg-green-900/40 border-green-600/40 text-green-300',
  }
  return (
    <div className={cn('px-4 py-3 rounded-xl border text-sm font-body animate-fade-up', colors[type])}>
      {message}
    </div>
  )
}

// ─── StatusDot ────────────────────────────────────
export function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-400">
      <span className={cn('w-1.5 h-1.5 rounded-full', connected ? 'bg-green-400' : 'bg-red-400 animate-pulse')} />
      {connected ? 'متصل' : 'جارٍ الاتصال...'}
    </span>
  )
}
