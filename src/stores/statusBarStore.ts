/**
 * statusBarStore — Zustand store for workspace-wide UI state (V3-2.1).
 *
 * CanvasArea and engine callbacks push updates here.
 * StatusBar, RightSidebar, and other workspace components subscribe reactively.
 */

import { create } from 'zustand'
import type { EvalMode } from '../engine/evalScheduler.ts'

export type EngineStatus = 'idle' | 'computing' | 'error'

export interface ExportHistoryEntry {
  format: string
  timestamp: number
  name: string
}

const EXPORT_HISTORY_KEY = 'cs:exportHistory'
const MAX_HISTORY = 5

function loadExportHistory(): ExportHistoryEntry[] {
  try {
    const raw = localStorage.getItem(EXPORT_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistExportHistory(entries: ExportHistoryEntry[]) {
  try {
    localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
  } catch {
    // private browsing
  }
}

export interface StatusBarState {
  engineStatus: EngineStatus
  nodeCount: number
  edgeCount: number
  zoomPercent: number
  snapToGrid: boolean
  /** Currently inspected node ID (shared between CanvasArea and RightSidebar). */
  inspectedNodeId: string | null
  /** V3-6.2: Export progress message (null = no export in progress). */
  exportProgress: string | null
  /** V3-6.2: Recent export history. */
  exportHistory: ExportHistoryEntry[]

  /** Phase 1E: Evaluation mode (auto/deferred/manual). Persisted to localStorage. */
  evalMode: EvalMode
  /** Phase 1E: True when graph has changed since last eval (non-auto modes). */
  isStale: boolean
  /** Phase 1E: Elapsed time (ms) of last successful evaluation. */
  lastEvalMs: number | null
  /** Phase 1E: Number of nodes computed in last eval. */
  lastEvalNodeCount: number
  /** Phase 1E: Number of pending patch ops waiting to be dispatched. */
  pendingPatchCount: number

  setEngineStatus: (status: EngineStatus) => void
  setNodeCount: (count: number) => void
  setEdgeCount: (count: number) => void
  setZoomPercent: (zoom: number) => void
  setSnapToGrid: (snap: boolean) => void
  setInspectedNodeId: (id: string | null) => void
  setExportProgress: (msg: string | null) => void
  addExportHistory: (entry: Omit<ExportHistoryEntry, 'timestamp'>) => void
  setEvalMode: (mode: EvalMode) => void
  setIsStale: (stale: boolean) => void
  setLastEvalMs: (ms: number | null) => void
  setLastEvalNodeCount: (count: number) => void
  setPendingPatchCount: (count: number) => void
}

const EVAL_MODE_KEY = 'cs:evalMode'

function loadEvalMode(): EvalMode {
  try {
    const raw = localStorage.getItem(EVAL_MODE_KEY)
    if (raw === 'auto' || raw === 'deferred' || raw === 'manual') return raw
  } catch {
    // private browsing
  }
  return 'auto'
}

export const useStatusBarStore = create<StatusBarState>((set) => ({
  engineStatus: 'idle',
  nodeCount: 0,
  edgeCount: 0,
  zoomPercent: 100,
  snapToGrid: false,
  inspectedNodeId: null,
  exportProgress: null,
  exportHistory: loadExportHistory(),
  evalMode: loadEvalMode(),
  isStale: false,
  lastEvalMs: null,
  lastEvalNodeCount: 0,
  pendingPatchCount: 0,

  setEngineStatus: (engineStatus) => set({ engineStatus }),
  setNodeCount: (nodeCount) => set({ nodeCount }),
  setEdgeCount: (edgeCount) => set({ edgeCount }),
  setZoomPercent: (zoomPercent) => set({ zoomPercent }),
  setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
  setInspectedNodeId: (inspectedNodeId) => set({ inspectedNodeId }),
  setExportProgress: (exportProgress) => set({ exportProgress }),
  addExportHistory: (entry) =>
    set((state) => {
      const newEntry = { ...entry, timestamp: Date.now() }
      const next = [newEntry, ...state.exportHistory].slice(0, MAX_HISTORY)
      persistExportHistory(next)
      return { exportHistory: next }
    }),
  setEvalMode: (evalMode) => {
    try {
      localStorage.setItem(EVAL_MODE_KEY, evalMode)
    } catch {
      // private browsing
    }
    set({ evalMode })
  },
  setIsStale: (isStale) => set({ isStale }),
  setLastEvalMs: (lastEvalMs) => set({ lastEvalMs }),
  setLastEvalNodeCount: (lastEvalNodeCount) => set({ lastEvalNodeCount }),
  setPendingPatchCount: (pendingPatchCount) => set({ pendingPatchCount }),
}))
