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
    const reqId = ++pendingRef.current

    if (!snapshotLoaded.current) {
      // First render: load full snapshot into persistent engine graph.
      snapshotLoaded.current = true
      const snapshot = toEngineSnapshot(nodes, edges)
      const t0 = perfEnabled ? performance.now() : 0
      engine.loadSnapshot(snapshot, options).then((result) => {
        if (reqId !== pendingRef.current) return
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
        prevNodesRef.current = nodes
        prevEdgesRef.current = edges
        return
      }
      const t0 = perfEnabled ? performance.now() : 0
      engine.applyPatch(ops, options).then((result) => {
        if (reqId !== pendingRef.current) return
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
    }

    prevNodesRef.current = nodes
    prevEdgesRef.current = edges
  }, [nodes, edges, engine, options])

  return { computed, isPartial }
}
