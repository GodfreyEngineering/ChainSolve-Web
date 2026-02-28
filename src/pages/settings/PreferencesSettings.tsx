import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { SUPPORTED_LANGUAGES } from '../../i18n/config'
import { BUILD_VERSION, BUILD_SHA, BUILD_TIME, BUILD_ENV } from '../../lib/build-info'
import { BugReportModal } from '../../components/BugReportModal'
import { useTheme } from '../../contexts/ThemeContext'
import type { ThemeMode } from '../../contexts/ThemeContext'
import { usePreferencesStore } from '../../stores/preferencesStore'

export function PreferencesSettings() {
  const { t, i18n } = useTranslation()
  const { mode, setMode } = useTheme()
  const [bugOpen, setBugOpen] = useState(false)
  const prefs = usePreferencesStore()

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
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'dark', label: t('settings.themeDark') },
              { value: 'light', label: t('settings.themeLight') },
            ]}
            value={mode}
            onChange={(e) => setMode(e.target.value as ThemeMode)}
          />
        </div>
      </div>

      {/* ── Autosave ───────────────────────────────────────────────────── */}
      <h2 style={{ ...headingStyle, marginTop: '2rem' }}>Autosave</h2>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={prefs.autosaveEnabled}
              onChange={(e) => prefs.update({ autosaveEnabled: e.target.checked })}
              style={checkboxStyle}
            />
            <div>
              <span style={checkLabelStyle}>Enable autosave</span>
              <span style={checkHintStyle}>Automatically save changes after editing</span>
            </div>
          </label>

          {prefs.autosaveEnabled && (
            <Select
              label="Autosave delay"
              options={[
                { value: '1000', label: '1 second' },
                { value: '2000', label: '2 seconds' },
                { value: '5000', label: '5 seconds' },
                { value: '10000', label: '10 seconds' },
              ]}
              value={String(prefs.autosaveDelayMs)}
              onChange={(e) => prefs.update({ autosaveDelayMs: parseInt(e.target.value) })}
            />
          )}
        </div>
      </div>

      {/* ── Numeric formatting ────────────────────────────────────────── */}
      <h2 style={{ ...headingStyle, marginTop: '2rem' }}>Numeric Formatting</h2>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Select
            label="Decimal places"
            hint="Number of decimal places displayed for values"
            options={[
              { value: '-1', label: 'Auto (smart precision)' },
              { value: '0', label: '0' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
              { value: '6', label: '6' },
              { value: '8', label: '8' },
            ]}
            value={String(prefs.decimalPlaces)}
            onChange={(e) => prefs.update({ decimalPlaces: parseInt(e.target.value) })}
          />

          <Select
            label="Scientific notation threshold"
            hint="Values above this magnitude use scientific notation"
            options={[
              { value: '1000', label: '1,000' },
              { value: '10000', label: '10,000' },
              { value: '100000', label: '100,000' },
              { value: '1000000', label: '1,000,000 (default)' },
              { value: '1000000000', label: '1,000,000,000' },
            ]}
            value={String(prefs.scientificNotationThreshold)}
            onChange={(e) =>
              prefs.update({ scientificNotationThreshold: parseFloat(e.target.value) })
            }
          />

          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={prefs.thousandsSeparator}
              onChange={(e) => prefs.update({ thousandsSeparator: e.target.checked })}
              style={checkboxStyle}
            />
            <div>
              <span style={checkLabelStyle}>Thousands separator</span>
              <span style={checkHintStyle}>Display commas in large numbers (1,000,000)</span>
            </div>
          </label>
        </div>
      </div>

      {/* ── Canvas defaults ────────────────────────────────────────────── */}
      <h2 style={{ ...headingStyle, marginTop: '2rem' }}>Canvas Defaults</h2>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={prefs.defaultSnapToGrid}
              onChange={(e) => prefs.update({ defaultSnapToGrid: e.target.checked })}
              style={checkboxStyle}
            />
            <div>
              <span style={checkLabelStyle}>Snap to grid</span>
              <span style={checkHintStyle}>Enable grid snapping by default on new canvases</span>
            </div>
          </label>

          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={prefs.defaultEdgeAnimation}
              onChange={(e) => prefs.update({ defaultEdgeAnimation: e.target.checked })}
              style={checkboxStyle}
            />
            <div>
              <span style={checkLabelStyle}>Animated edges</span>
              <span style={checkHintStyle}>Show flowing animation on connections</span>
            </div>
          </label>

          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={prefs.defaultLod}
              onChange={(e) => prefs.update({ defaultLod: e.target.checked })}
              style={checkboxStyle}
            />
            <div>
              <span style={checkLabelStyle}>Level-of-detail rendering</span>
              <span style={checkHintStyle}>Simplify nodes at low zoom for performance</span>
            </div>
          </label>
        </div>
      </div>

      {/* ── Export defaults ─────────────────────────────────────────────── */}
      <h2 style={{ ...headingStyle, marginTop: '2rem' }}>Export Defaults</h2>

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Select
            label="Default export format"
            options={[
              { value: 'pdf', label: 'PDF' },
              { value: 'xlsx', label: 'Excel (XLSX)' },
            ]}
            value={prefs.defaultExportFormat}
            onChange={(e) =>
              prefs.update({ defaultExportFormat: e.target.value as 'pdf' | 'xlsx' })
            }
          />

          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={prefs.exportIncludeImages}
              onChange={(e) => prefs.update({ exportIncludeImages: e.target.checked })}
              style={checkboxStyle}
            />
            <div>
              <span style={checkLabelStyle}>Include canvas images in exports</span>
              <span style={checkHintStyle}>
                Capture and embed canvas screenshots in PDF exports
              </span>
            </div>
          </label>
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

const checkRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.6rem',
  cursor: 'pointer',
}

const checkboxStyle: React.CSSProperties = {
  marginTop: '0.15rem',
  accentColor: 'var(--primary)',
  cursor: 'pointer',
}

const checkLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
}

const checkHintStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  opacity: 0.45,
  marginTop: '0.1rem',
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
