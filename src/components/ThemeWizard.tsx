/**
 * ThemeWizard.tsx -- V3-4.1 full theme editor with enhanced live preview.
 *
 * Opens as an AppWindow via the WindowManager. Left pane shows a live
 * mini-canvas preview (ThemePreview) with click-to-edit; right pane has
 * grouped color editors with search/filter, "Modified" badges, and
 * per-variable reset buttons.
 *
 * Pro-only: gating is enforced at the call site (PreferencesSettings).
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppWindow } from './ui/AppWindow'
import { Button } from './ui/Button'
import { useWindowManager } from '../contexts/WindowManagerContext'
import { useCustomThemesStore } from '../stores/customThemesStore'
import {
  THEME_VARIABLE_META,
  THEME_CATEGORY_LABELS,
  DARK_DEFAULTS,
  LIGHT_DEFAULTS,
  BUILT_IN_PRESETS,
  validateThemeName,
  type ThemeVarCategory,
  type CustomTheme,
} from '../lib/customThemes'
import { useTheme } from '../contexts/ThemeContext'
import { ThemePreview } from './ThemePreview'

export const THEME_WIZARD_WINDOW_ID = 'theme-wizard'

// ── Color picker row ─────────────────────────────────────────────────────────

function ColorRow({
  label,
  cssVar,
  value,
  isModified,
  isHighlighted,
  onChange,
  onReset,
}: {
  label: string
  cssVar: string
  value: string
  isModified: boolean
  isHighlighted: boolean
  onChange: (cssVar: string, val: string) => void
  onReset: (cssVar: string) => void
}) {
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value)
  return (
    <div
      style={{
        ...colorRowStyle,
        background: isHighlighted ? 'rgba(28,171,176,0.12)' : undefined,
        borderLeft: isHighlighted ? '2px solid var(--primary)' : '2px solid transparent',
        paddingLeft: isHighlighted ? '0.4rem' : '0.3rem',
        transition: 'background 0.2s, border-left 0.2s',
      }}
      data-css-var={cssVar}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>{label}</span>
          {isModified && <span style={modifiedBadgeStyle}>Modified</span>}
        </div>
        <div style={{ fontSize: '0.65rem', opacity: 0.4, fontFamily: 'monospace' }}>{cssVar}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        {isHex && (
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(cssVar, e.target.value)}
            style={{
              width: 28,
              height: 28,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(cssVar, e.target.value)}
          style={colorTextInputStyle}
        />
        {isModified && (
          <button
            onClick={() => onReset(cssVar)}
            style={resetBtnStyle}
            title="Reset to default"
            aria-label={`Reset ${cssVar}`}
          >
            x
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main wizard component ────────────────────────────────────────────────────

function ThemeWizardInner({ editTheme }: { editTheme?: CustomTheme }) {
  const { t } = useTranslation()
  const { closeWindow } = useWindowManager()
  const { resolved } = useTheme()
  const { addTheme, updateTheme } = useCustomThemesStore()

  const defaults = resolved === 'light' ? LIGHT_DEFAULTS : DARK_DEFAULTS

  const [name, setName] = useState(editTheme?.name ?? '')
  const [baseMode, setBaseMode] = useState<'dark' | 'light'>(editTheme?.baseMode ?? resolved)
  const [variables, setVariables] = useState<Record<string, string>>(() => {
    if (editTheme) return { ...defaults, ...editTheme.variables }
    return { ...defaults }
  })
  const [nameError, setNameError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [highlightedVar, setHighlightedVar] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const currentDefaults = useMemo(
    () => (baseMode === 'light' ? LIGHT_DEFAULTS : DARK_DEFAULTS),
    [baseMode],
  )

  const switchBaseMode = useCallback(
    (next: 'dark' | 'light') => {
      setBaseMode(next)
      if (!editTheme) {
        setVariables(next === 'light' ? { ...LIGHT_DEFAULTS } : { ...DARK_DEFAULTS })
      }
    },
    [editTheme],
  )

  const handleVarChange = useCallback((cssVar: string, value: string) => {
    setVariables((prev) => ({ ...prev, [cssVar]: value }))
  }, [])

  const handleReset = useCallback(
    (cssVar: string) => {
      setVariables((prev) => ({ ...prev, [cssVar]: currentDefaults[cssVar] ?? '' }))
    },
    [currentDefaults],
  )

  const handlePreset = useCallback((preset: (typeof BUILT_IN_PRESETS)[number]) => {
    const base = preset.baseMode === 'light' ? LIGHT_DEFAULTS : DARK_DEFAULTS
    setBaseMode(preset.baseMode)
    setName(preset.name)
    setVariables({ ...base, ...preset.variables })
  }, [])

  // Click-to-edit: scroll to and highlight variable row
  const handlePreviewClick = useCallback((cssVar: string) => {
    setHighlightedVar(cssVar)
    setSearch('') // Clear search so the variable is visible
    // Scroll to the row after render
    requestAnimationFrame(() => {
      const el = editorRef.current?.querySelector(`[data-css-var="${cssVar}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  // Clear highlight after 3 seconds
  useEffect(() => {
    if (!highlightedVar) return
    const timer = setTimeout(() => setHighlightedVar(null), 3000)
    return () => clearTimeout(timer)
  }, [highlightedVar])

  const grouped = useMemo(() => {
    const groups: Record<ThemeVarCategory, typeof THEME_VARIABLE_META> = {
      background: [],
      text: [],
      accent: [],
      ui: [],
      node: [],
      edge: [],
      surface: [],
      nodeType: [],
    }
    const lowerSearch = search.toLowerCase()
    for (const meta of THEME_VARIABLE_META) {
      if (
        lowerSearch &&
        !meta.label.toLowerCase().includes(lowerSearch) &&
        !meta.cssVar.toLowerCase().includes(lowerSearch)
      ) {
        continue
      }
      groups[meta.category].push(meta)
    }
    return groups
  }, [search])

  const modifiedCount = useMemo(() => {
    let count = 0
    for (const meta of THEME_VARIABLE_META) {
      if (variables[meta.cssVar] !== currentDefaults[meta.cssVar]) count++
    }
    return count
  }, [variables, currentDefaults])

  const handleSave = useCallback(() => {
    const v = validateThemeName(name)
    if (!v.ok) {
      setNameError(v.error ?? 'Invalid name')
      return
    }
    setNameError(null)

    // Compute only the variables that differ from defaults
    const base = baseMode === 'light' ? LIGHT_DEFAULTS : DARK_DEFAULTS
    const overrides: Record<string, string> = {}
    for (const [k, val] of Object.entries(variables)) {
      if (val !== base[k]) overrides[k] = val
    }

    if (editTheme) {
      updateTheme(editTheme.id, { name: name.trim(), variables: overrides, baseMode })
    } else {
      addTheme({ name: name.trim(), variables: overrides, baseMode }, true)
    }

    closeWindow(THEME_WIZARD_WINDOW_ID)
  }, [name, variables, baseMode, editTheme, addTheme, updateTheme, closeWindow])

  return (
    <AppWindow
      windowId={THEME_WIZARD_WINDOW_ID}
      title={editTheme ? t('settings.editTheme') : t('settings.themeWizardTitle')}
    >
      <div style={wizardLayoutStyle}>
        {/* -- Left: live preview ---------------------------------- */}
        <div style={previewPaneStyle}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {t('settings.themePreview')}
          </div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', opacity: 0.45 }}>
            {t('settings.themeClickHint')}
          </p>
          <ThemePreview
            variables={variables}
            onClickVar={handlePreviewClick}
            highlightedVar={highlightedVar}
          />

          {/* Presets */}
          <div style={{ marginTop: '0.75rem' }}>
            <div
              style={{ fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.4rem', opacity: 0.6 }}
            >
              {t('settings.themePresets')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {BUILT_IN_PRESETS.map((p) => (
                <button key={p.name} onClick={() => handlePreset(p)} style={presetBtnStyle}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: p.variables['--primary'] ?? '#1cabb0',
                      marginRight: 4,
                    }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* -- Right: editor --------------------------------------- */}
        <div style={editorPaneStyle}>
          {/* Name + base mode */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 600,
                marginBottom: '0.3rem',
              }}
            >
              {t('settings.themeName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(null)
              }}
              placeholder={t('settings.themeNamePlaceholder')}
              maxLength={64}
              style={nameInputStyle}
            />
            {nameError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                {nameError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <label style={radioLabelStyle}>
                <input
                  type="radio"
                  name="baseMode"
                  value="dark"
                  checked={baseMode === 'dark'}
                  onChange={() => switchBaseMode('dark')}
                  style={{ accentColor: 'var(--primary)' }}
                />
                {t('settings.themeDark')}
              </label>
              <label style={radioLabelStyle}>
                <input
                  type="radio"
                  name="baseMode"
                  value="light"
                  checked={baseMode === 'light'}
                  onChange={() => switchBaseMode('light')}
                  style={{ accentColor: 'var(--primary)' }}
                />
                {t('settings.themeLight')}
              </label>
            </div>
          </div>

          {/* Search / filter */}
          <div
            style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('settings.themeSearchPlaceholder')}
              style={searchInputStyle}
            />
            {modifiedCount > 0 && (
              <span style={modifiedCountStyle}>
                {modifiedCount} {t('settings.themeModified')}
              </span>
            )}
          </div>

          {/* Color groups */}
          <div ref={editorRef} style={{ flex: 1, overflow: 'auto' }}>
            {(Object.entries(grouped) as [ThemeVarCategory, typeof THEME_VARIABLE_META][]).map(
              ([cat, metas]) =>
                metas.length > 0 && (
                  <div key={cat} style={{ marginBottom: '1rem' }}>
                    <div style={categoryHeadingStyle}>{THEME_CATEGORY_LABELS[cat]}</div>
                    {metas.map((m) => (
                      <ColorRow
                        key={m.cssVar}
                        label={m.label}
                        cssVar={m.cssVar}
                        value={variables[m.cssVar] ?? ''}
                        isModified={variables[m.cssVar] !== currentDefaults[m.cssVar]}
                        isHighlighted={highlightedVar === m.cssVar}
                        onChange={handleVarChange}
                        onReset={handleReset}
                      />
                    ))}
                  </div>
                ),
            )}
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <Button variant="primary" size="sm" onClick={handleSave}>
              {editTheme ? t('settings.saveTheme') : t('settings.createTheme')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => closeWindow(THEME_WIZARD_WINDOW_ID)}
            >
              {t('settings.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </AppWindow>
  )
}

export const ThemeWizard = memo(ThemeWizardInner)

// ── Styles ───────────────────────────────────────────────────────────────────

const wizardLayoutStyle: React.CSSProperties = {
  display: 'flex',
  height: '100%',
  gap: '1rem',
  padding: '1rem',
  overflow: 'hidden',
}

const previewPaneStyle: React.CSSProperties = {
  flex: '0 0 380px',
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid var(--border)',
  paddingRight: '1rem',
}

const editorPaneStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const colorRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.3rem 0.3rem',
  gap: '0.5rem',
  borderRadius: 4,
}

const colorTextInputStyle: React.CSSProperties = {
  width: 110,
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '0.2rem 0.4rem',
  fontSize: '0.72rem',
  fontFamily: 'monospace',
  color: 'var(--text)',
}

const nameInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0.4rem 0.6rem',
  fontSize: '0.85rem',
  color: 'var(--text)',
  boxSizing: 'border-box',
}

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0.35rem 0.6rem',
  fontSize: '0.78rem',
  color: 'var(--text)',
  boxSizing: 'border-box',
}

const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  fontSize: '0.78rem',
  cursor: 'pointer',
}

const categoryHeadingStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  opacity: 0.5,
  marginBottom: '0.3rem',
}

const presetBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0.25rem 0.6rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: '0.7rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const modifiedBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0 0.3rem',
  borderRadius: 3,
  fontSize: '0.58rem',
  fontWeight: 700,
  background: 'rgba(251,191,36,0.15)',
  color: '#fbbf24',
  lineHeight: '1.4',
}

const modifiedCountStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  color: '#fbbf24',
  whiteSpace: 'nowrap',
  flexShrink: 0,
}

const resetBtnStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--surface-3)',
  color: 'var(--text-muted)',
  fontSize: '0.65rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  fontFamily: 'sans-serif',
}
