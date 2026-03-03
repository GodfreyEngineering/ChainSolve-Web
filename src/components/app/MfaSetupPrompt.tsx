/**
 * MfaSetupPrompt.tsx — J1-4: Optional 2FA setup during onboarding.
 *
 * Shown once after signup when the user has no MFA factors enrolled.
 * The user can set up TOTP or skip.
 */

import { useState, useCallback, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { enrollTotp, verifyTotp, type TotpEnrollment } from '../../lib/auth'

interface Props {
  open: boolean
  onComplete: () => void
  onSkip: () => void
}

type Phase = 'prompt' | 'enroll' | 'verify' | 'done'

export function MfaSetupPrompt({ open, onComplete, onSkip }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('prompt')
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSetup = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { enrollment: enroll, error: enrollErr } = await enrollTotp()
      if (enrollErr || !enroll) {
        setError(enrollErr?.message ?? t('security.enrollError'))
        return
      }
      setEnrollment(enroll)
      setPhase('enroll')
    } catch {
      setError(t('security.enrollError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const handleVerify = useCallback(async () => {
    if (!enrollment || code.length !== 6) return
    setLoading(true)
    setError(null)
    try {
      const { error: verifyErr } = await verifyTotp(enrollment.id, code)
      if (verifyErr) {
        setError(verifyErr.message)
        setCode('')
        inputRef.current?.focus()
        return
      }
      setPhase('done')
    } catch {
      setError(t('mfa.verifyError'))
      setCode('')
    } finally {
      setLoading(false)
    }
  }, [enrollment, code, t])

  return (
    <Modal open={open} onClose={() => {}} title={t('mfa.setupTitle')} width={480}>
      {error && <p style={errorStyle}>{error}</p>}

      {/* ── Prompt: ask whether to set up 2FA ── */}
      {phase === 'prompt' && (
        <div>
          <p style={descStyle}>{t('mfa.setupDesc')}</p>
          <div style={btnRowStyle}>
            <button onClick={onSkip} style={secondaryBtnStyle}>
              {t('mfa.skipForNow')}
            </button>
            <button onClick={() => void handleSetup()} style={primaryBtnStyle} disabled={loading}>
              {loading ? t('security.settingUp') : t('security.setup')}
            </button>
          </div>
        </div>
      )}

      {/* ── Enroll: show QR code ── */}
      {phase === 'enroll' && enrollment && (
        <div>
          <p style={descStyle}>{t('security.scanQr')}</p>
          <div style={qrContainerStyle}>
            <img src={enrollment.qrCode} alt="TOTP QR code" style={qrStyle} />
          </div>
          <details style={detailsStyle}>
            <summary style={summaryStyle}>{t('security.manualEntry')}</summary>
            <code style={secretStyle}>{enrollment.secret}</code>
          </details>

          <label style={labelStyle}>{t('security.enterCode')}</label>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.length === 6) void handleVerify()
            }}
            placeholder="000000"
            autoComplete="one-time-code"
            style={codeInputStyle}
            disabled={loading}
          />

          <div style={btnRowStyle}>
            <button onClick={onSkip} style={secondaryBtnStyle} disabled={loading}>
              {t('security.cancel')}
            </button>
            <button
              onClick={() => void handleVerify()}
              style={{ ...primaryBtnStyle, ...(loading || code.length !== 6 ? disabledStyle : {}) }}
              disabled={loading || code.length !== 6}
            >
              {loading ? t('security.verifying') : t('security.verify')}
            </button>
          </div>
        </div>
      )}

      {/* ── Done: success confirmation ── */}
      {phase === 'done' && (
        <div>
          <p style={descStyle}>{t('mfa.setupSuccess')}</p>
          <div style={btnRowStyle}>
            <button onClick={onComplete} style={primaryBtnStyle}>
              {t('mfa.continue')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const descStyle: CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '0.9rem',
  color: '#555',
  lineHeight: 1.5,
}

const errorStyle: CSSProperties = {
  padding: '0.5rem 0.75rem',
  margin: '0 0 1rem',
  fontSize: '0.85rem',
  color: '#b91c1c',
  background: '#fef2f2',
  border: '1px solid #fca5a5',
  borderRadius: 6,
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '0.35rem',
  marginTop: '1rem',
}

const codeInputStyle: CSSProperties = {
  width: '100%',
  padding: '0.6rem',
  fontSize: '1.3rem',
  fontFamily: 'monospace',
  textAlign: 'center',
  letterSpacing: '0.4em',
  border: '1px solid #ccc',
  borderRadius: 6,
  boxSizing: 'border-box',
}

const btnRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '1.5rem',
}

const primaryBtnStyle: CSSProperties = {
  padding: '0.5rem 1.25rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  background: 'var(--color-primary, #2563eb)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
}

const secondaryBtnStyle: CSSProperties = {
  padding: '0.5rem 1.25rem',
  fontSize: '0.9rem',
  fontWeight: 500,
  background: 'transparent',
  color: '#555',
  border: '1px solid #ccc',
  borderRadius: 6,
  cursor: 'pointer',
}

const disabledStyle: CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

const qrContainerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  margin: '1rem 0',
}

const qrStyle: CSSProperties = {
  width: 200,
  height: 200,
  borderRadius: 8,
  border: '1px solid #e5e7eb',
}

const detailsStyle: CSSProperties = {
  marginBottom: '0.5rem',
}

const summaryStyle: CSSProperties = {
  fontSize: '0.82rem',
  cursor: 'pointer',
  color: 'var(--color-primary, #2563eb)',
}

const secretStyle: CSSProperties = {
  display: 'block',
  marginTop: '0.5rem',
  padding: '0.5rem',
  background: '#f3f4f6',
  borderRadius: 4,
  fontSize: '0.8rem',
  wordBreak: 'break-all',
  userSelect: 'all',
}
