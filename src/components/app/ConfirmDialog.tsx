/**
 * ConfirmDialog — generic confirm dialog with configurable action buttons.
 *
 * Used for the "unsaved changes" prompt when switching projects.
 */

import { Modal } from '../ui/Modal'

export interface ConfirmAction {
  label: string
  variant?: 'primary' | 'danger' | 'muted'
  onClick: () => void
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  title: string
  message: string
  actions: ConfirmAction[]
}

const btnBase: React.CSSProperties = {
  padding: '0.4rem 0.9rem',
  borderRadius: 6,
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  lineHeight: 1.4,
}

function btnStyle(variant: ConfirmAction['variant']): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return { ...btnBase, background: 'var(--primary)', color: '#fff', border: 'none' }
    case 'danger':
      return { ...btnBase, background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }
    default:
      return {
        ...btnBase,
        background: 'transparent',
        color: 'var(--text-muted)',
        border: '1px solid var(--border)',
      }
  }
}

export function ConfirmDialog({ open, onClose, title, message, actions }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <p style={{ margin: '0 0 1.25rem', fontSize: '0.88rem', lineHeight: 1.5, opacity: 0.85 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        {actions.map((a) => (
          <button key={a.label} style={btnStyle(a.variant)} onClick={a.onClick}>
            {a.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}
