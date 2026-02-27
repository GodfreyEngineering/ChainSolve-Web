import { useCallback, useState, type ReactNode } from 'react'
import { ToastContext, type ToastVariant, type ToastAction } from './useToast'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
  action?: ToastAction
}

let nextId = 1

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  zIndex: 9500,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  pointerEvents: 'none',
}

const variantColors: Record<ToastVariant, string> = {
  info: 'var(--primary)',
  success: 'var(--success)',
  error: 'var(--danger)',
}

function toastStyle(variant: ToastVariant): React.CSSProperties {
  return {
    pointerEvents: 'auto',
    background: 'var(--card-bg)',
    border: `1px solid ${variantColors[variant]}44`,
    borderLeft: `3px solid ${variantColors[variant]}`,
    borderRadius: 8,
    padding: '0.65rem 1rem',
    fontSize: '0.85rem',
    color: 'var(--text)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    animation: 'cs-slide-up 0.2s ease',
    maxWidth: 360,
  }
}

const actionButtonStyle: React.CSSProperties = {
  marginLeft: '0.75rem',
  background: 'none',
  border: 'none',
  padding: 0,
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--primary)',
  cursor: 'pointer',
  textDecoration: 'underline',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info', action?: ToastAction) => {
      const id = nextId++
      setItems((prev) => [...prev, { id, message, variant, action }])
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id))
      }, 3500)
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={containerStyle} aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            style={toastStyle(t.variant)}
          >
            {t.message}
            {t.action && (
              <button style={actionButtonStyle} onClick={t.action.onClick}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
