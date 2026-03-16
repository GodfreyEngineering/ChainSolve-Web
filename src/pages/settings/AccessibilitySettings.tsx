/**
 * AccessibilitySettings — 4.12: high contrast, reduced motion, font scale.
 */

import { useTranslation } from 'react-i18next'
import { usePreferencesStore } from '../../stores/preferencesStore'

export function AccessibilitySettings() {
  const { t } = useTranslation()
  const highContrastMode = usePreferencesStore((s) => s.highContrastMode)
  const reducedMotion = usePreferencesStore((s) => s.reducedMotion)
  const fontScale = usePreferencesStore((s) => s.fontScale)
  const analyticsOptIn = usePreferencesStore((s) => s.analyticsOptIn)
  const crashReportingOptIn = usePreferencesStore((s) => s.crashReportingOptIn)
  const aiOptOut = usePreferencesStore((s) => s.aiOptOut)
  const updatePrefs = usePreferencesStore((s) => s.update)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
        {t('settings.accessibility', 'Accessibility')}
      </h3>

      {/* High contrast */}
      <label style={rowStyle}>
        <input
          type="checkbox"
          checked={highContrastMode}
          onChange={(e) => updatePrefs({ highContrastMode: e.target.checked })}
          style={{ accentColor: 'var(--primary)' }}
        />
        <div>
          <div style={labelStyle}>{t('settings.highContrast', 'High contrast mode')}</div>
          <div style={hintStyle}>
            {t(
              'settings.highContrastHint',
              'Increases border and text contrast for better visibility.',
            )}
          </div>
        </div>
      </label>

      {/* Reduced motion */}
      <label style={rowStyle}>
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(e) => updatePrefs({ reducedMotion: e.target.checked })}
          style={{ accentColor: 'var(--primary)' }}
        />
        <div>
          <div style={labelStyle}>{t('settings.reducedMotion', 'Reduced motion')}</div>
          <div style={hintStyle}>
            {t(
              'settings.reducedMotionHint',
              'Disables animations and transitions across the interface.',
            )}
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
            value={fontScale}
            onChange={(e) => updatePrefs({ fontScale: parseInt(e.target.value, 10) })}
            style={{ flex: 1, accentColor: 'var(--primary)' }}
            title={t('settings.fontScale', 'Font size scale')}
          />
          <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', minWidth: 40 }}>
            {fontScale}%
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
          checked={analyticsOptIn}
          onChange={(e) => updatePrefs({ analyticsOptIn: e.target.checked })}
          style={{ accentColor: 'var(--primary)' }}
        />
        <div>
          <div style={labelStyle}>{t('settings.analytics', 'Anonymous analytics')}</div>
          <div style={hintStyle}>
            {t(
              'settings.analyticsHint',
              'Help improve ChainSolve by sending anonymous usage data.',
            )}
          </div>
        </div>
      </label>

      {/* Crash reporting */}
      <label style={rowStyle}>
        <input
          type="checkbox"
          checked={crashReportingOptIn}
          onChange={(e) => updatePrefs({ crashReportingOptIn: e.target.checked })}
          style={{ accentColor: 'var(--primary)' }}
        />
        <div>
          <div style={labelStyle}>{t('settings.crashReporting', 'Crash reporting')}</div>
          <div style={hintStyle}>
            {t(
              'settings.crashReportingHint',
              'Automatically send crash reports to help us fix bugs faster.',
            )}
          </div>
        </div>
      </label>

      {/* 6.08: AI opt-out */}
      <label style={rowStyle}>
        <input
          type="checkbox"
          checked={aiOptOut}
          onChange={(e) => updatePrefs({ aiOptOut: e.target.checked })}
          style={{ accentColor: 'var(--primary)' }}
        />
        <div>
          <div style={labelStyle}>{t('settings.aiOptOut', 'Opt out of ChainSolve AI')}</div>
          <div style={hintStyle}>
            {t(
              'settings.aiOptOutHint',
              'When enabled, no canvas data is sent to external AI services. The ChainSolve AI panel will be disabled.',
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
