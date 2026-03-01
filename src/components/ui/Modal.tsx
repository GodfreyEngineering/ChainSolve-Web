import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: number
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9000,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'cs-fade-in 0.15s ease',
}

const panelStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: '1.5rem',
  boxShadow: 'var(--shadow-lg)',
  maxHeight: '85vh',
  overflowY: 'auto',
  animation: 'cs-slide-up 0.2s ease',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.25rem',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.05rem',
  fontWeight: 700,
}

const closeBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '1.1rem',
  padding: '0.2rem 0.5rem',
  borderRadius: 'var(--radius-md)',
  lineHeight: 1,
  fontFamily: 'inherit',
}

export function Modal({ open, onClose, title, children, width = 440 }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div ref={panelRef} style={{ ...panelStyle, width, maxWidth: '92vw' }}>
        {title && (
          <div style={headerStyle}>
            <h2 id={titleId} style={titleStyle}>
              {title}
            </h2>
            <button style={closeBtn} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
