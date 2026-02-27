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
import type { ConstantsLookup } from './resolveBindings.ts'
import type { VariablesMap } from '../lib/variables.ts'
import { toEngineSnapshot } from './bridge.ts'
import { diffGraph } from './diffGraph.ts'
import { isPerfHudEnabled } from '../lib/devFlags.ts'
import { updatePerfMetrics } from './perfMetrics.ts'
import { perfMark, perfMeasure } from '../perf/marks.ts'
import { dlog } from '../observability/debugLog.ts'

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
  /** Incrementing this key forces a full snapshot re-evaluation. */
  refreshKey?: number,
  /** When true, skip all evaluation. On unpause, forces a full re-eval. */
  paused?: boolean,
  /** W12.2: Constants lookup for binding resolution. */
  constants?: ConstantsLookup,
  /** W12.2: Project variables for binding resolution. */
  variables?: VariablesMap,
): GraphEngineResult {
  const [computed, setComputed] = useState<ReadonlyMap<string, Value>>(new Map())
  const [isPartial, setIsPartial] = useState(false)
  const prevNodesRef = useRef<Node[]>([])
  const prevEdgesRef = useRef<Edge[]>([])
  const snapshotLoaded = useRef(false)
  const prevRefreshKey = useRef(refreshKey)
  const prevPausedRef = useRef(paused)
  const pendingRef = useRef(0) // Coalescing counter: skip stale results.

  useEffect(() => {
    // When refreshKey changes, force a full snapshot re-evaluation.
    if (refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey
      snapshotLoaded.current = false
    }

    // Detect unpause transition: force a full re-eval of the latest graph.
    if (prevPausedRef.current && !paused) {
      snapshotLoaded.current = false
    }
    prevPausedRef.current = paused

    // Skip all evaluation while paused.
    if (paused) return

    if (!snapshotLoaded.current) {
      // First render: load full snapshot into persistent engine graph.
      snapshotLoaded.current = true
      const reqId = ++pendingRef.current
      const snapshot = toEngineSnapshot(nodes, edges, constants, variables)
      dlog.debug('engine', 'Snapshot eval started', { nodeCount: nodes.length, edgeCount: edges.length })
      const t0 = perfEnabled ? performance.now() : 0
      perfMark('cs:eval:start')
      engine.loadSnapshot(snapshot, options).then((result) => {
        if (reqId !== pendingRef.current) return
        perfMeasure('cs:eval:snapshot', 'cs:eval:start')
        setComputed(toValueMap(result.values))
        setIsPartial(result.partial ?? false)
        const snapshotErrors = Object.keys(result.values).filter((id) => (result.values[id] as Value)?.kind === 'error')
        dlog.info('engine', 'Snapshot eval complete', {
          evalMs: Math.round(result.elapsedUs / 1000),
          nodesComputed: Object.keys(result.values).length,
          partial: result.partial ?? false,
          errorCount: snapshotErrors.length,
          ...(snapshotErrors.length > 0 ? { errorNodeIds: snapshotErrors.slice(0, 5) } : {}),
        })
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
      dlog.debug('engine', 'Patch eval started', { opCount: ops.length })
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
          const patchErrors = Object.keys(result.changedValues).filter((id) => (result.changedValues[id] as Value)?.kind === 'error')
          dlog.info('engine', 'Patch eval complete', {
            evalMs: Math.round(result.elapsedUs / 1000),
            changedCount: Object.keys(result.changedValues).length,
            partial: result.partial ?? false,
            errorCount: patchErrors.length,
            ...(patchErrors.length > 0 ? { errorNodeIds: patchErrors.slice(0, 5) } : {}),
          })
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
        .catch((err: unknown) => {
          dlog.warn('engine', 'Eval interrupted', { error: String(err) })
        })
    }

    prevNodesRef.current = nodes
    prevEdgesRef.current = edges
  }, [nodes, edges, engine, options, refreshKey, paused, constants, variables])

  return { computed, isPartial }
}
