/**
 * MinimapWrapper — draggable container for the ReactFlow MiniMap.
 *
 * Renders as an absolute-positioned overlay on top of all canvas panels.
 * Supports drag-to-snap to 4 corner positions (TL, TR, BL, BR)
 * with ghost preview during drag. Position persists to localStorage.
 *
 * UX-11: Added node-count header, fade-when-idle, right-click → Fit All.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

// ── Snap positions ──────────────────────────────────────────────────────────

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const CORNERS: Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
const SNAP_KEY = 'cs:minimapCorner'
const INSET = 10

function loadCorner(): Corner {
  try {
    const v = localStorage.getItem(SNAP_KEY) as Corner | null
    if (v && CORNERS.includes(v)) return v
  } catch {
    // ignore
  }
  return 'bottom-right'
}

function saveCorner(pos: Corner) {
  try {
    localStorage.setItem(SNAP_KEY, pos)
  } catch {
    // ignore
  }
}

function cornerStyle(pos: Corner, bottomOffset: number): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 25,
    transition: 'top 0.2s ease, right 0.2s ease, bottom 0.2s ease, left 0.2s ease',
  }

  if (pos.startsWith('top-')) base.top = INSET
  else base.bottom = INSET + bottomOffset

  if (pos.endsWith('-left')) base.left = INSET
  else base.right = INSET

  return base
}

function ghostStyle(pos: Corner, bottomOffset: number): React.CSSProperties {
  return {
    ...cornerStyle(pos, bottomOffset),
    width: 160,
    height: 100,
    borderRadius: 'var(--radius-md)',
    background: 'color-mix(in srgb, var(--primary) 20%, transparent)',
    border: '2px dashed var(--primary)',
    boxShadow: '0 0 12px color-mix(in srgb, var(--primary) 30%, transparent)',
    pointerEvents: 'none',
    opacity: 0.7,
    transition: 'none',
  }
}

/** Given mouse within container, find nearest corner. */
function nearestCorner(x: number, y: number, w: number, h: number): Corner {
  const col = x < w / 2 ? 'left' : 'right'
  const row = y < h / 2 ? 'top' : 'bottom'
  return `${row}-${col}` as Corner
}

// ── Component ───────────────────────────────────────────────────────────────

interface MinimapWrapperProps {
  children: ReactNode
  /** Current bottom dock height in px. Used to keep minimap above the dock. */
  bottomOffset?: number
  /** UX-11: Total node count shown in header. */
  nodeCount?: number
  /** UX-11: Called on right-click → Fit All. */
  onFitView?: () => void
}

export function MinimapWrapper({
  children,
  bottomOffset = 40,
  nodeCount,
  onFitView,
}: MinimapWrapperProps) {
  const [corner, setCorner] = useState(loadCorner)
  const [dragging, setDragging] = useState(false)
  const [ghostCorner, setGhostCorner] = useState<Corner | null>(null)
  // UX-11: Fade when idle — active (opacity 1) on hover; fades to 0.45 after 3s idle
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragActiveRef = useRef(false)

  // Bring to full opacity, start idle timer
  const bringActive = useCallback(() => {
    setActive(true)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (!hovered) setActive(false)
    }, 3000)
  }, [hovered])

  // On first mount, start idle timer
  useEffect(() => {
    bringActive()
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onMouseEnter = useCallback(() => {
    setHovered(true)
    setActive(true)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
  }, [])

  const onMouseLeave = useCallback(() => {
    setHovered(false)
    idleTimerRef.current = setTimeout(() => setActive(false), 2000)
  }, [])

  // UX-11: right-click → Fit All context menu
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onFitView?.()
    },
    [onFitView],
  )

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only left-button drag
    if (e.button !== 0) return
    e.preventDefault()
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    dragActiveRef.current = false

    const onMove = (me: MouseEvent) => {
      if (!dragActiveRef.current && dragStartRef.current) {
        const dx = Math.abs(me.clientX - dragStartRef.current.x)
        const dy = Math.abs(me.clientY - dragStartRef.current.y)
        if (dx + dy < 5) return
        dragActiveRef.current = true
        setDragging(true)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }

      const parent = wrapperRef.current?.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      const x = me.clientX - rect.left
      const y = me.clientY - rect.top
      setGhostCorner(nearestCorner(x, y, rect.width, rect.height))
    }

    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)

      setDragging(false)
      dragActiveRef.current = false
      setGhostCorner((g) => {
        if (g) {
          setCorner(g)
          saveCorner(g)
        }
        return null
      })
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const opacity = active || hovered ? 1 : 0.45

  return (
    <>
      <div
        ref={wrapperRef}
        style={{
          ...cornerStyle(corner, bottomOffset),
          cursor: dragging ? 'grabbing' : 'grab',
          opacity,
          transition: 'opacity 0.5s ease',
        }}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
      >
        {/* UX-11: Node count header */}
        {nodeCount !== undefined && (
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderBottom: 'none',
              borderRadius: '4px 4px 0 0',
              padding: '1px 6px',
              fontSize: '0.6rem',
              color: 'var(--text-faint)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              userSelect: 'none',
            }}
            title="Right-click to fit all"
          >
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{nodeCount}</span>
            <span>node{nodeCount === 1 ? '' : 's'}</span>
            {onFitView && (
              <span
                style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '0.55rem' }}
              >
                ⌥ fit
              </span>
            )}
          </div>
        )}
        {children}
      </div>
      {dragging && ghostCorner && <div style={ghostStyle(ghostCorner, bottomOffset)} />}
    </>
  )
}
