/**
 * canvasesStore — Zustand store for multi-canvas "Sheets" state (W10.7).
 *
 * Tracks the list of canvases for the current project, the active canvas ID,
 * and per-canvas dirty state. Works alongside projectStore which still owns
 * project-level metadata (name, save status, etc.).
 */

import { create } from 'zustand'
import type { CanvasRow } from '../lib/canvases'

export interface CanvasesState {
  /** All canvases for the current project, sorted by position. */
  canvases: CanvasRow[]
  /** Currently active (visible) canvas ID. */
  activeCanvasId: string | null
  /** Set of canvas IDs with unsaved changes. */
  dirtyCanvasIds: Set<string>
  /** True while the canvases list is loading. */
  loading: boolean

  // ── Actions ───────────────────────────────────────────────────────────────
  setCanvases: (canvases: CanvasRow[]) => void
  setActiveCanvasId: (id: string) => void
  addCanvas: (canvas: CanvasRow) => void
  removeCanvas: (canvasId: string) => void
  updateCanvas: (canvasId: string, patch: Partial<Pick<CanvasRow, 'name' | 'position'>>) => void
  markCanvasDirty: (canvasId: string) => void
  markCanvasClean: (canvasId: string) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useCanvasesStore = create<CanvasesState>((set) => ({
  canvases: [],
  activeCanvasId: null,
  dirtyCanvasIds: new Set(),
  loading: false,

  setCanvases: (canvases) => set({ canvases }),

  setActiveCanvasId: (id) => set({ activeCanvasId: id }),

  addCanvas: (canvas) =>
    set((s) => ({
      canvases: [...s.canvases, canvas].sort((a, b) => a.position - b.position),
    })),

  removeCanvas: (canvasId) =>
    set((s) => {
      const dirtyCanvasIds = new Set(s.dirtyCanvasIds)
      dirtyCanvasIds.delete(canvasId)
      return {
        canvases: s.canvases.filter((c) => c.id !== canvasId),
        dirtyCanvasIds,
      }
    }),

  updateCanvas: (canvasId, patch) =>
    set((s) => ({
      canvases: s.canvases
        .map((c) => (c.id === canvasId ? { ...c, ...patch } : c))
        .sort((a, b) => a.position - b.position),
    })),

  markCanvasDirty: (canvasId) =>
    set((s) => {
      const dirtyCanvasIds = new Set(s.dirtyCanvasIds)
      dirtyCanvasIds.add(canvasId)
      return { dirtyCanvasIds }
    }),

  markCanvasClean: (canvasId) =>
    set((s) => {
      const dirtyCanvasIds = new Set(s.dirtyCanvasIds)
      dirtyCanvasIds.delete(canvasId)
      return { dirtyCanvasIds }
    }),

  setLoading: (loading) => set({ loading }),

  reset: () =>
    set({
      canvases: [],
      activeCanvasId: null,
      dirtyCanvasIds: new Set(),
      loading: false,
    }),
}))
