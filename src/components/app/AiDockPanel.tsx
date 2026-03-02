/**
 * AiDockPanel — right-side docking panel for the AI Copilot (G8-1).
 *
 * Provides a collapsible/expandable side panel on the right edge of the
 * canvas area. When collapsed, shows a thin vertical handle strip with
 * chevron. When expanded, shows the AI content with a draggable left
 * edge for resizing. Width and collapsed state persist to localStorage.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const STORAGE_WIDTH_KEY = 'cs:aiDockWidth'
const STORAGE_COLLAPSED_KEY = 'cs:aiDockCollapsed'
const DEFAULT_WIDTH = 380
const MIN_WIDTH = 280
const MAX_WIDTH = 700
const HANDLE_WIDTH = 18

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
  const [hovered, setHovered] = useState(false)
  const isExpand = side === 'expand'
  // Left-pointing chevron when collapsed (expand opens panel to the left)
  // Right-pointing chevron when expanded (collapse hides panel to the right)
  const chevron = isExpand ? '\u2039' : '\u203A'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...(isExpand
          ? {
              width: HANDLE_WIDTH,
              height: '100%',
              borderLeft: '1px solid var(--border)',
              background: hovered ? 'var(--primary-dim)' : 'var(--card-bg)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s ease',
            }
          : {
              position: 'absolute' as const,
              left: -3,
              top: 0,
              bottom: 0,
              width: 8,
              cursor: 'ew-resize',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }),
      }}
      onClick={isExpand ? onClick : undefined}
      onMouseDown={!isExpand ? onResizeStart : undefined}
      onDoubleClick={!isExpand ? onClick : undefined}
      title={title}
    >
      <span
        style={{
          fontSize: isExpand ? '1rem' : '0.7rem',
          color: hovered ? 'var(--primary)' : 'var(--text-faint)',
          transition: 'color 0.15s ease, transform 0.2s ease',
          transform: hovered ? `translateX(${isExpand ? '-2px' : '1px'})` : 'translateX(0)',
          lineHeight: 1,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {chevron}
      </span>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  height: '100%',
  position: 'relative',
  borderLeft: '1px solid var(--border)',
  background: 'var(--card-bg)',
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
}
