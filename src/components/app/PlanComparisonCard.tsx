/**
 * PlanComparisonCard — Reusable plan comparison grid.
 *
 * Shows Free / Pro / Student / Enterprise tiers in a responsive grid
 * with feature checklists, pricing, and action buttons.
 *
 * Used in: SignupWizard (step 3), BillingSettings, UpgradeModal.
 */

import { useState, useCallback, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { refreshSession, signOut } from '../../lib/auth'
import type { Plan, PlanKey } from '../../lib/entitlements'

// ── Feature definitions ─────────────────────────────────────────────────────

interface Feature {
  labelKey: string
  free: boolean
  pro: boolean
  student: boolean
  enterprise: boolean
}

const FEATURES: Feature[] = [
  { labelKey: 'planCard.featProjects', free: false, pro: true, student: true, enterprise: true },
  { labelKey: 'planCard.featCanvases', free: false, pro: true, student: true, enterprise: true },
  { labelKey: 'planCard.featGroups', free: true, pro: true, student: true, enterprise: true },
  { labelKey: 'planCard.featThemes', free: true, pro: true, student: true, enterprise: true },
  { labelKey: 'planCard.featCsv', free: false, pro: true, student: true, enterprise: true },
  { labelKey: 'planCard.featArrays', free: false, pro: true, student: true, enterprise: true },
  { labelKey: 'planCard.featPlots', free: false, pro: true, student: true, enterprise: true },
  { labelKey: 'planCard.featListBlocks', free: false, pro: true, student: true, enterprise: true },
  {
    labelKey: 'planCard.featGraphTable',
    free: false,
    pro: true,
    student: true,
    enterprise: true,
  },
  { labelKey: 'planCard.featExport', free: false, pro: true, student: true, enterprise: true },
  { labelKey: 'planCard.featImport', free: false, pro: true, student: true, enterprise: true },
  {
    labelKey: 'planCard.featCustomMaterials',
    free: false,
    pro: true,
    student: true,
    enterprise: true,
  },
  {
    labelKey: 'planCard.featCustomFunctions',
    free: false,
    pro: true,
    student: true,
    enterprise: true,
  },
  { labelKey: 'planCard.featAi', free: false, pro: true, student: true, enterprise: true },
  { labelKey: 'planCard.featOrgMgmt', free: false, pro: false, student: false, enterprise: true },
  { labelKey: 'planCard.featSeatMgmt', free: false, pro: false, student: false, enterprise: true },
  {
    labelKey: 'planCard.featPrioritySupport',
    free: false,
    pro: false,
    student: false,
    enterprise: true,
  },
]

// ── Pricing ─────────────────────────────────────────────────────────────────

type BillingCycle = 'monthly' | 'annual'

const PRICING: Record<BillingCycle, { pro: string; enterprise: string }> = {
  monthly: { pro: '£10/mo', enterprise: '£80/mo' },
  annual: { pro: '£96/yr', enterprise: '£768/yr' },
}

const ENTERPRISE_EMAIL = 'info@chainsolve.co.uk'

// ── Props ───────────────────────────────────────────────────────────────────

export interface PlanComparisonCardProps {
  /** The user's current effective plan, if known. Highlights the current plan. */
  currentPlan?: Plan | null
  /** Show billing cycle toggle and checkout buttons. False for signup wizard. */
  showCheckout?: boolean
  /** Compact mode reduces feature list to key differences only. */
  compact?: boolean
  /** Called when user selects a plan (signup wizard mode). */
  onSelectPlan?: (plan: string) => void
  /** Currently selected plan (signup wizard mode). */
  selectedPlan?: string
}

// ── Component ───────────────────────────────────────────────────────────────

export function PlanComparisonCard({
  currentPlan,
  showCheckout = false,
  compact = false,
  onSelectPlan,
  selectedPlan,
}: PlanComparisonCardProps) {
  const { t } = useTranslation()
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const prices = PRICING[cycle]
  const features = compact ? FEATURES.filter((f) => !(f.free && f.pro)) : FEATURES

  const handleCheckout = useCallback(async (planKey: PlanKey) => {
    setLoading(true)
    setError(null)
    try {
      const { session, error: refreshErr } = await refreshSession()
      if (refreshErr || !session) {
        await signOut()
        window.location.assign('/login')
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
  }, [])

  const proPlanKey: PlanKey = cycle === 'monthly' ? 'pro_monthly' : 'pro_annual'

  const isCurrent = (plan: string) => {
    if (!currentPlan) return false
    if (plan === 'pro' && (currentPlan === 'pro' || currentPlan === 'trialing')) return true
    return currentPlan === plan
  }

  const isSelected = (plan: string) => selectedPlan === plan

  type TierDef = {
    id: string
    titleKey: string
    price: string
    highlight: boolean
    features: boolean[]
    action: 'current' | 'select' | 'checkout' | 'contact' | 'student'
  }

  const tiers: TierDef[] = [
    {
      id: 'free',
      titleKey: 'planCard.tierFree',
      price: t('planCard.priceFree'),
      highlight: false,
      features: features.map((f) => f.free),
      action: isCurrent('free') ? 'current' : onSelectPlan ? 'select' : 'current',
    },
    {
      id: 'pro',
      titleKey: 'planCard.tierPro',
      price: prices.pro,
      highlight: true,
      features: features.map((f) => f.pro),
      action: isCurrent('pro') ? 'current' : showCheckout ? 'checkout' : 'select',
    },
    {
      id: 'student',
      titleKey: 'planCard.tierStudent',
      price: t('planCard.priceStudent'),
      highlight: false,
      features: features.map((f) => f.student),
      action: isCurrent('student') ? 'current' : onSelectPlan ? 'select' : 'student',
    },
    {
      id: 'enterprise',
      titleKey: 'planCard.tierEnterprise',
      price: showCheckout ? prices.enterprise : '',
      highlight: false,
      features: features.map((f) => f.enterprise),
      action: isCurrent('enterprise') ? 'current' : 'contact',
    },
  ]

  return (
    <div>
      {/* Billing cycle toggle */}
      {showCheckout && (
        <div style={toggleRowStyle}>
          <button style={toggleBtnStyle(cycle === 'monthly')} onClick={() => setCycle('monthly')}>
            {t('planCard.monthly')}
          </button>
          <button style={toggleBtnStyle(cycle === 'annual')} onClick={() => setCycle('annual')}>
            {t('planCard.annual')}
            <span style={{ marginLeft: '0.3rem', fontSize: '0.75rem', opacity: 0.8 }}>
              {t('planCard.annualSave')}
            </span>
          </button>
        </div>
      )}

      {/* Tier grid */}
      <div style={gridStyle}>
        {tiers.map((tier) => {
          const selected = isSelected(tier.id)
          const current = isCurrent(tier.id)
          return (
            <div
              key={tier.id}
              style={cardStyle(tier.highlight, selected)}
              onClick={onSelectPlan && !current ? () => onSelectPlan(tier.id) : undefined}
              role={onSelectPlan ? 'button' : undefined}
              tabIndex={onSelectPlan ? 0 : undefined}
            >
              <div style={tierTitleStyle}>{t(tier.titleKey)}</div>
              {tier.price && <div style={tierPriceStyle}>{tier.price}</div>}

              <div style={featListStyle}>
                {features.map((f, i) => (
                  <div key={f.labelKey} style={featRowStyle}>
                    <span style={{ color: tier.features[i] ? 'var(--primary, #1cabb0)' : '#ccc' }}>
                      {tier.features[i] ? '\u2713' : '\u2717'}
                    </span>
                    <span style={{ opacity: tier.features[i] ? 1 : 0.45 }}>{t(f.labelKey)}</span>
                  </div>
                ))}
              </div>

              {/* Action button */}
              <div style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
                {tier.action === 'current' && (
                  <button style={actionBtnStyle(false, true)} disabled>
                    {current ? t('planCard.currentPlan') : t('planCard.selectPlan')}
                  </button>
                )}
                {tier.action === 'select' && (
                  <button
                    style={actionBtnStyle(selected || tier.highlight, false)}
                    onClick={
                      onSelectPlan
                        ? (e) => {
                            e.stopPropagation()
                            onSelectPlan(tier.id)
                          }
                        : undefined
                    }
                  >
                    {selected ? t('planCard.selected') : t('planCard.selectPlan')}
                  </button>
                )}
                {tier.action === 'checkout' && (
                  <button
                    style={actionBtnStyle(true, loading)}
                    disabled={loading}
                    onClick={() => void handleCheckout(proPlanKey)}
                  >
                    {loading ? t('planCard.redirecting') : t('planCard.upgradePro')}
                  </button>
                )}
                {tier.action === 'student' && (
                  <button style={actionBtnStyle(false, false)} disabled>
                    {t('planCard.verifyInSettings')}
                  </button>
                )}
                {tier.action === 'contact' && (
                  <a
                    href={`mailto:${ENTERPRISE_EMAIL}?subject=ChainSolve Enterprise inquiry`}
                    style={{
                      ...actionBtnStyle(false, false),
                      textDecoration: 'none',
                      textAlign: 'center',
                      display: 'block',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('planCard.contactSales')}
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {error && <p style={errorStyle}>{error}</p>}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const toggleRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '0.5rem',
  marginBottom: '1rem',
}

const toggleBtnStyle = (active: boolean): CSSProperties => ({
  padding: '0.4rem 1rem',
  border: '1px solid var(--primary, #1cabb0)',
  borderRadius: 6,
  background: active ? 'var(--primary, #1cabb0)' : 'transparent',
  color: active ? '#fff' : 'var(--primary, #1cabb0)',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
})

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '0.75rem',
}

const cardStyle = (highlight: boolean, selected: boolean): CSSProperties => ({
  border: selected
    ? '2px solid var(--primary, #1cabb0)'
    : highlight
      ? '2px solid var(--primary, #1cabb0)'
      : '1px solid var(--border, #e5e7eb)',
  borderRadius: 'var(--radius-lg, 10px)',
  padding: '0.85rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  cursor: selected || highlight ? 'pointer' : 'default',
  background: selected ? 'rgba(28,171,176,0.06)' : 'transparent',
  transition: 'border-color 0.15s, background 0.15s',
})

const tierTitleStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: '1rem',
  textAlign: 'center',
}

const tierPriceStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: '0.88rem',
  textAlign: 'center',
  color: 'var(--primary, #1cabb0)',
  marginBottom: '0.5rem',
}

const featListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
}

const featRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.78rem',
  padding: '0.1rem 0',
}

const actionBtnStyle = (primary: boolean, disabled: boolean): CSSProperties => ({
  width: '100%',
  padding: '0.5rem 0',
  border: primary ? 'none' : '1px solid var(--primary, #1cabb0)',
  borderRadius: 'var(--radius-lg, 8px)',
  background: primary ? 'var(--primary, #1cabb0)' : 'transparent',
  color: primary ? '#fff' : 'var(--primary, #1cabb0)',
  fontWeight: 700,
  fontSize: '0.82rem',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit',
  opacity: disabled ? 0.55 : 1,
})

const errorStyle: CSSProperties = {
  margin: '0.5rem 0 0',
  fontSize: '0.82rem',
  color: 'var(--danger-text, #b91c1c)',
  background: 'rgba(239,68,68,0.1)',
  padding: '0.5rem 0.75rem',
  borderRadius: 6,
}
