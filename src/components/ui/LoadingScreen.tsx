/**
 * LoadingScreen — Premium full-page loading state (J4-1).
 *
 * Deterministic, lightweight, no external scripts.
 * Shows a pulsing logo and optional status text.
 * Used during initial engine load and full-page transitions.
 */

import { BRAND } from '../../lib/brand'

interface LoadingScreenProps {
  message?: string
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1.5rem',
  background: 'var(--bg)',
}

const logoStyle: React.CSSProperties = {
  height: 28,
  opacity: 0.5,
  animation: 'cs-logo-pulse 2s ease-in-out infinite',
}

const messageStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  color: 'var(--text-muted)',
  opacity: 0.5,
  letterSpacing: '0.02em',
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div style={containerStyle} role="status" aria-label={message ?? 'Loading'}>
      <img src={BRAND.logoWideText} alt="" style={logoStyle} />
      {message && <span style={messageStyle}>{message}</span>}
    </div>
  )
}
