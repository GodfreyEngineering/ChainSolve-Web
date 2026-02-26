/**
 * React hook that connects React Flow graph state to the WASM engine
 * using the incremental patch protocol.
 *
 * On first render: loads a full snapshot into the engine.
 * On subsequent changes: diffs previous vs current state and applies patches.
 * Results are merged incrementally (only changed values update the map).
 */

import { useEffect, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { EngineAPI } from './index.ts'
import type { EvalOptions } from './wasm-types.ts'
import type { Value } from './value.ts'
import { toEngineSnapshot } from './bridge.ts'
import { diffGraph } from './diffGraph.ts'
import { isPerfHudEnabled } from '../lib/devFlags.ts'
import { updatePerfMetrics } from './perfMetrics.ts'
import { perfMark, perfMeasure } from '../perf/marks.ts'

const perfEnabled = isPerfHudEnabled()

/** Convert a Record<string, EngineValue> into a Map<string, Value>. */
function toValueMap(values: Record<string, unknown>): Map<string, Value> {
  const map = new Map<string, Value>()
  for (const [id, val] of Object.entries(values)) {
    map.set(id, val as Value)
  }
  return map
}

export interface GraphEngineResult {
  computed: ReadonlyMap<string, Value>
  isPartial: boolean
}

export function useGraphEngine(
  nodes: Node[],
  edges: Edge[],
  engine: EngineAPI,
  options?: EvalOptions,
): GraphEngineResult {
  const [computed, setComputed] = useState<ReadonlyMap<string, Value>>(new Map())
  const [isPartial, setIsPartial] = useState(false)
  const prevNodesRef = useRef<Node[]>([])
  const prevEdgesRef = useRef<Edge[]>([])
  const snapshotLoaded = useRef(false)
  const pendingRef = useRef(0) // Coalescing counter: skip stale results.

  useEffect(() => {
    if (!snapshotLoaded.current) {
      // First render: load full snapshot into persistent engine graph.
      snapshotLoaded.current = true
      const reqId = ++pendingRef.current
      const snapshot = toEngineSnapshot(nodes, edges)
      const t0 = perfEnabled ? performance.now() : 0
      perfMark('cs:eval:start')
      engine.loadSnapshot(snapshot, options).then((result) => {
        if (reqId !== pendingRef.current) return
        perfMeasure('cs:eval:snapshot', 'cs:eval:start')
        setComputed(toValueMap(result.values))
        setIsPartial(result.partial ?? false)
        if (perfEnabled) {
          updatePerfMetrics({
            lastEvalMs: result.elapsedUs / 1000,
            workerRoundTripMs: performance.now() - t0,
            nodesEvaluated: Object.keys(result.values).length,
            totalNodes: nodes.length,
            isPartial: result.partial ?? false,
          })
          engine.getStats().then((stats) => {
            updatePerfMetrics({
              datasetCount: stats.datasetCount,
              datasetTotalBytes: stats.datasetTotalBytes,
            })
          })
        }
      })
    } else {
      // Subsequent renders: diff and apply patch.
      const ops = diffGraph(prevNodesRef.current, prevEdgesRef.current, nodes, edges)
      if (ops.length === 0) {
        // No engine-relevant changes (e.g. position-only update from React Flow).
        // Do NOT increment pendingRef — this would invalidate the in-flight
        // loadSnapshot result and cause computed values to never arrive.
        prevNodesRef.current = nodes
        prevEdgesRef.current = edges
        return
      }
      const reqId = ++pendingRef.current
      const t0 = perfEnabled ? performance.now() : 0
      perfMark('cs:eval:start')
      // Apply 300 ms interactive time budget so large evals return partial
      // results quickly rather than blocking the worker. Callers can override
      // by passing a higher timeBudgetMs in `options`.
      engine
        .applyPatch(ops, { timeBudgetMs: 300, ...options })
        .then((result) => {
          if (reqId !== pendingRef.current) return
          perfMeasure('cs:eval:patch', 'cs:eval:start')
          if (result.partial) perfMark('cs:eval:partial')
          setIsPartial(result.partial ?? false)
          // MERGE changed values into existing map (not replace).
          setComputed((prev) => {
            const next = new Map(prev)
            for (const [id, val] of Object.entries(result.changedValues)) {
              next.set(id, val as Value)
            }
            // Remove values for nodes that were removed.
            for (const op of ops) {
              if (op.op === 'removeNode') {
                next.delete(op.nodeId)
              }
            }
            return next
          })
          if (perfEnabled) {
            updatePerfMetrics({
              lastEvalMs: result.elapsedUs / 1000,
              workerRoundTripMs: performance.now() - t0,
              nodesEvaluated: result.evaluatedCount,
              totalNodes: result.totalCount,
              isPartial: result.partial ?? false,
            })
            engine.getStats().then((stats) => {
              updatePerfMetrics({
                datasetCount: stats.datasetCount,
                datasetTotalBytes: stats.datasetTotalBytes,
              })
            })
          }
        })
        .catch(() => {
          // Watchdog fired or worker was recreated — next user interaction
          // will retrigger evaluation via the useEffect dependency array.
        })
    }

    prevNodesRef.current = nodes
    prevEdgesRef.current = edges
  }, [nodes, edges, engine, options])

  return { computed, isPartial }
}
