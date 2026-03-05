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

  // Surfaces (V3-UI depth layers)
  { cssVar: '--surface-0', label: 'Canvas background', category: 'surface' },
  { cssVar: '--surface-1', label: 'Panel / sidebar', category: 'surface' },
  { cssVar: '--surface-2', label: 'Card / elevated', category: 'surface' },
  { cssVar: '--surface-3', label: 'Hover / input', category: 'surface' },

  // Text
  { cssVar: '--text', label: 'Primary text', category: 'text' },
  { cssVar: '--text-muted', label: 'Muted text', category: 'text' },

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
  '--surface-0': '#1a1a1a',
  '--surface-1': '#242424',
  '--surface-2': '#2e2e2e',
  '--surface-3': '#383838',
  '--text': '#f4f4f3',
  '--text-muted': 'rgba(244,244,243,0.65)',
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
      '--card-bg': '#1e293b',
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
      '--card-bg': '#2d1f1a',
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
      '--card-bg': '#1a2e1a',
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
      '--card-bg': 'rgba(30,40,55,0.75)',
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
      '--card-bg': '#ffffff',
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
