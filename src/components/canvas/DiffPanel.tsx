/**
 * DiffPanel — 3.40 Diff view.
 *
 * Compares current computed values against a saved baseline snapshot.
 * Lists nodes with changed values, coloured green (increased) or red (decreased).
 */

import { useMemo, type CSSProperties } from 'react'
import type { Value } from '../../engine/value'
import { formatValue } from '../../engine/value'

interface DiffEntry {
  nodeId: string
  label: string
  baseline: Value | undefined
  current: Value | undefined
  delta: number | null // null = non-numeric or NaN
  direction: 'increased' | 'decreased' | 'same' | 'changed'
}

interface DiffPanelProps {
  baseline: ReadonlyMap<string, Value>
  current: ReadonlyMap<string, Value>
  nodeLabels: ReadonlyMap<string, string>
  onClose: () => void
}

export function DiffPanel({ baseline, current, nodeLabels, onClose }: DiffPanelProps) {
  const entries = useMemo<DiffEntry[]>(() => {
    const result: DiffEntry[] = []
    const allIds = new Set([...baseline.keys(), ...current.keys()])

    for (const nodeId of allIds) {
      const base = baseline.get(nodeId)
      const curr = current.get(nodeId)
      const label = nodeLabels.get(nodeId) ?? nodeId

      // Skip nodes with no computable scalar delta
      const baseNum = toNum(base)
      const currNum = toNum(curr)

      if (baseNum !== null && currNum !== null) {
        const delta = currNum - baseNum
        const direction: DiffEntry['direction'] =
          delta > 1e-12
            ? 'increased'
            : delta < -1e-12
              ? 'decreased'
              : 'same'
        if (direction !== 'same') {
          result.push({ nodeId, label, baseline: base, current: curr, delta, direction })
        }
      } else {
        // Non-numeric: check if value kind changed
        const baseStr = base ? base.kind : 'none'
        const currStr = curr ? curr.kind : 'none'
        if (baseStr !== currStr || formatValue(base) !== formatValue(curr)) {
          result.push({
            nodeId,
            label,
            baseline: base,
            current: curr,
            delta: null,
            direction: 'changed',
          })
        }
      }
    }

    // Sort: largest absolute delta first
    return result.sort((a, b) => {
      const ad = a.delta !== null ? Math.abs(a.delta) : 0
      const bd = b.delta !== null ? Math.abs(b.delta) : 0
      return bd - ad
    })
  }, [baseline, current, nodeLabels])

  const changedCount = entries.length

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={titleStyle}>Snapshot Diff</span>
          <span
            style={{
              fontSize: '0.6rem',
              padding: '1px 5px',
              borderRadius: 8,
              background: changedCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)',
              color: changedCount > 0 ? '#ef4444' : '#4ade80',
              fontWeight: 700,
            }}
          >
            {changedCount} change{changedCount !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Close diff panel">
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        {entries.length === 0 ? (
          <div style={{ color: 'rgba(244,244,243,0.4)', fontSize: '0.72rem', padding: '8px 0', textAlign: 'center' }}>
            No changes from baseline
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.nodeId} style={rowStyle}>
              {/* Label */}
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: 'rgba(244,244,243,0.7)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                }}
                title={e.label}
              >
                {e.label}
              </div>

              {/* Delta or change indicator */}
              {e.delta !== null ? (
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: e.direction === 'increased' ? '#4ade80' : '#ef4444',
                    flexShrink: 0,
                    marginLeft: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: '0.7rem' }}>
                    {e.direction === 'increased' ? '▲' : '▼'}
                  </span>
                  {fmtDelta(e.delta)}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '0.6rem',
                    color: 'rgba(251,146,60,0.9)',
                    fontWeight: 600,
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  changed
                </div>
              )}

              {/* Before → After */}
              <div
                style={{
                  fontSize: '0.6rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'rgba(244,244,243,0.35)',
                  flexShrink: 0,
                  marginLeft: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                {fmtVal(e.baseline)} → {fmtVal(e.current)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNum(v: Value | undefined): number | null {
  if (!v) return null
  if (v.kind === 'scalar') return v.value
  if (v.kind === 'highPrecision') return v.approx
  return null
}

function fmtDelta(d: number): string {
  const abs = Math.abs(d)
  if (abs >= 1e6 || (abs < 1e-3 && abs !== 0)) return d.toExponential(2)
  return Number(d.toPrecision(4)).toString()
}

function fmtVal(v: Value | undefined): string {
  if (!v) return '—'
  const n = toNum(v)
  if (n !== null) return fmtDelta(n)
  return formatValue(v).slice(0, 12)
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 48,
  right: 8,
  width: 320,
  maxHeight: '60vh',
  background: 'var(--card, #383838)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 35,
  fontFamily: "'Montserrat', system-ui, sans-serif",
  overflow: 'hidden',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  flexShrink: 0,
  background: 'var(--surface, #2a2a2a)',
}

const titleStyle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  color: 'rgba(244,244,243,0.8)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const closeBtnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'rgba(244,244,243,0.4)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  padding: '0 2px',
  lineHeight: 1,
}

const bodyStyle: CSSProperties = {
  overflowY: 'auto',
  padding: '6px 12px',
  flex: 1,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '5px 0',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  gap: 4,
}
