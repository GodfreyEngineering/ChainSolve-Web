/**
 * BottomDock — tabbed bottom panel dock for canvas panels.
 *
 * Provides a workstation-IDE-like bottom panel with tabs, resizable height,
 * and persistent open/closed + active-tab state. Renders Debug Console,
 * Graph Health, and future panels in a single consistent container.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useWindowManager } from '../../contexts/WindowManagerContext'

// ── Types ──────────────────────────────────────────────────────────────────

export type DockTab = 'console' | 'health'

export interface DockPanel {
  id: DockTab
  label: string
  content: ReactNode
}

interface BottomDockProps {
  panels: DockPanel[]
  /** G5-2: Whether the dock is collapsed to a thin handle. */
  collapsed?: boolean
  /** G5-2: Toggle collapsed state. */
  onToggleCollapsed?: () => void
}

// ── Persistence helpers ──────────────────────────────────────────────────

const HEIGHT_KEY = 'cs:dockHeight'
const TAB_KEY = 'cs:dockTab'
const MIN_HEIGHT = 120
const MAX_HEIGHT = 500
const DEFAULT_HEIGHT = 200

function loadHeight(): number {
  try {
    const v = localStorage.getItem(HEIGHT_KEY)
    if (v) {
      const n = parseInt(v, 10)
      if (n >= MIN_HEIGHT && n <= MAX_HEIGHT) return n
    }
  } catch {
    // ignore
  }
  return DEFAULT_HEIGHT
}

function saveHeight(h: number) {
  try {
    localStorage.setItem(HEIGHT_KEY, String(h))
  } catch {
    // ignore
  }
}

function loadTab(): DockTab {
  try {
    const v = localStorage.getItem(TAB_KEY)
    if (v === 'console' || v === 'health') return v
  } catch {
    // ignore
  }
  return 'console'
}

function saveTab(tab: DockTab) {
  try {
    localStorage.setItem(TAB_KEY, tab)
  } catch {
    // ignore
  }
}

// ── Component ──────────────────────────────────────────────────────────────

/** Height of the collapsed bottom dock handle bar. */
export const COLLAPSED_DOCK_HEIGHT = 24

export function BottomDock({ panels, collapsed = false, onToggleCollapsed }: BottomDockProps) {
  const { windows } = useWindowManager()
  const [height, setHeight] = useState(loadHeight)
  const [activeTab, setActiveTab] = useState<DockTab>(() => {
    const saved = loadTab()
    if (panels.some((p) => p.id === saved)) return saved
    return panels[0]?.id ?? 'console'
  })
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const [handleHovered, setHandleHovered] = useState(false)

  // Persist tab changes
  const switchTab = useCallback((tab: DockTab) => {
    setActiveTab(tab)
    saveTab(tab)
  }, [])

  // Resize via drag on top edge
  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startH: height }

      const onMove = (me: MouseEvent) => {
        if (!dragRef.current) return
        const delta = dragRef.current.startY - me.clientY
        const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragRef.current.startH + delta))
        setHeight(next)
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setHeight((h) => {
          saveHeight(h)
          return h
        })
        dragRef.current = null
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [height],
  )

  // Keyboard: ESC collapses dock (only when no windows are open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !collapsed && windows.every((w) => w.minimized)) {
        onToggleCollapsed?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToggleCollapsed, windows, collapsed])

  const activePanel = panels.find((p) => p.id === activeTab)

  // G5-2: Collapsed — thin handle bar with chevron
  if (collapsed) {
    return (
      <div
        style={{
          ...dockStyle,
          height: COLLAPSED_DOCK_HEIGHT,
          cursor: 'pointer',
          justifyContent: 'center',
        }}
        onClick={onToggleCollapsed}
        onMouseEnter={() => setHandleHovered(true)}
        onMouseLeave={() => setHandleHovered(false)}
        title="Expand dock"
      >
        <span
          style={{
            fontSize: '0.65rem',
            color: handleHovered ? 'var(--primary)' : 'var(--text-faint)',
            transition: 'color 0.15s ease, transform 0.2s ease',
            transform: handleHovered ? 'translateY(-1px)' : 'translateY(0)',
            userSelect: 'none',
          }}
        >
          {'\u2303'}
        </span>
      </div>
    )
  }

  return (
    <div style={{ ...dockStyle, height }}>
      {/* Resize handle + double-click collapse */}
      <div
        style={resizeHandleStyle}
        onMouseDown={onResizeStart}
        onDoubleClick={onToggleCollapsed}
        title="Drag to resize, double-click to collapse"
      />

      {/* Tab bar */}
      <div style={tabBarStyle}>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {panels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => switchTab(panel.id)}
              style={{
                ...tabBtnStyle,
                ...(panel.id === activeTab ? tabBtnActiveStyle : {}),
              }}
            >
              {panel.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel content */}
      <div style={contentStyle}>{activePanel?.content}</div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const dockStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 48, // leave room for vertical CanvasToolbar
  zIndex: 15,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--card-bg, #1e1e1e)',
  borderTop: '1px solid var(--border, #333)',
  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
  fontSize: '0.72rem',
  color: 'var(--text, #f4f4f3)',
}

const resizeHandleStyle: React.CSSProperties = {
  position: 'absolute',
  top: -3,
  left: 0,
  right: 0,
  height: 6,
  cursor: 'ns-resize',
  zIndex: 1,
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 6px',
  borderBottom: '1px solid var(--border, #333)',
  flexShrink: 0,
  height: 28,
}

const tabBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: 'none',
  borderBottom: '2px solid transparent',
  background: 'transparent',
  color: 'var(--text, #f4f4f3)',
  opacity: 0.5,
  cursor: 'pointer',
  fontSize: '0.72rem',
  fontFamily: 'inherit',
  fontWeight: 500,
}

const tabBtnActiveStyle: React.CSSProperties = {
  opacity: 1,
  borderBottomColor: '#1CABB0',
  color: '#1CABB0',
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
}
