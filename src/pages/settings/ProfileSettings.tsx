import { useTranslation } from 'react-i18next'
import { Input } from '../../components/ui/Input'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../Settings'

interface Props {
  user: User | null
  profile: Profile | null
}

export function ProfileSettings({ user, profile }: Props) {
  const { t } = useTranslation()
  const plan = profile?.plan ?? 'free'

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'

  return (
    <div>
      <h2 style={headingStyle}>{t('settings.profile')}</h2>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Input
            label={t('settings.emailLabel')}
            value={user?.email ?? ''}
            readOnly
            hint={t('settings.emailHint')}
            style={{ opacity: 0.7, cursor: 'default' }}
          />

          <Input
            label={t('settings.userIdLabel')}
            value={user?.id ?? ''}
            readOnly
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.78rem',
              opacity: 0.5,
              cursor: 'default',
            }}
          />

          <div style={fieldStyle}>
            <span style={fieldLabel}>{t('settings.memberSince')}</span>
            <span style={{ fontSize: '0.88rem' }}>{memberSince}</span>
          </div>

          <div style={fieldStyle}>
            <span style={fieldLabel}>{t('settings.planLabel')}</span>
            <span style={planBadgeStyle(plan)}>{t(`plans.${plan}`)}</span>
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

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
}

const fieldLabel: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  opacity: 0.7,
}

const PLAN_COLORS: Record<string, string> = {
  free: '#6b7280',
  trialing: '#3b82f6',
  pro: '#22c55e',
  past_due: '#f59e0b',
  canceled: '#ef4444',
}

function planBadgeStyle(plan: string): React.CSSProperties {
  const color = PLAN_COLORS[plan] ?? '#6b7280'
  return {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    background: `${color}22`,
    color,
    border: `1px solid ${color}44`,
    width: 'fit-content',
  }
}
