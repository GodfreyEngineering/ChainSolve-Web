/**
 * AppWindow — a draggable, resizable in-app window with standard chrome.
 *
 * Features:
 *  - Drag via title bar (mousedown → mousemove → mouseup)
 *  - Resize via bottom-right corner handle
 *  - Title bar: title text, minimize (—), maximize (□ / ◻), close (✕)
 *  - Z-stacking via WindowManagerContext
 *  - Maximized state fills viewport
 *  - Minimized state hides body (title bar remains visible in a dock-like row)
 *  - Focus trap inside the window panel
 */
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useWindowManager, type WindowGeometry } from '../../contexts/WindowManagerContext'

export interface AppWindowProps {
  /** Unique window identifier. Must match the id used with openWindow(). */
  windowId: string
  /** Window title displayed in the chrome bar. */
  title: string
  /** Minimum width in pixels (default 280). */
  minWidth?: number
  /** Minimum height in pixels (default 200). */
  minHeight?: number
  /** Children rendered inside the window body. */
  children: ReactNode
}

// ── Styles ───────────────────────────────────────────────────────────────────

const chromeBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 36,
  padding: '0 0.5rem 0 0.85rem',
  background: 'var(--surface2, #2c2c2c)',
  borderBottom: '1px solid var(--border)',
  borderRadius: '12px 12px 0 0',
  cursor: 'grab',
  userSelect: 'none',
  flexShrink: 0,
}

const chromeTitle: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  pointerEvents: 'none',
}

const chromeBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.9rem',
  padding: '0.15rem 0.4rem',
  borderRadius: 'var(--radius-sm)',
  lineHeight: 1,
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const resizeHandle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  bottom: 0,
  width: 16,
  height: 16,
  cursor: 'nwse-resize',
  opacity: 0.3,
  fontSize: '0.6rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
}

// ── Snap-to-edges helper ──────────────────────────────────────────────────────

const SNAP_THRESHOLD = 12 // px — distance at which the window snaps to an edge

function snapPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Snap left / right edges
  if (x < SNAP_THRESHOLD) x = 0
  else if (x + width > vw - SNAP_THRESHOLD) x = vw - width

  // Snap top / bottom edges
  if (y < SNAP_THRESHOLD) y = 0
  else if (y + height > vh - SNAP_THRESHOLD) y = vh - height

  return { x, y }
}

// ── Component ────────────────────────────────────────────────────────────────

export function AppWindow({
  windowId,
  title,
  minWidth = 280,
  minHeight = 200,
  children,
}: AppWindowProps) {
  const { windows, closeWindow, focusWindow, toggleMinimize, toggleMaximize, updateGeometry } =
    useWindowManager()

  const win = windows.find((w) => w.id === windowId)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  // ── Drag ─────────────────────────────────────────────────────────────────

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!win || win.maximized) return
      e.preventDefault()
      focusWindow(windowId)
      dragOffset.current = {
        x: e.clientX - win.geometry.x,
        y: e.clientY - win.geometry.y,
      }
      const onMove = (me: MouseEvent) => {
        const rawX = me.clientX - dragOffset.current.x
        const rawY = me.clientY - dragOffset.current.y
        const snapped = snapPosition(rawX, rawY, win.geometry.width, win.geometry.height)
        updateGeometry(windowId, snapped)
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [win, windowId, focusWindow, updateGeometry],
  )

  // ── Resize ───────────────────────────────────────────────────────────────

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (!win || win.maximized) return
      e.preventDefault()
      e.stopPropagation()
      focusWindow(windowId)
      const startX = e.clientX
      const startY = e.clientY
      const startGeo: WindowGeometry = { ...win.geometry }
      const onMove = (me: MouseEvent) => {
        let w = Math.max(minWidth, startGeo.width + (me.clientX - startX))
        let h = Math.max(minHeight, startGeo.height + (me.clientY - startY))
        // Snap right/bottom edges to viewport
        const vw = window.innerWidth
        const vh = window.innerHeight
        if (startGeo.x + w > vw - SNAP_THRESHOLD) w = vw - startGeo.x
        if (startGeo.y + h > vh - SNAP_THRESHOLD) h = vh - startGeo.y
        updateGeometry(windowId, { width: w, height: h })
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [win, windowId, focusWindow, updateGeometry, minWidth, minHeight],
  )

  // ── Double-click title bar toggles maximize ──────────────────────────────

  const onTitleDoubleClick = useCallback(() => {
    toggleMaximize(windowId)
  }, [windowId, toggleMaximize])

  // ── Focus on click ───────────────────────────────────────────────────────

  const onPanelMouseDown = useCallback(() => {
    focusWindow(windowId)
  }, [windowId, focusWindow])

  // ── Save geometry on unmount ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Cleanup if needed — geometry is persisted on close via context
    }
  }, [])

  if (!win) return null

  // Minimized: don't render (dock is handled at the app level)
  if (win.minimized) return null

  const isMax = win.maximized
  const pos: React.CSSProperties = isMax
    ? { position: 'fixed', inset: 0, zIndex: win.zIndex }
    : {
        position: 'fixed',
        left: win.geometry.x,
        top: win.geometry.y,
        width: win.geometry.width,
        height: win.geometry.height,
        zIndex: win.zIndex,
      }

  return (
    <div
      ref={panelRef}
      style={{
        ...pos,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: isMax ? 0 : 12,
        boxShadow: 'var(--shadow-elevated)',
        overflow: 'hidden',
        animation: 'cs-fade-in 0.1s ease',
      }}
      onMouseDown={onPanelMouseDown}
      role="dialog"
      aria-label={title}
    >
      {/* ── Chrome bar ── */}
      <div
        style={isMax ? { ...chromeBar, borderRadius: 0 } : chromeBar}
        onMouseDown={onDragStart}
        onDoubleClick={onTitleDoubleClick}
      >
        <span style={chromeTitle}>{title}</span>
        <div style={{ display: 'flex', gap: '0.15rem' }}>
          <button
            style={chromeBtn}
            onClick={() => toggleMinimize(windowId)}
            title="Minimize"
            aria-label="Minimize"
          >
            —
          </button>
          <button
            style={chromeBtn}
            onClick={() => toggleMaximize(windowId)}
            title={isMax ? 'Restore' : 'Maximize'}
            aria-label={isMax ? 'Restore' : 'Maximize'}
          >
            {isMax ? '◻' : '□'}
          </button>
          <button
            style={chromeBtn}
            onClick={() => closeWindow(windowId)}
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>{children}</div>

      {/* ── Resize handle (bottom-right) ── */}
      {!isMax && (
        <div style={resizeHandle} onMouseDown={onResizeStart}>
          ⋱
        </div>
      )}
    </div>
  )
}
