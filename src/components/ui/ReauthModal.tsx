/**
 * ReauthModal — password re-authentication modal for billing-sensitive ops.
 *
 * Shows a password prompt before proceeding with billing operations.
 * On success it calls `markReauthed()` to start the 10-minute window,
 * then invokes `onSuccess` so the caller can proceed.
 *
 * P055: Customer portal + re-auth window (SEC-4, AU-5).
 */

import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'
import { Button } from './Button'
import { reauthenticate } from '../../lib/auth'
import { markReauthed } from '../../lib/reauth'

interface ReauthModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ReauthModal({ open, onClose, onSuccess }: ReauthModalProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount (component is remounted each time the modal opens)
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError(null)
    const { error: authError } = await reauthenticate(password)
    if (authError) {
      setError(t('reauth.wrongPassword'))
      setLoading(false)
      setPassword('')
      inputRef.current?.focus()
      return
    }
    markReauthed()
    setLoading(false)
    onSuccess()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('reauth.title')} width={400}>
      <p style={descStyle}>{t('reauth.description')}</p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <label style={labelStyle} htmlFor="reauth-password">
          {t('auth.password')}
        </label>
        <input
          id="reauth-password"
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          autoComplete="current-password"
          disabled={loading}
        />
        {error && <div style={errorStyle}>{error}</div>}
        <div style={actionsStyle}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
            {t('project.cancel')}
          </Button>
          <Button variant="primary" type="submit" disabled={!password || loading}>
            {loading ? t('reauth.verifying') : t('reauth.confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const descStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '0.9rem',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '0.4rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'rgba(0,0,0,0.2)',
  color: 'var(--text)',
  fontSize: '0.95rem',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const errorStyle: React.CSSProperties = {
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: '#f87171',
  borderRadius: 6,
  padding: '0.5rem 0.7rem',
  fontSize: '0.85rem',
  marginTop: '0.5rem',
}

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.6rem',
  marginTop: '1.25rem',
}
