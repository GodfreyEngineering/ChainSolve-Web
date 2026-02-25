/**
 * Dev-only performance heads-up display.
 *
 * Activated by `?perf=1` query parameter. Shows engine eval time,
 * worker round-trip, node counts, and dataset memory usage.
 *
 * Lazy-loaded in CanvasPage — zero bundle cost when not used.
 */

import { useSyncExternalStore } from 'react'
import { subscribePerfMetrics, getPerfSnapshot } from '../engine/perfMetrics.ts'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PerfHud() {
  const snap = useSyncExternalStore(subscribePerfMetrics, getPerfSnapshot)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.82)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.5,
        padding: '8px 12px',
        borderRadius: 6,
        pointerEvents: 'none',
        whiteSpace: 'pre',
        minWidth: 200,
      }}
    >
      {`eval   ${snap.lastEvalMs.toFixed(1)} ms
rtrip  ${snap.workerRoundTripMs.toFixed(1)} ms
nodes  ${snap.nodesEvaluated}/${snap.totalNodes}${snap.isPartial ? ' (partial)' : ''}
dsets  ${snap.datasetCount} (${formatBytes(snap.datasetTotalBytes)})`}
    </div>
  )
}
