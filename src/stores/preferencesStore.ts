/**
 * preferencesStore — Zustand store for user preferences (D8-1).
 *
 * Centralizes settings that were previously scattered across localStorage
 * helpers. All values persist to localStorage under the 'cs:prefs' key.
 */

import { create } from 'zustand'
import type { KeybindingAction, KeyCombo } from '../lib/keybindings'

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserPreferences {
  // Autosave
  autosaveEnabled: boolean
  autosaveDelayMs: number

  // SCI-06: Angle unit preference
  /** Whether trig blocks interpret/output angles in degrees or radians. */
  angleUnit: 'rad' | 'deg'

  // Numeric formatting (SCI-02, SCI-05, SCI-07)
  /** SCI-05: how numbers are displayed. */
  numberDisplayMode: 'auto' | 'decimal' | 'sig_figs' | 'scientific'
  /** Decimal places; used in 'decimal' and 'auto' modes (-1 = smart). */
  decimalPlaces: number
  /** SCI-05: significant figures count, used when numberDisplayMode === 'sig_figs'. */
  sigFigs: number
  /** Abs value above this uses scientific notation in 'auto' mode. */
  scientificNotationThreshold: number
  /** Show thousands separator. */
  thousandsSeparator: boolean
  /** SCI-07: thousands separator character. */
  thousandsSeparatorChar: 'comma' | 'period' | 'space' | 'underscore' | 'apostrophe'
  /** SCI-07: decimal separator character. */
  decimalSeparator: '.' | ','
  /** SCI-02: substitute high-precision digits for π, e, φ, √2. */
  highPrecisionConstants: boolean
  /** PREC-04: negative number style. 'minus' = -1.5, 'parens' = (1.5). */
  negativeStyle: 'minus' | 'parens'
  /** PREC-04: show trailing zeros in fixed-decimal mode. e.g. 1.50 vs 1.5. */
  trailingZeros: boolean

  // Canvas / Editor defaults
  defaultSnapToGrid: boolean
  defaultEdgeAnimation: boolean
  defaultLod: boolean
  defaultZoom: number // initial zoom percent for new canvases
  showGrid: boolean // show grid dots on canvas

  // THEME-02: Canvas appearance
  /** Background pattern: solid, dot-grid, line-grid, cross-grid, large-dots */
  canvasBgStyle: 'solid' | 'dot-grid' | 'line-grid' | 'cross-grid' | 'large-dots'
  /** Grid gap in pixels (8, 16, 32, 64) */
  canvasGridSize: 8 | 16 | 32 | 64
  /** Edge routing style */
  canvasEdgeType: 'bezier' | 'step' | 'straight' | 'smoothstep'
  /** Edge stroke width in px (1, 1.5, 2, 3) */
  canvasEdgeWidth: 1 | 1.5 | 2 | 3
  /** Node corner radius in px (0, 4, 8, 12) */
  canvasNodeBorderRadius: 0 | 4 | 8 | 12
  /** Node drop shadow strength */
  canvasNodeShadow: 'none' | 'subtle' | 'strong'
  /** Edge animation speed */
  canvasAnimationSpeed: 'none' | 'slow' | 'medium' | 'fast'
  /** Auto-layout direction preference */
  autoLayoutDirection: 'LR' | 'TB'
  /** 3.23: Edge bundling — cluster parallel edges from the same source node visually. */
  edgeBundlingEnabled: boolean

  // Export defaults
  exportIncludeImages: boolean
  defaultExportFormat: 'pdf' | 'xlsx'
  exportIncludeAnnotations: boolean
  exportPageSize: 'a4' | 'letter'

  // Notification preferences (ACCT-08)
  /** Email me about new features and product updates (opt-out). */
  notifyProductUpdates: boolean

  // 4.12: Accessibility
  /** High contrast mode — increases border/text contrast. */
  highContrastMode: boolean
  /** Reduced motion — disables animations. */
  reducedMotion: boolean
  /** Font size scale (80%–150%). */
  fontScale: number

  // 4.12: Privacy
  /** Opt-in to anonymous analytics. */
  analyticsOptIn: boolean
  /** Opt-in to crash reporting. */
  crashReportingOptIn: boolean
  /** 6.08: Opt out of ChainSolve AI — no canvas data sent to OpenAI. */
  aiOptOut: boolean

  // KB-01: User-editable keyboard shortcuts
  /** Partial overrides of DEFAULT_KEYBINDINGS. Only changed bindings are stored. */
  keybindings: Partial<Record<KeybindingAction, KeyCombo>>
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: UserPreferences = {
  autosaveEnabled: true,
  autosaveDelayMs: 2000,

  angleUnit: 'rad',

  numberDisplayMode: 'auto',
  decimalPlaces: -1, // auto
  sigFigs: 4,
  scientificNotationThreshold: 1e6,
  thousandsSeparator: false,
  thousandsSeparatorChar: 'comma',
  decimalSeparator: '.',
  highPrecisionConstants: false,
  negativeStyle: 'minus',
  trailingZeros: false,

  defaultSnapToGrid: false,
  defaultEdgeAnimation: true,
  defaultLod: true,
  defaultZoom: 100,
  showGrid: true,

  canvasBgStyle: 'dot-grid',
  canvasGridSize: 16,
  canvasEdgeType: 'bezier',
  canvasEdgeWidth: 1.5,
  canvasNodeBorderRadius: 8,
  canvasNodeShadow: 'subtle',
  canvasAnimationSpeed: 'medium',
  autoLayoutDirection: 'LR',
  edgeBundlingEnabled: false,

  exportIncludeImages: true,
  defaultExportFormat: 'pdf',
  exportIncludeAnnotations: true,
  exportPageSize: 'a4',

  notifyProductUpdates: true,

  highContrastMode: false,
  reducedMotion: false,
  fontScale: 100,

  analyticsOptIn: true,
  crashReportingOptIn: true,
  aiOptOut: false,

  keybindings: {},
}

// ── localStorage persistence ─────────────────────────────────────────────────

const LS_KEY = 'cs:prefs'

function loadPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<UserPreferences>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function savePrefs(prefs: UserPreferences): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs))
  } catch {
    // Private browsing
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

interface PreferencesState extends UserPreferences {
  /** Update one or more preference values. */
  update: (patch: Partial<UserPreferences>) => void
  /** Reset all preferences to defaults. */
  reset: () => void
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  ...loadPrefs(),

  update: (patch) =>
    set((s) => {
      const next = { ...s, ...patch }
      savePrefs(next)
      return next
    }),

  reset: () => {
    savePrefs(DEFAULTS)
    set({ ...DEFAULTS })
  },
}))
