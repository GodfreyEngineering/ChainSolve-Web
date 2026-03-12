import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import type { Value } from '../engine/value'
import type { ComputedStore } from './ComputedStore'

// ── Legacy context (Map reference — O(N) re-renders per eval) ────────────────
// Kept for CanvasArea-level code that accesses the full map reactively.
// Node components should use useComputedValue(nodeId) instead.

/** Map from node id → computed Value (error kind = error/disconnected). */
export const ComputedContext = createContext<ReadonlyMap<string, Value>>(new Map())

export function useComputed(): ReadonlyMap<string, Value> {
  return useContext(ComputedContext)
}

// ── Store context (per-node subscriptions — O(1) re-renders per eval) ────────

/** Context carrying the ComputedStore instance (stable reference). */
export const ComputedStoreContext = createContext<ComputedStore | null>(null)

/**
 * UI-PERF-02: Per-node computed value subscription.
 *
 * Uses useSyncExternalStore so only the node whose value changed re-renders —
 * O(1) render cost per engine evaluation instead of O(N).
 *
 * Falls back gracefully to the legacy Map context if the store context is not
 * provided (e.g. in test environments that only wrap with ComputedContext).
 */
export function useComputedValue(nodeId: string): Value | undefined {
  const store = useContext(ComputedStoreContext)
  const legacyMap = useContext(ComputedContext)

  // Stable subscribe / getSnapshot refs for useSyncExternalStore.
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!store) return () => {}
      return store.subscribeNode(nodeId, callback)
    },
    // store is stable (created once in useRef in useGraphEngine); nodeId is
    // stable for the lifetime of a mounted node component.
    [store, nodeId],
  )

  const getSnapshot = useCallback(
    () => (store ? store.get(nodeId) : legacyMap.get(nodeId)),
    [store, legacyMap, nodeId],
  )

  return useSyncExternalStore(subscribe, getSnapshot)
}
