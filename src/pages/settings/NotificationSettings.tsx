/**
 * NotificationSettings — Email notification preferences (ACCT-08).
 *
 * Exposes toggles for:
 *   - Product updates (opt-out)
 *   - Billing alerts (always on — informational only)
 *   - Security alerts (always on — informational only)
 *
 * Preferences are stored in the Zustand preferencesStore (persists to
 * localStorage and syncs to user_preferences DB on next save).
 */

import { useTranslation } from 'react-i18next'
import { usePreferencesStore } from '../../stores/preferencesStore'

export function NotificationSettings() {
  const { t } = useTranslation()
  const notifyProductUpdates = usePreferencesStore((s) => s.notifyProductUpdates)
  const update = usePreferencesStore((s) => s.update)

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>{t('settings.notifications', 'Notifications')}</h2>
      <p style={descStyle}>
        {t(
          'settings.notificationsDesc',
          'Control which emails ChainSolve sends to your account address.',
        )}
      </p>

      <div style={sectionStyle}>
        <h3 style={sectionHeadingStyle}>
          {t('settings.emailNotifications', 'Email notifications')}
        </h3>

        {/* Product updates — user-controllable */}
        <label style={rowStyle}>
          <div style={rowTextStyle}>
            <span style={rowLabelStyle}>
              {t('settings.notifyProductUpdates', 'Product updates')}
            </span>
            <span style={rowHintStyle}>
              {t(
                'settings.notifyProductUpdatesHint',
                'New features, improvements, and occasional announcements.',
              )}
            </span>
          </div>
          <input
            type="checkbox"
            checked={notifyProductUpdates}
            onChange={(e) => update({ notifyProductUpdates: e.target.checked })}
            style={checkboxStyle}
            aria-label={t('settings.notifyProductUpdates', 'Product updates')}
          />
        </label>

        {/* Billing alerts — always on, non-interactive */}
        <div style={{ ...rowStyle, opacity: 0.55, cursor: 'not-allowed' }}>
          <div style={rowTextStyle}>
            <span style={rowLabelStyle}>{t('settings.notifyBillingAlerts', 'Billing alerts')}</span>
            <span style={rowHintStyle}>
              {t(
                'settings.notifyBillingAlertsHint',
                'Payment failures, subscription renewals, and receipts. Cannot be disabled.',
              )}
            </span>
          </div>
          <input
            type="checkbox"
            checked
            disabled
            style={{ ...checkboxStyle, cursor: 'not-allowed' }}
            aria-label={t('settings.notifyBillingAlerts', 'Billing alerts')}
          />
        </div>

        {/* Security alerts — always on, non-interactive */}
        <div style={{ ...rowStyle, opacity: 0.55, cursor: 'not-allowed' }}>
          <div style={rowTextStyle}>
            <span style={rowLabelStyle}>
              {t('settings.notifySecurityAlerts', 'Security alerts')}
            </span>
            <span style={rowHintStyle}>
              {t(
                'settings.notifySecurityAlertsHint',
                'New sign-ins, password changes, and 2FA events. Cannot be disabled.',
              )}
            </span>
          </div>
          <input
            type="checkbox"
            checked
            disabled
            style={{ ...checkboxStyle, cursor: 'not-allowed' }}
            aria-label={t('settings.notifySecurityAlerts', 'Security alerts')}
          />
        </div>
      </div>

      <p style={footerStyle}>
        {t(
          'settings.notificationsFooter',
          'You can also unsubscribe from product update emails using the link in any email we send you.',
        )}
      </p>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  padding: '1.5rem',
  maxWidth: 560,
}

const headingStyle: React.CSSProperties = {
  margin: '0 0 0.25rem',
  fontSize: '1.1rem',
  fontWeight: 600,
}

const descStyle: React.CSSProperties = {
  margin: '0 0 1.5rem',
  fontSize: '0.85rem',
  opacity: 0.6,
  lineHeight: 1.5,
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  overflow: 'hidden',
}

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  padding: '0.75rem 1rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  opacity: 0.5,
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface-1)',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.875rem 1rem',
  borderBottom: '1px solid var(--border)',
}

const rowTextStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  flex: 1,
  minWidth: 0,
}

const rowLabelStyle: React.CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 500,
}

const rowHintStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  opacity: 0.55,
  lineHeight: 1.4,
}

const checkboxStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  accentColor: 'var(--primary)',
  cursor: 'pointer',
  flexShrink: 0,
}

const footerStyle: React.CSSProperties = {
  marginTop: '1rem',
  fontSize: '0.78rem',
  opacity: 0.45,
  lineHeight: 1.5,
}
