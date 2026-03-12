import { useRef, useEffect, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  height?: 'half' | 'full' | number
  children: ReactNode
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 'var(--z-modal, 9000)' as unknown as number,
  background: 'var(--overlay)',
  animation: 'cs-fade-in 0.2s ease',
}

const sheetBase: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 'var(--z-modal, 9000)' as unknown as number,
  background: 'var(--surface-1)',
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
  display: 'flex',
  flexDirection: 'column',
  animation: 'cs-slide-in-up var(--transition-drawer) both',
  overflow: 'hidden',
}

const dragHandleStyle: CSSProperties = {
  width: 36,
  height: 4,
  borderRadius: 2,
  background: 'rgba(128,128,128,0.4)',
  margin: '10px auto 6px',
  flexShrink: 0,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px 8px',
  flexShrink: 0,
}

const titleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '0.88rem',
}

const closeStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '1.1rem',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
}

const contentStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  WebkitOverflowScrolling: 'touch',
  padding: '0 16px 16px',
}

function getHeight(height: BottomSheetProps['height']): string {
  if (height === 'full') return 'calc(100vh - 40px)'
  if (height === 'half') return '50vh'
  if (typeof height === 'number') return `${height}px`
  return '50vh'
}

export function BottomSheet({ open, onClose, title, height = 'half', children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useSwipeGesture(sheetRef, {
    direction: 'down',
    threshold: 60,
    onSwipe: onClose,
    enabled: open,
  })

  // A11Y-01: Trap focus (Tab cycles within sheet) and return focus on close.
  useFocusTrap(sheetRef, open)

  // Escape closes the sheet
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <>
      <div style={overlayStyle} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Panel'}
        style={{ ...sheetBase, height: getHeight(height) }}
      >
        <div style={dragHandleStyle} />
        {title && (
          <div style={headerStyle}>
            <span style={titleStyle}>{title}</span>
            <button style={closeStyle} onClick={onClose} aria-label="Close">
              {'\u2715'}
            </button>
          </div>
        )}
        <div style={contentStyle}>{children}</div>
      </div>
    </>,
    document.body,
  )
}
