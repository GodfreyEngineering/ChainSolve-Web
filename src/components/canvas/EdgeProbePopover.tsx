/**
 * EdgeProbePopover — 3.35 Probe mode.
 *
 * Shown when user clicks an edge. Displays the source node's computed value
 * with: type badge, shape, statistics (min/max/mean/std for vectors/tables),
 * and an inline sparkline for vector data.
 */

import { useEffect, useRef, type CSSProperties } from 'react'
import type { Value } from '../../engine/value'
import { formatValue } from '../../engine/value'

interface EdgeProbePopoverProps {
  x: number
  y: number
  sourceLabel: string
  value: Value | undefined
  onClose: () => void
}

export function EdgeProbePopover({
  x,
  y,
  sourceLabel,
  value,
  onClose,
}: EdgeProbePopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on Escape or outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  const stats = computeStats(value)
  const kindColor = getKindColor(value)
  const kindLabel = getKindLabel(value)

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9999,
        background: 'var(--surface-2, #2a2a2a)',
        border: `1px solid ${kindColor}40`,
        borderRadius: 10,
        boxShadow: `0 4px 24px rgba(0,0,0,0.45), 0 0 0 1px ${kindColor}20`,
        padding: '10px 14px',
        minWidth: 220,
        maxWidth: 320,
        fontFamily: "'Montserrat', system-ui, sans-serif",
        fontSize: '0.75rem',
        color: 'var(--text, #f4f4f3)',
        pointerEvents: 'all',
      } as CSSProperties}
      role="dialog"
      aria-label="Edge probe"
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 4,
            background: `${kindColor}20`,
            color: kindColor,
            border: `1px solid ${kindColor}40`,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          {kindLabel}
        </span>
        <span
          style={{
            fontWeight: 600,
            fontSize: '0.7rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            opacity: 0.7,
          }}
        >
          {sourceLabel}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label="Close probe"
        >
          ✕
        </button>
      </div>

      {/* Value display */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.78rem',
          color: kindColor,
          fontWeight: 600,
          marginBottom: stats ? 8 : 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {formatValue(value)}
      </div>

      {/* Statistics */}
      {stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {stats.shape && (
            <div style={statRowStyle}>
              <span style={statLabelStyle}>shape</span>
              <span style={statValueStyle}>{stats.shape}</span>
            </div>
          )}
          {stats.min !== undefined && (
            <div style={statRowStyle}>
              <span style={statLabelStyle}>min</span>
              <span style={statValueStyle}>{fmtNum(stats.min)}</span>
            </div>
          )}
          {stats.max !== undefined && (
            <div style={statRowStyle}>
              <span style={statLabelStyle}>max</span>
              <span style={statValueStyle}>{fmtNum(stats.max)}</span>
            </div>
          )}
          {stats.mean !== undefined && (
            <div style={statRowStyle}>
              <span style={statLabelStyle}>mean</span>
              <span style={statValueStyle}>{fmtNum(stats.mean)}</span>
            </div>
          )}
          {stats.std !== undefined && (
            <div style={statRowStyle}>
              <span style={statLabelStyle}>std</span>
              <span style={statValueStyle}>{fmtNum(stats.std)}</span>
            </div>
          )}
        </div>
      )}

      {/* Sparkline for vectors */}
      {value?.kind === 'vector' && value.value.length >= 2 && (
        <div style={{ marginTop: 8 }}>
          <ProbeSparkline values={value.value} color={kindColor} />
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (!isFinite(n)) return String(n)
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-3 && n !== 0)) return n.toExponential(3)
  return Number(n.toPrecision(6)).toString()
}

interface Stats {
  shape?: string
  min?: number
  max?: number
  mean?: number
  std?: number
}

function computeStats(value: Value | undefined): Stats | null {
  if (!value) return null
  if (value.kind === 'vector') {
    const arr = value.value.filter(isFinite)
    if (arr.length === 0) return { shape: `[${value.value.length}]` }
    const min = Math.min(...arr)
    const max = Math.max(...arr)
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length)
    return { shape: `[${value.value.length}]`, min, max, mean, std }
  }
  if (value.kind === 'table') {
    const allVals: number[] = []
    for (const row of value.rows) {
      for (const v of row) {
        if (typeof v === 'number' && isFinite(v)) allVals.push(v)
      }
    }
    const shape = `${value.rows.length}\u00d7${value.columns.length}`
    if (allVals.length === 0) return { shape }
    const min = Math.min(...allVals)
    const max = Math.max(...allVals)
    const mean = allVals.reduce((a, b) => a + b, 0) / allVals.length
    const std = Math.sqrt(
      allVals.reduce((a, b) => a + (b - mean) ** 2, 0) / allVals.length,
    )
    return { shape, min, max, mean, std }
  }
  if (value.kind === 'interval') {
    return { min: value.lo, max: value.hi, mean: (value.lo + value.hi) / 2 }
  }
  return null
}

function getKindLabel(value: Value | undefined): string {
  if (!value) return 'no data'
  switch (value.kind) {
    case 'scalar':
      return 'scalar'
    case 'highPrecision':
      return 'high-prec'
    case 'vector':
      return 'vector'
    case 'table':
      return 'table'
    case 'interval':
      return 'interval'
    case 'error':
      return 'error'
  }
}

function getKindColor(value: Value | undefined): string {
  if (!value) return 'rgba(244,244,243,0.4)'
  switch (value.kind) {
    case 'scalar':
    case 'highPrecision':
      return 'var(--value-color-scalar, #60a5fa)'
    case 'vector':
      return 'var(--value-color-vector, #4ade80)'
    case 'table':
      return 'var(--value-color-table, #a78bfa)'
    case 'interval':
      return 'var(--value-color-interval, #fb923c)'
    case 'error':
      return 'var(--value-color-error, #ef4444)'
  }
}

function ProbeSparkline({ values, color }: { values: readonly number[]; color: string }) {
  const W = 200
  const H = 36
  const finite = values.filter(isFinite)
  if (finite.length < 2) return null
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const fx = (i / (values.length - 1)) * W
    const fy = H - ((isFinite(v) ? v - min : min) / range) * H
    return `${fx.toFixed(1)},${fy.toFixed(1)}`
  })
  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
    </svg>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const statRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}
const statLabelStyle: CSSProperties = {
  fontSize: '0.65rem',
  color: 'rgba(244,244,243,0.45)',
  width: 36,
  flexShrink: 0,
  fontFamily: "'JetBrains Mono', monospace",
}
const statValueStyle: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.7rem',
  color: 'rgba(244,244,243,0.9)',
}
