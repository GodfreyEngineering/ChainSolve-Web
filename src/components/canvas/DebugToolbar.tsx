/**
 * DebugToolbar — 3.36/3.37: Breakpoint and step-execution controls overlay.
 *
 * Displayed on the canvas when debug mode is active or when breakpoints are set.
 * Shows:
 *  - Current pause position in trace (node N of M)
 *  - Step backward / step forward / continue / continue to end buttons
 *  - Clear all breakpoints
 *  - Deactivate debug mode (close)
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebugStore } from '../../stores/debugStore'
import type { TraceEntry } from '../../engine/wasm-types'

interface DebugToolbarProps {
  /** Called to run a full evaluation with trace:true to enter step mode. */
  onRunWithTrace: () => void
}

export function DebugToolbar({ onRunWithTrace }: DebugToolbarProps) {
  const { t } = useTranslation()
  const {
    active,
    trace,
    stepIndex,
    pausedAtNodeId,
    breakpoints,
    stepForward,
    stepBackward,
    continueToBreakpoint,
    continueToEnd,
    deactivate,
    clearBreakpoints,
  } = useDebugStore()

  const handleStepForward = useCallback(() => {
    stepForward()
  }, [stepForward])

  const handleStepBackward = useCallback(() => {
    stepBackward()
  }, [stepBackward])

  const handleContinue = useCallback(() => {
    continueToBreakpoint()
  }, [continueToBreakpoint])

  const handleEnd = useCallback(() => {
    continueToEnd()
  }, [continueToEnd])

  const handleStop = useCallback(() => {
    deactivate()
  }, [deactivate])

  const handleClearAll = useCallback(() => {
    clearBreakpoints()
    deactivate()
  }, [clearBreakpoints, deactivate])

  const handleRunWithTrace = useCallback(() => {
    onRunWithTrace()
  }, [onRunWithTrace])

  const hasBreakpoints = breakpoints.size > 0
  if (!active && !hasBreakpoints) return null

  const atEnd = active && stepIndex >= trace.length - 1
  const atStart = stepIndex === 0
  const currentEntry: TraceEntry | undefined = trace[stepIndex]
  const totalNodes = trace.length

  return (
    <div style={toolbarStyle} role="toolbar" aria-label="Debug controls">
      {/* Status */}
      <div style={statusStyle}>
        {active ? (
          <>
            <span style={statusDotStyle} title="Debug mode active" />
            <span style={statusTextStyle}>
              {pausedAtNodeId ? (
                <>
                  Paused at <code style={codeStyle}>{pausedAtNodeId}</code> (node {stepIndex + 1} of{' '}
                  {totalNodes})
                </>
              ) : (
                `Step ${stepIndex + 1} of ${totalNodes}`
              )}
            </span>
          </>
        ) : (
          <>
            <span style={bpDotStyle} title="Breakpoints set" />
            <span style={statusTextStyle}>
              {breakpoints.size} breakpoint{breakpoints.size !== 1 ? 's' : ''} set
            </span>
          </>
        )}
      </div>

      {/* Node info when active */}
      {active && currentEntry && (
        <div style={nodeInfoStyle}>
          <span style={opStyle}>{currentEntry.opId}</span>
          <span style={outputPreviewStyle}>→ {summariseValue(currentEntry.output)}</span>
        </div>
      )}

      {/* Controls */}
      <div style={controlsStyle}>
        {!active && (
          <DebugButton onClick={handleRunWithTrace} title="Run with trace to activate debugger">
            ▶ Run
          </DebugButton>
        )}
        {active && (
          <>
            <DebugButton
              onClick={handleStepBackward}
              disabled={atStart}
              title={t('debug.stepBack', 'Step back')}
            >
              ⏮
            </DebugButton>
            <DebugButton
              onClick={handleStepForward}
              disabled={atEnd}
              title={t('debug.stepOver', 'Step forward')}
            >
              ⏭
            </DebugButton>
            <DebugButton
              onClick={handleContinue}
              disabled={atEnd}
              title={t('debug.continue', 'Continue to next breakpoint')}
            >
              ▶ Continue
            </DebugButton>
            <DebugButton
              onClick={handleEnd}
              disabled={atEnd}
              title={t('debug.continueToEnd', 'Continue to end')}
            >
              ⏩ End
            </DebugButton>
            <div style={sepStyle} />
            <DebugButton onClick={handleStop} title={t('debug.stop', 'Stop debugging')}>
              ⏹ Stop
            </DebugButton>
          </>
        )}
        <DebugButton
          onClick={handleClearAll}
          title={t('debug.clearAll', 'Clear all breakpoints')}
          danger
        >
          Clear all
        </DebugButton>
      </div>
    </div>
  )
}

// ── Helper ───────────────────────────────────────────────────────────────────

function summariseValue(v: {
  kind: string
  value?: number | string
  length?: number
  rows?: number
  message?: string
}): string {
  switch (v.kind) {
    case 'scalar':
      return typeof v.value === 'number'
        ? Number(v.value)
            .toPrecision(6)
            .replace(/\.?0+$/, '')
        : String(v.value)
    case 'vector':
      return `Vector(${v.length ?? '?'})`
    case 'table':
      return `Table(${v.rows ?? '?'})`
    case 'error':
      return `⚠ ${v.message ?? 'error'}`
    case 'text':
      return `"${String(v.value ?? '').slice(0, 20)}"`
    default:
      return v.kind
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface DebugButtonProps {
  onClick: () => void
  disabled?: boolean
  title?: string
  danger?: boolean
  children: React.ReactNode
}

function DebugButton({ onClick, disabled, title, danger, children }: DebugButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...btnStyle,
        ...(disabled ? disabledStyle : {}),
        ...(danger ? dangerStyle : {}),
      }}
    >
      {children}
    </button>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
  background: 'rgba(30, 30, 30, 0.95)',
  border: '1px solid rgba(250, 140, 0, 0.5)',
  borderRadius: '8px',
  padding: '0.35rem 0.75rem',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  maxWidth: 'calc(100vw - 120px)',
  pointerEvents: 'all',
}

const statusStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
}

const statusDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#fa8c00',
  flexShrink: 0,
  boxShadow: '0 0 4px #fa8c00',
}

const bpDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#ef4444',
  flexShrink: 0,
}

const statusTextStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  opacity: 0.9,
  whiteSpace: 'nowrap',
}

const nodeInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  fontSize: '0.75rem',
  opacity: 0.7,
  borderLeft: '1px solid rgba(255,255,255,0.1)',
  paddingLeft: '0.5rem',
}

const opStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.72rem',
  color: '#1cabb0',
}

const outputPreviewStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.72rem',
  opacity: 0.8,
}

const codeStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.72rem',
  color: '#1cabb0',
  background: 'rgba(28,171,176,0.1)',
  padding: '0 4px',
  borderRadius: 3,
}

const controlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  borderLeft: '1px solid rgba(255,255,255,0.1)',
  paddingLeft: '0.5rem',
}

const sepStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: 'rgba(255,255,255,0.15)',
  margin: '0 0.1rem',
}

const btnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '4px',
  color: 'var(--text)',
  fontSize: '0.72rem',
  padding: '0.2rem 0.5rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  transition: 'background 0.15s',
}

const disabledStyle: React.CSSProperties = {
  opacity: 0.35,
  cursor: 'not-allowed',
}

const dangerStyle: React.CSSProperties = {
  color: 'rgba(239,68,68,0.85)',
  borderColor: 'rgba(239,68,68,0.25)',
}
