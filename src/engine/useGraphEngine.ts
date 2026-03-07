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
import type { EvalOptions, PatchOp } from './wasm-types.ts'
import type { Value } from './value.ts'
import type { ConstantsLookup } from './resolveBindings.ts'
import type { VariablesMap } from '../lib/variables.ts'
import { toEngineSnapshot } from './bridge.ts'
import { diffGraph } from './diffGraph.ts'
import { isPerfHudEnabled } from '../lib/devFlags.ts'
import { updatePerfMetrics } from './perfMetrics.ts'
import { perfMark, perfMeasure } from '../perf/marks.ts'
import { dlog } from '../observability/debugLog.ts'
import { computeGraphHealth } from '../lib/graphHealth.ts'
import { useStatusBarStore } from '../stores/statusBarStore.ts'

const perfEnabled = isPerfHudEnabled()

/**
 * Milliseconds to wait before sending a data-only patch to the engine.
 * Rapid keystrokes in number/formula inputs within this window are coalesced
 * into a single applyPatch call, reducing worker message-queue pressure.
 * Structural changes (add/remove node/edge) bypass this delay entirely.
 */
export const PATCH_DEBOUNCE_MS = 50

/**
 * Returns true when at least one op is a structural change (i.e. anything
 * other than a node-data update).  Structural ops require immediate dispatch
 * so the engine graph stays consistent.
 */
export function hasStructuralChange(ops: PatchOp[]): boolean {
  return ops.some((op) => op.op !== 'updateNodeData')
}

/** Convert a Record<string, EngineValue> into a Map<string, Value>. */
function toValueMap(values: Record<string, unknown>): Map<string, Value> {
  const map = new Map<string, Value>()
  for (const [id, val] of Object.entries(values)) {
    map.set(id, val as Value)
  }
  return map
}

/** K4-2: Maximum node errors to log per eval to avoid flooding the console. */
const MAX_NODE_ERRORS_PER_EVAL = 10

/**
 * K4-2: Log individual node error messages to the debug console.
 * Deduplicates by nodeId+message so the same error is only logged once
 * until the error clears (node produces a non-error value).
 */
function logNodeErrors(values: Record<string, unknown>, seenErrors: Set<string>) {
  let logged = 0
  const stillActive = new Set<string>()

  for (const [id, val] of Object.entries(values)) {
    const v = val as Value
    if (v?.kind === 'error') {
      const key = `${id}:${v.message}`
      stillActive.add(key)
      if (!seenErrors.has(key) && logged < MAX_NODE_ERRORS_PER_EVAL) {
        seenErrors.add(key)
        dlog.warn('engine', v.message, { nodeId: id })
        logged++
      }
    } else {
      // Clear any previously-seen errors for this node (error resolved)
      for (const k of seenErrors) {
        if (k.startsWith(`${id}:`)) seenErrors.delete(k)
      }
    }
  }
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
  /** H7-1: Published channel values for subscribe block resolution. */
  publishedOutputs?: Record<string, number>,
): GraphEngineResult {
  const [computed, setComputed] = useState<ReadonlyMap<string, Value>>(new Map())
  const [isPartial, setIsPartial] = useState(false)
  const setEngineStatus = useStatusBarStore((s) => s.setEngineStatus)
  const prevNodesRef = useRef<Node[]>([])
  const prevEdgesRef = useRef<Edge[]>([])
  const snapshotLoaded = useRef(false)
  const prevRefreshKey = useRef(refreshKey)
  const prevPausedRef = useRef(paused)
  const pendingRef = useRef(0) // Coalescing counter: skip stale results.
  // Debounce timer for data-only patches (see PATCH_DEBOUNCE_MS).
  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // K4-2: Track already-logged node errors to avoid console spam.
  const seenErrorsRef = useRef<Set<string>>(new Set())

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
      const snapshot = toEngineSnapshot(nodes, edges, constants, variables, publishedOutputs)
      dlog.debug('engine', 'Snapshot eval started', {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      })
      const t0 = perfEnabled ? performance.now() : 0
      perfMark('cs:eval:start')
      setEngineStatus('computing')
      engine.loadSnapshot(snapshot, options).then((result) => {
        if (reqId !== pendingRef.current) return
        perfMeasure('cs:eval:snapshot', 'cs:eval:start')
        setComputed(toValueMap(result.values))
        setIsPartial(result.partial ?? false)
        const snapshotErrors = Object.keys(result.values).filter(
          (id) => (result.values[id] as Value)?.kind === 'error',
        )
        dlog.info('engine', 'Snapshot eval complete', {
          evalMs: Math.round(result.elapsedUs / 1000),
          nodesComputed: Object.keys(result.values).length,
          partial: result.partial ?? false,
          errorCount: snapshotErrors.length,
          ...(snapshotErrors.length > 0 ? { errorNodeIds: snapshotErrors.slice(0, 5) } : {}),
        })
        // K4-2: Log individual node error messages for console guidance.
        seenErrorsRef.current.clear()
        logNodeErrors(result.values, seenErrorsRef.current)
        const health = computeGraphHealth(nodes, edges)
        dlog.info('engine', 'Graph health', {
          nodeCount: health.nodeCount,
          edgeCount: health.edgeCount,
          groupCount: health.groupCount,
          orphanCount: health.orphanCount,
          crossingEdgeCount: health.crossingEdgeCount,
          cycleDetected: health.cycleDetected,
          warningCount: health.warnings.length,
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
        setEngineStatus('idle')
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

      /** Dispatch a set of patch ops to the engine worker. */
      const firePatch = (opsToSend: PatchOp[]) => {
        const reqId = ++pendingRef.current
        dlog.debug('engine', 'Patch eval started', { opCount: opsToSend.length })
        const t0 = perfEnabled ? performance.now() : 0
        perfMark('cs:eval:start')
        setEngineStatus('computing')
        // Apply 300 ms interactive time budget so large evals return partial
        // results quickly rather than blocking the worker. Callers can override
        // by passing a higher timeBudgetMs in `options`.
        engine
          .applyPatch(opsToSend, { timeBudgetMs: 300, ...options })
          .then((result) => {
            if (reqId !== pendingRef.current) return
            perfMeasure('cs:eval:patch', 'cs:eval:start')
            if (result.partial) perfMark('cs:eval:partial')
            const patchErrors = Object.keys(result.changedValues).filter(
              (id) => (result.changedValues[id] as Value)?.kind === 'error',
            )
            dlog.info('engine', 'Patch eval complete', {
              evalMs: Math.round(result.elapsedUs / 1000),
              changedCount: Object.keys(result.changedValues).length,
              partial: result.partial ?? false,
              errorCount: patchErrors.length,
              ...(patchErrors.length > 0 ? { errorNodeIds: patchErrors.slice(0, 5) } : {}),
            })
            // K4-2: Log individual node error messages for console guidance.
            logNodeErrors(result.changedValues, seenErrorsRef.current)
            setIsPartial(result.partial ?? false)
            // MERGE changed values into existing map (not replace).
            setComputed((prev) => {
              const next = new Map(prev)
              for (const [id, val] of Object.entries(result.changedValues)) {
                next.set(id, val as Value)
              }
              // Remove values for nodes that were removed.
              for (const op of opsToSend) {
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
            setEngineStatus('idle')
          })
          .catch((err: unknown) => {
            dlog.warn('engine', 'Eval interrupted', { error: String(err) })
            setEngineStatus('error')
          })
      }

      if (hasStructuralChange(ops)) {
        // Structural changes (add/remove node or edge) fire immediately.
        // Also flush any pending data-only debounce to avoid lost updates.
        if (patchTimerRef.current !== null) {
          clearTimeout(patchTimerRef.current)
          patchTimerRef.current = null
        }
        firePatch(ops)
      } else {
        // Data-only changes (node value/formula edits): debounce to coalesce
        // rapid keystrokes before sending to the worker.
        if (patchTimerRef.current !== null) clearTimeout(patchTimerRef.current)
        const capturedOps = ops // snapshot at this render
        patchTimerRef.current = setTimeout(() => {
          patchTimerRef.current = null
          firePatch(capturedOps)
        }, PATCH_DEBOUNCE_MS)
      }
    }

    prevNodesRef.current = nodes
    prevEdgesRef.current = edges
  }, [nodes, edges, engine, options, refreshKey, paused, constants, variables, publishedOutputs])

  return { computed, isPartial }
}
