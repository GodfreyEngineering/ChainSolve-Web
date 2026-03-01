/**
 * Login — E2-1: Auth UI for login, signup, and password reset.
 *
 * Supports three modes routed as first-class paths:
 *   /login          — sign in with email + password
 *   /signup         — create account with confirm password, T&C, marketing opt-in
 *   /reset-password — request password reset email
 */

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signInWithPassword, signUp, resetPasswordForEmail, resendConfirmation } from '../lib/auth'
import { BRAND } from '../lib/brand'
import TurnstileWidget from '../components/ui/TurnstileWidget'
import { isTurnstileEnabled } from '../lib/turnstile'

export type AuthMode = 'login' | 'signup' | 'reset'

interface LoginProps {
  initialMode?: AuthMode
}

export default function Login({ initialMode = 'login' }: LoginProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Email-confirmation pending state (signUp returned session=null)
  const [confirmPending, setConfirmPending] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

  // Reset success state
  const [resetSent, setResetSent] = useState(false)

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
      setError('Please complete the CAPTCHA challenge.')
      return
    }

    setLoading(true)
    const token = captchaToken ?? undefined
    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.')
          setLoading(false)
          return
        }
        if (!acceptTerms) {
          setError('You must accept the Terms & Conditions to create an account.')
          setLoading(false)
          return
        }
        const { session, error: signUpErr } = await signUp(email, password, token)
        if (signUpErr) throw signUpErr
        if (!session) {
          // Email confirmation required — show confirm prompt.
          setConfirmPending(true)
          return
        }
        // Email confirmation disabled (local dev) — session exists, go straight in.
        navigate('/app')
      } else if (mode === 'reset') {
        const { error: resetErr } = await resetPasswordForEmail(email, token)
        if (resetErr) throw resetErr
        setResetSent(true)
      } else {
        const { error: signInErr } = await signInWithPassword(email, password, token)
        if (signInErr) throw signInErr
        navigate('/app')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.')
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
      setResendMsg('Confirmation email resent — check your inbox and spam folder.')
    }
    setResendLoading(false)
  }

  // ── Email-confirmation pending view ──────────────────────────────────────────

  if (confirmPending) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <h1 style={s.heading}>Check your inbox</h1>
          <p style={s.sub}>Almost there — one more step</p>

          <div style={s.infoBox}>
            Account created. We sent a confirmation link to <strong>{email}</strong>. Click the link
            in that email to activate your account, then return here to sign in.
          </div>

          {error && <div style={s.errorBox}>{error}</div>}
          {resendMsg && <div style={s.successBox}>{resendMsg}</div>}

          <button
            style={{ ...s.btnSecondary, marginTop: 0, ...(resendLoading ? s.btnDisabled : {}) }}
            disabled={resendLoading}
            onClick={handleResend}
          >
            {resendLoading ? 'Sending…' : 'Resend confirmation email'}
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
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  // ── Reset sent confirmation view ────────────────────────────────────────────

  if (resetSent) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <h1 style={s.heading}>Check your email</h1>
          <p style={s.sub}>Password reset link sent</p>

          <div style={s.infoBox}>
            If an account exists for <strong>{email}</strong>, we sent a password reset link. Check
            your inbox and spam folder.
          </div>

          <Link
            to="/login"
            style={{ ...s.btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  // ── Main auth form ──────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoWrap}>
          <img src={BRAND.logoWideText} alt="ChainSolve" style={s.logo} />
        </div>
        <p style={s.sub}>
          {mode === 'login' && 'Sign in to your account'}
          {mode === 'signup' && 'Create your account'}
          {mode === 'reset' && 'Reset your password'}
        </p>

        {error && <div style={s.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={s.label} htmlFor="email">
            Email
          </label>
          <input
            ref={emailRef}
            id="email"
            style={s.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          {mode !== 'reset' && (
            <>
              <label style={s.label} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                style={s.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'signup' ? 8 : 1}
              />
            </>
          )}

          {mode === 'signup' && (
            <>
              <label style={s.label} htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                style={s.input}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
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
                I accept the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={s.link}>
                  Terms &amp; Conditions
                </a>
              </label>

              <label style={s.checkLabel}>
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  style={s.checkbox}
                />
                Send me product updates and tips (optional)
              </label>
            </>
          )}

          {mode === 'login' && (
            <div style={s.forgotRow}>
              <Link to="/reset-password" style={s.forgotLink}>
                Forgot password?
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
          {captchaError && (
            <div style={s.errorBox}>CAPTCHA failed to load. Please refresh and try again.</div>
          )}

          <button
            type="submit"
            style={{
              ...s.btn,
              ...(loading || (captchaEnabled && !captchaToken) ? s.btnDisabled : {}),
            }}
            disabled={loading || (captchaEnabled && !captchaToken)}
          >
            {loading
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Send reset link'}
          </button>
        </form>

        <p style={s.toggle}>
          {mode === 'login' && (
            <>
              Don&apos;t have an account?{' '}
              <Link to="/signup" style={s.toggleLink}>
                Sign up
              </Link>
            </>
          )}
          {mode === 'signup' && (
            <>
              Already have an account?{' '}
              <Link to="/login" style={s.toggleLink}>
                Sign in
              </Link>
            </>
          )}
          {mode === 'reset' && (
            <>
              Remember your password?{' '}
              <Link to="/login" style={s.toggleLink}>
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  } as React.CSSProperties,
  card: {
    background: 'var(--card-bg)',
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
    textAlign: 'right' as const,
    marginTop: '-0.5rem',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  forgotLink: {
    color: 'var(--primary)',
    fontSize: '0.82rem',
    textDecoration: 'underline',
    fontWeight: 500,
  } as React.CSSProperties,
}
