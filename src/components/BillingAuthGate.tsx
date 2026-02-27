import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getCurrentUser, signInWithPassword } from '../lib/auth'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { BillingSettings } from '../pages/settings/BillingSettings'
import type { Profile } from '../lib/profilesService'

interface Props {
  profile: Profile | null
}

const AUTH_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export function BillingAuthGate({ profile }: Props) {
  const { t } = useTranslation()
  const [verified, setVerified] = useState(false)
  const verifiedAt = useRef(0)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isExpired = verified && Date.now() - verifiedAt.current > AUTH_TIMEOUT_MS

  if (verified && !isExpired) {
    return <BillingSettings profile={profile} />
  }

  const handleVerify = async () => {
    setLoading(true)
    setError(null)
    try {
      const user = await getCurrentUser()
      if (!user?.email) throw new Error('No user session')

      // OAuth users cannot verify via password
      const provider = user.app_metadata?.provider as string | undefined
      if (provider && provider !== 'email') {
        setError(t('settings.billingOAuthHint'))
        setLoading(false)
        return
      }

      const { error: signInErr } = await signInWithPassword(user.email, password)
      if (signInErr) throw new Error(t('settings.billingAuthFailed'))

      verifiedAt.current = Date.now()
      setVerified(true)
      setPassword('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={headingStyle}>{t('settings.billing')}</h2>
      <div style={cardStyle}>
        <p style={{ margin: '0 0 1rem', opacity: 0.7, fontSize: '0.88rem' }}>
          {isExpired ? t('settings.billingSessionExpired') : t('settings.billingVerifyPrompt')}
        </p>
        <Input
          label={t('settings.billingPasswordLabel')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && password.trim()) void handleVerify()
          }}
          error={error ?? undefined}
          autoComplete="current-password"
        />
        <div style={{ marginTop: '1rem' }}>
          <Button
            variant="primary"
            disabled={loading || !password.trim()}
            onClick={() => void handleVerify()}
          >
            {loading ? t('ui.loading') : t('settings.billingVerifyBtn')}
          </Button>
        </div>
      </div>
    </div>
  )
}

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
