/**
 * canvasesStore.test.ts — Unit tests for multi-canvas sheet state (D13-2).
 *
 * Verifies state transitions for add, remove, reorder, and dirty tracking
 * to ensure sheet operations are robust.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasesStore } from './canvasesStore'
import type { CanvasRow } from '../lib/canvases'

function makeRow(id: string, pos: number, name?: string): CanvasRow {
  return {
    id,
    project_id: 'proj-1',
    owner_id: 'user-1',
    name: name ?? `Sheet ${pos + 1}`,
    position: pos,
    storage_path: `user-1/proj-1/canvases/${id}.json`,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  }
}

beforeEach(() => {
  useCanvasesStore.getState().reset()
})

// ── setCanvases ──────────────────────────────────────────────────────────────

describe('setCanvases', () => {
  it('replaces the canvases list', () => {
    const rows = [makeRow('c1', 0), makeRow('c2', 1)]
    useCanvasesStore.getState().setCanvases(rows)
    expect(useCanvasesStore.getState().canvases).toHaveLength(2)
    expect(useCanvasesStore.getState().canvases[0].id).toBe('c1')
  })
})

// ── addCanvas ────────────────────────────────────────────────────────────────

describe('addCanvas', () => {
  it('adds a canvas and sorts by position', () => {
    const { setCanvases, addCanvas } = useCanvasesStore.getState()
    setCanvases([makeRow('c1', 0), makeRow('c2', 1)])
    addCanvas(makeRow('c3', 2))
    expect(useCanvasesStore.getState().canvases).toHaveLength(3)
    expect(useCanvasesStore.getState().canvases[2].id).toBe('c3')
  })

  it('inserts in correct position order', () => {
    const { setCanvases, addCanvas } = useCanvasesStore.getState()
    setCanvases([makeRow('c1', 0), makeRow('c3', 2)])
    addCanvas(makeRow('c2', 1))
    const ids = useCanvasesStore.getState().canvases.map((c) => c.id)
    expect(ids).toEqual(['c1', 'c2', 'c3'])
  })
})

// ── removeCanvas ─────────────────────────────────────────────────────────────

describe('removeCanvas', () => {
  it('removes the canvas from the list', () => {
    const { setCanvases, removeCanvas } = useCanvasesStore.getState()
    setCanvases([makeRow('c1', 0), makeRow('c2', 1)])
    removeCanvas('c1')
    expect(useCanvasesStore.getState().canvases).toHaveLength(1)
    expect(useCanvasesStore.getState().canvases[0].id).toBe('c2')
  })

  it('clears dirty flag for the removed canvas', () => {
    const { setCanvases, markCanvasDirty, removeCanvas } = useCanvasesStore.getState()
    setCanvases([makeRow('c1', 0), makeRow('c2', 1)])
    markCanvasDirty('c1')
    expect(useCanvasesStore.getState().dirtyCanvasIds.has('c1')).toBe(true)
    removeCanvas('c1')
    expect(useCanvasesStore.getState().dirtyCanvasIds.has('c1')).toBe(false)
  })

  it('does not change activeCanvasId', () => {
    const { setCanvases, setActiveCanvasId, removeCanvas } = useCanvasesStore.getState()
    setCanvases([makeRow('c1', 0), makeRow('c2', 1)])
    setActiveCanvasId('c1')
    removeCanvas('c1')
    // activeCanvasId is NOT automatically cleared — caller must switch
    expect(useCanvasesStore.getState().activeCanvasId).toBe('c1')
  })
})

// ── updateCanvas ─────────────────────────────────────────────────────────────

describe('updateCanvas', () => {
  it('renames a canvas', () => {
    const { setCanvases, updateCanvas } = useCanvasesStore.getState()
    setCanvases([makeRow('c1', 0, 'Old Name')])
    updateCanvas('c1', { name: 'New Name' })
    expect(useCanvasesStore.getState().canvases[0].name).toBe('New Name')
  })

  it('re-sorts by position after update', () => {
    const { setCanvases, updateCanvas } = useCanvasesStore.getState()
    setCanvases([makeRow('c1', 0), makeRow('c2', 1)])
    updateCanvas('c1', { position: 2 })
    const ids = useCanvasesStore.getState().canvases.map((c) => c.id)
    expect(ids).toEqual(['c2', 'c1'])
  })
})

// ── dirty tracking ───────────────────────────────────────────────────────────

describe('dirty tracking', () => {
  it('marks a canvas dirty and clean', () => {
    const { markCanvasDirty, markCanvasClean } = useCanvasesStore.getState()
    markCanvasDirty('c1')
    expect(useCanvasesStore.getState().dirtyCanvasIds.has('c1')).toBe(true)
    markCanvasClean('c1')
    expect(useCanvasesStore.getState().dirtyCanvasIds.has('c1')).toBe(false)
  })

  it('tracks multiple dirty canvases independently', () => {
    const { markCanvasDirty, markCanvasClean } = useCanvasesStore.getState()
    markCanvasDirty('c1')
    markCanvasDirty('c2')
    markCanvasClean('c1')
    expect(useCanvasesStore.getState().dirtyCanvasIds.has('c1')).toBe(false)
    expect(useCanvasesStore.getState().dirtyCanvasIds.has('c2')).toBe(true)
  })
})

// ── reset ────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('clears all state', () => {
    const s = useCanvasesStore.getState()
    s.setCanvases([makeRow('c1', 0)])
    s.setActiveCanvasId('c1')
    s.markCanvasDirty('c1')
    s.reset()
    const after = useCanvasesStore.getState()
    expect(after.canvases).toHaveLength(0)
    expect(after.activeCanvasId).toBeNull()
    expect(after.dirtyCanvasIds.size).toBe(0)
  })
})
