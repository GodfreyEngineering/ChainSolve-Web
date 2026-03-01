import { describe, it, expect } from 'vitest'
import { applyPatchOps } from './patchExecutor'
import type { AiPatchOp } from './types'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../../blocks/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeNode(id: string, blockType = 'number'): Node<NodeData> {
  return {
    id,
    type: 'csSource',
    position: { x: 0, y: 0 },
    data: { blockType, label: blockType, value: 0 } as NodeData,
  }
}

function makeEdge(id: string, source: string, target: string, targetHandle = 'a'): Edge {
  return { id, source, sourceHandle: 'out', target, targetHandle }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('applyPatchOps', () => {
  it('adds a node', () => {
    const ops: AiPatchOp[] = [
      {
        op: 'addNode',
        node: {
          id: 'ai_node_1',
          blockType: 'add',
          label: 'Sum',
          position: { x: 100, y: 200 },
        },
      },
    ]
    const result = applyPatchOps(ops, [], [], true)
    expect(result.appliedCount).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe('ai_node_1')
    expect((result.nodes[0].data as NodeData).blockType).toBe('add')
  })

  it('rejects duplicate node ids', () => {
    const existing = [makeNode('n1')]
    const ops: AiPatchOp[] = [{ op: 'addNode', node: { id: 'n1', blockType: 'number' } }]
    const result = applyPatchOps(ops, existing, [], true)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('Duplicate')
    expect(result.appliedCount).toBe(0)
  })

  it('rejects unknown block types', () => {
    const ops: AiPatchOp[] = [
      { op: 'addNode', node: { id: 'n1', blockType: 'nonexistent_block_xyz' } },
    ]
    const result = applyPatchOps(ops, [], [], true)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('Unknown blockType')
  })

  it('adds an edge with source/target validation', () => {
    const nodes = [makeNode('n1'), makeNode('n2')]
    const ops: AiPatchOp[] = [
      {
        op: 'addEdge',
        edge: { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n2', targetHandle: 'a' },
      },
    ]
    const result = applyPatchOps(ops, nodes, [], true)
    expect(result.appliedCount).toBe(1)
    expect(result.edges).toHaveLength(1)
  })

  it('rejects edge when target node missing', () => {
    const nodes = [makeNode('n1')]
    const ops: AiPatchOp[] = [
      {
        op: 'addEdge',
        edge: { id: 'e1', source: 'n1', target: 'missing' },
      },
    ]
    const result = applyPatchOps(ops, nodes, [], true)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('Target node not found')
  })

  it('enforces fan-in (one edge per target handle)', () => {
    const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3')]
    const edges = [makeEdge('e1', 'n1', 'n3', 'a')]
    const ops: AiPatchOp[] = [
      {
        op: 'addEdge',
        edge: { id: 'e2', source: 'n2', target: 'n3', targetHandle: 'a' },
      },
    ]
    const result = applyPatchOps(ops, nodes, edges, true)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('Fan-in violation')
  })

  it('updates node data', () => {
    const nodes = [makeNode('n1')]
    const ops: AiPatchOp[] = [{ op: 'updateNodeData', nodeId: 'n1', data: { value: 42 } }]
    const result = applyPatchOps(ops, nodes, [], true)
    expect(result.appliedCount).toBe(1)
    expect((result.nodes[0].data as NodeData).value).toBe(42)
  })

  it('sanitizes NaN/Infinity in data', () => {
    const nodes = [makeNode('n1')]
    const ops: AiPatchOp[] = [
      { op: 'updateNodeData', nodeId: 'n1', data: { value: NaN, other: Infinity } },
    ]
    const result = applyPatchOps(ops, nodes, [], true)
    expect((result.nodes[0].data as NodeData).value).toBe(0)
    expect((result.nodes[0].data as Record<string, unknown>).other).toBe(0)
  })

  it('removes node and connected edges when destructive allowed', () => {
    const nodes = [makeNode('n1'), makeNode('n2')]
    const edges = [makeEdge('e1', 'n1', 'n2')]
    const ops: AiPatchOp[] = [{ op: 'removeNode', nodeId: 'n1' }]
    const result = applyPatchOps(ops, nodes, edges, true)
    expect(result.appliedCount).toBe(1)
    expect(result.nodes).toHaveLength(1)
    expect(result.edges).toHaveLength(0) // Connected edge removed
  })

  it('rejects removeNode when destructive not allowed', () => {
    const nodes = [makeNode('n1')]
    const ops: AiPatchOp[] = [{ op: 'removeNode', nodeId: 'n1' }]
    const result = applyPatchOps(ops, nodes, [], false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('Destructive op')
    expect(result.nodes).toHaveLength(1) // Not removed
  })

  it('rejects removeEdge when destructive not allowed', () => {
    const nodes = [makeNode('n1'), makeNode('n2')]
    const edges = [makeEdge('e1', 'n1', 'n2')]
    const ops: AiPatchOp[] = [{ op: 'removeEdge', edgeId: 'e1' }]
    const result = applyPatchOps(ops, nodes, edges, false)
    expect(result.errors).toHaveLength(1)
    expect(result.edges).toHaveLength(1)
  })

  it('sets input binding on a node', () => {
    const nodes = [makeNode('n1', 'add')]
    const ops: AiPatchOp[] = [
      {
        op: 'setInputBinding',
        nodeId: 'n1',
        portId: 'a',
        binding: { kind: 'literal', value: 7 },
      },
    ]
    const result = applyPatchOps(ops, nodes, [], true)
    expect(result.appliedCount).toBe(1)
    const data = result.nodes[0].data as NodeData
    expect(data.inputBindings?.a).toEqual({ kind: 'literal', value: 7 })
  })

  it('applies multiple ops in sequence', () => {
    const ops: AiPatchOp[] = [
      { op: 'addNode', node: { id: 'n1', blockType: 'number', label: 'A' } },
      { op: 'addNode', node: { id: 'n2', blockType: 'add', label: 'Sum' } },
      {
        op: 'addEdge',
        edge: { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n2', targetHandle: 'a' },
      },
    ]
    const result = applyPatchOps(ops, [], [], true)
    expect(result.appliedCount).toBe(3)
    expect(result.errors).toHaveLength(0)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })
})
