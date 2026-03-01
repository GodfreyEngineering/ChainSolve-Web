/**
 * CanvasToolbar — vertical toolbar anchored to the right edge of the canvas.
 *
 * Contains canvas interaction tools (pan, zoom, fit, snap, lock),
 * view toggles (minimap, edges, LOD, badges, health),
 * engine controls (pause, refresh), and panel toggles.
 */
import { useCallback, useState } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { useTranslation } from 'react-i18next'

export interface CanvasToolbarProps {
  panMode: boolean
  locked: boolean
  snapToGrid: boolean
  minimap: boolean
  paused: boolean
  libVisible: boolean
  inspVisible: boolean
  readOnly: boolean
  onTogglePan: () => void
  onToggleLock: () => void
  onToggleSnap: () => void
  onToggleMinimap: () => void
  onTogglePause: () => void
  onRefresh: () => void
  onToggleLibrary: () => void
  onToggleInspector: () => void
  onAutoOrganise: (shiftKey: boolean) => void
  edgesAnimated: boolean
  lodEnabled: boolean
  onToggleEdgesAnimated: () => void
  onToggleLod: () => void
  debugConsoleVisible?: boolean
  onToggleDebugConsole?: () => void
  badgesEnabled?: boolean
  onToggleBadges?: () => void
  edgeBadgesEnabled?: boolean
  onToggleEdgeBadges?: () => void
  healthPanelVisible?: boolean
  onToggleHealthPanel?: () => void
  bgDotsVisible?: boolean
  onToggleBgDots?: () => void
}

/** Width of the toolbar strip in pixels, exported for layout calculations. */
export const CANVAS_TOOLBAR_WIDTH = 40

export function CanvasToolbar({
  panMode,
  locked,
  snapToGrid,
  minimap,
  paused,
  libVisible,
  inspVisible,
  readOnly,
  onTogglePan,
  onToggleLock,
  onToggleSnap,
  onToggleMinimap,
  onTogglePause,
  onRefresh,
  onToggleLibrary,
  onToggleInspector,
  onAutoOrganise,
  edgesAnimated,
  lodEnabled,
  onToggleEdgesAnimated,
  onToggleLod,
  debugConsoleVisible,
  onToggleDebugConsole,
  badgesEnabled,
  onToggleBadges,
  edgeBadgesEnabled,
  onToggleEdgeBadges,
  healthPanelVisible,
  onToggleHealthPanel,
  bgDotsVisible,
  onToggleBgDots,
}: CanvasToolbarProps) {
  const { t } = useTranslation()
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow()
  const { zoom } = useViewport()
  const [editingZoom, setEditingZoom] = useState<string | null>(null)

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

  const pct = `${Math.round(zoom * 100)}%`

  return (
    <div style={barStyle} role="toolbar" aria-label={t('toolbar.label')}>
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

      <div style={sepStyle} />

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
          style={zoomInputStyle}
          aria-label={t('toolbar.zoomLevel')}
        />
      ) : (
        <button
          onClick={() => setEditingZoom(String(Math.round(zoom * 100)))}
          style={zoomDisplayStyle}
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
          <div style={sepStyle} />
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

      <div style={sepStyle} />

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

      {onToggleHealthPanel && (
        <button
          onClick={onToggleHealthPanel}
          style={btnStyle(!!healthPanelVisible)}
          title={t('toolbar.graphHealth')}
          aria-label={t('toolbar.graphHealth')}
          aria-pressed={!!healthPanelVisible}
        >
          {'\u2695'}
        </button>
      )}

      <div style={sepStyle} />

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

      <div style={sepStyle} />

      {/* ── Panels ── */}
      {!readOnly && (
        <button
          onClick={onToggleLibrary}
          style={btnStyle(libVisible)}
          title={t('toolbar.library')}
          aria-label={t('toolbar.library')}
          aria-pressed={libVisible}
        >
          {'\u2630'}
        </button>
      )}

      <button
        onClick={onToggleInspector}
        style={btnStyle(inspVisible)}
        title={t('toolbar.inspector')}
        aria-label={t('toolbar.inspector')}
        aria-pressed={inspVisible}
      >
        {'\u229f'}
      </button>

      {onToggleDebugConsole && (
        <button
          onClick={onToggleDebugConsole}
          style={btnStyle(!!debugConsoleVisible)}
          title={t('toolbar.debugConsole')}
          aria-label={t('toolbar.debugConsole')}
          aria-pressed={!!debugConsoleVisible}
        >
          {'\u2261'}
        </button>
      )}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const barStyle: React.CSSProperties = {
  position: 'absolute',
  right: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 16,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.15rem',
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '0.35rem 0.25rem',
  boxShadow: 'var(--shadow-md)',
  maxHeight: 'calc(100% - 24px)',
  overflowY: 'auto',
  overflowX: 'hidden',
}

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

const sepStyle: React.CSSProperties = {
  width: 18,
  height: 1,
  background: 'var(--border)',
  margin: '0.1rem 0',
  flexShrink: 0,
}
