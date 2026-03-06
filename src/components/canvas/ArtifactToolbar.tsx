/**
 * ArtifactToolbar — draggable mini toolbar with snap-to-8-positions.
 *
 * Phase L: Variables, Materials, Groups buttons.
 * Snap positions: top-left, top-center, top-right, middle-left, middle-right,
 * bottom-left, bottom-center, bottom-right.
 * Ghost preview shown during drag.
 */

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Variable, Gem, Layers } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'

// ── Snap positions ──────────────────────────────────────────────────────────

type SnapPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

const SNAP_POSITIONS: SnapPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const SNAP_KEY = 'cs:artifactToolbarSnap'
const INSET = 10

function loadSnap(): SnapPosition {
  try {
    const v = localStorage.getItem(SNAP_KEY) as SnapPosition | null
    if (v && SNAP_POSITIONS.includes(v)) return v
  } catch {
    // ignore
  }
  return 'top-right'
}

function saveSnap(pos: SnapPosition) {
  try {
    localStorage.setItem(SNAP_KEY, pos)
  } catch {
    // ignore
  }
}

function isHorizontal(pos: SnapPosition): boolean {
  return pos.startsWith('top-') || pos.startsWith('bottom-')
}

function computeStyle(pos: SnapPosition): React.CSSProperties {
  const horiz = isHorizontal(pos)
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 18,
    display: 'flex',
    flexDirection: horiz ? 'row' : 'column',
    gap: '0.3rem',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.35rem',
    boxShadow: 'var(--shadow-md)',
    transition: 'top 0.2s ease, right 0.2s ease, bottom 0.2s ease, left 0.2s ease',
  }

  // Vertical axis
  if (pos.startsWith('top-')) {
    base.top = INSET
  } else if (pos.startsWith('middle-')) {
    base.top = '50%'
    base.transform = 'translateY(-50%)'
  } else {
    base.bottom = INSET
  }

  // Horizontal axis
  if (pos.endsWith('-left')) {
    base.left = INSET
  } else if (pos.endsWith('-center')) {
    if (base.transform) {
      base.left = '50%'
      base.transform = 'translate(-50%, -50%)'
    } else {
      base.left = '50%'
      base.transform = 'translateX(-50%)'
    }
  } else {
    base.right = INSET
  }

  return base
}

function computeGhostStyle(pos: SnapPosition): React.CSSProperties {
  return {
    ...computeStyle(pos),
    background: 'color-mix(in srgb, var(--primary) 20%, transparent)',
    border: '2px dashed var(--primary)',
    boxShadow: '0 0 12px color-mix(in srgb, var(--primary) 30%, transparent)',
    pointerEvents: 'none',
    opacity: 0.7,
    transition: 'none',
  }
}

/** Given mouse position within the container, find nearest snap position. */
function nearestSnap(x: number, y: number, containerW: number, containerH: number): SnapPosition {
  // Divide into 3x3 grid
  const col = x < containerW / 3 ? 'left' : x > (containerW * 2) / 3 ? 'right' : 'center'
  const row = y < containerH / 3 ? 'top' : y > (containerH * 2) / 3 ? 'bottom' : 'middle'

  // middle-center isn't a valid position, snap to nearest edge
  if (row === 'middle' && col === 'center') {
    // Pick whichever axis is further from center
    const dx = Math.abs(x - containerW / 2)
    const dy = Math.abs(y - containerH / 2)
    if (dx >= dy) {
      return x < containerW / 2 ? 'middle-left' : 'middle-right'
    }
    return y < containerH / 2 ? 'top-center' : 'bottom-center'
  }

  return `${row}-${col}` as SnapPosition
}

// ── Button style ────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  padding: '0.3rem 0.55rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '0.72rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  letterSpacing: '0.02em',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

// ── Component ───────────────────────────────────────────────────────────────

export interface ArtifactToolbarProps {
  onOpenVariables?: () => void
  onOpenMaterials?: () => void
  onOpenGroups?: () => void
  readOnly?: boolean
  isMobile?: boolean
}

export function ArtifactToolbar({
  onOpenVariables,
  onOpenMaterials,
  onOpenGroups,
  readOnly,
  isMobile,
}: ArtifactToolbarProps) {
  const { t } = useTranslation()
  const [snap, setSnap] = useState(loadSnap)
  const [dragging, setDragging] = useState(false)
  const [ghostSnap, setGhostSnap] = useState<SnapPosition | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragActiveRef = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag on the toolbar background, not on buttons
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    dragActiveRef.current = false

    const onMove = (me: MouseEvent) => {
      // Require 5px movement before starting drag (avoid accidental drags)
      if (!dragActiveRef.current && dragStartRef.current) {
        const dx = Math.abs(me.clientX - dragStartRef.current.x)
        const dy = Math.abs(me.clientY - dragStartRef.current.y)
        if (dx + dy < 5) return
        dragActiveRef.current = true
        setDragging(true)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }

      // Find the canvas container (parent with position:relative)
      const parent = containerRef.current?.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      const x = me.clientX - rect.left
      const y = me.clientY - rect.top
      setGhostSnap(nearestSnap(x, y, rect.width, rect.height))
    }

    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)

      setDragging(false)
      dragActiveRef.current = false
      setGhostSnap((g) => {
        if (g) {
          setSnap(g)
          saveSnap(g)
        }
        return null
      })
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // Tooltip side based on position
  const tooltipSide = snap.endsWith('-right') ? 'left' : 'right'

  // Hide on mobile
  if (isMobile) return null

  // Don't render if no actions available
  const hasAnyAction = onOpenVariables || onOpenMaterials || onOpenGroups
  if (!hasAnyAction) return null

  return (
    <>
      {/* Ghost preview during drag */}
      {dragging && ghostSnap && (
        <GhostToolbar
          snap={ghostSnap}
          buttonCount={
            (onOpenVariables && !readOnly ? 1 : 0) +
            (onOpenMaterials && !readOnly ? 1 : 0) +
            (onOpenGroups && !readOnly ? 1 : 0)
          }
        />
      )}

      <div
        ref={containerRef}
        style={{
          ...computeStyle(snap),
          cursor: dragging ? 'grabbing' : 'grab',
          opacity: dragging ? 0.5 : 1,
        }}
        onMouseDown={onMouseDown}
      >
        {!readOnly && onOpenVariables && (
          <Tooltip content={t('toolbar.variables')} side={tooltipSide}>
            <button onClick={onOpenVariables} style={btnStyle} aria-label={t('toolbar.variables')}>
              <Variable size={16} />
            </button>
          </Tooltip>
        )}

        {!readOnly && onOpenMaterials && (
          <Tooltip content={t('toolbar.materials')} side={tooltipSide}>
            <button onClick={onOpenMaterials} style={btnStyle} aria-label={t('toolbar.materials')}>
              <Gem size={16} />
            </button>
          </Tooltip>
        )}

        {!readOnly && onOpenGroups && (
          <Tooltip content={t('toolbar.groups')} side={tooltipSide}>
            <button onClick={onOpenGroups} style={btnStyle} aria-label={t('toolbar.groups')}>
              <Layers size={16} />
            </button>
          </Tooltip>
        )}
      </div>
    </>
  )
}

// ── Ghost toolbar ───────────────────────────────────────────────────────────

function GhostToolbar({ snap, buttonCount }: { snap: SnapPosition; buttonCount: number }) {
  return (
    <div style={computeGhostStyle(snap)}>
      {Array.from({ length: buttonCount }, (_, i) => (
        <div
          key={i}
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-md)',
            border: '1px dashed color-mix(in srgb, var(--primary) 50%, transparent)',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}
