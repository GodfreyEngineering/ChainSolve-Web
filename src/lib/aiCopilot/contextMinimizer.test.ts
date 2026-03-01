import { describe, it, expect } from 'vitest'
import { buildContextPack, estimateContextTokens } from './contextMinimizer'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../../blocks/types'

function makeNode(id: string, blockType = 'number', label = blockType): Node<NodeData> {
  return {
    id,
    type: 'csSource',
    position: { x: 0, y: 0 },
    data: { blockType, label, value: 0 } as NodeData,
  }
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, sourceHandle: 'out', target, targetHandle: 'a' }
}

describe('buildContextPack', () => {
  it('includes all nodes when no selection', () => {
    const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3')]
    const edges = [makeEdge('e1', 'n1', 'n2')]
    const pack = buildContextPack(nodes, edges)
    expect(pack.nodes).toHaveLength(3)
    expect(pack.edges).toHaveLength(1)
  })

  it('limits to selected nodes + 1-hop neighbors', () => {
    const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3'), makeNode('n4')]
    const edges = [
      makeEdge('e1', 'n1', 'n2'),
      makeEdge('e2', 'n2', 'n3'),
      makeEdge('e3', 'n3', 'n4'),
    ]
    const pack = buildContextPack(nodes, edges, { selectedNodeIds: ['n2'], depth: 1 })
    // n2 + neighbors n1 and n3
    expect(pack.nodes).toHaveLength(3)
    expect(pack.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n2', 'n3'])
  })

  it('respects maxNodes cap', () => {
    const nodes = Array.from({ length: 100 }, (_, i) => makeNode(`n${i}`))
    const edges: Edge[] = []
    const pack = buildContextPack(nodes, edges, { maxNodes: 10 })
    expect(pack.nodes.length).toBeLessThanOrEqual(10)
  })

  it('filters edges to only included nodes', () => {
    const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3')]
    const edges = [makeEdge('e1', 'n1', 'n2'), makeEdge('e2', 'n2', 'n3')]
    const pack = buildContextPack(nodes, edges, { selectedNodeIds: ['n1'], depth: 0 })
    // Only n1 selected, depth=0 means no expansion
    expect(pack.nodes).toHaveLength(1)
    expect(pack.edges).toHaveLength(0) // No edges connect only n1
  })

  it('includes diagnostics when provided', () => {
    const nodes = [makeNode('n1')]
    const diags = [{ level: 'warn' as const, code: 'orphan', message: 'Node is orphaned' }]
    const pack = buildContextPack(nodes, [], { diagnostics: diags })
    expect(pack.diagnostics).toHaveLength(1)
    expect(pack.diagnostics![0].code).toBe('orphan')
  })

  it('strips labels when privacy option enabled', () => {
    const nodes = [makeNode('n1', 'add', 'My Secret Sum')]
    const pack = buildContextPack(nodes, [], { stripLabels: true })
    expect(pack.nodes[0].label).toBe('add') // blockType, not label
  })

  it('preserves input bindings when present', () => {
    const node = makeNode('n1', 'add')
    ;(node.data as NodeData).inputBindings = { a: { kind: 'literal', value: 7 } }
    const pack = buildContextPack([node], [])
    expect(pack.nodes[0].inputBindings).toBeDefined()
  })

  it('depth=0 returns only selected nodes', () => {
    const nodes = [makeNode('n1'), makeNode('n2')]
    const edges = [makeEdge('e1', 'n1', 'n2')]
    const pack = buildContextPack(nodes, edges, { selectedNodeIds: ['n1'], depth: 0 })
    expect(pack.nodes).toHaveLength(1)
    expect(pack.nodes[0].id).toBe('n1')
  })
})

describe('estimateContextTokens', () => {
  it('returns a positive number', () => {
    const pack = buildContextPack([makeNode('n1')], [])
    const tokens = estimateContextTokens(pack)
    expect(tokens).toBeGreaterThan(0)
  })

  it('scales with context size', () => {
    const small = buildContextPack([makeNode('n1')], [])
    const large = buildContextPack(
      Array.from({ length: 20 }, (_, i) => makeNode(`n${i}`)),
      [],
    )
    expect(estimateContextTokens(large)).toBeGreaterThan(estimateContextTokens(small))
  })
})
