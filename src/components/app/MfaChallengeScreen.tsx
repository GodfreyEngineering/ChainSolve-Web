/**
 * MfaChallengeScreen.tsx — J1-4: TOTP challenge during login.
 *
 * Shown when the user has MFA enrolled and needs to provide a
 * 6-digit code to complete authentication.
 */

import { useState, useCallback, useRef, useEffect, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { verifyTotp } from '../../lib/auth'

interface Props {
  factorId: string
  onVerified: () => void
  onCancel: () => void
}

export function MfaChallengeScreen({ factorId, onVerified, onCancel }: Props) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) return
    setError(null)
    setLoading(true)
    try {
      const { error: verifyErr } = await verifyTotp(factorId, code)
      if (verifyErr) {
        setError(verifyErr.message)
        setCode('')
        inputRef.current?.focus()
      } else {
        onVerified()
      }
    } catch {
      setError(t('mfa.verifyError'))
      setCode('')
    } finally {
      setLoading(false)
    }
  }, [code, factorId, onVerified, t])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && code.length === 6) {
        void handleVerify()
      }
    },
    [code, handleVerify],
  )

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>{t('mfa.challengeTitle')}</h1>
        <p style={subStyle}>{t('mfa.challengeSub')}</p>

        <div style={infoBoxStyle}>{t('mfa.challengeBody')}</div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <label style={labelStyle}>{t('security.enterCode')}</label>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(v)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder="000000"
          autoComplete="one-time-code"
          style={inputStyle}
          disabled={loading}
        />

        <button
          style={{ ...btnStyle, ...(loading || code.length !== 6 ? btnDisabledStyle : {}) }}
          disabled={loading || code.length !== 6}
          onClick={() => void handleVerify()}
        >
          {loading ? t('security.verifying') : t('security.verify')}
        </button>

        <button style={btnSecondaryStyle} onClick={onCancel} disabled={loading}>
          {t('mfa.backToLogin')}
        </button>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
}

const cardStyle: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: '2.5rem',
  width: '100%',
  maxWidth: '440px',
  animation: 'cs-fade-in 0.4s ease',
}

const headingStyle: CSSProperties = {
  margin: '0 0 0.25rem',
  fontSize: '1.5rem',
  fontWeight: 700,
}

const subStyle: CSSProperties = {
  margin: '0 0 2rem',
  opacity: 0.6,
  fontSize: '0.9rem',
  textAlign: 'center',
}

const infoBoxStyle: CSSProperties = {
  background: 'rgba(28,171,176,0.08)',
  border: '1px solid rgba(28,171,176,0.25)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.1rem',
  marginBottom: '1.25rem',
  fontSize: '0.9rem',
  lineHeight: 1.6,
}

const errorBoxStyle: CSSProperties = {
  background: 'var(--danger-dim)',
  border: '1px solid rgba(239,68,68,0.35)',
  color: 'var(--danger-text)',
  borderRadius: 'var(--radius-lg)',
  padding: '0.65rem 0.85rem',
  marginBottom: '1rem',
  fontSize: 'var(--font-md)',
  lineHeight: 1.45,
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '0.35rem',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  fontSize: '1.5rem',
  fontFamily: 'monospace',
  textAlign: 'center',
  letterSpacing: '0.5em',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  background: 'transparent',
  color: 'inherit',
  boxSizing: 'border-box',
  marginBottom: '1rem',
}

const btnStyle: CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: 'var(--radius-lg)',
  border: 'none',
  background: 'var(--primary)',
  color: 'var(--color-on-primary)',
  fontWeight: 700,
  fontSize: '1rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.02em',
}

const btnDisabledStyle: CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

const btnSecondaryStyle: CSSProperties = {
  width: '100%',
  padding: '0.65rem',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'inherit',
  fontWeight: 500,
  fontSize: 'var(--font-lg)',
  cursor: 'pointer',
  marginTop: '0.75rem',
  fontFamily: 'inherit',
}
