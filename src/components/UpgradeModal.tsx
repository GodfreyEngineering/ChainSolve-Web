/**
 * UpgradeModal — D11-3: Shows Free / Pro / Enterprise comparison
 * with monthly/annual toggle. Enterprise tier shows "Contact sales".
 */

import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from './ui/Modal'
import { refreshSession, signOut } from '../lib/auth'
import { useTranslation } from 'react-i18next'
import type { PlanKey } from '../lib/entitlements'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  /** Why the modal was triggered — drives the message shown. */
  reason: 'project_limit' | 'canvas_limit' | 'feature_locked' | 'export_locked' | 'ai_locked'
}

type BillingCycle = 'monthly' | 'annual'

const ENTERPRISE_EMAIL = 'info@chainsolve.co.uk'

const tierFeatures = {
  free: [
    { label: 'upgrade.feat1Project', included: true },
    { label: 'upgrade.feat2Canvases', included: true },
    { label: 'upgrade.featCsv', included: false },
    { label: 'upgrade.featArrays', included: false },
    { label: 'upgrade.featPlots', included: false },
    { label: 'upgrade.featGroups', included: false },
    { label: 'upgrade.featExport', included: false },
    { label: 'upgrade.featThemes', included: false },
  ],
  pro: [
    { label: 'upgrade.featUnlimitedProjects', included: true },
    { label: 'upgrade.featUnlimitedCanvases', included: true },
    { label: 'upgrade.featCsv', included: true },
    { label: 'upgrade.featArrays', included: true },
    { label: 'upgrade.featPlots', included: true },
    { label: 'upgrade.featGroups', included: true },
    { label: 'upgrade.featExport', included: true },
    { label: 'upgrade.featThemes', included: true },
  ],
  enterprise: [
    { label: 'upgrade.featEverythingInPro', included: true },
    { label: 'upgrade.featOrgManagement', included: true },
    { label: 'upgrade.featCompanyLibrary', included: true },
    { label: 'upgrade.featPolicyControls', included: true },
    { label: 'upgrade.featSeatManagement', included: true },
    { label: 'upgrade.featPrioritySupport', included: true },
  ],
}

const pricing: Record<
  BillingCycle,
  { pro: string; enterprise10: string; enterpriseUnlimited: string }
> = {
  monthly: { pro: '£10/mo', enterprise10: '£80/mo', enterpriseUnlimited: '£200/mo' },
  annual: { pro: '£96/yr', enterprise10: '£768/yr', enterpriseUnlimited: '£1,920/yr' },
}

// ── Styles ─────────────────────────────────────────────────────────────────

const toggleContainer: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '0.5rem',
  marginBottom: '1rem',
}

const toggleBtn = (active: boolean): React.CSSProperties => ({
  padding: '0.4rem 1rem',
  border: '1px solid var(--primary)',
  borderRadius: 6,
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--primary)',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
})

const tiersRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '0.75rem',
  marginBottom: '0.75rem',
}

const tierCard = (highlight: boolean): React.CSSProperties => ({
  border: highlight ? '2px solid var(--primary)' : '1px solid var(--border, #ddd)',
  borderRadius: 10,
  padding: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
})

const tierTitle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '1rem',
  textAlign: 'center',
}

const tierPrice: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.88rem',
  textAlign: 'center',
  color: 'var(--primary)',
  marginBottom: '0.5rem',
}

const featureRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.82rem',
  padding: '0.15rem 0',
}

const btnStyle = (primary: boolean, disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '0.55rem 0',
  border: primary ? 'none' : '1px solid var(--primary)',
  borderRadius: 8,
  background: primary ? 'var(--primary)' : 'transparent',
  color: primary ? '#fff' : 'var(--primary)',
  fontWeight: 700,
  fontSize: '0.85rem',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit',
  marginTop: 'auto',
  opacity: disabled ? 0.55 : 1,
})

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')

  const title =
    reason === 'project_limit'
      ? t('entitlements.projectLimitTitle')
      : reason === 'canvas_limit'
        ? t('upgrade.canvasLimitTitle', 'Canvas limit reached')
        : reason === 'export_locked'
          ? t('upgrade.exportLockedTitle', 'Export requires Pro')
          : reason === 'ai_locked'
            ? t('ai.upgradeTitle')
            : t('entitlements.featureLockedTitle')

  const message =
    reason === 'project_limit'
      ? t('entitlements.projectLimitMsg')
      : reason === 'canvas_limit'
        ? t(
            'upgrade.canvasLimitMsg',
            'Free accounts can have 2 canvases per project. Upgrade to Pro for unlimited canvases.',
          )
        : reason === 'export_locked'
          ? t('upgrade.exportLockedMsg', 'Export and import are Pro features. Upgrade to unlock.')
          : reason === 'ai_locked'
            ? t('ai.upgradeBody')
            : t('entitlements.featureLockedMsg')

  const handleCheckout = useCallback(
    async (planKey: PlanKey) => {
      setLoading(true)
      setError(null)
      try {
        const { session, error: refreshErr } = await refreshSession()
        if (refreshErr || !session) {
          await signOut()
          navigate('/login')
          return
        }
        const res = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ plan_key: planKey }),
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
    },
    [navigate],
  )

  const proPlanKey: PlanKey = cycle === 'monthly' ? 'pro_monthly' : 'pro_annual'
  const prices = pricing[cycle]

  return (
    <Modal open={open} onClose={onClose} title={title} width={720}>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', opacity: 0.7 }}>{message}</p>

      {/* Monthly / Annual toggle */}
      <div style={toggleContainer}>
        <button style={toggleBtn(cycle === 'monthly')} onClick={() => setCycle('monthly')}>
          {t('upgrade.monthly', 'Monthly')}
        </button>
        <button style={toggleBtn(cycle === 'annual')} onClick={() => setCycle('annual')}>
          {t('upgrade.annual', 'Annual')}
          <span style={{ marginLeft: '0.3rem', fontSize: '0.75rem', opacity: 0.8 }}>
            {t('upgrade.annualSave', '(save 20%)')}
          </span>
        </button>
      </div>

      {/* Tier comparison */}
      <div style={tiersRow}>
        {/* Free */}
        <div style={tierCard(false)}>
          <div style={tierTitle}>{t('upgrade.tierFree', 'Free')}</div>
          <div style={tierPrice}>{t('upgrade.freePrice', '£0')}</div>
          {tierFeatures.free.map((f) => (
            <div key={f.label} style={featureRow}>
              <span style={{ color: f.included ? 'var(--primary)' : '#ccc' }}>
                {f.included ? '\u2713' : '\u2717'}
              </span>
              <span style={{ opacity: f.included ? 1 : 0.5 }}>{t(f.label, f.label)}</span>
            </div>
          ))}
          <button style={btnStyle(false, true)} disabled>
            {t('upgrade.currentPlan', 'Current plan')}
          </button>
        </div>

        {/* Pro */}
        <div style={tierCard(true)}>
          <div style={tierTitle}>{t('upgrade.tierPro', 'Pro')}</div>
          <div style={tierPrice}>{prices.pro}</div>
          {tierFeatures.pro.map((f) => (
            <div key={f.label} style={featureRow}>
              <span style={{ color: 'var(--primary)' }}>{'\u2713'}</span>
              <span>{t(f.label, f.label)}</span>
            </div>
          ))}
          <button
            style={btnStyle(true, loading)}
            disabled={loading}
            onClick={() => void handleCheckout(proPlanKey)}
          >
            {loading
              ? t('upgrade.redirecting', 'Redirecting\u2026')
              : t('upgrade.upgradePro', 'Upgrade to Pro')}
          </button>
        </div>

        {/* Enterprise */}
        <div style={tierCard(false)}>
          <div style={tierTitle}>{t('upgrade.tierEnterprise', 'Enterprise')}</div>
          <div style={tierPrice}>
            {t('upgrade.enterpriseFrom', 'From {{price}}', { price: prices.enterprise10 })}
          </div>
          {tierFeatures.enterprise.map((f) => (
            <div key={f.label} style={featureRow}>
              <span style={{ color: 'var(--primary)' }}>{'\u2713'}</span>
              <span>{t(f.label, f.label)}</span>
            </div>
          ))}
          <a
            href={`mailto:${ENTERPRISE_EMAIL}?subject=ChainSolve Enterprise inquiry`}
            style={{
              ...btnStyle(false, false),
              textDecoration: 'none',
              textAlign: 'center',
              display: 'block',
            }}
          >
            {t('upgrade.contactSales', 'Contact sales')}
          </a>
        </div>
      </div>

      {error && (
        <p
          style={{
            margin: '0.5rem 0 0',
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
    </Modal>
  )
}
