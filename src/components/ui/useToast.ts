import { createContext, useContext } from 'react'

export type ToastVariant = 'info' | 'success' | 'error'

export interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

export const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}
