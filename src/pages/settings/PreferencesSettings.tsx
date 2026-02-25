import { useTranslation } from 'react-i18next'
import { Select } from '../../components/ui/Select'
import { SUPPORTED_LANGUAGES } from '../../i18n/config'

export function PreferencesSettings() {
  const { t, i18n } = useTranslation()

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
