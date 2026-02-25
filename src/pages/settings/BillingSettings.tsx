import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import type { Profile } from '../Settings'

type Plan = 'free' | 'trialing' | 'pro' | 'past_due' | 'canceled'

interface Props {
  profile: Profile | null
}

const PLAN_COLORS: Record<Plan, string> = {
  free: '#6b7280',
  trialing: '#3b82f6',
  pro: '#22c55e',
  past_due: '#f59e0b',
  canceled: '#ef4444',
}

export function BillingSettings({ profile }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan = (profile?.plan ?? 'free') as Plan
  const canUpgrade = plan === 'free' || plan === 'canceled'
  const canManage = plan === 'trialing' || plan === 'pro' || plan === 'past_due'

  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const callBillingApi = async (endpoint: string) => {
    setLoading(true)
    setError(null)
    try {
      // Force a token refresh so the access_token is never stale
      const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr || !refreshData.session) {
        setError('Session expired — please sign in again')
        setLoading(false)
        return
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshData.session.access_token}` },
      })
      let json: Record<string, unknown>
      try {
        json = (await res.json()) as Record<string, unknown>
      } catch {
        throw new Error(`Server returned a non-JSON response (HTTP ${res.status})`)
      }
      if (!res.ok)
        throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
      if (typeof json.url !== 'string') throw new Error('No redirect URL returned by server')
      window.location.assign(json.url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Billing request failed')
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={headingStyle}>{t('settings.billing')}</h2>

      <div style={cardStyle}>
        {error && <div style={errorBox}>{error}</div>}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={fieldCol}>
              <span style={fieldLabel}>{t('billing.currentPlan')}</span>
              <span style={planBadgeStyle(plan)}>{t(`plans.${plan}`)}</span>
            </div>
            {periodEnd && (
              <div style={fieldCol}>
                <span style={fieldLabel}>
                  {plan === 'trialing' ? t('billing.trialEnds') : t('billing.renews')}
                </span>
                <span style={{ fontWeight: 500 }}>{periodEnd}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {canUpgrade && (
              <Button
                variant="primary"
                disabled={loading}
                onClick={() => void callBillingApi('/api/stripe/create-checkout-session')}
              >
                {loading ? t('billing.redirecting') : t('billing.upgrade')}
              </Button>
            )}
            {canManage && (
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => void callBillingApi('/api/stripe/create-portal-session')}
              >
                {loading ? t('billing.redirecting') : t('billing.manage')}
              </Button>
            )}
          </div>
        </div>
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

const errorBox: React.CSSProperties = {
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: '#f87171',
  borderRadius: 8,
  padding: '0.65rem 0.85rem',
  marginBottom: '1rem',
  fontSize: '0.9rem',
}

const fieldCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
}

const fieldLabel: React.CSSProperties = {
  fontSize: '0.8rem',
  opacity: 0.5,
}

function planBadgeStyle(plan: Plan): React.CSSProperties {
  const color = PLAN_COLORS[plan]
  return {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    background: `${color}22`,
    color,
    border: `1px solid ${color}44`,
  }
}
