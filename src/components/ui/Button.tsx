import { type ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Show a spinner and disable the button while an async operation is in progress. */
  loading?: boolean
}

const base: React.CSSProperties = {
  fontFamily: 'inherit',
  cursor: 'pointer',
  borderRadius: 'var(--radius-lg)',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
  whiteSpace: 'nowrap',
}

const sizes: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '0.35rem 0.75rem', fontSize: '0.8rem' },
  md: { padding: '0.55rem 1.15rem', fontSize: '0.88rem' },
  lg: { padding: '0.7rem 1.5rem', fontSize: '0.95rem' },
}

const variants: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--primary)',
    color: 'var(--color-on-primary)',
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'transparent',
    color: 'var(--danger)',
    border: '1px solid var(--danger-dim)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid transparent',
  },
}

const spinnerStyle: React.CSSProperties = {
  width: '1em',
  height: '1em',
  border: '2px solid currentColor',
  borderTopColor: 'transparent',
  borderRadius: '50%',
  animation: 'cs-button-spin 0.6s linear infinite',
  flexShrink: 0,
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        ...base,
        ...sizes[size],
        ...variants[variant],
        ...(isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        ...style,
      }}
    >
      {loading && <span style={spinnerStyle} aria-hidden="true" />}
      {children}
    </button>
  )
}
