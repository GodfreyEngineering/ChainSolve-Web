import { describe, it, expect } from 'vitest'
import { assessRisk, requiresConfirmation } from './riskScoring'
import type { AiPatchOp } from './types'

describe('assessRisk', () => {
  it('returns low for empty ops', () => {
    const result = assessRisk([])
    expect(result.level).toBe('low')
    expect(result.reasons).toEqual([])
  })

  it('returns low for 1-3 simple adds', () => {
    const ops: AiPatchOp[] = [
      { op: 'addNode', node: { id: 'n1', blockType: 'number', label: 'X' } },
      { op: 'addEdge', edge: { id: 'e1', source: 'n1', target: 'n2' } },
    ]
    const result = assessRisk(ops)
    expect(result.level).toBe('low')
  })

  it('returns medium for removeNode', () => {
    const ops: AiPatchOp[] = [{ op: 'removeNode', nodeId: 'n1' }]
    const result = assessRisk(ops)
    expect(result.level).toBe('medium')
    expect(result.reasons.some((r) => r.includes('Removes'))).toBe(true)
  })

  it('returns high for >5 removals', () => {
    const ops: AiPatchOp[] = [
      { op: 'removeNode', nodeId: 'n1' },
      { op: 'removeNode', nodeId: 'n2' },
      { op: 'removeEdge', edgeId: 'e1' },
      { op: 'removeEdge', edgeId: 'e2' },
      { op: 'removeEdge', edgeId: 'e3' },
      { op: 'removeEdge', edgeId: 'e4' },
    ]
    const result = assessRisk(ops)
    expect(result.level).toBe('high')
  })

  it('returns medium for >10 ops', () => {
    const ops: AiPatchOp[] = Array.from({ length: 12 }, (_, i) => ({
      op: 'addNode' as const,
      node: { id: `n${i}`, blockType: 'number', label: `N${i}` },
    }))
    const result = assessRisk(ops)
    expect(result.level).toBe('medium')
  })

  it('returns medium for >20 node adds', () => {
    const ops: AiPatchOp[] = Array.from({ length: 22 }, (_, i) => ({
      op: 'addNode' as const,
      node: { id: `n${i}`, blockType: 'number', label: `N${i}` },
    }))
    const result = assessRisk(ops)
    expect(result.level).toBe('medium')
    expect(result.reasons.some((r) => r.includes('22 nodes'))).toBe(true)
  })

  it('returns medium for variable mutations', () => {
    const ops: AiPatchOp[] = [
      {
        op: 'createVariable',
        variable: { id: 'v1', name: 'x', value: 42 },
      },
    ]
    const result = assessRisk(ops)
    expect(result.level).toBe('medium')
  })
})

describe('requiresConfirmation', () => {
  it('always confirms high risk', () => {
    expect(requiresConfirmation('high', 'edit', false)).toBe(true)
    expect(requiresConfirmation('high', 'bypass', true)).toBe(true)
  })

  it('edit mode confirms medium risk', () => {
    expect(requiresConfirmation('medium', 'edit', false)).toBe(true)
  })

  it('bypass mode auto-applies medium if enterprise allows', () => {
    expect(requiresConfirmation('medium', 'bypass', true)).toBe(false)
  })

  it('bypass mode confirms medium if enterprise disallows', () => {
    expect(requiresConfirmation('medium', 'bypass', false)).toBe(true)
  })

  it('both modes auto-apply low risk', () => {
    expect(requiresConfirmation('low', 'edit', false)).toBe(false)
    expect(requiresConfirmation('low', 'bypass', false)).toBe(false)
  })
})
