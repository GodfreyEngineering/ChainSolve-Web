import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { SUPPORTED_LANGUAGES } from '../../i18n/config'
import { BUILD_VERSION, BUILD_SHA, BUILD_TIME, BUILD_ENV } from '../../lib/build-info'
import { BugReportModal } from '../../components/BugReportModal'

export function PreferencesSettings() {
  const { t, i18n } = useTranslation()
  const [bugOpen, setBugOpen] = useState(false)

  const buildDate = (() => {
    try {
      return new Date(BUILD_TIME).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return BUILD_TIME
    }
  })()

  return (
    <div>
      <h2 style={headingStyle}>{t('settings.preferences')}</h2>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Select
            label={t('settings.languageLabel')}
            hint={t('settings.languageHint')}
            value={i18n.language.slice(0, 2)}
            options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            onChange={(e) => void i18n.changeLanguage(e.target.value)}
          />

          <Select
            label={t('settings.themeLabel')}
            options={[
              { value: 'dark', label: t('settings.themeDark') },
              { value: 'light', label: t('settings.themeLight') },
            ]}
            value="dark"
            disabled
          />
        </div>
      </div>

      {/* ── Build info ──────────────────────────────────────────────────── */}
      <h2 style={{ ...headingStyle, marginTop: '2rem' }}>{t('settings.buildInfo')}</h2>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={infoRowStyle}>
            <span style={infoLabel}>{t('settings.version')}</span>
            <span style={monoStyle}>v{BUILD_VERSION}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabel}>{t('settings.commitSha')}</span>
            <span style={monoStyle}>{BUILD_SHA}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabel}>{t('settings.buildDate')}</span>
            <span style={monoStyle}>{buildDate}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabel}>{t('settings.environment')}</span>
            <span style={envBadgeStyle(BUILD_ENV)}>{BUILD_ENV}</span>
          </div>
        </div>
      </div>

      {/* ── Bug report ────────────────────────────────────────────────── */}
      <div style={{ marginTop: '2rem' }}>
        <Button variant="secondary" size="sm" onClick={() => setBugOpen(true)}>
          {t('settings.reportBug')}
        </Button>
      </div>

      <BugReportModal open={bugOpen} onClose={() => setBugOpen(false)} />
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

const infoRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const infoLabel: React.CSSProperties = {
  fontSize: '0.85rem',
  opacity: 0.6,
}

const monoStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.82rem',
  opacity: 0.8,
}

const ENV_COLORS: Record<string, string> = {
  production: '#22c55e',
  development: '#3b82f6',
}

function envBadgeStyle(env: string): React.CSSProperties {
  const color = ENV_COLORS[env] ?? '#f59e0b'
  return {
    display: 'inline-block',
    padding: '0.15rem 0.6rem',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 700,
    background: `${color}22`,
    color,
    border: `1px solid ${color}44`,
  }
}
