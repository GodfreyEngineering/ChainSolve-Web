/**
 * streamingBuffer.ts — 7.10: Streaming evaluation buffer for large parameter sweeps.
 *
 * Instead of accumulating all sweep results in memory, this ring-buffer
 * holds only the most recent `capacity` entries. Older entries are evicted
 * once the buffer is full, keeping memory use bounded.
 *
 * Default capacity: 131_072 entries (~1 MB for f64 pairs = index + value).
 * Configurable up to the browser budget passed in at construction.
 *
 * The buffer supports:
 *  - append(value): O(1) amortised
 *  - toArray(): returns all current entries in insertion order, O(n)
 *  - byteSize(): approximate memory used in bytes
 *  - isFull: true when at capacity (eviction mode)
 */

/** Default browser-side entry capacity: ~1 GB / 16 bytes per entry ≈ 64M entries.
 *  We use a more conservative 128K default for typical UI use. */
const DEFAULT_CAPACITY = 131_072

export class StreamingBuffer<T = number> {
  private readonly buf: T[]
  private head = 0
  private _size = 0
  readonly capacity: number

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = Math.max(1, capacity)
    this.buf = new Array<T>(this.capacity)
  }

  /** Append one entry, evicting the oldest if at capacity. */
  append(value: T): void {
    this.buf[this.head] = value
    this.head = (this.head + 1) % this.capacity
    if (this._size < this.capacity) this._size++
  }

  /** Number of entries currently stored. */
  get size(): number {
    return this._size
  }

  /** True when the buffer is full and eviction is occurring. */
  get isFull(): boolean {
    return this._size === this.capacity
  }

  /** Return all entries in insertion order (oldest first). */
  toArray(): T[] {
    if (this._size === 0) return []
    if (this._size < this.capacity) {
      return this.buf.slice(0, this._size)
    }
    // Full ring: entries from head (oldest) to end, then 0 to head-1.
    return [...this.buf.slice(this.head), ...this.buf.slice(0, this.head)]
  }

  /** Return only the last `n` entries. */
  tail(n: number): T[] {
    const arr = this.toArray()
    return n >= arr.length ? arr : arr.slice(arr.length - n)
  }

  /** Approximate memory usage in bytes (assumes 8 bytes per numeric entry). */
  byteSize(): number {
    return this._size * 16 // index + value pair
  }

  /** Clear all entries. */
  clear(): void {
    this.head = 0
    this._size = 0
  }
}

/**
 * Compute the streaming buffer capacity for a given byte budget.
 * Each entry is assumed to be 16 bytes (index + value pair).
 */
export function capacityForBudget(budgetBytes: number): number {
  return Math.max(1024, Math.floor(budgetBytes / 16))
}

/** 1 GB in bytes — default browser-side budget. */
export const BROWSER_BUDGET_BYTES = 1_073_741_824

/** 16 GB in bytes — default server-side budget. */
export const SERVER_BUDGET_BYTES = 17_179_869_184
