/**
 * diffGraph.test.ts — Integration tests for the React Flow diff → PatchOp[] bridge.
 *
 * Tests `diffGraph()`, which computes the minimal set of PatchOps needed to
 * transform the engine state from one graph state to another.
 *
 * P092: Integration tests: WASM worker snapshot → result
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { diffGraph } from './diffGraph'

// ── Helpers ──────────────────────────────────────────────────────────────────

function node(id: string, blockType: string, extra: Record<string, unknown> = {}): Node {
  return {
    id,
    type: blockType,
    position: { x: 0, y: 0 },
    data: { blockType, ...extra },
  }
}

function edge(id: string, source: string, target: string, sh = 'out', th = 'in'): Edge {
  return { id, source, target, sourceHandle: sh, targetHandle: th }
}

// ── No-op cases ──────────────────────────────────────────────────────────────

describe('diffGraph — no changes', () => {
  it('produces no ops for identical empty graphs', () => {
    expect(diffGraph([], [], [], [])).toHaveLength(0)
  })

  it('produces no ops when nodes/edges are unchanged', () => {
    const nodes = [node('n1', 'number', { value: 5 }), node('n2', 'display')]
    const edges = [edge('e1', 'n1', 'n2', 'out', 'value')]
    expect(diffGraph(nodes, edges, nodes, edges)).toHaveLength(0)
  })

  it('produces no ops when only node position changes', () => {
    const prev = [{ ...node('n1', 'number'), position: { x: 0, y: 0 } }]
    const next = [{ ...node('n1', 'number'), position: { x: 100, y: 200 } }]
    expect(diffGraph(prev, [], next, [])).toHaveLength(0)
  })
})

// ── Node changes ─────────────────────────────────────────────────────────────

describe('diffGraph — node additions', () => {
  it('emits addNode for a new node', () => {
    const ops = diffGraph([], [], [node('n1', 'number')], [])
    expect(ops).toHaveLength(1)
    expect(ops[0].op).toBe('addNode')
    if (ops[0].op === 'addNode') {
      expect(ops[0].node.id).toBe('n1')
      expect(ops[0].node.blockType).toBe('number')
    }
  })

  it('emits addNode for each newly added node', () => {
    const nodes = [node('n1', 'number'), node('n2', 'add')]
    const ops = diffGraph([], [], nodes, [])
    expect(ops.filter((o) => o.op === 'addNode')).toHaveLength(2)
  })
})

describe('diffGraph — node removals', () => {
  it('emits removeNode when a node is removed', () => {
    const ops = diffGraph([node('n1', 'number')], [], [], [])
    expect(ops).toHaveLength(1)
    expect(ops[0].op).toBe('removeNode')
    if (ops[0].op === 'removeNode') {
      expect(ops[0].nodeId).toBe('n1')
    }
  })
})

describe('diffGraph — node data changes', () => {
  it('emits updateNodeData when value changes', () => {
    const prev = [node('n1', 'number', { value: 5 })]
    const next = [node('n1', 'number', { value: 10 })]
    const ops = diffGraph(prev, [], next, [])
    expect(ops).toHaveLength(1)
    expect(ops[0].op).toBe('updateNodeData')
    if (ops[0].op === 'updateNodeData') {
      expect(ops[0].nodeId).toBe('n1')
      expect((ops[0].data as { value: number }).value).toBe(10)
    }
  })

  it('emits updateNodeData when manualValues change', () => {
    const prev = [node('n1', 'stats.desc.mean', { manualValues: { c: 3 } })]
    const next = [node('n1', 'stats.desc.mean', { manualValues: { c: 6 } })]
    const ops = diffGraph(prev, [], next, [])
    expect(ops).toHaveLength(1)
    expect(ops[0].op).toBe('updateNodeData')
  })

  it('emits no ops when data is unchanged', () => {
    const prev = [node('n1', 'number', { value: 42 })]
    const next = [node('n1', 'number', { value: 42 })]
    expect(diffGraph(prev, [], next, [])).toHaveLength(0)
  })
})

// ── Group node exclusion ──────────────────────────────────────────────────────

describe('diffGraph — group node exclusion', () => {
  it('ignores added group nodes', () => {
    const nodes = [node('g1', '__group__', { blockType: '__group__' })]
    const ops = diffGraph([], [], nodes, [])
    expect(ops).toHaveLength(0)
  })

  it('ignores removed group nodes', () => {
    const nodes = [node('g1', '__group__', { blockType: '__group__' })]
    const ops = diffGraph(nodes, [], [], [])
    expect(ops).toHaveLength(0)
  })

  it('ignores changed group nodes', () => {
    const prev = [node('g1', '__group__', { blockType: '__group__', color: 'red' })]
    const next = [node('g1', '__group__', { blockType: '__group__', color: 'blue' })]
    expect(diffGraph(prev, [], next, [])).toHaveLength(0)
  })
})

// ── Edge changes ─────────────────────────────────────────────────────────────

describe('diffGraph — edge additions', () => {
  it('emits addEdge for a new edge', () => {
    const nodes = [node('n1', 'number'), node('n2', 'display')]
    const ops = diffGraph(nodes, [], nodes, [edge('e1', 'n1', 'n2', 'out', 'value')])
    expect(ops).toHaveLength(1)
    expect(ops[0].op).toBe('addEdge')
    if (ops[0].op === 'addEdge') {
      expect(ops[0].edge.id).toBe('e1')
      expect(ops[0].edge.source).toBe('n1')
      expect(ops[0].edge.target).toBe('n2')
      expect(ops[0].edge.sourceHandle).toBe('out')
      expect(ops[0].edge.targetHandle).toBe('value')
    }
  })
})

describe('diffGraph — edge removals', () => {
  it('emits removeEdge when an edge is removed', () => {
    const nodes = [node('n1', 'number'), node('n2', 'display')]
    const edges = [edge('e1', 'n1', 'n2')]
    const ops = diffGraph(nodes, edges, nodes, [])
    expect(ops).toHaveLength(1)
    expect(ops[0].op).toBe('removeEdge')
    if (ops[0].op === 'removeEdge') {
      expect(ops[0].edgeId).toBe('e1')
    }
  })
})

// ── Mixed changes ─────────────────────────────────────────────────────────────

describe('diffGraph — mixed changes', () => {
  it('handles add node + add edge together', () => {
    const prevNodes = [node('n1', 'number', { value: 5 })]
    const nextNodes = [node('n1', 'number', { value: 5 }), node('n2', 'display')]
    const nextEdges = [edge('e1', 'n1', 'n2', 'out', 'value')]
    const ops = diffGraph(prevNodes, [], nextNodes, nextEdges)
    const opTypes = ops.map((o) => o.op)
    expect(opTypes).toContain('addNode')
    expect(opTypes).toContain('addEdge')
  })

  it('handles remove node + remove edge together', () => {
    const nodes = [node('n1', 'number'), node('n2', 'display')]
    const edges = [edge('e1', 'n1', 'n2')]
    // Remove n2 and its edge
    const ops = diffGraph(nodes, edges, [node('n1', 'number')], [])
    const opTypes = ops.map((o) => o.op)
    expect(opTypes).toContain('removeNode')
    expect(opTypes).toContain('removeEdge')
  })
})
