/**
 * canvasCache.ts — IndexedDB cache for canvas graph snapshots.
 *
 * Stale-while-revalidate pattern: returns cached canvas instantly on load,
 * then the caller fetches the authoritative copy from Supabase in the
 * background and updates the cache.
 *
 * Cache key: `{userId}/{projectId}/{canvasId}` (matches Supabase Storage path).
 * Eviction: LRU with configurable max entries (default 100).
 * Invalidation: on save (write-through), on logout (clear all), on conflict.
 */

const DB_NAME = 'chainsolve-canvas-cache'
const DB_VERSION = 1
const STORE_NAME = 'canvases'
const MAX_ENTRIES = 100

// ── DB lifecycle ──────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('accessedAt', 'accessedAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

function cacheKey(userId: string, projectId: string, canvasId: string): string {
  return `${userId}/${projectId}/${canvasId}`
}

// ── Public API ────────────────────────────────────────────────────────────

export interface CachedCanvas {
  key: string
  json: unknown
  accessedAt: number
}

/**
 * Retrieve a cached canvas snapshot. Returns `null` on miss or error.
 * Updates the accessedAt timestamp for LRU tracking.
 */
export async function getCachedCanvas(
  userId: string,
  projectId: string,
  canvasId: string,
): Promise<unknown | null> {
  try {
    const db = await openDB()
    const key = cacheKey(userId, projectId, canvasId)
    return await new Promise<unknown | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => {
        const entry = req.result as CachedCanvas | undefined
        if (!entry) {
          resolve(null)
          return
        }
        // Touch accessedAt for LRU
        entry.accessedAt = Date.now()
        store.put(entry)
        resolve(entry.json)
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

/**
 * Store a canvas snapshot in the cache. Evicts LRU entries if over capacity.
 */
export async function setCachedCanvas(
  userId: string,
  projectId: string,
  canvasId: string,
  json: unknown,
): Promise<void> {
  try {
    const db = await openDB()
    const key = cacheKey(userId, projectId, canvasId)
    const entry: CachedCanvas = { key, json, accessedAt: Date.now() }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(entry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    // Best-effort LRU eviction
    void evictIfOverCapacity(db)
  } catch {
    // Cache writes are best-effort — never block the caller
  }
}

/**
 * Remove a specific canvas from the cache (e.g. on conflict detection).
 */
export async function invalidateCachedCanvas(
  userId: string,
  projectId: string,
  canvasId: string,
): Promise<void> {
  try {
    const db = await openDB()
    const key = cacheKey(userId, projectId, canvasId)
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Best-effort
  }
}

/**
 * Clear the entire canvas cache (e.g. on logout).
 */
export async function clearCanvasCache(): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Best-effort
  }
}

// ── LRU eviction ──────────────────────────────────────────────────────────

async function evictIfOverCapacity(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const countReq = store.count()

  await new Promise<void>((resolve) => {
    countReq.onsuccess = () => {
      const total = countReq.result
      if (total <= MAX_ENTRIES) {
        resolve()
        return
      }
      // Delete oldest entries until at capacity
      const toDelete = total - MAX_ENTRIES
      const idx = store.index('accessedAt')
      let deleted = 0
      const cursor = idx.openCursor()
      cursor.onsuccess = () => {
        const c = cursor.result
        if (c && deleted < toDelete) {
          c.delete()
          deleted++
          c.continue()
        } else {
          resolve()
        }
      }
      cursor.onerror = () => resolve()
    }
    countReq.onerror = () => resolve()
  })
}
