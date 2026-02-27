/**
 * projectStore — Zustand store that tracks the currently open project's
 * metadata and save lifecycle.
 *
 * Does NOT store graph nodes/edges — those remain owned by React Flow state
 * inside CanvasArea. CanvasPage reads this store to drive the save status
 * indicator and the autosave logic.
 */

import { create } from 'zustand'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error' | 'offline-queued'

interface ProjectState {
  // ── Current project identity ──────────────────────────────────────────────
  projectId: string | null
  projectName: string
  /** The DB updated_at when we last loaded or successfully saved. */
  dbUpdatedAt: string | null
  /** Monotonic counter from the loaded ProjectJSON. Used in save calls. */
  formatVersion: number
  /** ISO timestamp from the loaded ProjectJSON (preserved across saves). */
  createdAt: string | null

  // ── Save lifecycle ────────────────────────────────────────────────────────
  saveStatus: SaveStatus
  errorMessage: string | null
  lastSavedAt: Date | null
  isDirty: boolean

  // ── Actions ───────────────────────────────────────────────────────────────
  beginLoad: (
    id: string,
    name: string,
    dbUpdatedAt: string,
    formatVersion: number,
    createdAt: string,
  ) => void
  setProjectName: (name: string) => void
  markDirty: () => void
  beginSave: () => void
  completeSave: (dbUpdatedAt: string) => void
  failSave: (err: string) => void
  queueOffline: () => void
  detectConflict: () => void
  dismissConflict: () => void
  reset: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectId: null,
  projectName: 'Untitled',
  dbUpdatedAt: null,
  formatVersion: 0,
  createdAt: null,
  saveStatus: 'idle',
  errorMessage: null,
  lastSavedAt: null,
  isDirty: false,

  beginLoad: (id, name, dbUpdatedAt, formatVersion, createdAt) =>
    set({
      projectId: id,
      projectName: name,
      dbUpdatedAt,
      formatVersion,
      createdAt,
      saveStatus: 'idle',
      errorMessage: null,
      lastSavedAt: null,
      isDirty: false,
    }),

  setProjectName: (name) => set({ projectName: name, isDirty: true }),

  markDirty: () =>
    set((s) => ({
      isDirty: true,
      // Clear error/offline-queued so the debounce autosave fires a fresh attempt
      saveStatus:
        s.saveStatus === 'error' || s.saveStatus === 'offline-queued' ? 'idle' : s.saveStatus,
    })),

  beginSave: () => set({ saveStatus: 'saving', errorMessage: null }),

  completeSave: (dbUpdatedAt) =>
    set({ saveStatus: 'saved', dbUpdatedAt, lastSavedAt: new Date(), isDirty: false }),

  failSave: (err) => set({ saveStatus: 'error', errorMessage: err }),

  /** Save failed while offline — queued for retry. */
  queueOffline: () => set({ saveStatus: 'offline-queued', errorMessage: null }),

  detectConflict: () => set({ saveStatus: 'conflict' }),

  dismissConflict: () => set({ saveStatus: 'idle', isDirty: true }),

  reset: () =>
    set({
      projectId: null,
      projectName: 'Untitled',
      dbUpdatedAt: null,
      formatVersion: 0,
      createdAt: null,
      saveStatus: 'idle',
      errorMessage: null,
      lastSavedAt: null,
      isDirty: false,
    }),
}))
