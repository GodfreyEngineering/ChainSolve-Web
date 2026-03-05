/**
 * AiDockPanel — right-side docking panel for the AI Copilot (G8-1).
 *
 * Provides a collapsible/expandable side panel on the right edge of the
 * canvas area. When collapsed, shows a thin vertical handle strip with
 * chevron. When expanded, shows the AI content with a draggable left
 * edge for resizing. Width and collapsed state persist to localStorage.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'

const STORAGE_WIDTH_KEY = 'cs:aiDockWidth'
const STORAGE_COLLAPSED_KEY = 'cs:aiDockCollapsed'
const DEFAULT_WIDTH = 380
const MIN_WIDTH = 280
const MAX_WIDTH = 700
const HANDLE_WIDTH = 28

function readPersistedWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_WIDTH_KEY)
    if (!raw) return DEFAULT_WIDTH
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH ? n : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}

function readPersistedCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_COLLAPSED_KEY) === 'true'
  } catch {
    return true
  }
}

function persistWidth(w: number) {
  try {
    localStorage.setItem(STORAGE_WIDTH_KEY, String(w))
  } catch {
    // Private browsing
  }
}

function persistCollapsed(v: boolean) {
  try {
    localStorage.setItem(STORAGE_COLLAPSED_KEY, String(v))
  } catch {
    // Private browsing
  }
}

interface AiDockPanelProps {
  children: ReactNode
  /** Whether the panel is open (AI window is active). */
  open: boolean
}

export function AiDockPanel({ children, open }: AiDockPanelProps) {
  const { t } = useTranslation()
  const [width, setWidth] = useState(readPersistedWidth)
  const [collapsed, setCollapsed] = useState(readPersistedCollapsed)
  const resizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      persistCollapsed(next)
      return next
    })
  }, [])

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      resizing.current = true
      startX.current = e.clientX
      startWidth.current = width
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'

      const onMove = (me: MouseEvent) => {
        if (!resizing.current) return
        // Dragging left edge: moving mouse left = wider, right = narrower
        const delta = startX.current - me.clientX
        const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
        setWidth(next)
      }
      const onUp = () => {
        resizing.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        // Persist final width
        setWidth((w) => {
          persistWidth(w)
          return w
        })
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [width],
  )

  // Keyboard shortcut: Ctrl/Cmd+Shift+A to toggle collapsed
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleCollapsed])

  // When panel is not open at all, render nothing
  if (!open) return null

  // Collapsed handle
  if (collapsed) {
    return <AiDockHandle side="expand" onClick={toggleCollapsed} title={t('ai.expandPanel')} />
  }

  // Expanded panel
  return (
    <div style={{ ...panelStyle, width }}>
      {/* Resize handle on left edge */}
      <AiDockHandle
        side="collapse"
        onResizeStart={onResizeStart}
        onClick={toggleCollapsed}
        title={t('ai.collapsePanel')}
      />
      {/* Panel content */}
      <div style={contentStyle}>{children}</div>
    </div>
  )
}

// ── Dock Handle ────────────────────────────────────────────────────────────

interface AiDockHandleProps {
  side: 'expand' | 'collapse'
  onClick?: () => void
  onResizeStart?: (e: React.MouseEvent) => void
  title?: string
}

function AiDockHandle({ side, onClick, onResizeStart, title }: AiDockHandleProps) {
  const { t } = useTranslation()
  const isExpand = side === 'expand'
  const shortcutLabel = navigator.platform?.includes('Mac') ? '⌘⇧A' : 'Ctrl+Shift+A'

  if (isExpand) {
    // Collapsed — single-click to expand, shows Sparkles icon + rotated "AI" label
    return (
      <Tooltip content={title ?? t('ai.expandPanel')} side="left" shortcut={shortcutLabel}>
        <div
          className="cs-dock-handle"
          style={{
            width: HANDLE_WIDTH,
            height: '100%',
            borderLeft: '1px solid var(--border)',
            background: 'var(--surface-1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            paddingTop: 10,
          }}
          onClick={onClick}
        >
          <Sparkles size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <ChevronLeft size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <span
            style={{
              writingMode: 'vertical-rl',
              fontSize: '0.6rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--text-faint)',
              userSelect: 'none',
            }}
          >
            AI
          </span>
        </div>
      </Tooltip>
    )
  }

  // Expanded — resize handle (drag) + collapse button (single-click)
  return (
    <>
      <div
        className="cs-dock-resize-handle"
        data-direction="horizontal-left"
        onMouseDown={onResizeStart}
        title={t('dock.dragToResize')}
      />
      <Tooltip content={title ?? t('ai.collapsePanel')} side="left" shortcut={shortcutLabel}>
        <button
          className="cs-dock-collapse-btn"
          onClick={onClick}
          style={{ position: 'absolute', left: 2, top: 4, zIndex: 11 }}
        >
          <ChevronRight size={12} />
        </button>
      </Tooltip>
    </>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  height: '100%',
  position: 'relative',
  borderLeft: '1px solid var(--border)',
  background: 'var(--surface-1)',
  transition: 'width var(--transition-panel, 0.25s cubic-bezier(0.16, 1, 0.3, 1))',
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
}
