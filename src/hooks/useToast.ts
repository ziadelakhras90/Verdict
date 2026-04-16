import { create } from 'zustand'

export interface ToastItem {
  id:      string
  message: string
  type:    'info' | 'success' | 'error' | 'warn'
}

interface ToastStore {
  toasts: ToastItem[]
  push:   (msg: string, type?: ToastItem['type']) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3500)
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

export function useToast() {
  const { push } = useToastStore()
  return {
    info:    (msg: string) => push(msg, 'info'),
    success: (msg: string) => push(msg, 'success'),
    error:   (msg: string) => push(msg, 'error'),
    warn:    (msg: string) => push(msg, 'warn'),
  }
}
