/**
 * SecuritySettings — E2-4: Account Security (2FA / MFA).
 *
 * Allows users to:
 *   - Enrol a TOTP authenticator app (QR code + manual secret)
 *   - Verify the 6-digit code to complete enrolment
 *   - Disable 2FA by unenrolling the factor
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  enrollTotp,
  verifyTotp,
  unenrollTotp,
  listMfaFactors,
  type MfaFactor,
  type TotpEnrollment,
} from '../../lib/auth'

export function SecuritySettings() {
  const { t } = useTranslation()

  const [factors, setFactors] = useState<MfaFactor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Enrolment state
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [verifying, setVerifying] = useState(false)

  // Disable state
  const [disabling, setDisabling] = useState(false)

  const fetchFactors = useCallback(async () => {
    const { factors: f, error: err } = await listMfaFactors()
    if (err) setError(err.message)
    else setFactors(f.filter((fac) => fac.status === 'verified'))
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    listMfaFactors().then(({ factors: f, error: err }) => {
      if (cancelled) return
      if (err) setError(err.message)
      else setFactors(f.filter((fac) => fac.status === 'verified'))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleEnroll = async () => {
    setError(null)
    setEnrolling(true)
    const { enrollment: e, error: err } = await enrollTotp()
    if (err || !e) {
      setError(err?.message ?? t('security.enrollError'))
    } else {
      setEnrollment(e)
    }
    setEnrolling(false)
  }

  const handleVerify = async () => {
    if (!enrollment) return
    setError(null)
    setVerifying(true)
    const { error: err } = await verifyTotp(enrollment.id, verifyCode.trim())
    if (err) {
      setError(err.message)
    } else {
      setEnrollment(null)
      setVerifyCode('')
      await fetchFactors()
    }
    setVerifying(false)
  }

  const handleCancelEnroll = () => {
    setEnrollment(null)
    setVerifyCode('')
    setError(null)
  }

  const handleDisable = async (factorId: string) => {
    setError(null)
    setDisabling(true)
    const { error: err } = await unenrollTotp(factorId)
    if (err) {
      setError(err.message)
    } else {
      await fetchFactors()
    }
    setDisabling(false)
  }

  const hasVerifiedFactor = factors.length > 0

  if (loading) {
    return <div style={{ opacity: 0.5, padding: '2rem' }}>{t('ui.loading')}</div>
  }

  return (
    <div>
      <h2 style={headingStyle}>{t('security.title')}</h2>

      {error && <div style={errorBox}>{error}</div>}

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={fieldLabel}>{t('security.totpTitle')}</div>
            <div style={fieldHint}>{t('security.totpDesc')}</div>
          </div>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: 20,
              fontSize: '0.8rem',
              fontWeight: 600,
              background: hasVerifiedFactor ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
              color: hasVerifiedFactor ? '#22c55e' : '#6b7280',
            }}
          >
            {hasVerifiedFactor ? t('security.enabled') : t('security.disabled')}
          </span>
        </div>

        {/* ── Factor list (when enabled) ──────────────────────────────────── */}
        {hasVerifiedFactor && (
          <div style={{ marginTop: '1rem' }}>
            {factors.map((f) => (
              <div key={f.id} style={factorRow}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    {f.friendly_name ?? t('security.authenticatorApp')}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                    {t('security.addedOn', {
                      date: new Date(f.created_at).toLocaleDateString(),
                    })}
                  </div>
                </div>
                <button
                  style={{ ...btnDanger, ...(disabling ? btnDisabledStyle : {}) }}
                  disabled={disabling}
                  onClick={() => handleDisable(f.id)}
                >
                  {disabling ? t('security.disabling') : t('security.disable')}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Enrol button (when disabled) ────────────────────────────────── */}
        {!hasVerifiedFactor && !enrollment && (
          <button
            style={{ ...btnPrimary, marginTop: '1rem', ...(enrolling ? btnDisabledStyle : {}) }}
            disabled={enrolling}
            onClick={handleEnroll}
          >
            {enrolling ? t('security.settingUp') : t('security.setup')}
          </button>
        )}

        {/* ── Enrolment flow (QR + verify) ────────────────────────────────── */}
        {enrollment && (
          <div style={enrollSection}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>{t('security.scanQr')}</p>

            <div style={{ textAlign: 'center', margin: '0.75rem 0' }}>
              <img
                src={enrollment.qrCode}
                alt="TOTP QR Code"
                style={{ width: 200, height: 200, borderRadius: 8 }}
              />
            </div>

            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.85rem', opacity: 0.7 }}>
                {t('security.manualEntry')}
              </summary>
              <code
                style={{
                  display: 'block',
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: 'rgba(0,0,0,0.1)',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  wordBreak: 'break-all',
                  userSelect: 'all',
                }}
              >
                {enrollment.secret}
              </code>
            </details>

            <label style={fieldLabel}>{t('security.enterCode')}</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              style={inputStyle}
            />

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button
                style={{
                  ...btnPrimary,
                  flex: 1,
                  ...(verifying || verifyCode.length !== 6 ? btnDisabledStyle : {}),
                }}
                disabled={verifying || verifyCode.length !== 6}
                onClick={handleVerify}
              >
                {verifying ? t('security.verifying') : t('security.verify')}
              </button>
              <button style={{ ...btnSecondary, flex: 1 }} onClick={handleCancelEnroll}>
                {t('security.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  margin: '0 0 1.25rem',
  fontSize: '1.15rem',
  fontWeight: 700,
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.5rem',
  background: 'var(--card-bg)',
}

const fieldLabel: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.9rem',
}

const fieldHint: React.CSSProperties = {
  fontSize: '0.8rem',
  opacity: 0.6,
  marginTop: '0.15rem',
}

const errorBox: React.CSSProperties = {
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: '#f87171',
  borderRadius: 8,
  padding: '0.65rem 0.85rem',
  marginBottom: '1rem',
  fontSize: '0.9rem',
}

const factorRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem 0',
  borderTop: '1px solid var(--border)',
}

const enrollSection: React.CSSProperties = {
  marginTop: '1.25rem',
  paddingTop: '1.25rem',
  borderTop: '1px solid var(--border)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--input-bg)',
  color: 'inherit',
  fontSize: '1.1rem',
  boxSizing: 'border-box',
  marginTop: '0.35rem',
  outline: 'none',
  fontFamily: 'monospace',
  letterSpacing: '0.3em',
  textAlign: 'center',
}

const btnPrimary: React.CSSProperties = {
  padding: '0.6rem 1.25rem',
  borderRadius: 8,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnSecondary: React.CSSProperties = {
  padding: '0.6rem 1.25rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'inherit',
  fontWeight: 500,
  fontSize: '0.9rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnDanger: React.CSSProperties = {
  padding: '0.4rem 0.85rem',
  borderRadius: 8,
  border: '1px solid rgba(239,68,68,0.3)',
  background: 'rgba(239,68,68,0.1)',
  color: '#f87171',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnDisabledStyle: React.CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }
