/**
 * customThemes.ts — D8-2 Theme wizard types, validation, and localStorage CRUD.
 *
 * Custom themes are CSS variable override maps applied on top of the base
 * dark/light theme.  They are persisted in localStorage and can be applied
 * or removed at any time via document.documentElement.style.setProperty().
 */

import { sanitizeThemeVariables } from './marketplaceThemeService'

// ── Types ────────────────────────────────────────────────────────────────────

export type ThemeVarCategory =
  | 'background'
  | 'surface'
  | 'text'
  | 'accent'
  | 'ui'
  | 'node'
  | 'nodeType'
  | 'edge'

export interface ThemeVarMeta {
  label: string
  category: ThemeVarCategory
  /** CSS variable name (e.g. '--primary'). */
  cssVar: string
}

/** Metadata for every editable CSS variable in the theme wizard. */
export const THEME_VARIABLE_META: ThemeVarMeta[] = [
  // Backgrounds
  { cssVar: '--bg', label: 'Background', category: 'background' },
  { cssVar: '--input-bg', label: 'Input background', category: 'background' },

  // Canvas grid
  { cssVar: '--grid-minor-color', label: 'Grid dots (minor)', category: 'background' },
  { cssVar: '--grid-major-color', label: 'Grid dots (major)', category: 'background' },

  // Surfaces (V3-UI depth layers)
  { cssVar: '--surface-0', label: 'Canvas background', category: 'surface' },
  { cssVar: '--surface-1', label: 'Panel / sidebar', category: 'surface' },
  { cssVar: '--surface-2', label: 'Card / elevated', category: 'surface' },
  { cssVar: '--surface-3', label: 'Hover / input', category: 'surface' },

  // Text
  { cssVar: '--text', label: 'Primary text', category: 'text' },
  { cssVar: '--text-muted', label: 'Muted text', category: 'text' },
  { cssVar: '--text-faint', label: 'Faint text', category: 'text' },

  // Accent
  { cssVar: '--primary', label: 'Primary accent', category: 'accent' },
  { cssVar: '--primary-dim', label: 'Primary dim', category: 'accent' },
  { cssVar: '--primary-glow', label: 'Primary glow', category: 'accent' },
  { cssVar: '--success', label: 'Success / output', category: 'accent' },
  { cssVar: '--danger', label: 'Danger / error', category: 'accent' },

  // UI components
  { cssVar: '--toolbar-bg', label: 'Toolbar background', category: 'ui' },
  { cssVar: '--tooltip-bg', label: 'Tooltip background', category: 'ui' },
  { cssVar: '--tooltip-text', label: 'Tooltip text', category: 'ui' },
  { cssVar: '--badge-bg', label: 'Badge background', category: 'ui' },
  { cssVar: '--separator', label: 'Separator line', category: 'ui' },
  { cssVar: '--menu-hover', label: 'Menu item hover', category: 'ui' },
  { cssVar: '--menu-danger-hover', label: 'Danger menu hover', category: 'ui' },
  { cssVar: '--overlay', label: 'Modal overlay', category: 'ui' },
  { cssVar: '--danger-dim', label: 'Danger background', category: 'ui' },

  // Node-specific (new variables added to index.css)
  { cssVar: '--node-bg', label: 'Node background', category: 'node' },
  { cssVar: '--node-border', label: 'Node border', category: 'node' },
  { cssVar: '--node-header-bg', label: 'Node header', category: 'node' },
  { cssVar: '--node-selected-border', label: 'Selected border', category: 'node' },
  { cssVar: '--handle-input', label: 'Input handle', category: 'node' },
  { cssVar: '--handle-output', label: 'Output handle', category: 'node' },

  // Node-type semantic colors (V3-UI)
  { cssVar: '--node-color-source', label: 'Source nodes', category: 'nodeType' },
  { cssVar: '--node-color-operation', label: 'Operation nodes', category: 'nodeType' },
  { cssVar: '--node-color-display', label: 'Display nodes', category: 'nodeType' },
  { cssVar: '--node-color-data', label: 'Data nodes', category: 'nodeType' },
  { cssVar: '--node-color-plot', label: 'Plot nodes', category: 'nodeType' },
  { cssVar: '--node-color-group', label: 'Group nodes', category: 'nodeType' },

  // Chain
  { cssVar: '--edge-color', label: 'Chain stroke', category: 'edge' },
  { cssVar: '--border', label: 'Border', category: 'edge' },
]

export const THEME_CATEGORY_LABELS: Record<ThemeVarCategory, string> = {
  background: 'Backgrounds',
  surface: 'Surfaces',
  text: 'Text',
  accent: 'Accent Colors',
  ui: 'UI Components',
  node: 'Nodes',
  nodeType: 'Node Types',
  edge: 'Chains & Borders',
}

/** A user-created custom theme. */
export interface CustomTheme {
  id: string
  name: string
  /** Which base mode the theme was designed for. */
  baseMode: 'dark' | 'light'
  /** CSS variable overrides. Keys are '--xxx'. */
  variables: Record<string, string>
  createdAt: number
  updatedAt: number
}

// ── Dark / light defaults (for the editor's initial values) ──────────────────

export const DARK_DEFAULTS: Record<string, string> = {
  '--bg': '#1a1a1a',
  '--input-bg': '#252525',
  '--grid-minor-color': 'rgba(255,255,255,0.18)',
  '--grid-major-color': 'rgba(255,255,255,0.10)',
  '--surface-0': '#1a1a1a',
  '--surface-1': '#242424',
  '--surface-2': '#2e2e2e',
  '--surface-3': '#383838',
  '--text': '#f4f4f3',
  '--text-muted': 'rgba(244,244,243,0.65)',
  '--text-faint': 'rgba(244,244,243,0.35)',
  '--primary': '#1cabb0',
  '--primary-dim': 'rgba(28,171,176,0.15)',
  '--primary-glow': 'rgba(28,171,176,0.35)',
  '--success': '#22c55e',
  '--danger': '#ef4444',
  '--toolbar-bg': '#2c2c2c',
  '--tooltip-bg': '#252525',
  '--tooltip-text': '#f4f4f3',
  '--badge-bg': 'rgba(28,171,176,0.15)',
  '--separator': 'rgba(255,255,255,0.08)',
  '--menu-hover': 'rgba(28,171,176,0.15)',
  '--menu-danger-hover': 'rgba(239,68,68,0.15)',
  '--overlay': 'rgba(0,0,0,0.6)',
  '--danger-dim': 'rgba(239,68,68,0.3)',
  '--node-bg': '#2e2e2e',
  '--node-border': 'rgba(255,255,255,0.12)',
  '--node-header-bg': 'rgba(28,171,176,0.15)',
  '--node-selected-border': '#1cabb0',
  '--handle-input': '#1cabb0',
  '--handle-output': '#22c55e',
  '--node-color-source': '#a78bfa',
  '--node-color-operation': '#1cabb0',
  '--node-color-display': '#06b6d4',
  '--node-color-data': '#f59e0b',
  '--node-color-plot': '#10b981',
  '--node-color-group': '#8b5cf6',
  '--edge-color': '#1cabb0',
  '--border': 'rgba(255,255,255,0.1)',
}

export const LIGHT_DEFAULTS: Record<string, string> = {
  '--bg': '#f5f5f4',
  '--input-bg': '#ffffff',
  '--surface-0': '#f5f5f4',
  '--surface-1': '#ffffff',
  '--surface-2': '#f8f8f7',
  '--surface-3': '#eaeae9',
  '--text': '#1a1a1a',
  '--text-muted': 'rgba(26,26,26,0.65)',
  '--text-faint': 'rgba(26,26,26,0.35)',
  '--primary': '#1cabb0',
  '--primary-dim': 'rgba(28,171,176,0.15)',
  '--primary-glow': 'rgba(28,171,176,0.35)',
  '--success': '#22c55e',
  '--danger': '#ef4444',
  '--toolbar-bg': '#eaeae9',
  '--tooltip-bg': '#1a1a1a',
  '--tooltip-text': '#f4f4f3',
  '--badge-bg': 'rgba(28,171,176,0.1)',
  '--separator': 'rgba(0,0,0,0.08)',
  '--menu-hover': 'rgba(28,171,176,0.1)',
  '--menu-danger-hover': 'rgba(239,68,68,0.1)',
  '--overlay': 'rgba(0,0,0,0.4)',
  '--danger-dim': 'rgba(239,68,68,0.15)',
  '--node-bg': '#f8f8f7',
  '--node-border': 'rgba(0,0,0,0.12)',
  '--node-header-bg': 'rgba(28,171,176,0.12)',
  '--node-selected-border': '#0f7578',
  '--handle-input': '#0f7578',
  '--handle-output': '#16a34a',
  '--node-color-source': '#7c3aed',
  '--node-color-operation': '#0f7578',
  '--node-color-display': '#0891b2',
  '--node-color-data': '#d97706',
  '--node-color-plot': '#059669',
  '--node-color-group': '#6d28d9',
  '--edge-color': '#0f7578',
  '--border': 'rgba(0,0,0,0.12)',
  '--grid-minor-color': 'rgba(0,0,0,0.12)',
  '--grid-major-color': 'rgba(0,0,0,0.06)',
}

// ── Built-in presets (starting points) ───────────────────────────────────────

export const BUILT_IN_PRESETS: {
  name: string
  baseMode: 'dark' | 'light'
  variables: Record<string, string>
}[] = [
  {
    name: 'Midnight Blue',
    baseMode: 'dark',
    variables: {
      '--bg': '#0f172a',
      '--surface-2': '#1e293b',
      '--surface2': '#1a2332',
      '--input-bg': '#0f172a',
      '--primary': '#3b82f6',
      '--primary-dim': 'rgba(59,130,246,0.15)',
      '--primary-glow': 'rgba(59,130,246,0.35)',
      '--node-bg': '#1e293b',
      '--node-border': 'rgba(148,163,184,0.15)',
      '--node-header-bg': 'rgba(59,130,246,0.15)',
      '--node-selected-border': '#3b82f6',
      '--handle-input': '#3b82f6',
      '--edge-color': '#3b82f6',
    },
  },
  {
    name: 'Warm Sunset',
    baseMode: 'dark',
    variables: {
      '--bg': '#1c1210',
      '--surface-2': '#2d1f1a',
      '--surface2': '#251815',
      '--input-bg': '#1c1210',
      '--primary': '#f97316',
      '--primary-dim': 'rgba(249,115,22,0.15)',
      '--primary-glow': 'rgba(249,115,22,0.35)',
      '--success': '#84cc16',
      '--node-bg': '#2d1f1a',
      '--node-border': 'rgba(255,200,150,0.12)',
      '--node-header-bg': 'rgba(249,115,22,0.15)',
      '--node-selected-border': '#f97316',
      '--handle-input': '#f97316',
      '--edge-color': '#f97316',
    },
  },
  {
    name: 'Forest Green',
    baseMode: 'dark',
    variables: {
      '--bg': '#0c1a0c',
      '--surface-2': '#1a2e1a',
      '--surface2': '#142414',
      '--input-bg': '#0c1a0c',
      '--primary': '#22c55e',
      '--primary-dim': 'rgba(34,197,94,0.15)',
      '--primary-glow': 'rgba(34,197,94,0.35)',
      '--node-bg': '#1a2e1a',
      '--node-border': 'rgba(134,239,172,0.12)',
      '--node-header-bg': 'rgba(34,197,94,0.15)',
      '--node-selected-border': '#22c55e',
      '--handle-input': '#22c55e',
      '--edge-color': '#22c55e',
    },
  },
  {
    name: 'Glass Panels',
    baseMode: 'dark',
    variables: {
      '--bg': '#0d1117',
      '--surface-2': 'rgba(30,40,55,0.75)',
      '--surface2': 'rgba(22,30,42,0.8)',
      '--input-bg': 'rgba(15,20,30,0.9)',
      '--primary': '#38bdf8',
      '--primary-dim': 'rgba(56,189,248,0.12)',
      '--primary-glow': 'rgba(56,189,248,0.4)',
      '--success': '#34d399',
      '--toolbar-bg': 'rgba(22,30,42,0.7)',
      '--tooltip-bg': 'rgba(15,20,30,0.95)',
      '--badge-bg': 'rgba(56,189,248,0.12)',
      '--separator': 'rgba(56,189,248,0.08)',
      '--menu-hover': 'rgba(56,189,248,0.12)',
      '--overlay': 'rgba(0,0,0,0.7)',
      '--node-bg': 'rgba(30,40,55,0.8)',
      '--node-border': 'rgba(56,189,248,0.15)',
      '--node-header-bg': 'rgba(56,189,248,0.1)',
      '--node-selected-border': '#38bdf8',
      '--handle-input': '#38bdf8',
      '--handle-output': '#34d399',
      '--edge-color': '#38bdf8',
      '--border': 'rgba(56,189,248,0.1)',
    },
  },
  {
    name: 'Clean Paper',
    baseMode: 'light',
    variables: {
      '--bg': '#fafaf9',
      '--surface-2': '#ffffff',
      '--surface2': '#f5f5f4',
      '--input-bg': '#ffffff',
      '--primary': '#0d9488',
      '--primary-dim': 'rgba(13,148,136,0.1)',
      '--primary-glow': 'rgba(13,148,136,0.25)',
      '--node-bg': '#ffffff',
      '--node-border': 'rgba(0,0,0,0.08)',
      '--node-header-bg': 'rgba(13,148,136,0.08)',
      '--node-selected-border': '#0d9488',
      '--handle-input': '#0d9488',
      '--edge-color': '#0d9488',
    },
  },
  // ── Named preset set for THEME-01 ─────────────────────────────────
  {
    name: 'Dark',
    baseMode: 'dark',
    variables: { '--primary': '#6366f1' },
  },
  {
    name: 'Light',
    baseMode: 'light',
    variables: { '--primary': '#6366f1' },
  },
  {
    name: 'Ocean Blue',
    baseMode: 'dark',
    variables: {
      '--bg': '#050d1a',
      '--input-bg': '#0a1628',
      '--surface-0': '#050d1a',
      '--surface-1': '#0a1628',
      '--surface-2': '#0e1f38',
      '--surface-3': '#142a4d',
      '--primary': '#38bdf8',
      '--primary-dim': 'rgba(56,189,248,0.15)',
      '--primary-glow': 'rgba(56,189,248,0.35)',
      '--node-bg': '#0e1f38',
      '--node-border': 'rgba(56,189,248,0.15)',
      '--node-header-bg': 'rgba(56,189,248,0.12)',
      '--node-selected-border': '#38bdf8',
      '--handle-input': '#38bdf8',
      '--handle-output': '#34d399',
      '--edge-color': '#38bdf8',
      '--border': 'rgba(56,189,248,0.12)',
      '--toolbar-bg': '#0a1628',
    },
  },
  {
    name: 'Forest',
    baseMode: 'dark',
    variables: {
      '--bg': '#0a1a0a',
      '--input-bg': '#0f2010',
      '--surface-0': '#0a1a0a',
      '--surface-1': '#0f2010',
      '--surface-2': '#152a16',
      '--surface-3': '#1c3a1d',
      '--primary': '#4ade80',
      '--primary-dim': 'rgba(74,222,128,0.15)',
      '--primary-glow': 'rgba(74,222,128,0.3)',
      '--node-bg': '#152a16',
      '--node-border': 'rgba(74,222,128,0.15)',
      '--node-header-bg': 'rgba(74,222,128,0.1)',
      '--node-selected-border': '#4ade80',
      '--handle-input': '#4ade80',
      '--handle-output': '#86efac',
      '--edge-color': '#4ade80',
      '--border': 'rgba(74,222,128,0.12)',
      '--toolbar-bg': '#0f2010',
    },
  },
  {
    name: 'High Contrast',
    baseMode: 'dark',
    variables: {
      '--bg': '#000000',
      '--input-bg': '#111111',
      '--surface-0': '#000000',
      '--surface-1': '#111111',
      '--surface-2': '#1a1a1a',
      '--surface-3': '#222222',
      '--text': '#ffffff',
      '--text-muted': 'rgba(255,255,255,0.85)',
      '--text-faint': 'rgba(255,255,255,0.6)',
      '--primary': '#ffff00',
      '--primary-dim': 'rgba(255,255,0,0.15)',
      '--primary-glow': 'rgba(255,255,0,0.4)',
      '--success': '#00ff88',
      '--danger': '#ff3333',
      '--node-bg': '#1a1a1a',
      '--node-border': 'rgba(255,255,255,0.3)',
      '--node-header-bg': 'rgba(255,255,0,0.12)',
      '--node-selected-border': '#ffff00',
      '--handle-input': '#ffff00',
      '--handle-output': '#00ff88',
      '--edge-color': '#ffff00',
      '--border': 'rgba(255,255,255,0.2)',
    },
  },
  {
    name: 'Solarized',
    baseMode: 'dark',
    variables: {
      '--bg': '#002b36',
      '--input-bg': '#073642',
      '--surface-0': '#002b36',
      '--surface-1': '#073642',
      '--surface-2': '#0d4052',
      '--surface-3': '#115162',
      '--text': '#fdf6e3',
      '--text-muted': '#839496',
      '--text-faint': '#586e75',
      '--primary': '#268bd2',
      '--primary-dim': 'rgba(38,139,210,0.15)',
      '--primary-glow': 'rgba(38,139,210,0.35)',
      '--success': '#859900',
      '--danger': '#dc322f',
      '--node-bg': '#073642',
      '--node-border': 'rgba(131,148,150,0.2)',
      '--node-header-bg': 'rgba(38,139,210,0.15)',
      '--node-selected-border': '#268bd2',
      '--handle-input': '#268bd2',
      '--handle-output': '#859900',
      '--edge-color': '#268bd2',
      '--border': 'rgba(131,148,150,0.15)',
      '--toolbar-bg': '#073642',
    },
  },
  {
    name: 'Nord',
    baseMode: 'dark',
    variables: {
      '--bg': '#2e3440',
      '--input-bg': '#3b4252',
      '--surface-0': '#2e3440',
      '--surface-1': '#3b4252',
      '--surface-2': '#434c5e',
      '--surface-3': '#4c566a',
      '--text': '#eceff4',
      '--text-muted': '#d8dee9',
      '--text-faint': '#9aa5b4',
      '--primary': '#88c0d0',
      '--primary-dim': 'rgba(136,192,208,0.15)',
      '--primary-glow': 'rgba(136,192,208,0.35)',
      '--success': '#a3be8c',
      '--danger': '#bf616a',
      '--node-bg': '#3b4252',
      '--node-border': 'rgba(216,222,233,0.12)',
      '--node-header-bg': 'rgba(136,192,208,0.15)',
      '--node-selected-border': '#88c0d0',
      '--handle-input': '#88c0d0',
      '--handle-output': '#a3be8c',
      '--edge-color': '#88c0d0',
      '--border': 'rgba(216,222,233,0.1)',
      '--toolbar-bg': '#3b4252',
    },
  },
]

// ── Validation ───────────────────────────────────────────────────────────────

export function validateThemeName(name: string): { ok: boolean; error?: string } {
  const trimmed = name.trim()
  if (trimmed.length === 0) return { ok: false, error: 'Name is required' }
  if (trimmed.length > 64) return { ok: false, error: 'Name must be 64 characters or fewer' }
  return { ok: true }
}

export function validateThemeVariables(vars: Record<string, string>): {
  ok: boolean
  error?: string
} {
  const sanitized = sanitizeThemeVariables(vars)
  if (Object.keys(sanitized).length === 0) {
    return { ok: false, error: 'At least one variable must be defined' }
  }
  return { ok: true }
}

// ── localStorage CRUD ────────────────────────────────────────────────────────

const LS_KEY = 'cs:custom-themes'
const ACTIVE_KEY = 'cs:active-theme'

export function loadCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CustomTheme[]
  } catch {
    return []
  }
}

export function saveCustomThemes(themes: CustomTheme[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(themes))
  } catch {
    // Private browsing
  }
}

export function getActiveThemeId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function setActiveThemeId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id)
    } else {
      localStorage.removeItem(ACTIVE_KEY)
    }
  } catch {
    // Private browsing
  }
}

export function generateThemeId(): string {
  return `ct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Apply / clear ────────────────────────────────────────────────────────────

export function applyThemeVariables(variables: Record<string, string>): void {
  const sanitized = sanitizeThemeVariables(variables)
  const root = document.documentElement
  for (const [key, value] of Object.entries(sanitized)) {
    root.style.setProperty(key, value)
  }
}

export function clearThemeVariables(variables: Record<string, string>): void {
  const root = document.documentElement
  for (const key of Object.keys(variables)) {
    root.style.removeProperty(key)
  }
}

/**
 * Apply the persisted active theme on app startup.
 * Call this once during initialisation.
 */
export function applyPersistedCustomTheme(): void {
  const id = getActiveThemeId()
  if (!id) return
  const themes = loadCustomThemes()
  const theme = themes.find((t) => t.id === id)
  if (theme) applyThemeVariables(theme.variables)
}

// ── V3-4.2: Theme import / export ─────────────────────────────────────────

/** Serialisation format for .chainsolve-theme.json files. */
export interface ThemeExportPayload {
  formatVersion: 1
  name: string
  baseMode: 'dark' | 'light'
  variables: Record<string, string>
}

/** Export a CustomTheme as a downloadable JSON file. */
export function exportThemeToFile(theme: CustomTheme): void {
  const payload: ThemeExportPayload = {
    formatVersion: 1,
    name: theme.name,
    baseMode: theme.baseMode,
    variables: { ...theme.variables },
  }
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${theme.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.chainsolve-theme.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Validate and parse a theme import JSON string.
 * Returns the parsed payload or an error message.
 */
export function parseThemeImport(
  json: string,
): { ok: true; payload: ThemeExportPayload } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'Invalid JSON' }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Invalid theme format' }
  }
  const obj = parsed as Record<string, unknown>
  if (obj.formatVersion !== 1) {
    return { ok: false, error: 'Unsupported theme format version' }
  }
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    return { ok: false, error: 'Theme name is required' }
  }
  if (obj.baseMode !== 'dark' && obj.baseMode !== 'light') {
    return { ok: false, error: 'baseMode must be "dark" or "light"' }
  }
  if (typeof obj.variables !== 'object' || obj.variables === null) {
    return { ok: false, error: 'variables must be an object' }
  }
  const sanitized = sanitizeThemeVariables(obj.variables as Record<string, string>)
  return {
    ok: true,
    payload: {
      formatVersion: 1,
      name: String(obj.name).trim().slice(0, 64),
      baseMode: obj.baseMode as 'dark' | 'light',
      variables: sanitized,
    },
  }
}
