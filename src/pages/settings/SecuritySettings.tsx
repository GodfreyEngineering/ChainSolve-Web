/**
 * SecuritySettings — E2-4 + E2-5: Account Security.
 *
 * Allows users to:
 *   - Enrol a TOTP authenticator app (QR code + manual secret)
 *   - Verify the 6-digit code to complete enrolment
 *   - Disable 2FA by unenrolling the factor
 *   - View and revoke active device sessions
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  enrollTotp,
  verifyTotp,
  unenrollTotp,
  listMfaFactors,
  getCurrentUser,
  changePassword,
  requestEmailChange,
  getPasswordStrength,
  type MfaFactor,
  type TotpEnrollment,
} from '../../lib/auth'
import {
  listSessions,
  revokeSession,
  revokeAllOtherSessions,
  getCurrentSessionId,
  type UserSession,
} from '../../lib/sessionService'

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

  // ── Sessions state ─────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [revoking, setRevoking] = useState(false)
  const currentSessionId = getCurrentSessionId()

  useEffect(() => {
    let cancelled = false
    getCurrentUser().then((user) => {
      if (cancelled || !user) {
        setSessionsLoading(false)
        return
      }
      listSessions(user.id).then((s) => {
        if (!cancelled) setSessions(s)
        setSessionsLoading(false)
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleRevoke = async (sessionId: string) => {
    setError(null)
    setRevoking(true)
    const { error: err } = await revokeSession(sessionId)
    if (err) setError(err)
    else setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    setRevoking(false)
  }

  const handleRevokeAll = async () => {
    setError(null)
    setRevoking(true)
    const user = await getCurrentUser()
    if (!user) {
      setRevoking(false)
      return
    }
    const { error: err } = await revokeAllOtherSessions(user.id)
    if (err) setError(err)
    else setSessions((prev) => prev.filter((s) => s.id === currentSessionId))
    setRevoking(false)
  }

  const hasVerifiedFactor = factors.length > 0

  // ── Password change state (ACCT-04) ────────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const pwdStrength = getPasswordStrength(newPwd)

  const handleChangePassword = async () => {
    setPwdError(null)
    setPwdSuccess(false)
    if (newPwd !== confirmPwd) {
      setPwdError(t('security.passwordMismatch', 'Passwords do not match.'))
      return
    }
    setPwdSaving(true)
    const { error: err } = await changePassword(currentPwd, newPwd)
    if (err) {
      setPwdError(err)
    } else {
      setPwdSuccess(true)
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
    }
    setPwdSaving(false)
  }

  // ── Email change state (ACCT-03) ────────────────────────────────────────
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState(false)

  const handleChangeEmail = async () => {
    setEmailError(null)
    setEmailSuccess(false)
    setEmailSaving(true)
    const { error: err } = await requestEmailChange(newEmail.trim())
    if (err) {
      setEmailError(err)
    } else {
      setEmailSuccess(true)
      setNewEmail('')
    }
    setEmailSaving(false)
  }

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

      {/* ── Password change (ACCT-04) ─────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginTop: '1.25rem' }}>
        <div style={fieldLabel}>{t('security.changePassword', 'Change password')}</div>
        <div style={fieldHint}>{t('security.changePasswordDesc', 'Requires your current password for verification.')}</div>

        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div>
            <label style={{ ...fieldHint, display: 'block', marginBottom: '0.25rem' }}>
              {t('security.currentPassword', 'Current password')}
            </label>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              placeholder={t('security.currentPasswordPlaceholder', 'Enter current password')}
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label style={{ ...fieldHint, display: 'block', marginBottom: '0.25rem' }}>
              {t('security.newPassword', 'New password')}
            </label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder={t('security.newPasswordPlaceholder', 'At least 8 chars + 1 number')}
              style={inputStyle}
              autoComplete="new-password"
            />
            {newPwd.length > 0 && (
              <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background: i < pwdStrength.score ? strengthColor(pwdStrength.score) : 'var(--border)',
                    }}
                  />
                ))}
                <span style={{ fontSize: '0.72rem', opacity: 0.6, whiteSpace: 'nowrap' }}>
                  {t(`security.strength_${pwdStrength.label}`, pwdStrength.label.replace('-', ' '))}
                </span>
              </div>
            )}
          </div>
          <div>
            <label style={{ ...fieldHint, display: 'block', marginBottom: '0.25rem' }}>
              {t('security.confirmPassword', 'Confirm new password')}
            </label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder={t('security.confirmPasswordPlaceholder', 'Repeat new password')}
              style={inputStyle}
              autoComplete="new-password"
            />
          </div>

          {pwdError && <div style={errorBox}>{pwdError}</div>}
          {pwdSuccess && (
            <div style={{ color: '#34d399', fontSize: '0.88rem' }}>
              {t('security.passwordChanged', 'Password changed successfully.')}
            </div>
          )}

          <button
            style={{
              ...btnPrimary,
              alignSelf: 'flex-start',
              ...(pwdSaving || !currentPwd || !newPwd || !confirmPwd ? btnDisabledStyle : {}),
            }}
            disabled={pwdSaving || !currentPwd || !newPwd || !confirmPwd}
            onClick={handleChangePassword}
          >
            {pwdSaving ? t('ui.saving', 'Saving…') : t('security.changePasswordBtn', 'Change password')}
          </button>
        </div>
      </div>

      {/* ── Email change (ACCT-03) ────────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginTop: '1.25rem' }}>
        <div style={fieldLabel}>{t('security.changeEmail', 'Change email address')}</div>
        <div style={fieldHint}>
          {t('security.changeEmailDesc', 'A verification link will be sent to the new address. The change takes effect after confirmation.')}
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div>
            <label style={{ ...fieldHint, display: 'block', marginBottom: '0.25rem' }}>
              {t('security.newEmail', 'New email address')}
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@example.com"
              style={inputStyle}
              autoComplete="email"
            />
          </div>

          {emailError && <div style={errorBox}>{emailError}</div>}
          {emailSuccess && (
            <div style={{ color: '#34d399', fontSize: '0.88rem' }}>
              {t('security.emailVerificationSent', 'Verification email sent. Check your inbox and click the link to confirm.')}
            </div>
          )}

          <button
            style={{
              ...btnPrimary,
              alignSelf: 'flex-start',
              ...(emailSaving || !newEmail.trim() ? btnDisabledStyle : {}),
            }}
            disabled={emailSaving || !newEmail.trim()}
            onClick={handleChangeEmail}
          >
            {emailSaving ? t('ui.saving', 'Saving…') : t('security.changeEmailBtn', 'Change email')}
          </button>
        </div>
      </div>

      {/* ── Active sessions (E2-5) ────────────────────────────────────────── */}
      <div style={{ ...cardStyle, marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={fieldLabel}>{t('security.sessionsTitle')}</div>
            <div style={fieldHint}>{t('security.sessionsDesc')}</div>
          </div>
          {sessions.length > 1 && (
            <button
              style={{ ...btnDanger, ...(revoking ? btnDisabledStyle : {}) }}
              disabled={revoking}
              onClick={handleRevokeAll}
            >
              {revoking ? t('security.revoking') : t('security.revokeAll')}
            </button>
          )}
        </div>

        {sessionsLoading ? (
          <div style={{ opacity: 0.5, marginTop: '1rem', fontSize: '0.85rem' }}>
            {t('ui.loading')}
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ opacity: 0.5, marginTop: '1rem', fontSize: '0.85rem' }}>
            {t('security.noSessions')}
          </div>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            {sessions.map((s) => (
              <div key={s.id} style={factorRow}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    {s.device_label}
                    {s.id === currentSessionId && (
                      <span style={currentBadge}>{t('security.currentSession')}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                    {t('security.lastActive', {
                      date: new Date(s.last_active_at).toLocaleString(),
                    })}
                  </div>
                </div>
                {s.id !== currentSessionId && (
                  <button
                    style={{ ...btnDanger, ...(revoking ? btnDisabledStyle : {}) }}
                    disabled={revoking}
                    onClick={() => handleRevoke(s.id)}
                  >
                    {t('security.revoke')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function strengthColor(score: number): string {
  if (score <= 1) return '#f87171'
  if (score === 2) return '#fbbf24'
  if (score === 3) return '#34d399'
  return '#22c55e'
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
  background: 'var(--surface-2)',
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

const currentBadge: React.CSSProperties = {
  marginLeft: '0.5rem',
  padding: '0.1rem 0.5rem',
  borderRadius: 12,
  fontSize: '0.72rem',
  fontWeight: 600,
  background: 'rgba(28,171,176,0.15)',
  color: 'var(--primary)',
}
