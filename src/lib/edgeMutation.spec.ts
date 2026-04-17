import { describe, expect, it } from 'vitest'
import { getEdgeMutationFeedback } from '@/lib/edgeMutation'

describe('edgeMutation helpers', () => {
  it('returns success feedback for fresh start-game responses', () => {
    expect(getEdgeMutationFeedback('start-game', { ok: true })).toEqual({
      variant: 'success',
      message: 'تم تجهيز اللعبة',
      isDuplicate: false,
      isStale: false,
    })
  })

  it('returns info feedback for duplicate begin-session responses', () => {
    expect(getEdgeMutationFeedback('begin-session', { idempotent: true })).toEqual({
      variant: 'info',
      message: 'تم بدء الجلسة بالفعل',
      isDuplicate: true,
      isStale: false,
    })
  })

  it('marks stale responses as duplicate and stale', () => {
    expect(getEdgeMutationFeedback('submit-verdict', { stale_request: true })).toEqual({
      variant: 'info',
      message: 'تم حفظ الحكم بالفعل',
      isDuplicate: true,
      isStale: true,
    })
  })

  it('supports per-call message overrides', () => {
    expect(getEdgeMutationFeedback('advance-session', { ok: true }, { message: 'انتقلنا للجلسة التالية' })).toEqual({
      variant: 'success',
      message: 'انتقلنا للجلسة التالية',
      isDuplicate: false,
      isStale: false,
    })
  })
})
