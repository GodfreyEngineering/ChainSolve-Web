/**
 * Tests for the pure helper exports of useGraphEngine.
 *
 * The hook itself is exercised indirectly through the engine integration tests
 * (jobManager.test.ts) and Rust perf smoke tests.  Here we verify the
 * scheduler logic that drives debounce behaviour.
 */
import { describe, it, expect } from 'vitest'
import { hasStructuralChange, PATCH_DEBOUNCE_MS } from './useGraphEngine.ts'
import type { PatchOp } from './wasm-types.ts'

// ── hasStructuralChange ───────────────────────────────────────────────────────

describe('hasStructuralChange', () => {
  it('returns false for an empty op list', () => {
    expect(hasStructuralChange([])).toBe(false)
  })

  it('returns false for updateNodeData-only ops', () => {
    const ops: PatchOp[] = [
      { op: 'updateNodeData', nodeId: 'n1', data: { value: 42 } },
      { op: 'updateNodeData', nodeId: 'n2', data: { value: 7 } },
    ]
    expect(hasStructuralChange(ops)).toBe(false)
  })

  it('returns true when addNode is present', () => {
    const ops: PatchOp[] = [{ op: 'addNode', node: { id: 'n1', blockType: 'number', data: {} } }]
    expect(hasStructuralChange(ops)).toBe(true)
  })

  it('returns true when removeNode is present', () => {
    const ops: PatchOp[] = [{ op: 'removeNode', nodeId: 'n1' }]
    expect(hasStructuralChange(ops)).toBe(true)
  })

  it('returns true when addEdge is present', () => {
    const ops: PatchOp[] = [
      {
        op: 'addEdge',
        edge: { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n2', targetHandle: 'in' },
      },
    ]
    expect(hasStructuralChange(ops)).toBe(true)
  })

  it('returns true when removeEdge is present', () => {
    const ops: PatchOp[] = [{ op: 'removeEdge', edgeId: 'e1' }]
    expect(hasStructuralChange(ops)).toBe(true)
  })

  it('returns true when structural op is mixed with data ops', () => {
    const ops: PatchOp[] = [
      { op: 'updateNodeData', nodeId: 'n1', data: { value: 1 } },
      { op: 'removeNode', nodeId: 'n2' },
    ]
    expect(hasStructuralChange(ops)).toBe(true)
  })
})

// ── PATCH_DEBOUNCE_MS ─────────────────────────────────────────────────────────

describe('PATCH_DEBOUNCE_MS', () => {
  it('is a positive integer ≤ 500ms (reasonable debounce range)', () => {
    expect(Number.isInteger(PATCH_DEBOUNCE_MS)).toBe(true)
    expect(PATCH_DEBOUNCE_MS).toBeGreaterThan(0)
    expect(PATCH_DEBOUNCE_MS).toBeLessThanOrEqual(500)
  })
})
