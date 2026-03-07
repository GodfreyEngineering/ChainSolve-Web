/**
 * statusBarStore — Zustand store for workspace-wide UI state (V3-2.1).
 *
 * CanvasArea and engine callbacks push updates here.
 * StatusBar, RightSidebar, and other workspace components subscribe reactively.
 */

import { create } from 'zustand'

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

  setEngineStatus: (status: EngineStatus) => void
  setNodeCount: (count: number) => void
  setEdgeCount: (count: number) => void
  setZoomPercent: (zoom: number) => void
  setSnapToGrid: (snap: boolean) => void
  setInspectedNodeId: (id: string | null) => void
  setExportProgress: (msg: string | null) => void
  addExportHistory: (entry: Omit<ExportHistoryEntry, 'timestamp'>) => void
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
}))
