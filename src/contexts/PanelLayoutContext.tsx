/* eslint-disable react-refresh/only-export-components */
/**
 * PanelLayoutContext — manages panel regions for the workspace (V3-2.2).
 *
 * Regions: left sidebar, right sidebar, bottom panel, main area.
 * Each region is resizable, collapsible, and dimensions are persisted.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'cs:panelLayout'

interface PanelDimensions {
  leftWidth: number
  rightWidth: number
  bottomHeight: number
  leftOpen: boolean
  rightOpen: boolean
  bottomOpen: boolean
}

interface PanelLayoutContextValue extends PanelDimensions {
  setLeftWidth: (w: number) => void
  setRightWidth: (w: number) => void
  setBottomHeight: (h: number) => void
  toggleLeft: () => void
  toggleRight: () => void
  toggleBottom: () => void
  setLeftOpen: (v: boolean) => void
  setRightOpen: (v: boolean) => void
  setBottomOpen: (v: boolean) => void
}

const DEFAULTS: PanelDimensions = {
  leftWidth: 320,
  rightWidth: 300,
  bottomHeight: 200,
  leftOpen: true,
  rightOpen: false,
  bottomOpen: false,
}

function readPersisted(): PanelDimensions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PanelDimensions>
      return {
        leftWidth: clamp(parsed.leftWidth ?? DEFAULTS.leftWidth, 160, 500),
        rightWidth: clamp(parsed.rightWidth ?? DEFAULTS.rightWidth, 160, 500),
        bottomHeight: clamp(parsed.bottomHeight ?? DEFAULTS.bottomHeight, 100, 500),
        leftOpen: typeof parsed.leftOpen === 'boolean' ? parsed.leftOpen : DEFAULTS.leftOpen,
        rightOpen: typeof parsed.rightOpen === 'boolean' ? parsed.rightOpen : DEFAULTS.rightOpen,
        bottomOpen:
          typeof parsed.bottomOpen === 'boolean' ? parsed.bottomOpen : DEFAULTS.bottomOpen,
      }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS }
}

function persist(dims: PanelDimensions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dims))
  } catch {
    /* ignore */
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

const PanelLayoutContext = createContext<PanelLayoutContextValue | null>(null)

export function PanelLayoutProvider({ children }: { children: ReactNode }) {
  const [dims, setDims] = useState<PanelDimensions>(readPersisted)

  const update = useCallback((patch: Partial<PanelDimensions>) => {
    setDims((prev) => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [])

  const value = useMemo<PanelLayoutContextValue>(
    () => ({
      ...dims,
      setLeftWidth: (w) => update({ leftWidth: clamp(w, 160, 500) }),
      setRightWidth: (w) => update({ rightWidth: clamp(w, 160, 500) }),
      setBottomHeight: (h) => update({ bottomHeight: clamp(h, 100, 500) }),
      toggleLeft: () => update({ leftOpen: !dims.leftOpen }),
      toggleRight: () => update({ rightOpen: !dims.rightOpen }),
      toggleBottom: () => update({ bottomOpen: !dims.bottomOpen }),
      setLeftOpen: (v) => update({ leftOpen: v }),
      setRightOpen: (v) => update({ rightOpen: v }),
      setBottomOpen: (v) => update({ bottomOpen: v }),
    }),
    [dims, update],
  )

  return <PanelLayoutContext.Provider value={value}>{children}</PanelLayoutContext.Provider>
}

export function usePanelLayout(): PanelLayoutContextValue {
  const ctx = useContext(PanelLayoutContext)
  if (!ctx) throw new Error('usePanelLayout must be used within PanelLayoutProvider')
  return ctx
}
