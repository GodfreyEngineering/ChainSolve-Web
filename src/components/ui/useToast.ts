import { createContext, useContext } from 'react'

export type ToastVariant = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}
