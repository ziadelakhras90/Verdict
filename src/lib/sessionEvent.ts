export class SessionExpiredError extends Error {
  constructor(message = 'انتهى وقت الجلسة') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

export function isSessionExpiredResult(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const maybe = value as Record<string, unknown>
  return maybe.code === 'session_expired' || maybe.code === 'session_closed'
}
