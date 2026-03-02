/**
 * AuthGate — E2-3: Email verification + ToS acceptance gate.
 *
 * Blocks access to the app until:
 *   1. The user's email is verified (email_confirmed_at is set)
 *   2. The user has accepted the current Terms & Conditions version
 *
 * Renders the appropriate gate screen or passes through to children.
 */

import { useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { CURRENT_TERMS_VERSION } from '../lib/termsVersion'
import { resendConfirmation } from '../lib/auth'

/** Minimal profile shape required by AuthGate (compatible with any Profile superset). */
interface GateProfile {
  accepted_terms_version: string | null
}

export interface AuthGateProps {
  user: User
  profile: GateProfile
  /** Called after the user accepts the ToS (parent should re-fetch profile). */
  onTermsAccepted: (version: string) => Promise<void>
  children: ReactNode
}

export default function AuthGate({ user, profile, onTermsAccepted, children }: AuthGateProps) {
  // ── Email verification check ────────────────────────────────────────────
  if (!user.email_confirmed_at) {
    return <EmailVerificationScreen email={user.email ?? ''} />
  }

  // ── ToS acceptance check ────────────────────────────────────────────────
  if (profile.accepted_terms_version !== CURRENT_TERMS_VERSION) {
    return (
      <TermsAcceptanceScreen currentVersion={CURRENT_TERMS_VERSION} onAccept={onTermsAccepted} />
    )
  }

  return <>{children}</>
}

// ── Email verification screen ────────────────────────────────────────────────

function EmailVerificationScreen({ email }: { email: string }) {
  const [resendLoading, setResendLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleResend = async () => {
    setResendLoading(true)
    setMsg(null)
    setError(null)
    const { error: resendErr } = await resendConfirmation(email)
    if (resendErr) {
      setError(resendErr.message)
    } else {
      setMsg('Confirmation email resent — check your inbox and spam folder.')
    }
    setResendLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.heading}>Verify your email</h1>
        <p style={s.sub}>One more step before you can continue</p>

        <div style={s.infoBox}>
          We sent a verification link to <strong>{email}</strong>. Click the link in that email to
          verify your account, then refresh this page.
        </div>

        {error && <div style={s.errorBox}>{error}</div>}
        {msg && <div style={s.successBox}>{msg}</div>}

        <button
          style={{ ...s.btnSecondary, ...(resendLoading ? s.btnDisabled : {}) }}
          disabled={resendLoading}
          onClick={handleResend}
        >
          {resendLoading ? 'Sending…' : 'Resend verification email'}
        </button>

        <button style={s.btnSecondary} onClick={() => window.location.reload()}>
          I've verified — refresh
        </button>
      </div>
    </div>
  )
}

// ── Terms acceptance screen ──────────────────────────────────────────────────

function TermsAcceptanceScreen({
  currentVersion,
  onAccept,
}: {
  currentVersion: string
  onAccept: (version: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  const handleAccept = async () => {
    setError(null)
    setLoading(true)
    try {
      await onAccept(currentVersion)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to record acceptance. Please retry.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.heading}>Terms & Conditions</h1>
        <p style={s.sub}>Please review and accept to continue</p>

        <div style={s.infoBox}>
          We've updated our Terms &amp; Conditions (v{currentVersion}). Please review them and
          accept to continue using ChainSolve.
        </div>

        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...s.link, display: 'block', marginBottom: '1rem' }}
        >
          Read the full Terms &amp; Conditions
        </a>

        {error && <div style={s.errorBox}>{error}</div>}

        <label style={s.checkLabel}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={s.checkbox}
          />
          I accept the Terms &amp; Conditions (v{currentVersion})
        </label>

        <button
          style={{ ...s.btn, ...(loading || !checked ? s.btnDisabled : {}) }}
          disabled={loading || !checked}
          onClick={handleAccept}
        >
          {loading ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

// ── Styles (consistent with Login.tsx) ───────────────────────────────────────

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
    borderRadius: 'var(--radius-xl)',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '440px',
    animation: 'cs-fade-in 0.4s ease',
  } as React.CSSProperties,
  heading: { margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 700 } as React.CSSProperties,
  sub: {
    margin: '0 0 2rem',
    opacity: 0.6,
    fontSize: '0.9rem',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  infoBox: {
    background: 'rgba(28,171,176,0.08)',
    border: '1px solid rgba(28,171,176,0.25)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.1rem',
    marginBottom: '1.25rem',
    fontSize: '0.9rem',
    lineHeight: 1.6,
  } as React.CSSProperties,
  errorBox: {
    background: 'var(--danger-dim)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: 'var(--danger-text)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.65rem 0.85rem',
    marginBottom: '1rem',
    fontSize: 'var(--font-md)',
    lineHeight: 1.45,
  } as React.CSSProperties,
  successBox: {
    background: 'rgba(28,171,176,0.1)',
    border: '1px solid rgba(28,171,176,0.35)',
    color: 'var(--primary)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.65rem 0.85rem',
    marginBottom: '1rem',
    fontSize: 'var(--font-md)',
    lineHeight: 1.45,
  } as React.CSSProperties,
  btn: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: 'var(--radius-lg)',
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
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'inherit',
    fontWeight: 500,
    fontSize: 'var(--font-lg)',
    cursor: 'pointer',
    marginTop: '0.75rem',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' } as React.CSSProperties,
  link: {
    color: 'var(--primary)',
    textDecoration: 'underline',
    fontSize: '0.9rem',
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
}
