/**
 * ThemeWizard.tsx — D8-2 full theme editor with live preview.
 *
 * Opens as an AppWindow via the WindowManager.  Left pane shows a live
 * sample graph preview; right pane has grouped color editors.
 *
 * Pro-only: gating is enforced at the call site (PreferencesSettings).
 */

import { memo, useCallback, useMemo, useState } from 'react'
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

export const THEME_WIZARD_WINDOW_ID = 'theme-wizard'

// ── Sample graph SVG for live preview ────────────────────────────────────────

function SamplePreview({ variables }: { variables: Record<string, string> }) {
  const bg = variables['--bg'] ?? '#1a1a1a'
  const cardBg = variables['--node-bg'] ?? variables['--card-bg'] ?? '#383838'
  const headerBg = variables['--node-header-bg'] ?? 'rgba(28,171,176,0.15)'
  const border = variables['--node-border'] ?? 'rgba(255,255,255,0.12)'
  const primary = variables['--primary'] ?? '#1cabb0'
  const text = variables['--text'] ?? '#f4f4f3'
  const textMuted = variables['--text-muted'] ?? 'rgba(244,244,243,0.65)'
  const handleIn = variables['--handle-input'] ?? primary
  const handleOut = variables['--handle-output'] ?? variables['--success'] ?? '#22c55e'
  const edgeColor = variables['--edge-color'] ?? primary
  const selectedBorder = variables['--node-selected-border'] ?? primary

  return (
    <svg
      viewBox="0 0 400 280"
      style={{ width: '100%', height: '100%', borderRadius: 8 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Canvas background */}
      <rect width="400" height="280" fill={bg} rx="8" />

      {/* Grid dots */}
      {Array.from({ length: 10 }, (_, i) =>
        Array.from({ length: 7 }, (_, j) => (
          <circle
            key={`${i}-${j}`}
            cx={20 + i * 40}
            cy={20 + j * 40}
            r="1"
            fill={textMuted}
            opacity="0.3"
          />
        )),
      )}

      {/* Edge: Node A → Node B */}
      <path
        d={`M 165 100 C 220 100 230 170 285 170`}
        fill="none"
        stroke={edgeColor}
        strokeWidth="2"
        opacity="0.7"
      />

      {/* Node A (source) */}
      <g>
        <rect x="40" y="70" width="130" height="60" rx="8" fill={cardBg} stroke={border} />
        <rect x="40" y="70" width="130" height="22" rx="8" fill={headerBg} />
        <rect x="40" y="84" width="130" height="1" fill={border} />
        <text x="52" y="86" fontSize="8" fontWeight="700" fill={text} fontFamily="sans-serif">
          NUMBER
        </text>
        <text x="148" y="86" fontSize="8" fill={primary} fontFamily="monospace" textAnchor="end">
          42
        </text>
        <text x="52" y="112" fontSize="8" fill={textMuted} fontFamily="sans-serif">
          value
        </text>
        <text x="148" y="112" fontSize="9" fill={primary} fontFamily="monospace" textAnchor="end">
          42
        </text>
        {/* Output handle */}
        <circle cx="170" cy="100" r="5" fill={handleOut} stroke={cardBg} strokeWidth="2" />
      </g>

      {/* Node B (selected) */}
      <g>
        <rect
          x="280"
          y="140"
          width="100"
          height="70"
          rx="8"
          fill={cardBg}
          stroke={selectedBorder}
          strokeWidth="1.5"
        />
        <rect x="280" y="140" width="100" height="22" rx="8" fill={headerBg} />
        <rect x="280" y="154" width="100" height="1" fill={border} />
        <text x="292" y="156" fontSize="8" fontWeight="700" fill={text} fontFamily="sans-serif">
          DISPLAY
        </text>
        <text
          x="330"
          y="186"
          fontSize="14"
          fontWeight="700"
          fill={primary}
          fontFamily="monospace"
          textAnchor="middle"
        >
          42
        </text>
        {/* Input handle */}
        <circle cx="280" cy="170" r="5" fill={handleIn} stroke={cardBg} strokeWidth="2" />
      </g>

      {/* Node C (small, bottom-left) */}
      <g>
        <rect x="60" y="190" width="110" height="50" rx="8" fill={cardBg} stroke={border} />
        <rect x="60" y="190" width="110" height="22" rx="8" fill={headerBg} />
        <rect x="60" y="204" width="110" height="1" fill={border} />
        <text x="72" y="206" fontSize="8" fontWeight="700" fill={text} fontFamily="sans-serif">
          ADD
        </text>
        <text x="72" y="226" fontSize="7" fill={textMuted} fontFamily="sans-serif">
          a, b
        </text>
        <circle cx="60" cy="215" r="4" fill={handleIn} stroke={cardBg} strokeWidth="2" />
        <circle cx="170" cy="215" r="4" fill={handleOut} stroke={cardBg} strokeWidth="2" />
      </g>
    </svg>
  )
}

// ── Color picker row ─────────────────────────────────────────────────────────

function ColorRow({
  label,
  cssVar,
  value,
  onChange,
}: {
  label: string
  cssVar: string
  value: string
  onChange: (cssVar: string, val: string) => void
}) {
  // For rgba() values, show a text input; for hex, show color picker
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value)
  return (
    <div style={colorRowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '0.65rem', opacity: 0.4, fontFamily: 'monospace' }}>{cssVar}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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

  const handlePreset = useCallback((preset: (typeof BUILT_IN_PRESETS)[number]) => {
    const base = preset.baseMode === 'light' ? LIGHT_DEFAULTS : DARK_DEFAULTS
    setBaseMode(preset.baseMode)
    setName(preset.name)
    setVariables({ ...base, ...preset.variables })
  }, [])

  const grouped = useMemo(() => {
    const groups: Record<ThemeVarCategory, typeof THEME_VARIABLE_META> = {
      background: [],
      text: [],
      accent: [],
      node: [],
      edge: [],
    }
    for (const meta of THEME_VARIABLE_META) {
      groups[meta.category].push(meta)
    }
    return groups
  }, [])

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
        {/* ── Left: live preview ──────────────────────────────────────── */}
        <div style={previewPaneStyle}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {t('settings.themePreview')}
          </div>
          <SamplePreview variables={variables} />

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

        {/* ── Right: editor ──────────────────────────────────────────── */}
        <div style={editorPaneStyle}>
          {/* Name + base mode */}
          <div style={{ marginBottom: '1rem' }}>
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

          {/* Color groups */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {(Object.entries(grouped) as [ThemeVarCategory, typeof THEME_VARIABLE_META][]).map(
              ([cat, metas]) => (
                <div key={cat} style={{ marginBottom: '1rem' }}>
                  <div style={categoryHeadingStyle}>{THEME_CATEGORY_LABELS[cat]}</div>
                  {metas.map((m) => (
                    <ColorRow
                      key={m.cssVar}
                      label={m.label}
                      cssVar={m.cssVar}
                      value={variables[m.cssVar] ?? ''}
                      onChange={handleVarChange}
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
  flex: '0 0 340px',
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
  padding: '0.3rem 0',
  gap: '0.5rem',
}

const colorTextInputStyle: React.CSSProperties = {
  width: 120,
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
