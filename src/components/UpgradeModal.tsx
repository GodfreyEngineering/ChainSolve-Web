/**
 * UpgradeModal — shown when a free/past_due user tries an action
 * that requires a higher plan (e.g. creating a second project).
 */

import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from './ui/Modal'
import { supabase } from '../lib/supabase'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  /** Why the modal was triggered — drives the message shown. */
  reason: 'project_limit' | 'feature_locked'
}

const features = [
  'Unlimited projects',
  'CSV file uploads',
  'Array operations',
  'Plot visualizations',
]

const featureStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.88rem',
  padding: '0.3rem 0',
}

const btnUpgrade: React.CSSProperties = {
  width: '100%',
  padding: '0.7rem 0',
  border: 'none',
  borderRadius: 8,
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 700,
  fontSize: '0.95rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginTop: '1rem',
}

const btnDisabledStyle: React.CSSProperties = { opacity: 0.55, cursor: 'not-allowed' }

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = reason === 'project_limit' ? 'Project limit reached' : 'Pro feature'

  const message =
    reason === 'project_limit'
      ? 'Free accounts can have 1 project. Upgrade to Pro for unlimited projects.'
      : 'This feature requires a Pro subscription.'

  const handleUpgrade = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr || !data.session) {
        await supabase.auth.signOut()
        navigate('/login')
        return
      }
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })
      let json: Record<string, unknown>
      try {
        json = (await res.json()) as Record<string, unknown>
      } catch {
        throw new Error(`Server returned a non-JSON response (HTTP ${res.status})`)
      }
      if (!res.ok)
        throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
      if (typeof json.url !== 'string') throw new Error('No redirect URL returned')
      window.location.assign(json.url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upgrade request failed')
      setLoading(false)
    }
  }, [navigate])

  return (
    <Modal open={open} onClose={onClose} title={title} width={400}>
      <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', opacity: 0.7 }}>{message}</p>

      <div style={{ margin: '0.5rem 0 0.5rem' }}>
        {features.map((f) => (
          <div key={f} style={featureStyle}>
            <span style={{ color: 'var(--primary)' }}>&#10003;</span>
            <span>{f}</span>
          </div>
        ))}
      </div>

      {error && (
        <p
          style={{
            margin: '0.75rem 0 0',
            fontSize: '0.82rem',
            color: '#f87171',
            background: 'rgba(239,68,68,0.1)',
            padding: '0.5rem 0.75rem',
            borderRadius: 6,
          }}
        >
          {error}
        </p>
      )}

      <button
        style={{ ...btnUpgrade, ...(loading ? btnDisabledStyle : {}) }}
        disabled={loading}
        onClick={() => void handleUpgrade()}
      >
        {loading ? 'Redirecting…' : 'Upgrade — £10/mo'}
      </button>
    </Modal>
  )
}
