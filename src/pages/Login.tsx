import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup'

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
  } as React.CSSProperties,
  heading: { margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 700 } as React.CSSProperties,
  sub: { margin: '0 0 2rem', opacity: 0.6, fontSize: '0.9rem' } as React.CSSProperties,
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
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'underline',
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
  } as React.CSSProperties,
}

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Email-confirmation pending state (signUp returned session=null)
  const [confirmPending, setConfirmPending] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

  const emailRef = useRef<HTMLInputElement>(null)

  // Auto-focus email on mode change
  useEffect(() => {
    emailRef.current?.focus()
  }, [mode])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error: signUpErr } = await supabase.auth.signUp({ email, password })
        if (signUpErr) throw signUpErr
        if (!data.session) {
          // Email confirmation required — do NOT navigate, show confirm prompt instead.
          setConfirmPending(true)
          return
        }
        // Email confirmation disabled (local dev) — session exists, go straight in.
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) throw signInErr
      }
      navigate('/app')
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
    const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email })
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
            Account created. We sent a confirmation link to{' '}
            <strong>{email}</strong>. Click the link in that email to activate
            your account, then return here to sign in.
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

          <button
            style={s.btnSecondary}
            onClick={() => {
              setConfirmPending(false)
              setMode('login')
              setError(null)
              setResendMsg(null)
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  // ── Login / signup view ───────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.heading}>ChainSolve</h1>
        <p style={s.sub}>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</p>

        {error && <div style={s.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={s.label} htmlFor="email">Email</label>
          <input
            ref={emailRef}
            id="email"
            style={s.input}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label style={s.label} htmlFor="password">Password</label>
          <input
            id="password"
            style={s.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={mode === 'signup' ? 8 : 1}
          />

          <button
            type="submit"
            style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }}
            disabled={loading}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={s.toggle}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            style={s.toggleLink}
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}