/**
 * AccessibilitySettings — 4.12: high contrast, reduced motion, font scale.
 */

import { useTranslation } from 'react-i18next'
import { usePreferencesStore } from '../../stores/preferencesStore'

export function AccessibilitySettings() {
  const { t } = useTranslation()
  const prefs = usePreferencesStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
        {t('settings.accessibility', 'Accessibility')}
      </h3>

      {/* High contrast */}
      <label style={rowStyle}>
        <input
          type="checkbox"
          checked={prefs.highContrastMode}
          onChange={(e) => prefs.update({ highContrastMode: e.target.checked })}
          style={{ accentColor: 'var(--primary)' }}
        />
        <div>
          <div style={labelStyle}>{t('settings.highContrast', 'High contrast mode')}</div>
          <div style={hintStyle}>
            {t('settings.highContrastHint', 'Increases border and text contrast for better visibility.')}
          </div>
        </div>
      </label>

      {/* Reduced motion */}
      <label style={rowStyle}>
        <input
          type="checkbox"
          checked={prefs.reducedMotion}
          onChange={(e) => prefs.update({ reducedMotion: e.target.checked })}
          style={{ accentColor: 'var(--primary)' }}
        />
        <div>
          <div style={labelStyle}>{t('settings.reducedMotion', 'Reduced motion')}</div>
          <div style={hintStyle}>
            {t('settings.reducedMotionHint', 'Disables animations and transitions across the interface.')}
          </div>
        </div>
      </label>

      {/* Font scale */}
      <div>
        <div style={labelStyle}>{t('settings.fontScale', 'Font size scale')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <input
            type="range"
            min={80}
            max={150}
            step={10}
            value={prefs.fontScale}
            onChange={(e) => prefs.update({ fontScale: parseInt(e.target.value, 10) })}
            style={{ flex: 1, accentColor: 'var(--primary)' }}
            title={t('settings.fontScale', 'Font size scale')}
          />
          <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', minWidth: 40 }}>
            {prefs.fontScale}%
          </span>
        </div>
        <div style={hintStyle}>
          {t('settings.fontScaleHint', 'Scales the interface font size (80%–150%).')}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />

      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
        {t('settings.privacy', 'Privacy')}
      </h3>

      {/* Analytics */}
      <label style={rowStyle}>
        <input
          type="checkbox"
          checked={prefs.analyticsOptIn}
          onChange={(e) => prefs.update({ analyticsOptIn: e.target.checked })}
          style={{ accentColor: 'var(--primary)' }}
        />
        <div>
          <div style={labelStyle}>{t('settings.analytics', 'Anonymous analytics')}</div>
          <div style={hintStyle}>
            {t('settings.analyticsHint', 'Help improve ChainSolve by sending anonymous usage data.')}
          </div>
        </div>
      </label>

      {/* Crash reporting */}
      <label style={rowStyle}>
        <input
          type="checkbox"
          checked={prefs.crashReportingOptIn}
          onChange={(e) => prefs.update({ crashReportingOptIn: e.target.checked })}
          style={{ accentColor: 'var(--primary)' }}
        />
        <div>
          <div style={labelStyle}>{t('settings.crashReporting', 'Crash reporting')}</div>
          <div style={hintStyle}>
            {t('settings.crashReportingHint', 'Automatically send crash reports to help us fix bugs faster.')}
          </div>
        </div>
      </label>

      {/* 6.08: AI opt-out */}
      <label style={rowStyle}>
        <input
          type="checkbox"
          checked={prefs.aiOptOut}
          onChange={(e) => prefs.update({ aiOptOut: e.target.checked })}
          style={{ accentColor: 'var(--primary)' }}
        />
        <div>
          <div style={labelStyle}>{t('settings.aiOptOut', 'Opt out of AI Copilot')}</div>
          <div style={hintStyle}>
            {t(
              'settings.aiOptOutHint',
              'When enabled, no canvas data is sent to external AI services. The AI Copilot panel will be disabled.',
            )}
          </div>
        </div>
      </label>
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  cursor: 'pointer',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 500,
}

const hintStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--text-faint)',
  marginTop: 2,
}
