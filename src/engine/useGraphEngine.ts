/**
 * React hook that connects React Flow graph state to the WASM engine
 * using the incremental patch protocol.
 *
 * On first render: loads a full snapshot into the engine.
 * On subsequent changes: diffs previous vs current state and applies patches.
 * Results are merged incrementally (only changed values update the map).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { EngineAPI } from './index.ts'
import type { EngineDiagnostic, EvalOptions, PatchOp } from './wasm-types.ts'
import type { Value } from './value.ts'
import type { ConstantsLookup } from './resolveBindings.ts'
import type { VariablesMap } from '../lib/variables.ts'
import { toEngineSnapshot } from './bridge.ts'
import { diffGraph } from './diffGraph.ts'
import { EvalScheduler } from './evalScheduler.ts'
import type { EvalMode } from './evalScheduler.ts'
import { isPerfHudEnabled } from '../lib/devFlags.ts'
import { updatePerfMetrics } from './perfMetrics.ts'
import { perfMark, perfMeasure } from '../perf/marks.ts'
import { dlog } from '../observability/debugLog.ts'
import { recordEngineEval } from '../observability/engineTelemetry.ts'
import { useStatusBarStore } from '../stores/statusBarStore.ts'
import { ComputedStore } from '../contexts/ComputedStore.ts'

const perfEnabled = isPerfHudEnabled()

// Patch debounce is now inside evalScheduler.ts. Re-export constant
// for backwards compat with existing tests.
export const PATCH_DEBOUNCE_MS = 50

/**
 * Returns true when an error is the expected "Engine disposed" rejection
 * that fires during project/canvas navigation. These should be silently
 * swallowed — they are not bugs.
 */
function isEngineDisposedError(err: unknown): boolean {
  return err instanceof Error && err.message === 'Engine disposed'
}

/**
 * Returns true when at least one op is a structural change (i.e. anything
 * other than a node-data update).  Structural ops require immediate dispatch
 * so the engine graph stays consistent.
 */
export function hasStructuralChange(ops: PatchOp[]): boolean {
  return ops.some((op) => op.op !== 'updateNodeData')
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
  computedStore: ComputedStore
  /** Manually trigger evaluation (for Run button in manual/deferred mode). */
  triggerEval: () => void
  /** Number of patch ops waiting to be dispatched. */
  pendingPatchCount: number
  /** Engine diagnostics from the last evaluation (warnings, errors). */
  engineDiagnostics: EngineDiagnostic[]
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
  /** OBS-02: project/canvas IDs for engine eval telemetry. */
  telemetryOpts?: { projectId?: string; canvasId?: string },
  /** SCI-06: Angle unit preference for trig blocks. */
  angleUnit?: 'rad' | 'deg',
  /** Phase 1: Evaluation mode — auto, deferred, or manual. Default: auto. */
  evalMode?: EvalMode,
): GraphEngineResult {
  const [computed, setComputed] = useState<ReadonlyMap<string, Value>>(new Map())
  const [isPartial, setIsPartial] = useState(false)
  const [engineDiagnostics, setEngineDiagnostics] = useState<EngineDiagnostic[]>([])
  // UI-PERF-02: per-node subscription store — stable instance for the hook's lifetime
  const [store] = useState(() => new ComputedStore())
  const setEngineStatus = useStatusBarStore((s) => s.setEngineStatus)
  const setIsStale = useStatusBarStore((s) => s.setIsStale)
  const setLastEvalMs = useStatusBarStore((s) => s.setLastEvalMs)
  const setLastEvalNodeCount = useStatusBarStore((s) => s.setLastEvalNodeCount)
  const prevNodesRef = useRef<Node[]>([])
  const prevEdgesRef = useRef<Edge[]>([])
  const snapshotLoaded = useRef(false)
  const prevRefreshKey = useRef(refreshKey)
  const prevPausedRef = useRef(paused)
  // SCI-06: Force full snapshot reload when angle unit changes.
  const prevAngleUnitRef = useRef(angleUnit)
  // H7-1: Force full snapshot reload when published outputs change
  // so subscribe blocks pick up cross-canvas value updates.
  const prevPublishedRef = useRef(publishedOutputs)
  const pendingRef = useRef(0) // Coalescing counter: skip stale results.
  // K4-2: Track already-logged node errors to avoid console spam.
  const seenErrorsRef = useRef<Set<string>>(new Set())

  // Phase 1: EvalScheduler manages patch dispatch timing.
  // Stored in a ref — only accessed inside effects and callbacks (never during render).
  const schedulerRef = useRef<EvalScheduler | null>(null)
  const [pendingPatchCount, setPendingPatchCount] = useState(0)

  // Lazily initialise and keep scheduler mode in sync with evalMode.
  useEffect(() => {
    if (!schedulerRef.current) {
      schedulerRef.current = new EvalScheduler(evalMode ?? 'reactive')
      schedulerRef.current.onPendingChange(setPendingPatchCount)
    } else {
      schedulerRef.current.mode = evalMode ?? 'reactive'
    }
  }, [evalMode])

  // Dispose scheduler on unmount.
  useEffect(() => {
    return () => {
      schedulerRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    // When refreshKey changes, force a full snapshot re-evaluation.
    if (refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey
      snapshotLoaded.current = false
    }

    // SCI-06: When angle unit changes, force a full snapshot re-evaluation
    // so all trig nodes get the updated angleUnit in their data.
    if (angleUnit !== prevAngleUnitRef.current) {
      prevAngleUnitRef.current = angleUnit
      snapshotLoaded.current = false
    }

    // H7-1: When published outputs change (cross-canvas publish), force a
    // full snapshot re-evaluation so subscribe blocks get the new values.
    // The diff engine won't detect this change because it lives outside
    // node data — it's injected by toEngineSnapshot at bridge time.
    if (publishedOutputs !== prevPublishedRef.current) {
      prevPublishedRef.current = publishedOutputs
      snapshotLoaded.current = false
    }

    // Detect unpause transition.
    // Phase 0: Instead of always forcing a full snapshot reload on unpause,
    // only do so if the graph actually has data changes that accumulated
    // while paused. Position-only changes (from dragging) produce zero
    // diff ops and don't need a reload. If snapshotLoaded is already true,
    // the normal diff path (below) will handle any pending changes.
    if (prevPausedRef.current && !paused) {
      if (!snapshotLoaded.current) {
        // Snapshot was never loaded (e.g. initial mount while paused) — must reload
        // (snapshotLoaded.current stays false, so the snapshot path fires below)
      } else {
        // Snapshot was loaded before pause. Let the diff path handle changes.
        // If there are actual data changes, diffGraph will produce ops and
        // they'll be dispatched. If only positions changed, it's a no-op.
        // No need to force snapshotLoaded = false.
      }
    }
    prevPausedRef.current = paused

    // Skip all evaluation while paused.
    if (paused) return

    if (!snapshotLoaded.current) {
      // First render: load full snapshot into persistent engine graph.
      snapshotLoaded.current = true
      const reqId = ++pendingRef.current
      const snapshot = toEngineSnapshot(
        nodes,
        edges,
        constants,
        variables,
        publishedOutputs,
        angleUnit,
      )
      dlog.debug('engine', 'Snapshot eval started', {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      })
      const t0 = perfEnabled ? performance.now() : 0
      perfMark('cs:eval:start')
      setEngineStatus('computing')
      engine
        .loadSnapshot(snapshot, options)
        .then((result) => {
          if (reqId !== pendingRef.current) return
          perfMeasure('cs:eval:snapshot', 'cs:eval:start')
          store.load(result.values)
          setComputed(store.getAll())
          setIsPartial(result.partial ?? false)
          setEngineDiagnostics(result.diagnostics ?? [])
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
          // Phase 0: Graph health moved to on-demand (GraphHealthPanel).
          // Previously ran O(V+E) cycle detection + critical path analysis
          // on every snapshot eval, causing "Graph health" console spam.
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
          recordEngineEval(
            'snapshot',
            result.elapsedUs,
            nodes.length,
            edges.length,
            Object.keys(result.values).length,
            result.partial ?? false,
            telemetryOpts,
          )
          // Phase 1E: Update stale/timing state after successful eval.
          setIsStale(false)
          setLastEvalMs(Math.round(result.elapsedUs / 1000))
          setLastEvalNodeCount(Object.keys(result.values).length)
          setEngineStatus('idle')
        })
        .catch((err: unknown) => {
          // Engine disposed during project/canvas switch — expected, not a bug.
          if (isEngineDisposedError(err)) return
          dlog.warn('engine', 'Snapshot eval interrupted', { error: String(err) })
          setEngineStatus('error')
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
            setEngineDiagnostics(result.diagnostics ?? [])
            // MERGE changed values into existing map (not replace).
            const removedNodeIds = opsToSend
              .filter((op) => op.op === 'removeNode')
              .map((op) => (op as { op: 'removeNode'; nodeId: string }).nodeId)
            store.update(
              result.changedValues,
              removedNodeIds.length > 0 ? removedNodeIds : undefined,
            )
            setComputed(store.getAll())
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
            recordEngineEval(
              'patch',
              result.elapsedUs,
              result.totalCount,
              edges.length,
              result.evaluatedCount,
              result.partial ?? false,
              telemetryOpts,
            )
            // Phase 1E: Update stale/timing state after successful patch eval.
            setIsStale(false)
            setLastEvalMs(Math.round(result.elapsedUs / 1000))
            setLastEvalNodeCount(result.evaluatedCount)
            setEngineStatus('idle')
          })
          .catch((err: unknown) => {
            // Engine disposed during project/canvas switch — expected, not a bug.
            if (isEngineDisposedError(err)) return
            dlog.warn('engine', 'Eval interrupted', { error: String(err) })
            setEngineStatus('error')
          })
      }

      // Phase 1: Delegate dispatch timing to the EvalScheduler.
      // The scheduler handles debouncing, idle-callback, or manual
      // accumulation based on the current evalMode.
      if (schedulerRef.current) {
        schedulerRef.current.onFlush(firePatch)
        schedulerRef.current.enqueue(ops)
        // Phase 1E: Mark graph as stale when ops are enqueued but not yet dispatched.
        // In auto mode the scheduler flushes immediately (after debounce), so
        // isStale is briefly true then cleared by the eval callback.
        // In manual/deferred mode, isStale stays true until the user clicks Run.
        setIsStale(true)
      }
    }

    prevNodesRef.current = nodes
    prevEdgesRef.current = edges

    // Cleanup: clear scheduler timers on effect re-run or unmount.
    return () => {
      schedulerRef.current?.clear()
    }
  }, [
    nodes,
    edges,
    engine,
    options,
    refreshKey,
    paused,
    constants,
    variables,
    publishedOutputs,
    setEngineStatus,
    setIsStale,
    setLastEvalMs,
    setLastEvalNodeCount,
    store,
    telemetryOpts,
    angleUnit,
  ])

  // Phase 1: triggerEval — flush any pending scheduler ops OR force a full
  // snapshot reload if there are no pending ops (covers "re-run everything").
  const triggerEval = useCallback(() => {
    const sched = schedulerRef.current
    if (sched && sched.pendingCount > 0) {
      sched.flush()
    } else {
      // No pending ops — force a full snapshot reload (same as Refresh button)
      snapshotLoaded.current = false
      // Trigger the effect by updating a ref-change signal. Since React
      // won't re-run the effect just from a ref change, we nudge it via
      // the existing mechanism: the caller can bump refreshKey.
      // For now, just mark snapshot as not loaded — the next render cycle
      // will pick it up since nodes/edges are in the dep array.
      prevNodesRef.current = [] // Force diff to see "everything changed"
    }
  }, [])

  return { computed, isPartial, computedStore: store, triggerEval, pendingPatchCount, engineDiagnostics }
}
