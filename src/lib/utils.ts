import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

/** Generate a random avatar color from username */
export function avatarColor(username: string): string {
  const colors = ['#8B1A1A','#1A508B','#8B641A','#5A1A8B','#1A785A','#8B4A1A']
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hrs = Math.floor(mins / 60)
  return `منذ ${hrs} ساعة`
}
