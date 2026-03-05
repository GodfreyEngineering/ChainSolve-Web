import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { SUPPORTED_LANGUAGES } from '../../i18n/config'
import { BUILD_VERSION, BUILD_SHA, BUILD_TIME, BUILD_ENV } from '../../lib/build-info'
const LazyFeedbackModal = lazy(() =>
  import('../../components/FeedbackModal').then((m) => ({ default: m.FeedbackModal })),
)
import { UpgradeModal } from '../../components/UpgradeModal'
import { useTheme } from '../../contexts/ThemeContext'
import type { ThemeMode } from '../../contexts/ThemeContext'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { useCustomThemesStore } from '../../stores/customThemesStore'
import { useWindowManager } from '../../contexts/WindowManagerContext'
import { THEME_WIZARD_WINDOW_ID, THEME_LIBRARY_WINDOW_ID } from '../../components/windowIds'
import { getEntitlements, type Plan } from '../../lib/entitlements'
import { HelpLink } from '../../components/ui/HelpLink'
import type { AppTab } from '../../contexts/SettingsModalContext'

const LazyThemeWizard = lazy(() =>
  import('../../components/ThemeWizard').then((m) => ({ default: m.ThemeWizard })),
)

const LazyThemeLibraryWindow = lazy(() =>
  import('../../components/ThemeLibraryWindow').then((m) => ({
    default: m.ThemeLibraryWindow,
  })),
)

interface Props {
  plan?: Plan
  tab?: AppTab
}

export function PreferencesSettings({ plan = 'free', tab = 'general' }: Props) {
  const { t, i18n } = useTranslation()
  const { mode, setMode } = useTheme()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<'bug' | 'suggestion' | 'block_request'>('bug')
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const prefs = usePreferencesStore()
  const { themes, activeThemeId, activateTheme, deleteTheme } = useCustomThemesStore()
  const { openWindow, isOpen } = useWindowManager()
  const wizardOpen = isOpen(THEME_WIZARD_WINDOW_ID)
  const libraryOpen = isOpen(THEME_LIBRARY_WINDOW_ID)
  const canTheme = getEntitlements(plan).canEditThemes

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

  const handleOpenWizard = () => {
    if (!canTheme) {
      setUpgradeOpen(true)
      return
    }
    openWindow(THEME_WIZARD_WINDOW_ID, { width: 900, height: 600 })
  }

  const handleOpenLibrary = () => {
    if (!canTheme) {
      setUpgradeOpen(true)
      return
    }
    openWindow(THEME_LIBRARY_WINDOW_ID, { width: 560, height: 480 })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <h2 style={headingStyle}>{t(`settings.tab_${tab}`)}</h2>
        <HelpLink section="onboarding" />
      </div>
      <p style={sectionDescStyle}>{t(`settings.tab_${tab}Desc`)}</p>

      {/* ── General ──────────────────────────────────────────────────────── */}
      {tab === 'general' && (
        <>
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <Select
                label={t('settings.languageLabel')}
                hint={t('settings.languageHint')}
                value={i18n.language.slice(0, 2)}
                options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                onChange={(e) => void i18n.changeLanguage(e.target.value)}
              />
            </div>
          </div>

          <h3 style={subheadingStyle}>{t('settings.autosaveTitle')}</h3>
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
                  <span style={checkLabelStyle}>{t('settings.autosaveEnable')}</span>
                  <span style={checkHintStyle}>{t('settings.autosaveEnableHint')}</span>
                </div>
              </label>

              {prefs.autosaveEnabled && (
                <Select
                  label={t('settings.autosaveDelay')}
                  options={[
                    { value: '1000', label: t('settings.seconds', { count: 1 }) },
                    { value: '2000', label: t('settings.seconds', { count: 2 }) },
                    { value: '5000', label: t('settings.seconds', { count: 5 }) },
                    { value: '10000', label: t('settings.seconds', { count: 10 }) },
                  ]}
                  value={String(prefs.autosaveDelayMs)}
                  onChange={(e) => prefs.update({ autosaveDelayMs: parseInt(e.target.value) })}
                />
              )}
            </div>
          </div>

          <h3 style={subheadingStyle}>{t('settings.exportTitle')}</h3>
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Select
                label={t('settings.exportFormat')}
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
                  <span style={checkLabelStyle}>{t('settings.exportImages')}</span>
                  <span style={checkHintStyle}>{t('settings.exportImagesHint')}</span>
                </div>
              </label>
            </div>
          </div>

          {/* Build info */}
          <h3 style={subheadingStyle}>{t('settings.buildInfo')}</h3>
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

          {/* Feedback */}
          <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFeedbackType('bug')
                setFeedbackOpen(true)
              }}
            >
              {t('settings.reportBug')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFeedbackType('suggestion')
                setFeedbackOpen(true)
              }}
            >
              {t('settings.suggest')}
            </Button>
          </div>
        </>
      )}

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      {tab === 'canvas' && (
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
                <span style={checkLabelStyle}>{t('settings.snapToGrid')}</span>
                <span style={checkHintStyle}>{t('settings.snapToGridHint')}</span>
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
                <span style={checkLabelStyle}>{t('settings.animatedChains')}</span>
                <span style={checkHintStyle}>{t('settings.animatedChainsHint')}</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* ── Values & Units ───────────────────────────────────────────────── */}
      {tab === 'values' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Select
              label={t('settings.decimalPlaces')}
              hint={t('settings.decimalPlacesHint')}
              options={[
                { value: '-1', label: t('settings.decimalAuto') },
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
              label={t('settings.sciNotation')}
              hint={t('settings.sciNotationHint')}
              options={[
                { value: '1000', label: '1,000' },
                { value: '10000', label: '10,000' },
                { value: '100000', label: '100,000' },
                { value: '1000000', label: t('settings.sciDefault') },
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
                <span style={checkLabelStyle}>{t('settings.thousandsSep')}</span>
                <span style={checkHintStyle}>{t('settings.thousandsSepHint')}</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* ── Performance ──────────────────────────────────────────────────── */}
      {tab === 'performance' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <label style={checkRowStyle}>
              <input
                type="checkbox"
                checked={prefs.defaultLod}
                onChange={(e) => prefs.update({ defaultLod: e.target.checked })}
                style={checkboxStyle}
              />
              <div>
                <span style={checkLabelStyle}>{t('settings.lodRendering')}</span>
                <span style={checkHintStyle}>{t('settings.lodRenderingHint')}</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* ── Theme ────────────────────────────────────────────────────────── */}
      {tab === 'theme' && (
        <>
          <div style={cardStyle}>
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

          <h3 style={subheadingStyle}>
            {t('settings.themeWizardTitle')}
            {!canTheme && <span style={proBadgeStyle}>PRO</span>}
          </h3>

          <div style={cardStyle}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', opacity: 0.6 }}>
              {t('settings.themeWizardDesc')}
            </p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="primary" size="sm" onClick={handleOpenWizard}>
                {t('settings.createTheme')}
              </Button>
              {themes.length > 0 && (
                <Button variant="secondary" size="sm" onClick={handleOpenLibrary}>
                  {t('settings.themeLibraryTitle')}
                </Button>
              )}
            </div>

            {themes.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {t('settings.savedThemes')}
                </div>
                {themes.map((th) => (
                  <div key={th.id} style={themeRowStyle}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: th.variables['--primary'] ?? 'var(--primary)',
                          border: '1px solid var(--border)',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: '0.82rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {th.name}
                      </span>
                      {activeThemeId === th.id && (
                        <span style={activeBadgeStyle}>{t('settings.activeThemeBadge')}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                      {activeThemeId === th.id ? (
                        <Button variant="secondary" size="sm" onClick={() => activateTheme(null)}>
                          {t('settings.deactivateTheme')}
                        </Button>
                      ) : (
                        <Button variant="primary" size="sm" onClick={() => activateTheme(th.id)}>
                          {t('settings.applyTheme')}
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => deleteTheme(th.id)}>
                        {t('settings.deleteTheme')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modals (always mounted) ──────────────────────────────────────── */}
      <Suspense fallback={null}>
        {feedbackOpen && (
          <LazyFeedbackModal
            open={feedbackOpen}
            onClose={() => setFeedbackOpen(false)}
            initialType={feedbackType}
          />
        )}
      </Suspense>
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="feature_locked"
      />

      {wizardOpen && (
        <Suspense fallback={null}>
          <LazyThemeWizard />
        </Suspense>
      )}
      {libraryOpen && (
        <Suspense fallback={null}>
          <LazyThemeLibraryWindow plan={plan} />
        </Suspense>
      )}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  margin: '0 0 0.25rem',
  fontSize: '1.15rem',
  fontWeight: 700,
}

const sectionDescStyle: React.CSSProperties = {
  margin: '0 0 1.5rem',
  fontSize: '0.82rem',
  opacity: 0.5,
  lineHeight: 1.5,
}

const subheadingStyle: React.CSSProperties = {
  margin: '2rem 0 1rem',
  fontSize: '0.95rem',
  fontWeight: 600,
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.5rem',
  background: 'var(--surface-2)',
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

const proBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: '0.5rem',
  padding: '0.1rem 0.4rem',
  borderRadius: 4,
  fontSize: '0.6rem',
  fontWeight: 700,
  background: 'rgba(28,171,176,0.15)',
  color: 'var(--primary)',
  verticalAlign: 'middle',
}

const themeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.5rem 0',
  borderBottom: '1px solid var(--border)',
  gap: '0.5rem',
}

const activeBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.05rem 0.35rem',
  borderRadius: 4,
  fontSize: '0.6rem',
  fontWeight: 700,
  background: 'rgba(34,197,94,0.15)',
  color: 'var(--success)',
  flexShrink: 0,
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
