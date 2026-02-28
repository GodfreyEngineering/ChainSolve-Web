/**
 * Dev-only performance heads-up display.
 *
 * Activated by `?perf=1` query parameter. Shows engine eval time,
 * worker round-trip, node counts, dataset memory usage, and live FPS.
 * Also logs a condensed perf summary to the console every 5 seconds.
 *
 * Lazy-loaded in CanvasPage — zero bundle cost when not used.
 */

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { subscribePerfMetrics, getPerfSnapshot } from '../engine/perfMetrics.ts'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const LOG_INTERVAL_MS = 5_000

export function PerfHud() {
  const snap = useSyncExternalStore(subscribePerfMetrics, getPerfSnapshot)
  const [fps, setFps] = useState(0)
  const fpsRef = useRef(0)

  // rAF loop: count frames per second.
  useEffect(() => {
    let frames = 0
    let lastTime = performance.now()
    let rafId: number

    function tick() {
      frames++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        const f = Math.round((frames * 1000) / (now - lastTime))
        fpsRef.current = f
        setFps(f)
        frames = 0
        lastTime = now
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Periodic console log (every 5 s) — useful for pasting into bug reports.
  useEffect(() => {
    const id = setInterval(() => {
      const s = getPerfSnapshot()
      console.log(
        `[cs:perf] eval=${s.lastEvalMs.toFixed(1)}ms rtrip=${s.workerRoundTripMs.toFixed(1)}ms ` +
          `nodes=${s.nodesEvaluated}/${s.totalNodes}${s.isPartial ? '(partial)' : ''} ` +
          `fps=${fpsRef.current} dsets=${s.datasetCount}(${formatBytes(s.datasetTotalBytes)}) ` +
          `wasmInit=${s.wasmInitMs.toFixed(1)}ms`,
      )
    }, LOG_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

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
dsets  ${snap.datasetCount} (${formatBytes(snap.datasetTotalBytes)})
fps    ${fps}
wasm   ${snap.wasmInitMs.toFixed(1)} ms`}
    </div>
  )
}
