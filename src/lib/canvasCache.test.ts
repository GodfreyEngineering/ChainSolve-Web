/**
 * canvasCache.test.ts — Unit tests for the IndexedDB canvas cache module.
 *
 * Since jsdom does not provide IndexedDB, we test that the public API
 * degrades gracefully (returns null / does not throw) when IndexedDB is
 * unavailable.  The cache is best-effort by design — it must never block
 * or crash the application.
 */

import { describe, it, expect } from 'vitest'
import {
  getCachedCanvas,
  setCachedCanvas,
  invalidateCachedCanvas,
  clearCanvasCache,
} from './canvasCache'

const USER = 'user-1'
const PROJECT = 'proj-1'
const CANVAS = 'canvas-1'

describe('canvasCache (no IndexedDB)', () => {
  it('getCachedCanvas returns null when IndexedDB is unavailable', async () => {
    const result = await getCachedCanvas(USER, PROJECT, CANVAS)
    expect(result).toBeNull()
  })

  it('setCachedCanvas does not throw when IndexedDB is unavailable', async () => {
    await expect(
      setCachedCanvas(USER, PROJECT, CANVAS, { nodes: [], edges: [] }),
    ).resolves.toBeUndefined()
  })

  it('invalidateCachedCanvas does not throw when IndexedDB is unavailable', async () => {
    await expect(invalidateCachedCanvas(USER, PROJECT, CANVAS)).resolves.toBeUndefined()
  })

  it('clearCanvasCache does not throw when IndexedDB is unavailable', async () => {
    await expect(clearCanvasCache()).resolves.toBeUndefined()
  })
})
