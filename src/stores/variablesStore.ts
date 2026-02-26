/**
 * variablesStore — Zustand store for project-level variables (W12.2).
 *
 * Variables are scalar values shared across all canvases in a project.
 * The store is loaded when a project opens and saved alongside the
 * canvas autosave cycle when dirty.
 */

import { create } from 'zustand'
import type { ProjectVariable, VariablesMap } from '../lib/variables'

interface VariablesState {
  variables: VariablesMap
  isDirty: boolean

  /** Load variables (called on project open). */
  load: (variables: VariablesMap) => void
  /** Add or update a variable. */
  setVariable: (variable: ProjectVariable) => void
  /** Remove a variable by ID. */
  removeVariable: (varId: string) => void
  /** Rename a variable. */
  renameVariable: (varId: string, newName: string) => void
  /** Update just the numeric value. */
  updateValue: (varId: string, value: number) => void
  /** Reset store (called on project close). */
  reset: () => void
  /** Mark clean after a successful save. */
  markClean: () => void
}

export const useVariablesStore = create<VariablesState>((set) => ({
  variables: {},
  isDirty: false,

  load: (variables) => set({ variables, isDirty: false }),

  setVariable: (variable) =>
    set((s) => ({
      variables: { ...s.variables, [variable.id]: variable },
      isDirty: true,
    })),

  removeVariable: (varId) =>
    set((s) => {
      const { [varId]: _removed, ...rest } = s.variables
      void _removed
      return { variables: rest, isDirty: true }
    }),

  renameVariable: (varId, newName) =>
    set((s) => {
      const existing = s.variables[varId]
      if (!existing) return s
      return {
        variables: { ...s.variables, [varId]: { ...existing, name: newName } },
        isDirty: true,
      }
    }),

  updateValue: (varId, value) =>
    set((s) => {
      const existing = s.variables[varId]
      if (!existing) return s
      return {
        variables: { ...s.variables, [varId]: { ...existing, value } },
        isDirty: true,
      }
    }),

  reset: () => set({ variables: {}, isDirty: false }),

  markClean: () => set({ isDirty: false }),
}))
