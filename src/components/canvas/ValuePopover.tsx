/**
 * ValuePopover — click-triggered popover showing full-precision value,
 * copy buttons, and jump-to-source for errors.
 *
 * Rendered as a fixed-position panel at the click coordinates.
 * Closes on outside click, Escape, or scroll.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Value } from '../../engine/value'
import { isError } from '../../engine/value'
import { formatValue } from '../../engine/value'
import { formatValueFull, copyValueToClipboard } from '../../engine/valueFormat'

interface ValuePopoverProps {
  nodeId: string
  x: number
  y: number
  computed: ReadonlyMap<string, Value>
  onClose: () => void
  onJumpToNode?: (nodeId: string) => void
}

export function ValuePopover({ nodeId, x, y, computed, onClose, onJumpToNode }: ValuePopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const value = computed.get(nodeId)

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = () => onClose()
    window.addEventListener('mousedown', onClick, true)
    window.addEventListener('keydown', onEsc)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('mousedown', onClick, true)
      window.removeEventListener('keydown', onEsc)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  const compact = formatValue(value)
  const full = formatValueFull(value)
  const kind = value?.kind ?? 'unknown'
  const hasError = value !== undefined && isError(value)

  const kindColors: Record<string, string> = {
    scalar: '#14b8a6',
    vector: '#a78bfa',
    table: '#f59e0b',
    error: '#ef4444',
    unknown: 'var(--text-muted)',
  }

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 2000,
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.5rem 0.65rem',
        minWidth: 180,
        maxWidth: 320,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        fontSize: '0.78rem',
        color: '#F4F4F3',
        animation: 'cs-fade-in 0.1s ease-out',
      }}
    >
      {/* Kind badge */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}
      >
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: kindColors[kind] ?? kindColors.unknown,
            letterSpacing: '0.04em',
          }}
        >
          {kind}
        </span>
      </div>

      {/* Compact value */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.82rem',
          color: '#1CABB0',
          fontWeight: 600,
          wordBreak: 'break-all',
          marginBottom: '0.2rem',
        }}
      >
        {compact}
      </div>

      {/* Full precision (only if different from compact) */}
      {full !== compact && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.68rem',
            color: 'rgba(244,244,243,0.5)',
            wordBreak: 'break-all',
            marginBottom: '0.35rem',
            maxHeight: 120,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {full}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem' }}>
        <button
          style={btnStyle}
          onClick={() => {
            copyValueToClipboard(value, 'compact')
            onClose()
          }}
        >
          Copy
        </button>
        <button
          style={btnStyle}
          onClick={() => {
            copyValueToClipboard(value, 'json')
            onClose()
          }}
        >
          JSON
        </button>
        {hasError && onJumpToNode && (
          <button
            style={{ ...btnStyle, color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
            onClick={() => {
              onJumpToNode(nodeId)
              onClose()
            }}
          >
            Jump
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

const btnStyle: React.CSSProperties = {
  padding: '0.18rem 0.5rem',
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '0.68rem',
  fontWeight: 500,
  fontFamily: 'inherit',
}
