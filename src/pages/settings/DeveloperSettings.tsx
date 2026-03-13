import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import {
  type Plan,
  getDevPlanOverride,
  setDevPlanOverride,
  getEntitlements,
} from '../../lib/entitlements'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { BUILD_VERSION, BUILD_SHA, BUILD_ENV } from '../../lib/build-info'

interface Props {
  cardStyle: React.CSSProperties
  subheadingStyle: React.CSSProperties
  checkRowStyle: React.CSSProperties
  checkboxStyle: React.CSSProperties
  checkLabelStyle: React.CSSProperties
  checkHintStyle: React.CSSProperties
}

const PLANS: { value: Plan | ''; label: string }[] = [
  { value: '', label: 'None (use actual plan)' },
  { value: 'free', label: 'Free' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'pro', label: 'Pro' },
  { value: 'student', label: 'Student' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'canceled', label: 'Canceled' },
]

export function DeveloperSettings({
  cardStyle,
  subheadingStyle,
  checkRowStyle,
  checkboxStyle,
  checkLabelStyle,
  checkHintStyle,
}: Props) {
  const { t } = useTranslation()
  const defaultLod = usePreferencesStore((s) => s.defaultLod)
  const updatePrefs = usePreferencesStore((s) => s.update)
  const [planOverride, setPlanOverride] = useState<string>(getDevPlanOverride() ?? '')

  const handlePlanChange = (value: string) => {
    setPlanOverride(value)
    setDevPlanOverride(value ? (value as Plan) : null)
  }

  const activeEntitlements = getEntitlements(planOverride ? (planOverride as Plan) : 'developer')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Plan Switcher */}
      <div style={cardStyle}>
        <Select
          label={t('settings.devPlanSwitcher')}
          hint={t('settings.devPlanSwitcherHint')}
          options={PLANS.map((p) => ({ value: p.value, label: p.label }))}
          value={planOverride}
          onChange={(e) => handlePlanChange(e.target.value)}
        />

        {planOverride && (
          <div style={{ marginTop: '1rem' }}>
            <div style={entitlementHeadingStyle}>{t('settings.devActiveEntitlements')}</div>
            <div style={entGridStyle}>
              <EntRow label="maxProjects" value={String(activeEntitlements.maxProjects)} />
              <EntRow label="maxCanvases" value={String(activeEntitlements.maxCanvases)} />
              <EntRow label="canExport" value={String(activeEntitlements.canExport)} />
              <EntRow label="canUseAi" value={String(activeEntitlements.canUseAi)} />
              <EntRow label="canEditThemes" value={String(activeEntitlements.canEditThemes)} />
              <EntRow label="canUseGroups" value={String(activeEntitlements.canUseGroups)} />
              <EntRow label="canUsePlots" value={String(activeEntitlements.canUsePlots)} />
              <EntRow label="canUseArrays" value={String(activeEntitlements.canUseArrays)} />
            </div>
          </div>
        )}
      </div>

      {/* Engine Debug */}
      <h3 style={subheadingStyle}>{t('settings.devEngineDebug')}</h3>
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={defaultLod}
              onChange={(e) => updatePrefs({ defaultLod: e.target.checked })}
              style={checkboxStyle}
            />
            <div>
              <span style={checkLabelStyle}>{t('settings.lodRendering')}</span>
              <span style={checkHintStyle}>{t('settings.lodRenderingHint')}</span>
            </div>
          </label>
        </div>
      </div>

      {/* Diagnostics */}
      <h3 style={subheadingStyle}>{t('settings.devDiagnostics')}</h3>
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <InfoRow label="Version" value={`v${BUILD_VERSION}`} />
          <InfoRow label="Commit" value={BUILD_SHA} />
          <InfoRow label="Environment" value={BUILD_ENV} />
          <InfoRow label="Plan Override" value={planOverride || 'none'} />
          <InfoRow label="localStorage keys" value={countLocalStorageKeys()} />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDevPlanOverride(null)
              setPlanOverride('')
            }}
          >
            {t('settings.devClearOverride')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function EntRow({ label, value }: { label: string; value: string }) {
  const isTrue = value === 'true' || value === 'Infinity'
  return (
    <div style={entRowStyle}>
      <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>{label}</span>
      <span
        style={{
          fontSize: '0.78rem',
          fontFamily: "'JetBrains Mono', monospace",
          color: isTrue ? 'var(--success)' : 'var(--danger)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.82rem', opacity: 0.6 }}>{label}</span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.78rem',
          opacity: 0.8,
        }}
      >
        {value}
      </span>
    </div>
  )
}

function countLocalStorageKeys(): string {
  try {
    const csKeys = Object.keys(localStorage).filter((k) => k.startsWith('cs:'))
    return `${csKeys.length} cs: keys / ${localStorage.length} total`
  } catch {
    return 'unavailable'
  }
}

const entitlementHeadingStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--primary)',
  marginBottom: '0.5rem',
}

const entGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.25rem 1rem',
}

const entRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.15rem 0',
  borderBottom: '1px solid var(--border)',
}
