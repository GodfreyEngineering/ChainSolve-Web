import type { CSSProperties, ReactNode } from 'react'

interface ErrorStateProps {
  title?: string
  message: string
  icon?: ReactNode
  action?: { label: string; onClick: () => void }
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  padding: '2rem 1.5rem',
  textAlign: 'center',
  color: 'var(--text-muted)',
}

const iconWrapStyle: CSSProperties = {
  fontSize: '2rem',
  opacity: 0.4,
}

const titleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '0.95rem',
  color: 'var(--text)',
  margin: 0,
}

const messageStyle: CSSProperties = {
  fontSize: '0.78rem',
  lineHeight: 1.5,
  maxWidth: 320,
  margin: 0,
}

const btnStyle: CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.4rem 1rem',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--primary)',
  fontWeight: 600,
  fontSize: '0.78rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.15s, border-color 0.15s',
}

export function ErrorState({ title, message, icon, action }: ErrorStateProps) {
  return (
    <div style={containerStyle}>
      {icon && <div style={iconWrapStyle}>{icon}</div>}
      {title && <h3 style={titleStyle}>{title}</h3>}
      <p style={messageStyle}>{message}</p>
      {action && (
        <button
          style={btnStyle}
          onClick={action.onClick}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)'
            e.currentTarget.style.background = 'var(--primary-dim)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
