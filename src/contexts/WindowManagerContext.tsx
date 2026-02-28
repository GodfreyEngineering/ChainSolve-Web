/**
 * WindowManagerContext — manages in-app window lifecycle, z-stacking, and geometry persistence.
 *
 * Each window is identified by a unique `windowId` string.
 * The provider tracks which windows are open, their z-indices,
 * minimized/maximized state, and persisted geometry.
 */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WindowGeometry {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowState {
  id: string
  zIndex: number
  minimized: boolean
  maximized: boolean
  geometry: WindowGeometry
}

export interface WindowManagerContextValue {
  /** All currently open windows, ordered by z-index. */
  windows: WindowState[]
  /** Open (or focus) a window. If already open, brings it to front. */
  openWindow: (id: string, defaults?: Partial<WindowGeometry>) => void
  /** Close a window. */
  closeWindow: (id: string) => void
  /** Close the topmost (highest z-index) window. Used by ESC key handler. */
  closeTopmost: () => void
  /** Bring a window to the front (highest z-index). */
  focusWindow: (id: string) => void
  /** Toggle minimized state for a window. */
  toggleMinimize: (id: string) => void
  /** Toggle maximized state for a window. */
  toggleMaximize: (id: string) => void
  /** Update geometry for a window (drag / resize). */
  updateGeometry: (id: string, geo: Partial<WindowGeometry>) => void
  /** Check if a window is open. */
  isOpen: (id: string) => boolean
}

const STORAGE_KEY = 'cs:window-geometry'
const BASE_Z = 10000

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadGeometryCache(): Record<string, WindowGeometry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Record<string, WindowGeometry>
  } catch {
    // ignore
  }
  return {}
}

function saveGeometryCache(cache: Record<string, WindowGeometry>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // ignore — private browsing
  }
}

const DEFAULT_GEO: WindowGeometry = { x: 120, y: 80, width: 480, height: 400 }

// ── Context ──────────────────────────────────────────────────────────────────

const WindowManagerContext = createContext<WindowManagerContextValue>({
  windows: [],
  openWindow: () => {},
  closeWindow: () => {},
  closeTopmost: () => {},
  focusWindow: () => {},
  toggleMinimize: () => {},
  toggleMaximize: () => {},
  updateGeometry: () => {},
  isOpen: () => false,
})

export function useWindowManager(): WindowManagerContextValue {
  return useContext(WindowManagerContext)
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<WindowState[]>([])
  const nextZ = useRef(BASE_Z)
  const geoCache = useRef(loadGeometryCache())

  // ── Keyboard: ESC closes topmost, Cmd/Ctrl+W closes active ──
  const closeTopmost = useCallback(() => {
    setWindows((prev) => {
      if (prev.length === 0) return prev
      // Find the topmost non-minimized window
      const sorted = [...prev].sort((a, b) => b.zIndex - a.zIndex)
      const top = sorted.find((w) => !w.minimized) ?? sorted[0]
      return prev.filter((w) => w.id !== top.id)
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWindows((prev) => {
          if (prev.length === 0) return prev
          const sorted = [...prev].sort((a, b) => b.zIndex - a.zIndex)
          const top = sorted.find((w) => !w.minimized) ?? sorted[0]
          return prev.filter((w) => w.id !== top.id)
        })
      }
      if (e.key === 'w' && (e.metaKey || e.ctrlKey)) {
        setWindows((prev) => {
          if (prev.length === 0) return prev
          e.preventDefault()
          const sorted = [...prev].sort((a, b) => b.zIndex - a.zIndex)
          const top = sorted.find((w) => !w.minimized) ?? sorted[0]
          return prev.filter((w) => w.id !== top.id)
        })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const openWindow = useCallback((id: string, defaults?: Partial<WindowGeometry>) => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.id === id)
      if (existing) {
        // Bring to front + unminimize
        const z = ++nextZ.current
        return prev.map((w) => (w.id === id ? { ...w, zIndex: z, minimized: false } : w))
      }
      const z = ++nextZ.current
      const persisted = geoCache.current[id]
      const geo: WindowGeometry = persisted ?? { ...DEFAULT_GEO, ...defaults }
      return [...prev, { id, zIndex: z, minimized: false, maximized: false, geometry: geo }]
    })
  }, [])

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const w = prev.find((win) => win.id === id)
      if (w) {
        geoCache.current[id] = w.geometry
        saveGeometryCache(geoCache.current)
      }
      return prev.filter((win) => win.id !== id)
    })
  }, [])

  const focusWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const z = ++nextZ.current
      return prev.map((w) => (w.id === id ? { ...w, zIndex: z } : w))
    })
  }, [])

  const toggleMinimize = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)))
  }, [])

  const toggleMaximize = useCallback((id: string) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)))
  }, [])

  const updateGeometry = useCallback((id: string, geo: Partial<WindowGeometry>) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w
        const next = { ...w.geometry, ...geo }
        geoCache.current[id] = next
        return { ...w, geometry: next }
      }),
    )
  }, [])

  const isOpen = useCallback((id: string) => windows.some((w) => w.id === id), [windows])

  const value = useMemo<WindowManagerContextValue>(
    () => ({
      windows,
      openWindow,
      closeWindow,
      closeTopmost,
      focusWindow,
      toggleMinimize,
      toggleMaximize,
      updateGeometry,
      isOpen,
    }),
    [
      windows,
      openWindow,
      closeWindow,
      closeTopmost,
      focusWindow,
      toggleMinimize,
      toggleMaximize,
      updateGeometry,
      isOpen,
    ],
  )

  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>
}
