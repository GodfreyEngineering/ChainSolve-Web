/**
 * CanvasToolbar — draggable toolbar that snaps to any edge of the canvas.
 *
 * G5-3: Always visible, auto-rotates horizontal/vertical based on snap edge,
 * draggable to top/right/bottom/left. Hover animations on icons (CAD-style).
 *
 * Contains canvas interaction tools (pan, zoom, fit, snap, lock),
 * view toggles (minimap, edges, LOD, badges),
 * engine controls (pause, refresh), and inspector toggle.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { useTranslation } from 'react-i18next'

export interface CanvasToolbarProps {
  panMode: boolean
  locked: boolean
  snapToGrid: boolean
  minimap: boolean
  paused: boolean
  inspVisible: boolean
  readOnly: boolean
  onTogglePan: () => void
  onToggleLock: () => void
  onToggleSnap: () => void
  onToggleMinimap: () => void
  onTogglePause: () => void
  onRefresh: () => void
  onToggleInspector: () => void
  onAutoOrganise: (shiftKey: boolean) => void
  edgesAnimated: boolean
  lodEnabled: boolean
  onToggleEdgesAnimated: () => void
  onToggleLod: () => void
  badgesEnabled?: boolean
  onToggleBadges?: () => void
  edgeBadgesEnabled?: boolean
  onToggleEdgeBadges?: () => void
  bgDotsVisible?: boolean
  onToggleBgDots?: () => void
}

/** Width/height of the toolbar strip in pixels, exported for layout calculations. */
export const CANVAS_TOOLBAR_WIDTH = 40

// ── Snap position persistence ─────────────────────────────────────────────

type SnapEdge = 'top' | 'right' | 'bottom' | 'left'
const SNAP_KEY = 'cs:toolbarSnap'

function loadSnap(): SnapEdge {
  try {
    const v = localStorage.getItem(SNAP_KEY) as SnapEdge | null
    if (v === 'top' || v === 'right' || v === 'bottom' || v === 'left') return v
  } catch {
    // ignore
  }
  return 'top'
}

function saveSnap(edge: SnapEdge) {
  try {
    localStorage.setItem(SNAP_KEY, edge)
  } catch {
    // ignore
  }
}

// ── Snap-edge style computation ───────────────────────────────────────────

function isHorizontal(edge: SnapEdge): boolean {
  return edge === 'top' || edge === 'bottom'
}

function computeBarStyle(edge: SnapEdge): React.CSSProperties {
  const horiz = isHorizontal(edge)
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 16,
    display: 'flex',
    flexDirection: horiz ? 'row' : 'column',
    alignItems: 'center',
    gap: '0.15rem',
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: horiz ? '0.25rem 0.35rem' : '0.35rem 0.25rem',
    boxShadow: 'var(--shadow-md)',
    cursor: 'grab',
    userSelect: 'none',
    transition: 'top 0.2s ease, right 0.2s ease, bottom 0.2s ease, left 0.2s ease',
  }
  if (horiz) {
    base.maxWidth = 'calc(100% - 24px)'
    base.overflowX = 'auto'
    base.overflowY = 'hidden'
  } else {
    base.maxHeight = 'calc(100% - 24px)'
    base.overflowY = 'auto'
    base.overflowX = 'hidden'
  }
  // Position on the chosen edge, centered along the other axis
  switch (edge) {
    case 'top':
      base.top = 8
      base.left = '50%'
      base.transform = 'translateX(-50%)'
      break
    case 'bottom':
      base.bottom = 8
      base.left = '50%'
      base.transform = 'translateX(-50%)'
      break
    case 'left':
      base.left = 8
      base.top = '50%'
      base.transform = 'translateY(-50%)'
      break
    case 'right':
      base.right = 8
      base.top = '50%'
      base.transform = 'translateY(-50%)'
      break
  }
  return base
}

function computeSepStyle(edge: SnapEdge): React.CSSProperties {
  const horiz = isHorizontal(edge)
  return {
    width: horiz ? 1 : 18,
    height: horiz ? 18 : 1,
    background: 'var(--border)',
    margin: horiz ? '0 0.1rem' : '0.1rem 0',
    flexShrink: 0,
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function CanvasToolbar({
  panMode,
  locked,
  snapToGrid,
  minimap,
  paused,
  inspVisible,
  readOnly,
  onTogglePan,
  onToggleLock,
  onToggleSnap,
  onToggleMinimap,
  onTogglePause,
  onRefresh,
  onToggleInspector,
  onAutoOrganise,
  edgesAnimated,
  lodEnabled,
  onToggleEdgesAnimated,
  onToggleLod,
  badgesEnabled,
  onToggleBadges,
  edgeBadgesEnabled,
  onToggleEdgeBadges,
  bgDotsVisible,
  onToggleBgDots,
}: CanvasToolbarProps) {
  const { t } = useTranslation()
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow()
  const { zoom } = useViewport()
  const [editingZoom, setEditingZoom] = useState<string | null>(null)
  const [snapEdge, setSnapEdge] = useState<SnapEdge>(loadSnap)
  const [dragging, setDragging] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // Persist snap edge
  useEffect(() => {
    saveSnap(snapEdge)
  }, [snapEdge])

  const handleZoomInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const val = parseFloat(editingZoom ?? '')
        if (!isNaN(val)) {
          const clamped = Math.min(Math.max(val, 8), 400)
          zoomTo(clamped / 100, { duration: 200 })
        }
        setEditingZoom(null)
      } else if (e.key === 'Escape') {
        setEditingZoom(null)
      }
    },
    [editingZoom, zoomTo],
  )

  const handleZoomInputBlur = useCallback(() => {
    setEditingZoom(null)
  }, [])

  // Drag to reposition — on mouseup, snap to nearest edge
  const onBarMouseDown = useCallback((e: React.MouseEvent) => {
    // Only initiate drag on the bar background, not on buttons/inputs
    if ((e.target as HTMLElement).closest('button, input')) return
    e.preventDefault()
    setDragging(true)

    const parent = barRef.current?.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()

    const onMove = () => {
      // Nothing to do during move — we snap on up
    }
    const onUp = (me: globalThis.MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setDragging(false)

      // Determine which edge the mouse is closest to
      const x = me.clientX - rect.left
      const y = me.clientY - rect.top
      const dTop = y
      const dBottom = rect.height - y
      const dLeft = x
      const dRight = rect.width - x
      const min = Math.min(dTop, dBottom, dLeft, dRight)

      if (min === dTop) setSnapEdge('top')
      else if (min === dBottom) setSnapEdge('bottom')
      else if (min === dLeft) setSnapEdge('left')
      else setSnapEdge('right')
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const pct = `${Math.round(zoom * 100)}%`
  const horiz = isHorizontal(snapEdge)
  const sep = computeSepStyle(snapEdge)

  return (
    <div
      ref={barRef}
      style={{
        ...computeBarStyle(snapEdge),
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      role="toolbar"
      aria-label={t('toolbar.label')}
      onMouseDown={onBarMouseDown}
      data-cs-toolbar
    >
      {/* G5-3: Hover animation styles */}
      <style>{`
        [data-cs-toolbar] button {
          transition: transform 0.12s ease, background 0.1s ease;
        }
        [data-cs-toolbar] button:hover {
          transform: scale(1.15);
        }
        [data-cs-toolbar] button:active {
          transform: scale(0.95);
        }
      `}</style>

      {/* ── Canvas tools ── */}
      {!readOnly && (
        <button
          onClick={onTogglePan}
          style={btnStyle(panMode)}
          title={t('toolbar.panMode')}
          aria-label={t('toolbar.panMode')}
          aria-pressed={panMode}
        >
          {'\u270b'}
        </button>
      )}

      <div style={sep} />

      {/* Zoom controls */}
      <button
        onClick={() => zoomOut({ duration: 200 })}
        style={btnStyle(false)}
        title={t('toolbar.zoomOut')}
        aria-label={t('toolbar.zoomOut')}
      >
        {'\u2212'}
      </button>

      {editingZoom !== null ? (
        <input
          autoFocus
          type="text"
          value={editingZoom}
          onChange={(e) => setEditingZoom(e.target.value)}
          onKeyDown={handleZoomInputKeyDown}
          onBlur={handleZoomInputBlur}
          style={horiz ? { ...zoomInputStyle, width: 36 } : zoomInputStyle}
          aria-label={t('toolbar.zoomLevel')}
        />
      ) : (
        <button
          onClick={() => setEditingZoom(String(Math.round(zoom * 100)))}
          style={horiz ? { ...zoomDisplayStyle, width: 36 } : zoomDisplayStyle}
          title={t('toolbar.zoomLevel')}
          aria-label={t('toolbar.zoomLevel')}
        >
          {pct}
        </button>
      )}

      <button
        onClick={() => zoomIn({ duration: 200 })}
        style={btnStyle(false)}
        title={t('toolbar.zoomIn')}
        aria-label={t('toolbar.zoomIn')}
      >
        +
      </button>

      <button
        onClick={() => fitView({ padding: 0.15, duration: 300 })}
        style={btnStyle(false)}
        title={t('toolbar.fitView')}
        aria-label={t('toolbar.fitView')}
      >
        {'\u2b13'}
      </button>

      {/* ── Layout ── */}
      {!readOnly && (
        <>
          <div style={sep} />
          <button
            onClick={onToggleLock}
            style={btnStyle(locked)}
            title={t('toolbar.lockLayout')}
            aria-label={t('toolbar.lockLayout')}
            aria-pressed={locked}
          >
            {locked ? '\ud83d\udd12' : '\ud83d\udd13'}
          </button>
          <button
            onClick={onToggleSnap}
            style={btnStyle(snapToGrid)}
            title={t('toolbar.snapGrid')}
            aria-label={t('toolbar.snapGrid')}
            aria-pressed={snapToGrid}
          >
            {'\u229e'}
          </button>
          <button
            onClick={(e) => onAutoOrganise(e.shiftKey)}
            style={btnStyle(false)}
            title={t('toolbar.autoOrganise')}
            aria-label={t('toolbar.autoOrganise')}
          >
            {'\u26a1'}
          </button>
        </>
      )}

      <div style={sep} />

      {/* ── View ── */}
      <button
        onClick={onToggleMinimap}
        style={btnStyle(minimap)}
        title={t('toolbar.minimap')}
        aria-label={t('toolbar.minimap')}
        aria-pressed={minimap}
      >
        {'\ud83d\uddfa'}
      </button>

      {onToggleBgDots && (
        <button
          onClick={onToggleBgDots}
          style={btnStyle(!!bgDotsVisible)}
          title={t('toolbar.bgDots')}
          aria-label={t('toolbar.bgDots')}
          aria-pressed={!!bgDotsVisible}
        >
          {'\u2059'}
        </button>
      )}

      <button
        onClick={onToggleEdgesAnimated}
        style={btnStyle(edgesAnimated)}
        title={t('toolbar.animatedEdges')}
        aria-label={t('toolbar.animatedEdges')}
        aria-pressed={edgesAnimated}
      >
        {'\u2248'}
      </button>

      <button
        onClick={onToggleLod}
        style={btnStyle(lodEnabled)}
        title={t('toolbar.lod')}
        aria-label={t('toolbar.lod')}
        aria-pressed={lodEnabled}
      >
        {'\u25e7'}
      </button>

      {onToggleBadges && (
        <button
          onClick={onToggleBadges}
          style={btnStyle(!!badgesEnabled)}
          title={t('toolbar.valueBadges')}
          aria-label={t('toolbar.valueBadges')}
          aria-pressed={!!badgesEnabled}
        >
          {'\u2b1a'}
        </button>
      )}

      {onToggleEdgeBadges && (
        <button
          onClick={onToggleEdgeBadges}
          style={btnStyle(!!edgeBadgesEnabled)}
          title={t('toolbar.edgeBadges')}
          aria-label={t('toolbar.edgeBadges')}
          aria-pressed={!!edgeBadgesEnabled}
        >
          {'\u22ef'}
        </button>
      )}

      <div style={sep} />

      {/* ── Engine ── */}
      <button
        onClick={onTogglePause}
        style={btnStyle(paused)}
        title={paused ? t('toolbar.resumeEval') : t('toolbar.pauseEval')}
        aria-label={paused ? t('toolbar.resumeEval') : t('toolbar.pauseEval')}
        aria-pressed={paused}
      >
        {paused ? '\u25b6' : '\u23f8'}
      </button>

      <button
        onClick={onRefresh}
        style={btnStyle(false)}
        title={t('toolbar.refresh')}
        aria-label={t('toolbar.refresh')}
      >
        {'\u21bb'}
      </button>

      <div style={sep} />

      {/* ── Panels ── */}
      <button
        onClick={onToggleInspector}
        style={btnStyle(inspVisible)}
        title={t('toolbar.inspector')}
        aria-label={t('toolbar.inspector')}
        aria-pressed={inspVisible}
      >
        {'\u229f'}
      </button>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.2rem',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: active ? 'var(--primary-dim)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text)',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    lineHeight: 1.2,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
}

const zoomDisplayStyle: React.CSSProperties = {
  padding: '0.15rem 0',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.62rem',
  fontWeight: 500,
  width: 28,
  textAlign: 'center' as const,
  lineHeight: 1.2,
}

const zoomInputStyle: React.CSSProperties = {
  width: 28,
  padding: '0.1rem 0',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--primary)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.62rem',
  textAlign: 'center' as const,
  outline: 'none',
}
