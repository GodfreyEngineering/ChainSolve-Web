/**
 * Login — E2-1: Auth UI for login, signup, and password reset.
 *
 * Supports three modes routed as first-class paths:
 *   /login          — sign in with email + password
 *   /signup         — create account with confirm password, T&C, marketing opt-in
 *   /reset-password — request password reset email
 */

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react'
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  signInWithPassword,
  signUp,
  resetPasswordForEmail,
  resendConfirmation,
  getSession,
  listMfaFactors,
  signOut,
} from '../lib/auth'
import { MfaChallengeScreen } from '../components/app/MfaChallengeScreen'
import { BRAND } from '../lib/brand'
import { CURRENT_TERMS_VERSION } from '../lib/termsVersion'
import { LegalFooter } from '../components/ui/LegalFooter'
import { usePageMeta, useHreflang } from '../lib/seo'
import TurnstileWidget from '../components/ui/TurnstileWidget'
import { isTurnstileEnabled } from '../lib/turnstile'
import { enforceAndRegisterSession, isSingleSessionRequired } from '../lib/sessionService'
import { getRememberMe, setRememberMe } from '../lib/rememberMe'

export type AuthMode = 'login' | 'signup' | 'reset'

/** SEC-04: Escape HTML special characters before interpolating user-controlled
 *  values into dangerouslySetInnerHTML translation strings. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface LoginProps {
  initialMode?: AuthMode
}

const SEO_KEY: Record<AuthMode, string> = {
  login: 'seo.login',
  signup: 'seo.signup',
  reset: 'seo.resetPassword',
}

export default function Login({ initialMode = 'login' }: LoginProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('session_expired') === 'true'
  const { t } = useTranslation()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [rememberMe, setRememberMeState] = useState(getRememberMe)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Email-confirmation pending state (signUp returned session=null)
  const [confirmPending, setConfirmPending] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

  const [resetSent, setResetSent] = useState(false)

  // J1-4: MFA challenge state (shown when user has TOTP enrolled)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)

  // Per-page SEO (I6-2, L2-2)
  const seoKey = SEO_KEY[mode]
  usePageMeta(t(`${seoKey}.title`), t(`${seoKey}.description`))
  useHreflang(location.pathname)

  // Turnstile CAPTCHA token (E2-2)
  const captchaEnabled = isTurnstileEnabled()
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState(false)

  const handleCaptchaToken = useCallback((token: string) => {
    setCaptchaToken(token)
    setCaptchaError(false)
  }, [])

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null)
    setCaptchaError(true)
  }, [])

  const handleCaptchaExpired = useCallback(() => {
    setCaptchaToken(null)
  }, [])

  const emailRef = useRef<HTMLInputElement>(null)

  // Auto-focus email on mode change
  useEffect(() => {
    emailRef.current?.focus()
  }, [mode])

  // Sync mode with initialMode prop when route changes
  useEffect(() => {
    setMode(initialMode)
    setError(null)
    setResetSent(false)
    setConfirmPending(false)
  }, [initialMode])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // Validate CAPTCHA if enabled (E2-2)
    if (captchaEnabled && !captchaToken) {
      setError(t('auth.captchaRequired'))
      return
    }

    setLoading(true)
    const token = captchaToken ?? undefined
    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError(t('auth.passwordsMismatch'))
          setLoading(false)
          return
        }
        if (!acceptTerms) {
          setError(t('auth.termsRequired'))
          setLoading(false)
          return
        }
        const { session, error: signUpErr } = await signUp(email, password, token, {
          acceptedTermsVersion: CURRENT_TERMS_VERSION,
          marketingOptIn,
        })
        if (signUpErr) throw signUpErr
        if (!session) {
          // Email confirmation required — show confirm prompt.
          setConfirmPending(true)
          return
        }
        // Email confirmation disabled (local dev) — session exists, go straight in.
        if (session?.user) {
          const singleRequired = await isSingleSessionRequired(session.user.id)
          await enforceAndRegisterSession(session.user.id, singleRequired)
        }
        navigate('/app')
      } else if (mode === 'reset') {
        const { error: resetErr } = await resetPasswordForEmail(email, token)
        if (resetErr) throw resetErr
        setResetSent(true)
      } else {
        const { error: signInErr } = await signInWithPassword(email, password, token)
        if (signInErr) throw signInErr
        setRememberMe(rememberMe)
        // J1-4: Check for enrolled MFA factors before completing login.
        const { factors } = await listMfaFactors()
        const verified = factors.filter((f) => f.status === 'verified')
        if (verified.length > 0) {
          // User has MFA — show challenge screen instead of navigating.
          setMfaFactorId(verified[0].id)
          return
        }
        // No MFA — proceed directly.
        // L3-1: Check org policy before deciding whether to revoke other sessions.
        const session = await getSession()
        if (session?.user) {
          const singleRequired = await isSingleSessionRequired(session.user.id)
          await enforceAndRegisterSession(session.user.id, singleRequired)
        }
        navigate('/app')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.authFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendMsg(null)
    setError(null)
    const { error: resendErr } = await resendConfirmation(email)
    if (resendErr) {
      setError(resendErr.message)
    } else {
      setResendMsg(t('auth.verifyEmailResent'))
    }
    setResendLoading(false)
  }

  // J1-4: MFA challenge verified → enforce session + navigate
  const handleMfaVerified = useCallback(async () => {
    const session = await getSession()
    if (session?.user) {
      const singleRequired = await isSingleSessionRequired(session.user.id)
      await enforceAndRegisterSession(session.user.id, singleRequired)
    }
    navigate('/app')
  }, [navigate])

  // J1-4: MFA challenge cancelled → sign out + reset state
  const handleMfaCancel = useCallback(async () => {
    setMfaFactorId(null)
    await signOut()
  }, [])

  // ── J1-4: MFA challenge view ──────────────────────────────────────────────

  if (mfaFactorId) {
    return (
      <main>
        <MfaChallengeScreen
          factorId={mfaFactorId}
          onVerified={() => void handleMfaVerified()}
          onCancel={() => void handleMfaCancel()}
        />
      </main>
    )
  }

  // ── Email-confirmation pending view ──────────────────────────────────────────

  if (confirmPending) {
    return (
      <main style={s.page}>
        <div style={s.card}>
          <h1 style={s.heading}>{t('auth.checkInbox')}</h1>
          <p style={s.sub}>{t('auth.checkInboxSub')}</p>

          <div style={s.infoBox}>
            <span
              dangerouslySetInnerHTML={{
                __html: t('auth.checkInboxBody', { email: escapeHtml(email) }),
              }}
            />
          </div>

          {error && <div style={s.errorBox}>{error}</div>}
          {resendMsg && <div style={s.successBox}>{resendMsg}</div>}

          <button
            style={{ ...s.btnSecondary, marginTop: 0, ...(resendLoading ? s.btnDisabled : {}) }}
            disabled={resendLoading}
            onClick={handleResend}
          >
            {resendLoading ? t('auth.verifyEmailSending') : t('auth.verifyEmailResend')}
          </button>

          <Link
            to="/login"
            style={{
              ...s.btnSecondary,
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            {t('auth.backToSignIn')}
          </Link>
        </div>
      </main>
    )
  }

  // ── Reset sent confirmation view ────────────────────────────────────────────

  if (resetSent) {
    return (
      <main style={s.page}>
        <div style={s.card}>
          <h1 style={s.heading}>{t('auth.checkEmail')}</h1>
          <p style={s.sub}>{t('auth.resetLinkSent')}</p>

          <div style={s.infoBox}>
            <span
              dangerouslySetInnerHTML={{
                __html: t('auth.resetLinkBody', { email: escapeHtml(email) }),
              }}
            />
          </div>

          <Link
            to="/login"
            style={{ ...s.btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            {t('auth.backToSignIn')}
          </Link>
        </div>
      </main>
    )
  }

  // ── Main auth form ──────────────────────────────────────────────────────────

  return (
    <main style={s.pageWrap}>
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.logoWrap}>
            <img src={BRAND.logoWideText} alt="ChainSolve" style={s.logo} />
          </div>
          <p style={s.sub}>
            {mode === 'login' && t('auth.signInTitle')}
            {mode === 'signup' && t('auth.signUpTitle')}
            {mode === 'reset' && t('auth.resetTitle')}
          </p>

          {/* BUG-07: Session expired banner */}
          {sessionExpired && (
            <div
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: 6,
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#93c5fd',
                fontSize: '0.78rem',
                marginBottom: '0.75rem',
                lineHeight: 1.5,
              }}
            >
              {t('auth.sessionExpired', 'Your session expired — please sign in again.')}
            </div>
          )}

          {error && <div style={s.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <label style={s.label} htmlFor="email">
              {t('auth.email')}
            </label>
            <input
              ref={emailRef}
              id="email"
              style={s.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
              required
            />

            {mode !== 'reset' && (
              <>
                <label style={s.label} htmlFor="password">
                  {t('auth.password')}
                </label>
                <input
                  id="password"
                  style={s.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? t('auth.passwordPlaceholderSignup') : '••••••••'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'signup' ? 8 : 1}
                />
              </>
            )}

            {mode === 'signup' && (
              <>
                <label style={s.label} htmlFor="confirmPassword">
                  {t('auth.confirmPassword')}
                </label>
                <input
                  id="confirmPassword"
                  style={s.input}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />

                <label style={s.checkLabel}>
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    style={s.checkbox}
                  />
                  {t('auth.termsAcceptShort')}{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" style={s.link}>
                    {t('auth.termsTitle')}
                  </a>
                </label>

                <label style={s.checkLabel}>
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    style={s.checkbox}
                  />
                  {t('auth.marketingOptIn')}
                </label>
              </>
            )}

            {mode === 'login' && (
              <div style={s.forgotRow}>
                <label style={s.rememberLabel}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMeState(e.target.checked)}
                    style={s.checkbox}
                  />
                  {t('auth.rememberMe')}
                </label>
                <Link to="/reset-password" style={s.forgotLink}>
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            )}

            {captchaEnabled && (
              <TurnstileWidget
                onToken={handleCaptchaToken}
                onError={handleCaptchaError}
                onExpired={handleCaptchaExpired}
              />
            )}
            {captchaError && <div style={s.errorBox}>{t('auth.captchaFailed')}</div>}

            <button
              type="submit"
              style={{
                ...s.btn,
                ...(loading || (captchaEnabled && !captchaToken) ? s.btnDisabled : {}),
              }}
              disabled={loading || (captchaEnabled && !captchaToken)}
            >
              {loading
                ? t('auth.pleaseWait')
                : mode === 'login'
                  ? t('auth.login')
                  : mode === 'signup'
                    ? t('auth.signup')
                    : t('auth.resetSendLink')}
            </button>
          </form>

          <p style={s.toggle}>
            {mode === 'login' && (
              <>
                {t('auth.noAccount')}{' '}
                <Link to="/signup" style={s.toggleLink}>
                  {t('auth.signUpLink')}
                </Link>
              </>
            )}
            {mode === 'signup' && (
              <>
                {t('auth.hasAccount')}{' '}
                <Link to="/login" style={s.toggleLink}>
                  {t('auth.signInLink')}
                </Link>
              </>
            )}
            {mode === 'reset' && (
              <>
                {t('auth.rememberPassword')}{' '}
                <Link to="/login" style={s.toggleLink}>
                  {t('auth.signInLink')}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
      <LegalFooter />
    </main>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  pageWrap: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  page: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  } as React.CSSProperties,
  card: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '400px',
    animation: 'cs-fade-in 0.4s ease',
  } as React.CSSProperties,
  logoWrap: {
    textAlign: 'center' as const,
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  logo: {
    height: 40,
    marginBottom: '0.5rem',
    display: 'inline-block',
  } as React.CSSProperties,
  heading: { margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 700 } as React.CSSProperties,
  sub: {
    margin: '0 0 2rem',
    opacity: 0.6,
    fontSize: '0.9rem',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  label: {
    display: 'block',
    marginBottom: '0.35rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    opacity: 0.8,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '0.65rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'inherit',
    fontSize: '1rem',
    boxSizing: 'border-box',
    marginBottom: '1.1rem',
    outline: 'none',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  btn: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
    fontFamily: 'inherit',
    letterSpacing: '0.02em',
  } as React.CSSProperties,
  btnSecondary: {
    width: '100%',
    padding: '0.65rem',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'inherit',
    fontWeight: 500,
    fontSize: '0.95rem',
    cursor: 'pointer',
    marginTop: '0.75rem',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' } as React.CSSProperties,
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#f87171',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    marginBottom: '1rem',
    fontSize: '0.88rem',
    lineHeight: 1.45,
  } as React.CSSProperties,
  successBox: {
    background: 'rgba(28,171,176,0.1)',
    border: '1px solid rgba(28,171,176,0.35)',
    color: 'var(--primary)',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    marginBottom: '1rem',
    fontSize: '0.88rem',
    lineHeight: 1.45,
  } as React.CSSProperties,
  infoBox: {
    background: 'rgba(28,171,176,0.08)',
    border: '1px solid rgba(28,171,176,0.25)',
    borderRadius: '10px',
    padding: '1.1rem',
    marginBottom: '1.25rem',
    fontSize: '0.9rem',
    lineHeight: 1.6,
  } as React.CSSProperties,
  toggle: {
    marginTop: '1.5rem',
    textAlign: 'center' as const,
    fontSize: '0.9rem',
    opacity: 0.7,
  } as React.CSSProperties,
  toggleLink: {
    color: 'var(--primary)',
    fontWeight: 600,
    textDecoration: 'underline',
  } as React.CSSProperties,
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    marginBottom: '0.75rem',
    cursor: 'pointer',
  } as React.CSSProperties,
  checkbox: {
    accentColor: 'var(--primary)',
    width: 16,
    height: 16,
    cursor: 'pointer',
    flexShrink: 0,
  } as React.CSSProperties,
  link: {
    color: 'var(--primary)',
    textDecoration: 'underline',
  } as React.CSSProperties,
  forgotRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '-0.5rem',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  forgotLink: {
    color: 'var(--primary)',
    fontSize: '0.82rem',
    textDecoration: 'underline',
    fontWeight: 500,
  } as React.CSSProperties,
  rememberLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.82rem',
    cursor: 'pointer',
    opacity: 0.8,
  } as React.CSSProperties,
}
