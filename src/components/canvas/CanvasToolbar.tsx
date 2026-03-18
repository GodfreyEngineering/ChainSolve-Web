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
import { useCallback, useRef, useState } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '../ui/Tooltip'
import {
  Hand,
  ZoomOut,
  ZoomIn,
  Maximize,
  Lock,
  Unlock,
  Grid3x3,
  Zap,
  Map,
  Circle,
  Waves,
  Layers,
  Tag,
  Tags,
  Pause,
  Play,
  RefreshCw,
  PanelRight,
  Eye,
  EyeOff,
  ScanEye,
  Projector,
  Bot,
  GitBranch,
} from 'lucide-react'

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
  /** 3.23: Edge bundling toggle. */
  edgeBundlingEnabled?: boolean
  onToggleEdgeBundling?: () => void
  /** 3.21: Smart edge routing toggle. */
  smartEdgeRoutingEnabled?: boolean
  onToggleSmartEdgeRouting?: () => void
  /** I3-1: Insert annotation at viewport center. */
  onInsertAnnotation?: (annotationType: string) => void
  /** K2-1: Toggle hidden-view mode (show hidden blocks as ghosts). */
  hiddenViewMode?: boolean
  onToggleHiddenView?: () => void
  /** K2-1: True when any node is hidden. */
  hasHiddenNodes?: boolean
  /** K2-1: Show all hidden blocks. */
  onShowAllHidden?: () => void
  /** UX-19: Presentation mode toggle. */
  presentationMode?: boolean
  onTogglePresentationMode?: () => void
  /** 8.04: Mobile mode — larger touch targets. */
  isMobile?: boolean
  /** 9.12: AI assistant panel toggle. */
  aiPanelOpen?: boolean
  onToggleAiPanel?: () => void
  /** Phase 1: Trigger evaluation (Run button). */
  onRun?: () => void
  /** Phase 1: Whether the graph has changed since last eval. */
  isStale?: boolean
  /** Phase 1: Number of pending patch ops awaiting dispatch. */
  pendingPatchCount?: number
  /** Phase 1: Current engine status string for tooltip. */
  engineStatus?: string
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
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: '1px solid var(--glass-border)',
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

/** Ghost preview style — semi-transparent toolbar outline at target edge. */
function computeGhostStyle(edge: SnapEdge): React.CSSProperties {
  return {
    ...computeBarStyle(edge),
    background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
    border: '2px dashed var(--primary)',
    boxShadow: '0 0 12px color-mix(in srgb, var(--primary) 30%, transparent)',
    pointerEvents: 'none',
    opacity: 0.7,
    transition: 'none',
    cursor: 'default',
    // Approximate toolbar dimensions
    width: isHorizontal(edge) ? 480 : 36,
    height: isHorizontal(edge) ? 36 : 480,
    maxWidth: isHorizontal(edge) ? 'calc(100% - 24px)' : undefined,
    maxHeight: isHorizontal(edge) ? undefined : 'calc(100% - 24px)',
    overflow: 'hidden',
  }
}

/** Drop-zone edge strip — colored highlight on the target edge. */
function computeDropZoneStyle(edge: SnapEdge): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 15,
    background: 'color-mix(in srgb, var(--primary) 25%, transparent)',
    pointerEvents: 'none',
    transition: 'none',
  }
  switch (edge) {
    case 'top':
      base.top = 0
      base.left = 0
      base.right = 0
      base.height = 4
      break
    case 'bottom':
      base.bottom = 0
      base.left = 0
      base.right = 0
      base.height = 4
      break
    case 'left':
      base.top = 0
      base.bottom = 0
      base.left = 0
      base.width = 4
      break
    case 'right':
      base.top = 0
      base.bottom = 0
      base.right = 0
      base.width = 4
      break
  }
  return base
}

/** Determine nearest edge from mouse position within container. */
function nearestEdge(x: number, y: number, w: number, h: number): SnapEdge {
  const dTop = y
  const dBottom = h - y
  const dLeft = x
  const dRight = w - x
  const min = Math.min(dTop, dBottom, dLeft, dRight)
  if (min === dTop) return 'top'
  if (min === dBottom) return 'bottom'
  if (min === dLeft) return 'left'
  return 'right'
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
  edgeBundlingEnabled,
  onToggleEdgeBundling,
  smartEdgeRoutingEnabled,
  onToggleSmartEdgeRouting,
  // C.2: onInsertAnnotation no longer used in toolbar (annotations available via right-click menu)
  onInsertAnnotation: _,
  hiddenViewMode,
  onToggleHiddenView,
  hasHiddenNodes,
  onShowAllHidden,
  presentationMode,
  onTogglePresentationMode,
  isMobile,
  aiPanelOpen,
  onToggleAiPanel,
  onRun,
  isStale,
  pendingPatchCount,
  engineStatus: _es,
}: CanvasToolbarProps) {
  const { t } = useTranslation()
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow()
  const { zoom } = useViewport()
  const [editingZoom, setEditingZoom] = useState<string | null>(null)
  const [snapEdge, setSnapEdge] = useState<SnapEdge>(loadSnap)
  const [dragging, setDragging] = useState(false)
  const [ghostEdge, setGhostEdge] = useState<SnapEdge | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragActiveRef = useRef(false)

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

  // Drag to reposition — ghost preview tracks nearest edge during move
  const onBarMouseDown = useCallback((e: React.MouseEvent) => {
    // Only initiate drag on the bar background, not on buttons/inputs
    if ((e.target as HTMLElement).closest('button, input')) return
    e.preventDefault()
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    dragActiveRef.current = false

    const onMove = (me: globalThis.MouseEvent) => {
      // Require 5px movement before starting drag
      if (!dragActiveRef.current && dragStartRef.current) {
        const dx = Math.abs(me.clientX - dragStartRef.current.x)
        const dy = Math.abs(me.clientY - dragStartRef.current.y)
        if (dx + dy < 5) return
        dragActiveRef.current = true
        setDragging(true)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
      }

      const parent = barRef.current?.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      const x = me.clientX - rect.left
      const y = me.clientY - rect.top
      setGhostEdge(nearestEdge(x, y, rect.width, rect.height))
    }

    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)

      setDragging(false)
      dragActiveRef.current = false
      setGhostEdge((g) => {
        if (g) {
          setSnapEdge(g)
          saveSnap(g)
        }
        return null
      })
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const pct = `${Math.round(zoom * 100)}%`
  const horiz = isHorizontal(snapEdge)
  const sep = computeSepStyle(snapEdge)
  // Tooltip should appear on the opposite side of the snap edge
  const tipSide: 'top' | 'right' | 'bottom' | 'left' =
    snapEdge === 'top'
      ? 'bottom'
      : snapEdge === 'bottom'
        ? 'top'
        : snapEdge === 'left'
          ? 'right'
          : 'left'

  return (
    <>
      <div
        ref={barRef}
        style={{
          ...computeBarStyle(snapEdge),
          cursor: dragging ? 'grabbing' : 'grab',
          // 8.04: Scale up on mobile for WCAG ≥44px touch targets
          ...(isMobile
            ? {
                transform: `${computeBarStyle(snapEdge).transform ?? ''} scale(1.4)`.trim(),
                transformOrigin: 'center',
              }
            : {}),
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
          transform: scale(1.08);
        }
        [data-cs-toolbar] button:active {
          transform: scale(0.95);
        }
      `}</style>

        {/* ── Canvas tools ── */}
        {!readOnly && (
          <Tooltip content={t('toolbar.panMode')} side={tipSide}>
            <button
              onClick={onTogglePan}
              style={btnStyle(panMode)}
              aria-label={t('toolbar.panMode')}
              aria-pressed={panMode}
            >
              <Hand size={16} />
            </button>
          </Tooltip>
        )}

        <div style={sep} />

        {/* Zoom controls */}
        <Tooltip content={t('toolbar.zoomOut')} side={tipSide}>
          <button
            onClick={() => zoomOut({ duration: 200 })}
            style={btnStyle(false)}
            aria-label={t('toolbar.zoomOut')}
          >
            <ZoomOut size={16} />
          </button>
        </Tooltip>

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

        <Tooltip content={t('toolbar.zoomIn')} side={tipSide}>
          <button
            onClick={() => zoomIn({ duration: 200 })}
            style={btnStyle(false)}
            aria-label={t('toolbar.zoomIn')}
          >
            <ZoomIn size={16} />
          </button>
        </Tooltip>

        <Tooltip content={t('toolbar.fitView')} side={tipSide}>
          <button
            onClick={() => fitView({ padding: 0.15, duration: 300 })}
            style={btnStyle(false)}
            aria-label={t('toolbar.fitView')}
          >
            <Maximize size={16} />
          </button>
        </Tooltip>

        {/* ── Layout ── */}
        {!readOnly && (
          <>
            <div style={sep} />
            <Tooltip content={t('toolbar.lockLayout')} side={tipSide}>
              <button
                onClick={onToggleLock}
                style={btnStyle(locked)}
                aria-label={t('toolbar.lockLayout')}
                aria-pressed={locked}
              >
                {locked ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
            </Tooltip>
            <Tooltip content={t('toolbar.snapGrid')} side={tipSide}>
              <button
                onClick={onToggleSnap}
                style={btnStyle(snapToGrid)}
                aria-label={t('toolbar.snapGrid')}
                aria-pressed={snapToGrid}
              >
                <Grid3x3 size={16} />
              </button>
            </Tooltip>
            <Tooltip content={t('toolbar.autoOrganise')} side={tipSide}>
              <button
                onClick={(e) => onAutoOrganise(e.shiftKey)}
                style={btnStyle(false)}
                aria-label={t('toolbar.autoOrganise')}
              >
                <Zap size={16} />
              </button>
            </Tooltip>
          </>
        )}

        <div style={sep} />

        {/* ── View ── */}
        <Tooltip content={t('toolbar.minimap')} side={tipSide}>
          <button
            onClick={onToggleMinimap}
            style={btnStyle(minimap)}
            aria-label={t('toolbar.minimap')}
            aria-pressed={minimap}
          >
            <Map size={16} />
          </button>
        </Tooltip>

        {onToggleBgDots && (
          <Tooltip content={t('toolbar.bgDots')} side={tipSide}>
            <button
              onClick={onToggleBgDots}
              style={btnStyle(!!bgDotsVisible)}
              aria-label={t('toolbar.bgDots')}
              aria-pressed={!!bgDotsVisible}
            >
              <Circle size={16} />
            </button>
          </Tooltip>
        )}

        <Tooltip content={t('toolbar.animatedEdges')} side={tipSide}>
          <button
            onClick={onToggleEdgesAnimated}
            style={btnStyle(edgesAnimated)}
            aria-label={t('toolbar.animatedEdges')}
            aria-pressed={edgesAnimated}
          >
            <Waves size={16} />
          </button>
        </Tooltip>

        <Tooltip content={t('toolbar.lod')} side={tipSide}>
          <button
            onClick={onToggleLod}
            style={btnStyle(lodEnabled)}
            aria-label={t('toolbar.lod')}
            aria-pressed={lodEnabled}
          >
            <Layers size={16} />
          </button>
        </Tooltip>

        {onToggleBadges && (
          <Tooltip content={t('toolbar.valueBadges')} side={tipSide}>
            <button
              onClick={onToggleBadges}
              style={btnStyle(!!badgesEnabled)}
              aria-label={t('toolbar.valueBadges')}
              aria-pressed={!!badgesEnabled}
            >
              <Tag size={16} />
            </button>
          </Tooltip>
        )}

        {onToggleEdgeBadges && (
          <Tooltip content={t('toolbar.edgeBadges')} side={tipSide}>
            <button
              onClick={onToggleEdgeBadges}
              style={btnStyle(!!edgeBadgesEnabled)}
              aria-label={t('toolbar.edgeBadges')}
              aria-pressed={!!edgeBadgesEnabled}
            >
              <Tags size={16} />
            </button>
          </Tooltip>
        )}

        {/* 3.23: Edge bundling toggle */}
        {onToggleEdgeBundling && (
          <Tooltip content={t('toolbar.edgeBundling', 'Bundle edges')} side={tipSide}>
            <button
              onClick={onToggleEdgeBundling}
              style={btnStyle(!!edgeBundlingEnabled)}
              aria-label={t('toolbar.edgeBundling', 'Bundle edges')}
              aria-pressed={!!edgeBundlingEnabled}
            >
              <Layers size={16} />
            </button>
          </Tooltip>
        )}

        {/* 3.21: Smart edge routing toggle */}
        {onToggleSmartEdgeRouting && (
          <Tooltip content={t('toolbar.smartEdgeRouting', 'Smart edge routing')} side={tipSide}>
            <button
              onClick={onToggleSmartEdgeRouting}
              style={btnStyle(!!smartEdgeRoutingEnabled)}
              aria-label={t('toolbar.smartEdgeRouting', 'Smart edge routing')}
              aria-pressed={!!smartEdgeRoutingEnabled}
            >
              <GitBranch size={16} />
            </button>
          </Tooltip>
        )}

        {/* K2-1: Hidden view toggle */}
        {onToggleHiddenView && hasHiddenNodes && (
          <Tooltip content={t('toolbar.hiddenView')} side={tipSide}>
            <button
              onClick={onToggleHiddenView}
              style={btnStyle(!!hiddenViewMode)}
              aria-label={t('toolbar.hiddenView')}
              aria-pressed={!!hiddenViewMode}
            >
              {hiddenViewMode ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </Tooltip>
        )}

        {onShowAllHidden && hasHiddenNodes && !readOnly && (
          <Tooltip content={t('toolbar.showAllHidden')} side={tipSide}>
            <button
              onClick={onShowAllHidden}
              style={btnStyle(false)}
              aria-label={t('toolbar.showAllHidden')}
            >
              <ScanEye size={16} />
            </button>
          </Tooltip>
        )}

        <div style={sep} />

        {/* ── Engine ── */}
        {/* Run button: always visible, useful for force-refresh and manual mode */}
        {onRun && (
          <Tooltip
            content={
              pendingPatchCount
                ? t('toolbar.run', 'Run') + ` (${pendingPatchCount})`
                : t('toolbar.run', 'Run')
            }
            side={tipSide}
          >
            <button
              onClick={onRun}
              style={{
                ...btnStyle(false),
                color: isStale ? '#1CABB0' : undefined,
              }}
              aria-label={t('toolbar.run', 'Run')}
            >
              <Play size={16} />
            </button>
          </Tooltip>
        )}

        {/* Pause / Resume toggle */}
        <Tooltip content={paused ? t('toolbar.resumeEval') : t('toolbar.pauseEval')} side={tipSide}>
          <button
            onClick={onTogglePause}
            style={btnStyle(paused)}
            aria-label={paused ? t('toolbar.resumeEval') : t('toolbar.pauseEval')}
            aria-pressed={paused}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </Tooltip>

        <Tooltip content={t('toolbar.refresh')} side={tipSide}>
          <button onClick={onRefresh} style={btnStyle(false)} aria-label={t('toolbar.refresh')}>
            <RefreshCw size={16} />
          </button>
        </Tooltip>

        <div style={sep} />

        {/* ── Panels ── */}
        <Tooltip content={t('toolbar.inspector')} side={tipSide}>
          <button
            onClick={onToggleInspector}
            style={btnStyle(inspVisible)}
            aria-label={t('toolbar.inspector')}
            aria-pressed={inspVisible}
          >
            <PanelRight size={16} />
          </button>
        </Tooltip>

        {/* 9.12: AI assistant panel toggle */}
        {onToggleAiPanel && (
          <Tooltip content={t('toolbar.aiAssistant', 'AI Assistant')} side={tipSide}>
            <button
              onClick={onToggleAiPanel}
              style={btnStyle(!!aiPanelOpen)}
              aria-label={t('toolbar.aiAssistant', 'AI Assistant')}
              aria-pressed={!!aiPanelOpen}
            >
              <Bot size={16} />
            </button>
          </Tooltip>
        )}

        <div style={sep} />

        {/* UX-19: Presentation mode toggle */}
        {onTogglePresentationMode && (
          <>
            <div style={sep} />
            <Tooltip
              content={t('toolbar.presentationMode', 'Presentation mode (Ctrl+Shift+P)')}
              side={tipSide}
            >
              <button
                onClick={onTogglePresentationMode}
                style={btnStyle(!!presentationMode)}
                aria-label={t('toolbar.presentationMode', 'Presentation mode')}
                aria-pressed={!!presentationMode}
              >
                <Projector size={16} />
              </button>
            </Tooltip>
          </>
        )}
      </div>
      {dragging && ghostEdge && (
        <>
          <div style={computeGhostStyle(ghostEdge)} />
          <div style={computeDropZoneStyle(ghostEdge)} />
        </>
      )}
    </>
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
    width: 34,
    height: 34,
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
