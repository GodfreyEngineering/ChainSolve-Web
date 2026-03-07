/**
 * statusBarStore — Zustand store for workspace-wide UI state (V3-2.1).
 *
 * CanvasArea and engine callbacks push updates here.
 * StatusBar, RightSidebar, and other workspace components subscribe reactively.
 */

import { create } from 'zustand'

export type EngineStatus = 'idle' | 'computing' | 'error'

export interface StatusBarState {
  engineStatus: EngineStatus
  nodeCount: number
  edgeCount: number
  zoomPercent: number
  snapToGrid: boolean
  /** Currently inspected node ID (shared between CanvasArea and RightSidebar). */
  inspectedNodeId: string | null

  setEngineStatus: (status: EngineStatus) => void
  setNodeCount: (count: number) => void
  setEdgeCount: (count: number) => void
  setZoomPercent: (zoom: number) => void
  setSnapToGrid: (snap: boolean) => void
  setInspectedNodeId: (id: string | null) => void
}

export const useStatusBarStore = create<StatusBarState>((set) => ({
  engineStatus: 'idle',
  nodeCount: 0,
  edgeCount: 0,
  zoomPercent: 100,
  snapToGrid: false,
  inspectedNodeId: null,

  setEngineStatus: (engineStatus) => set({ engineStatus }),
  setNodeCount: (nodeCount) => set({ nodeCount }),
  setEdgeCount: (edgeCount) => set({ edgeCount }),
  setZoomPercent: (zoomPercent) => set({ zoomPercent }),
  setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
  setInspectedNodeId: (inspectedNodeId) => set({ inspectedNodeId }),
}))
