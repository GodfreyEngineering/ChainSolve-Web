/**
 * customThemesStore — Zustand store for user-created themes (D8-2).
 *
 * Manages the list of custom themes and which one is currently active.
 * All mutations auto-persist to localStorage.
 */

import { create } from 'zustand'
import type { CustomTheme } from '../lib/customThemes'
import {
  loadCustomThemes,
  saveCustomThemes,
  getActiveThemeId,
  setActiveThemeId,
  applyThemeVariables,
  clearThemeVariables,
  generateThemeId,
} from '../lib/customThemes'

interface CustomThemesState {
  themes: CustomTheme[]
  activeThemeId: string | null

  /** Load themes from localStorage. */
  load: () => void
  /** Add a new theme and optionally activate it. */
  addTheme: (
    theme: Omit<CustomTheme, 'id' | 'createdAt' | 'updatedAt'>,
    activate?: boolean,
  ) => string
  /** Update an existing theme's name/variables. */
  updateTheme: (
    id: string,
    patch: Partial<Pick<CustomTheme, 'name' | 'variables' | 'baseMode'>>,
  ) => void
  /** Delete a theme. If it was active, deactivates it. */
  deleteTheme: (id: string) => void
  /** Activate a theme (apply its CSS variables). Pass null to deactivate. */
  activateTheme: (id: string | null) => void
}

export const useCustomThemesStore = create<CustomThemesState>((set, get) => ({
  themes: loadCustomThemes(),
  activeThemeId: getActiveThemeId(),

  load: () => {
    set({ themes: loadCustomThemes(), activeThemeId: getActiveThemeId() })
  },

  addTheme: (theme, activate = false) => {
    const id = generateThemeId()
    const now = Date.now()
    const full: CustomTheme = { ...theme, id, createdAt: now, updatedAt: now }
    const next = [...get().themes, full]
    saveCustomThemes(next)
    set({ themes: next })

    if (activate) {
      // Clear previous active theme variables
      const prevId = get().activeThemeId
      if (prevId) {
        const prev = get().themes.find((t) => t.id === prevId)
        if (prev) clearThemeVariables(prev.variables)
      }
      setActiveThemeId(id)
      applyThemeVariables(full.variables)
      set({ activeThemeId: id })
    }

    return id
  },

  updateTheme: (id, patch) => {
    const next = get().themes.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
    )
    saveCustomThemes(next)
    set({ themes: next })

    // If this theme is active, re-apply its variables
    if (get().activeThemeId === id) {
      const updated = next.find((t) => t.id === id)
      if (updated) {
        // Clear all possible vars first, then apply new set
        clearThemeVariables({ ...updated.variables, ...patch.variables })
        applyThemeVariables(updated.variables)
      }
    }
  },

  deleteTheme: (id) => {
    const theme = get().themes.find((t) => t.id === id)
    const next = get().themes.filter((t) => t.id !== id)
    saveCustomThemes(next)

    if (get().activeThemeId === id) {
      if (theme) clearThemeVariables(theme.variables)
      setActiveThemeId(null)
      set({ themes: next, activeThemeId: null })
    } else {
      set({ themes: next })
    }
  },

  activateTheme: (id) => {
    // Clear previous
    const prevId = get().activeThemeId
    if (prevId) {
      const prev = get().themes.find((t) => t.id === prevId)
      if (prev) clearThemeVariables(prev.variables)
    }

    if (id) {
      const theme = get().themes.find((t) => t.id === id)
      if (theme) {
        applyThemeVariables(theme.variables)
        setActiveThemeId(id)
        set({ activeThemeId: id })
      }
    } else {
      setActiveThemeId(null)
      set({ activeThemeId: null })
    }
  },
}))
