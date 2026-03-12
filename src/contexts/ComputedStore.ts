/**
 * ComputedStore — external store for O(1) per-node value subscriptions.
 *
 * UI-PERF-02: Engine result values flow through ComputedContext → all
 * node components. Previously, every engine evaluation replaced the
 * ReadonlyMap<string, Value> reference, causing every node component
 * that called useComputed() to re-render — O(N) renders per eval.
 *
 * ComputedStore lets each node subscribe to its own nodeId only.
 * useSyncExternalStore drives the subscription, so React's concurrent
 * scheduler sees the updates and batches them correctly.
 */

import type { Value } from '../engine/value'

type Listener = () => void

export class ComputedStore {
  private values = new Map<string, Value>()
  /** Per-node subscribers: nodeId → set of listeners. */
  private nodeListeners = new Map<string, Set<Listener>>()
  /** Subscribers that want to know about ANY change (for legacy useComputed()). */
  private anyListeners = new Set<Listener>()

  // ── Read API ──────────────────────────────────────────────────────────────

  get(nodeId: string): Value | undefined {
    return this.values.get(nodeId)
  }

  getAll(): ReadonlyMap<string, Value> {
    return this.values
  }

  // ── Write API (called from useGraphEngine) ────────────────────────────────

  /**
   * Replace all values (snapshot load).
   * Notifies every per-node subscriber and all any-change subscribers.
   */
  load(newValues: Record<string, unknown>): void {
    this.values = new Map()
    for (const [id, val] of Object.entries(newValues)) {
      this.values.set(id, val as Value)
    }
    // Notify per-node listeners that existed in the previous snapshot.
    this.nodeListeners.forEach((set) => set.forEach((l) => l()))
    this.anyListeners.forEach((l) => l())
  }

  /**
   * Apply a partial update (incremental patch result).
   * Only notifies subscribers for the nodes that actually changed.
   */
  update(changedValues: Record<string, unknown>, removedNodeIds?: string[]): void {
    for (const [id, val] of Object.entries(changedValues)) {
      this.values.set(id, val as Value)
      this.nodeListeners.get(id)?.forEach((l) => l())
    }
    if (removedNodeIds) {
      for (const id of removedNodeIds) {
        this.values.delete(id)
        this.nodeListeners.get(id)?.forEach((l) => l())
      }
    }
    // Notify broad subscribers once (after all per-node notifications).
    this.anyListeners.forEach((l) => l())
  }

  // ── Subscription API (used by useSyncExternalStore) ───────────────────────

  /** Subscribe to changes for a single node. Returns an unsubscribe function. */
  subscribeNode(nodeId: string, listener: Listener): () => void {
    let set = this.nodeListeners.get(nodeId)
    if (!set) {
      set = new Set()
      this.nodeListeners.set(nodeId, set)
    }
    set.add(listener)
    return () => {
      this.nodeListeners.get(nodeId)?.delete(listener)
    }
  }

  /** Subscribe to any change (for components that need the full Map). */
  subscribeAll(listener: Listener): () => void {
    this.anyListeners.add(listener)
    return () => {
      this.anyListeners.delete(listener)
    }
  }
}
