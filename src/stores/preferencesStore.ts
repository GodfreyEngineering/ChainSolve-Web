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

  // Numeric formatting
  decimalPlaces: number // -1 = auto (smart precision)
  scientificNotationThreshold: number // abs value above this uses sci notation
  thousandsSeparator: boolean

  // Canvas defaults
  defaultSnapToGrid: boolean
  defaultEdgeAnimation: boolean
  defaultLod: boolean

  // Export defaults
  exportIncludeImages: boolean
  defaultExportFormat: 'pdf' | 'xlsx'
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: UserPreferences = {
  autosaveEnabled: false, // D8-1: OFF by default
  autosaveDelayMs: 2000,

  decimalPlaces: -1, // auto
  scientificNotationThreshold: 1e6,
  thousandsSeparator: false,

  defaultSnapToGrid: false,
  defaultEdgeAnimation: true,
  defaultLod: true,

  exportIncludeImages: true,
  defaultExportFormat: 'pdf',
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
