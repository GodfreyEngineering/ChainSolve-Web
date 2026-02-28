/**
 * bridge.test.ts — Integration tests for the React Flow → EngineSnapshotV1 bridge.
 *
 * Tests `toEngineSnapshot()`, which is the sole translation layer between
 * the UI graph model and the WASM engine input.  No WASM is loaded.
 *
 * P092: Integration tests: WASM worker snapshot → result
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { toEngineSnapshot } from './bridge'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeNode(id: string, blockType: string, data: Record<string, unknown> = {}): Node {
  return {
    id,
    type: blockType,
    position: { x: 0, y: 0 },
    data: { blockType, ...data },
  }
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle = 'out',
  targetHandle = 'in',
): Edge {
  return { id, source, target, sourceHandle, targetHandle }
}

// ── toEngineSnapshot ─────────────────────────────────────────────────────────

describe('toEngineSnapshot — basic', () => {
  it('returns version 1 snapshot', () => {
    const snap = toEngineSnapshot([], [])
    expect(snap.version).toBe(1)
  })

  it('produces empty nodes and edges for empty graph', () => {
    const snap = toEngineSnapshot([], [])
    expect(snap.nodes).toHaveLength(0)
    expect(snap.edges).toHaveLength(0)
  })

  it('maps a number node to an engine node', () => {
    const nodes = [makeNode('n1', 'number', { value: 42 })]
    const snap = toEngineSnapshot(nodes, [])
    expect(snap.nodes).toHaveLength(1)
    expect(snap.nodes[0].id).toBe('n1')
    expect(snap.nodes[0].blockType).toBe('number')
    expect((snap.nodes[0].data as { value: number }).value).toBe(42)
  })

  it('maps an eng.mechanics.force_ma node correctly', () => {
    const nodes = [makeNode('fma', 'eng.mechanics.force_ma')]
    const snap = toEngineSnapshot(nodes, [])
    expect(snap.nodes[0].blockType).toBe('eng.mechanics.force_ma')
  })

  it('maps a stats.desc.mean node with manualValues', () => {
    const nodes = [makeNode('mean', 'stats.desc.mean', { manualValues: { c: 6 } })]
    const snap = toEngineSnapshot(nodes, [])
    expect(snap.nodes[0].blockType).toBe('stats.desc.mean')
    expect((snap.nodes[0].data as { manualValues: { c: number } }).manualValues.c).toBe(6)
  })
})

describe('toEngineSnapshot — probe → display mapping', () => {
  it('maps probe blockType to display', () => {
    const nodes = [makeNode('p1', 'probe', { blockType: 'probe' })]
    // blockType in data is 'probe'; toEngineSnapshot should remap it
    const snap = toEngineSnapshot(nodes, [])
    expect(snap.nodes[0].blockType).toBe('display')
  })
})

describe('toEngineSnapshot — group node exclusion', () => {
  it('excludes group nodes from the snapshot', () => {
    const nodes = [
      makeNode('n1', '__group__', { blockType: '__group__' }),
      makeNode('n2', 'number', { value: 10 }),
    ]
    const snap = toEngineSnapshot(nodes, [])
    expect(snap.nodes).toHaveLength(1)
    expect(snap.nodes[0].id).toBe('n2')
  })
})

describe('toEngineSnapshot — edges', () => {
  it('includes edges between valid eval nodes', () => {
    const nodes = [makeNode('n1', 'number'), makeNode('n2', 'display')]
    const edges = [makeEdge('e1', 'n1', 'n2', 'out', 'value')]
    const snap = toEngineSnapshot(nodes, edges)
    expect(snap.edges).toHaveLength(1)
    expect(snap.edges[0].id).toBe('e1')
    expect(snap.edges[0].source).toBe('n1')
    expect(snap.edges[0].target).toBe('n2')
    expect(snap.edges[0].sourceHandle).toBe('out')
    expect(snap.edges[0].targetHandle).toBe('value')
  })

  it('uses fallback "out" sourceHandle when sourceHandle is null', () => {
    const nodes = [makeNode('n1', 'number'), makeNode('n2', 'display')]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: null, targetHandle: 'value' },
    ]
    const snap = toEngineSnapshot(nodes, edges)
    expect(snap.edges[0].sourceHandle).toBe('out')
  })

  it('uses fallback "in" targetHandle when targetHandle is null', () => {
    const nodes = [makeNode('n1', 'number'), makeNode('n2', 'display')]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'out', targetHandle: null },
    ]
    const snap = toEngineSnapshot(nodes, edges)
    expect(snap.edges[0].targetHandle).toBe('in')
  })

  it('excludes edges where source is not in eval node set', () => {
    const nodes = [makeNode('n2', 'display')]
    const edges = [makeEdge('e1', 'missing', 'n2')]
    const snap = toEngineSnapshot(nodes, edges)
    expect(snap.edges).toHaveLength(0)
  })

  it('excludes edges where target is not in eval node set', () => {
    const nodes = [makeNode('n1', 'number')]
    const edges = [makeEdge('e1', 'n1', 'missing')]
    const snap = toEngineSnapshot(nodes, edges)
    expect(snap.edges).toHaveLength(0)
  })

  it('excludes edges connected to group nodes', () => {
    const nodes = [
      makeNode('n1', 'number'),
      makeNode('grp', '__group__', { blockType: '__group__' }),
    ]
    const edges = [makeEdge('e1', 'n1', 'grp')]
    const snap = toEngineSnapshot(nodes, edges)
    expect(snap.edges).toHaveLength(0)
  })
})

describe('toEngineSnapshot — multi-node graph', () => {
  it('produces a correct snapshot for physics-101-style graph', () => {
    const nodes = [
      makeNode('m', 'number', { value: 10 }),
      makeNode('a', 'number', { value: 2 }),
      makeNode('fma', 'eng.mechanics.force_ma'),
      makeNode('disp', 'display'),
    ]
    const edges = [
      makeEdge('e1', 'm', 'fma', 'out', 'm'),
      makeEdge('e2', 'a', 'fma', 'out', 'a'),
      makeEdge('e3', 'fma', 'disp', 'out', 'value'),
    ]
    const snap = toEngineSnapshot(nodes, edges)
    expect(snap.nodes).toHaveLength(4)
    expect(snap.edges).toHaveLength(3)
    const fmaNode = snap.nodes.find((n) => n.id === 'fma')
    expect(fmaNode?.blockType).toBe('eng.mechanics.force_ma')
  })
})
