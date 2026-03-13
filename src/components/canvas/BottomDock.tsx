/**
 * BottomDock — tabbed bottom panel dock for canvas panels.
 *
 * Provides a workstation-IDE-like bottom panel with tabs, resizable height,
 * and persistent open/closed + active-tab state. Renders Debug Console,
 * Graph Health, and future panels in a single consistent container.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowManager } from '../../contexts/WindowManagerContext'
import { ChevronUp, ChevronDown, Terminal } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'

// ── Types ──────────────────────────────────────────────────────────────────

export type DockTab = 'console' | 'health' | 'output' | 'problems' | 'history' | 'notes'

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
  /** Right inset in px (leaves room for vertical toolbar). */
  rightInset?: number
  /** Called whenever the visible dock height changes (for minimap positioning). */
  onHeightChange?: (height: number) => void
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
    if (
      v === 'console' ||
      v === 'health' ||
      v === 'output' ||
      v === 'problems' ||
      v === 'history' ||
      v === 'notes'
    )
      return v
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
export const COLLAPSED_DOCK_HEIGHT = 32

export function BottomDock({
  panels,
  collapsed = false,
  onToggleCollapsed,
  rightInset = 0,
  onHeightChange,
}: BottomDockProps) {
  const { t } = useTranslation()
  const { windows } = useWindowManager()
  const [height, setHeight] = useState(loadHeight)
  const [activeTab, setActiveTab] = useState<DockTab>(() => {
    const saved = loadTab()
    if (panels.some((p) => p.id === saved)) return saved
    return panels[0]?.id ?? 'console'
  })
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const rafId = useRef(0)

  // Notify parent of effective height (for minimap positioning)
  useEffect(() => {
    onHeightChange?.(collapsed ? COLLAPSED_DOCK_HEIGHT : height)
  }, [height, collapsed, onHeightChange])

  // Persist tab changes
  const switchTab = useCallback((tab: DockTab) => {
    setActiveTab(tab)
    saveTab(tab)
  }, [])

  // Resize via drag on top edge — RAF throttled to prevent ResizeObserver loops
  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startH: height }

      const onMove = (me: MouseEvent) => {
        if (!dragRef.current) return
        cancelAnimationFrame(rafId.current)
        rafId.current = requestAnimationFrame(() => {
          if (!dragRef.current) return
          const delta = dragRef.current.startY - me.clientY
          const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragRef.current.startH + delta))
          setHeight(next)
        })
      }
      const onUp = () => {
        cancelAnimationFrame(rafId.current)
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
  const dockPositionStyle: React.CSSProperties = {
    ...dockStyle,
    right: rightInset,
  }

  // G5-2: Collapsed — thin handle bar with icon + label (single-click to expand)
  if (collapsed) {
    return (
      <Tooltip content={t('dock.expandDock')} side="top" display="block">
        <div
          className="cs-dock-handle"
          style={{
            ...dockPositionStyle,
            height: COLLAPSED_DOCK_HEIGHT,
            justifyContent: 'center',
            gap: 6,
          }}
          onClick={onToggleCollapsed}
        >
          <Terminal size={12} style={{ color: 'var(--text-faint)' }} />
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--text-faint)',
              userSelect: 'none',
            }}
          >
            {t('dock.console')}
          </span>
          <ChevronUp size={14} className="cs-dock-handle-chevron" />
        </div>
      </Tooltip>
    )
  }

  return (
    <div style={{ ...dockPositionStyle, height }}>
      {/* Resize handle (drag only — no double-click needed) */}
      <div
        className="cs-dock-resize-handle"
        data-direction="vertical"
        onMouseDown={onResizeStart}
        title={t('dock.dragToResize')}
      />

      {/* Tab bar with collapse button */}
      <div style={tabBarStyle}>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {panels.map((panel) => (
            <button
              key={panel.id}
              className="cs-dock-tab"
              data-active={panel.id === activeTab}
              data-tour={panel.id === 'problems' ? 'problems-panel' : undefined}
              onClick={() => switchTab(panel.id)}
              title={panel.label}
              aria-label={panel.label}
            >
              {panel.label}
            </button>
          ))}
        </div>
        {/* Single-click collapse button */}
        <Tooltip content={t('dock.collapseDock')} side="top">
          <button
            className="cs-dock-collapse-btn"
            onClick={onToggleCollapsed}
            aria-label={t('dock.collapseDock')}
          >
            <ChevronDown size={14} />
          </button>
        </Tooltip>
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
  zIndex: 15,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--surface-1)',
  borderTop: '1px solid var(--border, #333)',
  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
  fontSize: '0.72rem',
  color: 'var(--text, #f4f4f3)',
  transition: 'height var(--transition-panel, 0.25s cubic-bezier(0.16, 1, 0.3, 1))',
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 6px',
  borderBottom: '1px solid var(--border, #333)',
  flexShrink: 0,
  height: 28,
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
}
