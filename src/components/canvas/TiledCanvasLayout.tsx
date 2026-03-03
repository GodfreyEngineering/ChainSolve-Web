/**
 * TiledCanvasLayout — K1-1: split-pane layout for multi-sheet tiled views.
 *
 * Renders two canvas panes (primary + secondary) side-by-side (horizontal)
 * or stacked (vertical) with a draggable resize handle between them.
 * Each pane has a compact header with sheet name and window controls
 * (minimize, maximize, close).
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export type PaneState = 'normal' | 'minimized' | 'maximized'

export interface PaneConfig {
  canvasId: string
  name: string
  state: PaneState
}

export interface TiledCanvasLayoutProps {
  direction: 'vertical' | 'horizontal'
  primaryPane: PaneConfig
  secondaryPane: PaneConfig
  focusedCanvasId: string | null
  onFocusPane: (canvasId: string) => void
  onToggleMinimize: (canvasId: string) => void
  onToggleMaximize: (canvasId: string) => void
  /** Exit tiled mode (return to fullscreen). */
  onClosePane: () => void
  primaryContent: ReactNode
  secondaryContent: ReactNode
  /** Refs to pane container DOM elements for cross-sheet drag detection. */
  primaryPaneRef?: React.RefObject<HTMLDivElement | null>
  secondaryPaneRef?: React.RefObject<HTMLDivElement | null>
}

// ── Snap thresholds for resize handle ──────────────────────────────────────

const SNAP_POSITIONS = [0.25, 0.5, 0.75]
const SNAP_THRESHOLD = 0.03

function snapRatio(raw: number): number {
  for (const pos of SNAP_POSITIONS) {
    if (Math.abs(raw - pos) < SNAP_THRESHOLD) return pos
  }
  return raw
}

// ── Component ───────────────────────────────────────────────────────────────

export function TiledCanvasLayout({
  direction,
  primaryPane,
  secondaryPane,
  focusedCanvasId,
  onFocusPane,
  onToggleMinimize,
  onToggleMaximize,
  onClosePane,
  primaryContent,
  secondaryContent,
  primaryPaneRef,
  secondaryPaneRef,
}: TiledCanvasLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [splitRatio, setSplitRatio] = useState(0.5)
  const [isDragging, setIsDragging] = useState(false)

  const isHorizontal = direction === 'horizontal'

  // ── Resize handle drag ──────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)

      const handleMouseMove = (ev: MouseEvent) => {
        const container = containerRef.current
        if (!container) return
        const rect = container.getBoundingClientRect()
        let ratio: number
        if (isHorizontal) {
          ratio = (ev.clientX - rect.left) / rect.width
        } else {
          ratio = (ev.clientY - rect.top) / rect.height
        }
        ratio = Math.max(0.15, Math.min(0.85, ratio))
        setSplitRatio(ratio)
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        // Snap to nearest position on release
        setSplitRatio((r) => snapRatio(r))
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [isHorizontal],
  )

  const handleDoubleClick = useCallback(() => {
    setSplitRatio(0.5)
  }, [])

  // ── Visibility / sizing logic ───────────────────────────────────────────

  const primaryMaximized = primaryPane.state === 'maximized'
  const secondaryMaximized = secondaryPane.state === 'maximized'
  const primaryMinimized = primaryPane.state === 'minimized'
  const secondaryMinimized = secondaryPane.state === 'minimized'

  const showPrimary = !secondaryMaximized
  const showSecondary = !primaryMaximized
  const showResize =
    !primaryMaximized && !secondaryMaximized && !primaryMinimized && !secondaryMinimized

  function getPrimaryFlex(): string {
    if (primaryMinimized) return '0 0 auto'
    if (primaryMaximized || secondaryMinimized) return '1 1 0%'
    return `${splitRatio} 1 0%`
  }

  function getSecondaryFlex(): string {
    if (secondaryMinimized) return '0 0 auto'
    if (secondaryMaximized || primaryMinimized) return '1 1 0%'
    return `${1 - splitRatio} 1 0%`
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── Primary pane ─────────────────────────────────────────────────── */}
      {showPrimary && (
        <div
          ref={primaryPaneRef}
          style={{
            flex: getPrimaryFlex(),
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            ...(isHorizontal
              ? { minWidth: primaryMinimized ? undefined : 100 }
              : { minHeight: primaryMinimized ? undefined : 100 }),
          }}
          onClick={() => onFocusPane(primaryPane.canvasId)}
        >
          <PaneHeader
            name={primaryPane.name}
            state={primaryPane.state}
            focused={focusedCanvasId === primaryPane.canvasId}
            onToggleMinimize={() => onToggleMinimize(primaryPane.canvasId)}
            onToggleMaximize={() => onToggleMaximize(primaryPane.canvasId)}
            onClose={onClosePane}
          />
          {!primaryMinimized && <div style={{ flex: 1, overflow: 'hidden' }}>{primaryContent}</div>}
        </div>
      )}

      {/* ── Resize handle ────────────────────────────────────────────────── */}
      {showResize && (
        <div
          style={{
            ...(isHorizontal
              ? { width: 5, cursor: 'col-resize', flexShrink: 0 }
              : { height: 5, cursor: 'row-resize', flexShrink: 0 }),
            background: isDragging ? 'var(--primary)' : 'var(--border)',
            transition: isDragging ? 'none' : 'background 0.15s',
            position: 'relative',
            zIndex: 10,
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          {/* Drag affordance */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              ...(isHorizontal ? { width: 2, height: 20 } : { width: 20, height: 2 }),
              background: 'var(--text-muted)',
              borderRadius: 1,
              opacity: 0.4,
            }}
          />
        </div>
      )}

      {/* ── Secondary pane ───────────────────────────────────────────────── */}
      {showSecondary && (
        <div
          ref={secondaryPaneRef}
          style={{
            flex: getSecondaryFlex(),
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            ...(isHorizontal
              ? { minWidth: secondaryMinimized ? undefined : 100 }
              : { minHeight: secondaryMinimized ? undefined : 100 }),
          }}
          onClick={() => onFocusPane(secondaryPane.canvasId)}
        >
          <PaneHeader
            name={secondaryPane.name}
            state={secondaryPane.state}
            focused={focusedCanvasId === secondaryPane.canvasId}
            onToggleMinimize={() => onToggleMinimize(secondaryPane.canvasId)}
            onToggleMaximize={() => onToggleMaximize(secondaryPane.canvasId)}
            onClose={onClosePane}
          />
          {!secondaryMinimized && (
            <div style={{ flex: 1, overflow: 'hidden' }}>{secondaryContent}</div>
          )}
        </div>
      )}

      {/* ── Drag overlay (prevents iframe/canvas stealing mouse during resize) */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            cursor: isHorizontal ? 'col-resize' : 'row-resize',
          }}
        />
      )}
    </div>
  )
}

// ── PaneHeader ──────────────────────────────────────────────────────────────

function PaneHeader({
  name,
  state,
  focused,
  onToggleMinimize,
  onToggleMaximize,
  onClose,
}: {
  name: string
  state: PaneState
  focused: boolean
  onToggleMinimize: () => void
  onToggleMaximize: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 26,
        background: focused ? 'var(--surface2)' : 'var(--bg)',
        borderBottom: `1px solid ${focused ? 'var(--primary)' : 'var(--border)'}`,
        padding: '0 0.5rem',
        flexShrink: 0,
        userSelect: 'none',
        gap: 2,
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: '0.72rem',
          fontWeight: focused ? 600 : 400,
          color: focused ? 'var(--text)' : 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      <button
        title={state === 'minimized' ? t('sheets.restore') : t('sheets.minimize')}
        onClick={(e) => {
          e.stopPropagation()
          onToggleMinimize()
        }}
        style={paneBtnStyle}
      >
        {state === 'minimized' ? '\u25A1' : '\u2014'}
      </button>
      <button
        title={state === 'maximized' ? t('sheets.restore') : t('sheets.maximize')}
        onClick={(e) => {
          e.stopPropagation()
          onToggleMaximize()
        }}
        style={paneBtnStyle}
      >
        {state === 'maximized' ? '\u29C9' : '\u25A1'}
      </button>
      <button
        title={t('sheets.closePane')}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        style={paneBtnStyle}
      >
        {'\u2715'}
      </button>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const paneBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.6rem',
  cursor: 'pointer',
  borderRadius: 3,
  padding: 0,
  fontFamily: 'inherit',
  transition: 'color 0.15s',
}
