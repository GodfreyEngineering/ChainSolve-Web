/**
 * customFunctionsStore — Zustand store for user-defined custom function blocks (H5-1).
 *
 * Persists to localStorage. Pro-only feature — the UI guards creation
 * behind an entitlements check.
 */

import { create } from 'zustand'
import type { CustomFunction } from '../lib/customFunctions'
import {
  loadCustomFunctions,
  saveCustomFunctions,
  generateFunctionId,
} from '../lib/customFunctions'

interface CustomFunctionsState {
  functions: CustomFunction[]

  /** Load functions from localStorage (called on app init). */
  load: () => void
  /** Add a new custom function. */
  addFunction: (fn: CustomFunction) => void
  /** Update an existing custom function. */
  updateFunction: (id: string, updates: Partial<Omit<CustomFunction, 'id'>>) => void
  /** Delete a custom function by ID. */
  deleteFunction: (id: string) => void
  /** Duplicate a custom function with a new ID and modified name. */
  duplicateFunction: (id: string) => CustomFunction | null
}

export const useCustomFunctionsStore = create<CustomFunctionsState>((set, get) => ({
  functions: loadCustomFunctions(),

  load: () => set({ functions: loadCustomFunctions() }),

  addFunction: (fn) => {
    const updated = [...get().functions, fn]
    saveCustomFunctions(updated)
    set({ functions: updated })
  },

  updateFunction: (id, updates) => {
    const updated = get().functions.map((f) => (f.id === id ? { ...f, ...updates } : f))
    saveCustomFunctions(updated)
    set({ functions: updated })
  },

  deleteFunction: (id) => {
    const updated = get().functions.filter((f) => f.id !== id)
    saveCustomFunctions(updated)
    set({ functions: updated })
  },

  duplicateFunction: (id) => {
    const original = get().functions.find((f) => f.id === id)
    if (!original) return null
    const duplicate: CustomFunction = {
      ...original,
      id: generateFunctionId(),
      name: `${original.name} (copy)`,
    }
    const updated = [...get().functions, duplicate]
    saveCustomFunctions(updated)
    set({ functions: updated })
    return duplicate
  },
}))
