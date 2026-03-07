/**
 * statusBarStore — Zustand store for the bottom status bar (V3-2.1).
 *
 * CanvasArea and engine callbacks push updates here.
 * The StatusBar component subscribes reactively.
 */

import { create } from 'zustand'

export type EngineStatus = 'idle' | 'computing' | 'error'

export interface StatusBarState {
  engineStatus: EngineStatus
  nodeCount: number
  edgeCount: number
  zoomPercent: number
  snapToGrid: boolean

  setEngineStatus: (status: EngineStatus) => void
  setNodeCount: (count: number) => void
  setEdgeCount: (count: number) => void
  setZoomPercent: (zoom: number) => void
  setSnapToGrid: (snap: boolean) => void
}

export const useStatusBarStore = create<StatusBarState>((set) => ({
  engineStatus: 'idle',
  nodeCount: 0,
  edgeCount: 0,
  zoomPercent: 100,
  snapToGrid: false,

  setEngineStatus: (engineStatus) => set({ engineStatus }),
  setNodeCount: (nodeCount) => set({ nodeCount }),
  setEdgeCount: (edgeCount) => set({ edgeCount }),
  setZoomPercent: (zoomPercent) => set({ zoomPercent }),
  setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
}))
