/**
 * preferencesStore — Zustand store for user preferences (D8-1).
 *
 * Centralizes settings that were previously scattered across localStorage
 * helpers. All values persist to localStorage under the 'cs:prefs' key.
 */

import { create } from 'zustand'

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserPreferences {
  // Autosave
  autosaveEnabled: boolean
  autosaveDelayMs: number

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

  // Canvas / Editor defaults
  defaultSnapToGrid: boolean
  defaultEdgeAnimation: boolean
  defaultLod: boolean
  defaultZoom: number // initial zoom percent for new canvases
  showGrid: boolean // show grid dots on canvas

  // Export defaults
  exportIncludeImages: boolean
  defaultExportFormat: 'pdf' | 'xlsx'
  exportIncludeAnnotations: boolean
  exportPageSize: 'a4' | 'letter'
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: UserPreferences = {
  autosaveEnabled: true,
  autosaveDelayMs: 2000,

  numberDisplayMode: 'auto',
  decimalPlaces: -1, // auto
  sigFigs: 4,
  scientificNotationThreshold: 1e6,
  thousandsSeparator: false,
  thousandsSeparatorChar: 'comma',
  decimalSeparator: '.',
  highPrecisionConstants: false,

  defaultSnapToGrid: false,
  defaultEdgeAnimation: true,
  defaultLod: true,
  defaultZoom: 100,
  showGrid: true,

  exportIncludeImages: true,
  defaultExportFormat: 'pdf',
  exportIncludeAnnotations: true,
  exportPageSize: 'a4',
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
