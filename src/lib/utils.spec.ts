import { describe, expect, it } from 'vitest'
import {
  formatTimer,
  getEdgeMutationState,
  getInitials,
  normalizeErrorMessage,
  timeAgo,
} from '@/lib/utils'

describe('utility helpers', () => {
  it('formats timers as mm:ss', () => {
    expect(formatTimer(0)).toBe('00:00')
    expect(formatTimer(65)).toBe('01:05')
    expect(formatTimer(600)).toBe('10:00')
  })

  it('returns initials from the first two characters', () => {
    expect(getInitials('ziad')).toBe('ZI')
    expect(getInitials('محمود')).toBe('مح')
  })

  it('normalizes errors from different shapes', () => {
    expect(normalizeErrorMessage('  custom error  ')).toBe('custom error')
    expect(normalizeErrorMessage(new Error('boom'))).toBe('boom')
    expect(normalizeErrorMessage({ message: 'bad request' })).toBe('bad request')
    expect(normalizeErrorMessage({ error: 'network down' })).toBe('network down')
    expect(normalizeErrorMessage({})).toBe('حدث خطأ غير متوقع')
    expect(normalizeErrorMessage(null, 'fallback')).toBe('fallback')
  })

  it('detects duplicate/idempotent mutation responses', () => {
    expect(getEdgeMutationState({})).toEqual({ isDuplicate: false, isStale: false })
    expect(getEdgeMutationState({ idempotent: true })).toEqual({ isDuplicate: true, isStale: false })
    expect(getEdgeMutationState({ stale_request: true })).toEqual({ isDuplicate: true, isStale: true })
    expect(getEdgeMutationState({ idempotent: true, stale_request: true })).toEqual({
      isDuplicate: true,
      isStale: true,
    })
  })

  it('renders timeAgo in Arabic for minutes and hours', () => {
    const now = Date.now()
    expect(timeAgo(new Date(now - 30 * 1000).toISOString())).toBe('الآن')
    expect(timeAgo(new Date(now - 5 * 60 * 1000).toISOString())).toBe('منذ 5 دقيقة')
    expect(timeAgo(new Date(now - 2 * 60 * 60 * 1000).toISOString())).toBe('منذ 2 ساعة')
  })
})
