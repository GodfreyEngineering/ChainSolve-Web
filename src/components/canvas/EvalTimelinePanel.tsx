/**
 * EvalTimelinePanel — 3.38: Execution timeline showing recent eval durations.
 *
 * Subscribes to perfMetrics and accumulates a rolling history of the last
 * MAX_HISTORY evaluations, rendering them as a bar chart sorted chronologically.
 * Each bar is colour-coded:
 *   green  (<20ms)  — fast
 *   amber  (<100ms) — moderate
 *   red    (≥100ms) — slow
 *
 * Hovering a bar shows node count and exact timing.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { subscribePerfMetrics, getPerfSnapshot } from '../../engine/perfMetrics'

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_HISTORY = 60
const BAR_GAP = 2
const MIN_BAR_H = 2

interface EvalRecord {
  id: number
  ms: number
  nodes: number
  totalNodes: number
  timestamp: number
}

// ── Colour helper ──────────────────────────────────────────────────────────

function barColor(ms: number): string {
  if (ms < 20) return '#22c55e'
  if (ms < 100) return '#f59e0b'
  return '#ef4444'
}

// ── Component ──────────────────────────────────────────────────────────────

export function EvalTimelinePanel() {
  const { t } = useTranslation()
  const [history, setHistory] = useState<EvalRecord[]>([])
  const [tooltip, setTooltip] = useState<{ record: EvalRecord; x: number; y: number } | null>(null)
  const seqRef = useRef(0)
  const lastTimestampRef = useRef(0)

  // Subscribe to perf metrics updates
  const handleUpdate = useCallback(() => {
    const snap = getPerfSnapshot()
    // Only record if this is a new evaluation (timestamp changed)
    if (snap.timestamp === lastTimestampRef.current || snap.lastEvalMs === 0) return
    lastTimestampRef.current = snap.timestamp
    const record: EvalRecord = {
      id: ++seqRef.current,
      ms: snap.lastEvalMs,
      nodes: snap.nodesEvaluated,
      totalNodes: snap.totalNodes,
      timestamp: snap.timestamp,
    }
    setHistory((prev) => {
      const next = [...prev, record]
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
    })
  }, [])

  useEffect(() => {
    const unsub = subscribePerfMetrics(handleUpdate)
    return unsub
  }, [handleUpdate])

  // Stats
  const count = history.length
  const avgMs = count > 0 ? history.reduce((s, r) => s + r.ms, 0) / count : 0
  const maxMs = count > 0 ? Math.max(...history.map((r) => r.ms)) : 0
  const lastMs = count > 0 ? history[history.length - 1].ms : 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        padding: '0.5rem 0.75rem',
        gap: '0.5rem',
      }}
    >
      {/* Stats row */}
      <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
        <StatChip
          label={t('timeline.lastEval', 'Last')}
          value={count > 0 ? `${lastMs.toFixed(1)} ms` : '—'}
          color={count > 0 ? barColor(lastMs) : 'var(--muted)'}
        />
        <StatChip
          label={t('timeline.avgEval', 'Avg')}
          value={count > 0 ? `${avgMs.toFixed(1)} ms` : '—'}
          color="var(--text-faint, #888)"
        />
        <StatChip
          label={t('timeline.maxEval', 'Max')}
          value={count > 0 ? `${maxMs.toFixed(1)} ms` : '—'}
          color={count > 0 ? barColor(maxMs) : 'var(--muted)'}
        />
        <StatChip
          label={t('timeline.evalCount', 'Evals')}
          value={String(count)}
          color="var(--primary, #1CABB0)"
        />
      </div>

      {/* Bar chart */}
      <div
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {count === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--muted)',
              fontSize: '0.75rem',
              opacity: 0.6,
            }}
          >
            {t('timeline.empty', 'No evaluations yet. Run the graph to see timing data.')}
          </div>
        ) : (
          <BarChart
            history={history}
            maxMs={maxMs}
            onHover={(record, x, y) => setTooltip({ record, x, y })}
          />
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(tooltip.x + 8, 220),
              top: Math.max(tooltip.y - 60, 4),
              background: 'var(--surface-2, #2a2a2a)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '0.35rem 0.6rem',
              fontSize: '0.7rem',
              color: 'var(--text)',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontWeight: 700, color: barColor(tooltip.record.ms) }}>
              {tooltip.record.ms.toFixed(2)} ms
            </div>
            <div style={{ opacity: 0.75 }}>
              {tooltip.record.nodes}/{tooltip.record.totalNodes} {t('timeline.nodes', 'nodes')}
            </div>
            <div style={{ opacity: 0.5 }}>
              {new Date(tooltip.record.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexShrink: 0,
          fontSize: '0.62rem',
          color: 'var(--muted)',
          alignItems: 'center',
        }}
      >
        <LegendItem color="#22c55e" label={t('timeline.fast', 'Fast (<20ms)')} />
        <LegendItem color="#f59e0b" label={t('timeline.moderate', 'Moderate (<100ms)')} />
        <LegendItem color="#ef4444" label={t('timeline.slow', 'Slow (≥100ms)')} />
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span
        style={{
          fontSize: '0.6rem',
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '0.8rem',
          fontWeight: 700,
          color,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {value}
      </span>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <span>{label}</span>
    </div>
  )
}

function BarChart({
  history,
  maxMs,
  onHover,
}: {
  history: EvalRecord[]
  maxMs: number
  onHover: (record: EvalRecord, x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const effectiveMax = Math.max(maxMs, 1)

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: BAR_GAP,
        height: '100%',
        paddingBottom: 16,
        overflow: 'hidden',
      }}
    >
      {history.map((record) => {
        const heightPct = Math.max(record.ms / effectiveMax, 0.02)
        const color = barColor(record.ms)
        return (
          <div
            key={record.id}
            style={{
              flex: 1,
              minWidth: 4,
              maxWidth: 18,
              height: `${Math.max(heightPct * 100, MIN_BAR_H)}%`,
              background: color,
              borderRadius: '2px 2px 0 0',
              opacity: 0.85,
              cursor: 'default',
              transition: 'opacity 0.1s',
            }}
            onMouseEnter={(e) => {
              const rect = containerRef.current?.getBoundingClientRect()
              const parentRect = containerRef.current?.parentElement?.getBoundingClientRect()
              if (!rect || !parentRect) return
              onHover(record, e.clientX - parentRect.left, e.clientY - parentRect.top)
            }}
          />
        )
      })}
    </div>
  )
}
