/**
 * customMaterialsStore — Zustand store for user-defined custom materials (D7-5).
 *
 * Persists to localStorage. Pro-only feature — the UI guards creation
 * behind an isPro() check.
 */

import { create } from 'zustand'
import type { CustomMaterial } from '../lib/customMaterials'
import { loadCustomMaterials, saveCustomMaterials } from '../lib/customMaterials'

interface CustomMaterialsState {
  materials: CustomMaterial[]

  /** Load materials from localStorage (called on app init). */
  load: () => void
  /** Add a new custom material. */
  addMaterial: (material: CustomMaterial) => void
  /** Update an existing custom material. */
  updateMaterial: (id: string, updates: Partial<Omit<CustomMaterial, 'id'>>) => void
  /** Delete a custom material by ID. */
  deleteMaterial: (id: string) => void
}

export const useCustomMaterialsStore = create<CustomMaterialsState>((set, get) => ({
  materials: loadCustomMaterials(),

  load: () => set({ materials: loadCustomMaterials() }),

  addMaterial: (material) => {
    const updated = [...get().materials, material]
    saveCustomMaterials(updated)
    set({ materials: updated })
  },

  updateMaterial: (id, updates) => {
    const updated = get().materials.map((m) => (m.id === id ? { ...m, ...updates } : m))
    saveCustomMaterials(updated)
    set({ materials: updated })
  },

  deleteMaterial: (id) => {
    const updated = get().materials.filter((m) => m.id !== id)
    saveCustomMaterials(updated)
    set({ materials: updated })
  },
}))
