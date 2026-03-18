/**
 * Generic LRU (Least-Recently-Used) cache with configurable capacity (7.11).
 *
 * Uses a `Map` for O(1) get/set/delete (Map preserves insertion order,
 * which is exactly what we need for LRU: oldest entry = first key).
 *
 * ## Usage
 * ```ts
 * const cache = new LruCache<string, Float64Array>(512)
 * cache.set('nodeA', resultArray)
 * const v = cache.get('nodeA') // refreshes recency
 * ```
 *
 * ## Memory pressure
 * Call `evictToMemoryBudgetBytes()` to trim cache size based on estimated
 * bytes consumed.  When `performance.memory` (Chrome) is available, call
 * `evictOnPressure(limitMb)` to auto-trim when the JS heap approaches a
 * configured threshold.
 */

// ── Core LruCache ──────────────────────────────────────────────────────────────

export class LruCache<K, V> {
  /** Underlying insertion-ordered map; oldest entry = first key (LRU). */
  private readonly _map: Map<K, V>
  private readonly _maxEntries: number
  private readonly _onEvict?: (key: K, value: V) => void

  /**
   * @param maxEntries Maximum number of entries before LRU eviction fires.
   *   Must be ≥ 1.
   * @param onEvict Optional callback invoked when an entry is evicted.
   */
  constructor(maxEntries: number, onEvict?: (key: K, value: V) => void) {
    if (maxEntries < 1) throw new RangeError(`LruCache: maxEntries must be ≥ 1 (got ${maxEntries})`)
    this._map = new Map()
    this._maxEntries = maxEntries
    this._onEvict = onEvict
  }

  // ── Capacity ──────────────────────────────────────────────────────────────

  get maxEntries(): number {
    return this._maxEntries
  }

  get size(): number {
    return this._map.size
  }

  // ── Core operations ───────────────────────────────────────────────────────

  /**
   * Look up a key and refresh its recency if found.
   * Returns `undefined` for cache misses.
   */
  get(key: K): V | undefined {
    if (!this._map.has(key)) return undefined
    const value = this._map.get(key) as V
    // Move to tail (MRU position) via delete + re-insert
    this._map.delete(key)
    this._map.set(key, value)
    return value
  }

  /**
   * Peek at a value without refreshing recency.
   * Does NOT count as a "use" for LRU purposes.
   */
  peek(key: K): V | undefined {
    return this._map.get(key)
  }

  /** Whether the key exists in the cache (does not refresh recency). */
  has(key: K): boolean {
    return this._map.has(key)
  }

  /**
   * Insert or update a key→value pair.
   *
   * If the cache is at capacity and the key is new, the least-recently-used
   * entry is evicted first.
   */
  set(key: K, value: V): this {
    if (this._map.has(key)) {
      // Refresh recency by deleting and re-inserting
      this._map.delete(key)
    } else if (this._map.size >= this._maxEntries) {
      this._evictOne()
    }
    this._map.set(key, value)
    return this
  }

  /** Remove a specific key. Returns `true` if the key existed. */
  delete(key: K): boolean {
    return this._map.delete(key)
  }

  /** Remove all entries. */
  clear(): void {
    this._map.clear()
  }

  // ── Bulk eviction ─────────────────────────────────────────────────────────

  /**
   * Evict entries (LRU first) until `size <= targetSize`.
   * No-op if already at or below `targetSize`.
   */
  evictUntil(targetSize: number): void {
    while (this._map.size > targetSize) {
      if (!this._evictOne()) break
    }
  }

  /**
   * Evict entries whose estimated size (via `sizeOf`) causes total bytes to
   * exceed `maxBytes`.  Evicts LRU entries first.
   *
   * @param sizeOf Function that returns the estimated byte size of a value.
   *   For a `Float64Array`, `v => v.byteLength` is appropriate.
   * @param maxBytes Budget in bytes.
   */
  evictToMemoryBudgetBytes(sizeOf: (value: V) => number, maxBytes: number): void {
    let total = 0
    for (const v of this._map.values()) total += sizeOf(v)
    for (const [k, v] of this._map) {
      if (total <= maxBytes) break
      total -= sizeOf(v)
      this._map.delete(k)
      this._onEvict?.(k, v)
    }
  }

  /**
   * Evict LRU entries if the JS heap (via `performance.memory`) exceeds
   * `limitMb`.  Evicts in batches of 10% of current size until under budget.
   *
   * Only effective in Chrome/Chromium (where `performance.memory` is
   * available); no-op otherwise.
   *
   * @param limitMb Heap usage threshold in mebibytes (MiB).
   */
  evictOnPressure(limitMb: number): void {
    const perf = performance as typeof performance & {
      memory?: { usedJSHeapSize: number }
    }
    if (!perf.memory) return
    const usedMb = perf.memory.usedJSHeapSize / (1024 * 1024)
    if (usedMb <= limitMb) return
    // Evict 10% of cache entries per call to relieve pressure gradually
    const evictCount = Math.max(1, Math.floor(this._map.size * 0.1))
    this.evictUntil(this._map.size - evictCount)
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  /** Keys in LRU→MRU order (oldest first). */
  keys(): IterableIterator<K> {
    return this._map.keys()
  }

  /** Values in LRU→MRU order. */
  values(): IterableIterator<V> {
    return this._map.values()
  }

  /** Entries in LRU→MRU order. */
  entries(): IterableIterator<[K, V]> {
    return this._map.entries()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /** Evict the single least-recently-used entry. Returns false if empty. */
  private _evictOne(): boolean {
    const iter = this._map.keys()
    const first = iter.next()
    if (first.done) return false
    const lruKey = first.value
    const lruValue = this._map.get(lruKey) as V
    this._map.delete(lruKey)
    this._onEvict?.(lruKey, lruValue)
    return true
  }
}

// ── BlockResultCache ──────────────────────────────────────────────────────────

/**
 * Specialisation of LruCache keyed by `nodeId:inputHash` for caching block
 * evaluation results.
 *
 * Default capacity: 1024 entries (configurable via constructor).
 * On-evict: optional diagnostic callback.
 *
 * ## Integration with EvalScheduler
 *
 * The EvalScheduler can check this cache before dispatching a node's evaluation
 * to the WASM engine.  On cache hit, the engine's dirty flag for that node is
 * cleared without performing any computation.
 */
export class BlockResultCache {
  private readonly _cache: LruCache<string, unknown>
  private _hits = 0
  private _misses = 0

  constructor(maxEntries = 1024) {
    this._cache = new LruCache(maxEntries)
  }

  get maxEntries(): number {
    return this._cache.maxEntries
  }

  get size(): number {
    return this._cache.size
  }

  /** Hit/miss ratio (0–1). Returns 0 if no queries yet. */
  get hitRate(): number {
    const total = this._hits + this._misses
    return total === 0 ? 0 : this._hits / total
  }

  get hits(): number {
    return this._hits
  }

  get misses(): number {
    return this._misses
  }

  /** Composite cache key: `<nodeId>:<inputHash>`. */
  static key(nodeId: string, inputHash: string): string {
    return `${nodeId}:${inputHash}`
  }

  /** Look up a cached result. Refreshes recency on hit. */
  get(nodeId: string, inputHash: string): unknown | undefined {
    const value = this._cache.get(BlockResultCache.key(nodeId, inputHash))
    if (value === undefined) {
      this._misses++
    } else {
      this._hits++
    }
    return value
  }

  /** Store a computed result. Evicts LRU entry if at capacity. */
  set(nodeId: string, inputHash: string, value: unknown): void {
    this._cache.set(BlockResultCache.key(nodeId, inputHash), value)
  }

  /** Invalidate all cached results for a specific node. */
  invalidateNode(nodeId: string): void {
    for (const key of Array.from(this._cache.keys())) {
      if (key.startsWith(`${nodeId}:`)) {
        this._cache.delete(key)
      }
    }
  }

  /** Trim to `maxEntries` entries (evict LRU first). */
  evictUntil(maxEntries: number): void {
    this._cache.evictUntil(maxEntries)
  }

  /** Evict if JS heap usage exceeds `limitMb` (Chrome only). */
  evictOnPressure(limitMb: number): void {
    this._cache.evictOnPressure(limitMb)
  }

  /** Remove all entries and reset stats. */
  clear(): void {
    this._cache.clear()
    this._hits = 0
    this._misses = 0
  }
}
