import { getEdgeMutationState } from '@/lib/utils'

export type EdgeMutationKind =
  | 'start-game'
  | 'begin-session'
  | 'advance-session'
  | 'submit-verdict'
  | 'reveal-truth'

export type EdgeMutationFeedback = {
  variant: 'success' | 'info'
  message: string
  isDuplicate: boolean
  isStale: boolean
}

const DUPLICATE_MESSAGES: Record<EdgeMutationKind, string> = {
  'start-game': 'تم تجهيز اللعبة بالفعل',
  'begin-session': 'تم بدء الجلسة بالفعل',
  'advance-session': 'تمت معالجة انتهاء الجلسة بالفعل',
  'submit-verdict': 'تم حفظ الحكم بالفعل',
  'reveal-truth': 'تم كشف الحقيقة بالفعل',
}

const SUCCESS_MESSAGES: Record<EdgeMutationKind, string> = {
  'start-game': 'تم تجهيز اللعبة',
  'begin-session': 'تم بدء الجلسة',
  'advance-session': 'تم الانتقال للمرحلة التالية',
  'submit-verdict': 'تم إصدار الحكم',
  'reveal-truth': 'تم كشف الحقيقة!',
}

export function getEdgeMutationFeedback(
  kind: EdgeMutationKind,
  result: unknown,
  overrides?: Partial<Pick<EdgeMutationFeedback, 'message' | 'variant'>>,
): EdgeMutationFeedback {
  const state = getEdgeMutationState(result)

  return {
    variant: overrides?.variant ?? (state.isDuplicate ? 'info' : 'success'),
    message: overrides?.message ?? (state.isDuplicate ? DUPLICATE_MESSAGES[kind] : SUCCESS_MESSAGES[kind]),
    isDuplicate: state.isDuplicate,
    isStale: state.isStale,
  }
}
