/**
 * canvasSaveLoad.test.ts — Integration tests for the canvas save/load round-trip.
 *
 * Exercises the complete pipeline:
 *   buildCanvasJsonFromGraph()  → JSON.stringify()
 *   → JSON.parse() → parseCanvasJson()
 *
 * Verifies that:
 *   - Node IDs survive the cycle
 *   - Edge IDs survive the cycle
 *   - Node positions are preserved
 *   - Node data is preserved (finite values)
 *   - Non-finite values (NaN, Infinity) are sanitized to null before persist
 *   - Legacy V3 format migrates cleanly on load
 *
 * No WASM or Supabase is involved.  This is a pure TS integration test.
 *
 * P093: Integration tests: save/load round-trip
 */

import { describe, it, expect } from 'vitest'
import { buildCanvasJsonFromGraph, parseCanvasJson } from './canvasSchema'
import { buildPhysics101 } from '../templates/physics-101'
import { buildStats101 } from '../templates/stats-101'

// ── Helpers ──────────────────────────────────────────────────────────────────

type RawNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}
type RawEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

/** Simulate the storage cycle: build → stringify → parse → load. */
function roundTrip(
  nodes: unknown[],
  edges: unknown[],
  canvasId = 'canvas-1',
  projectId = 'proj-1',
) {
  const saved = buildCanvasJsonFromGraph(canvasId, projectId, nodes, edges)
  const serialized = JSON.stringify(saved)
  const raw = JSON.parse(serialized) as unknown
  return parseCanvasJson(raw, canvasId, projectId)
}

// ── Basic round-trip ─────────────────────────────────────────────────────────

describe('canvasSaveLoad — empty graph', () => {
  it('round-trips an empty canvas without error', () => {
    const result = roundTrip([], [])
    expect(result.schemaVersion).toBe(4)
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })
})

describe('canvasSaveLoad — node preservation', () => {
  const testNode: RawNode = {
    id: 'n1',
    type: 'number',
    position: { x: 100, y: 200 },
    data: { blockType: 'number', label: 'Mass m', value: 42 },
  }

  it('preserves node id through round-trip', () => {
    const result = roundTrip([testNode], [])
    const nodes = result.nodes as RawNode[]
    expect(nodes[0].id).toBe('n1')
  })

  it('preserves node type through round-trip', () => {
    const result = roundTrip([testNode], [])
    const nodes = result.nodes as RawNode[]
    expect(nodes[0].type).toBe('number')
  })

  it('preserves node position through round-trip', () => {
    const result = roundTrip([testNode], [])
    const nodes = result.nodes as RawNode[]
    expect(nodes[0].position.x).toBe(100)
    expect(nodes[0].position.y).toBe(200)
  })

  it('preserves finite value in node data', () => {
    const result = roundTrip([testNode], [])
    const nodes = result.nodes as RawNode[]
    expect(nodes[0].data.value).toBe(42)
  })

  it('preserves blockType in node data', () => {
    const result = roundTrip([testNode], [])
    const nodes = result.nodes as RawNode[]
    expect(nodes[0].data.blockType).toBe('number')
  })
})

describe('canvasSaveLoad — edge preservation', () => {
  const nodeA: RawNode = {
    id: 'n1',
    type: 'number',
    position: { x: 0, y: 0 },
    data: { blockType: 'number', value: 5 },
  }
  const nodeB: RawNode = {
    id: 'n2',
    type: 'display',
    position: { x: 200, y: 0 },
    data: { blockType: 'display', label: 'Out' },
  }
  const testEdge: RawEdge = {
    id: 'e1',
    source: 'n1',
    target: 'n2',
    sourceHandle: 'out',
    targetHandle: 'value',
  }

  it('preserves edge id through round-trip', () => {
    const result = roundTrip([nodeA, nodeB], [testEdge])
    const edges = result.edges as RawEdge[]
    expect(edges[0].id).toBe('e1')
  })

  it('preserves edge source and target', () => {
    const result = roundTrip([nodeA, nodeB], [testEdge])
    const edges = result.edges as RawEdge[]
    expect(edges[0].source).toBe('n1')
    expect(edges[0].target).toBe('n2')
  })

  it('preserves edge handle names', () => {
    const result = roundTrip([nodeA, nodeB], [testEdge])
    const edges = result.edges as RawEdge[]
    expect(edges[0].sourceHandle).toBe('out')
    expect(edges[0].targetHandle).toBe('value')
  })
})

// ── Non-finite sanitization ──────────────────────────────────────────────────

describe('canvasSaveLoad — non-finite sanitization', () => {
  it('sanitizes NaN in node data to null before persist', () => {
    const nodesWithNaN = [
      {
        id: 'n1',
        type: 'number',
        position: { x: 0, y: 0 },
        data: { blockType: 'number', value: NaN },
      },
    ]
    const result = roundTrip(nodesWithNaN, [])
    const nodes = result.nodes as RawNode[]
    // JSON.parse(JSON.stringify(null)) === null
    expect(nodes[0].data.value).toBeNull()
  })

  it('sanitizes Infinity in node data to null before persist', () => {
    const nodes = [
      {
        id: 'n1',
        type: 'number',
        position: { x: 0, y: 0 },
        data: { blockType: 'number', value: Infinity },
      },
    ]
    const result = roundTrip(nodes, [])
    const loadedNodes = result.nodes as RawNode[]
    expect(loadedNodes[0].data.value).toBeNull()
  })

  it('sanitizes -Infinity in nested data to null', () => {
    const nodes = [
      {
        id: 'n1',
        type: 'stats.desc.mean',
        position: { x: 0, y: 0 },
        data: { blockType: 'stats.desc.mean', manualValues: { c: -Infinity } },
      },
    ]
    const result = roundTrip(nodes, [])
    const loaded = result.nodes as RawNode[]
    const mv = loaded[0].data.manualValues as Record<string, unknown>
    expect(mv.c).toBeNull()
  })

  it('preserves finite manualValues through round-trip', () => {
    const nodes = [
      {
        id: 'n1',
        type: 'stats.desc.mean',
        position: { x: 0, y: 0 },
        data: { blockType: 'stats.desc.mean', manualValues: { c: 6 } },
      },
    ]
    const result = roundTrip(nodes, [])
    const loaded = result.nodes as RawNode[]
    const mv = loaded[0].data.manualValues as Record<string, unknown>
    expect(mv.c).toBe(6)
  })
})

// ── Template round-trips ─────────────────────────────────────────────────────

describe('canvasSaveLoad — physics-101 template', () => {
  const graph = buildPhysics101('c-phys', 'p-test')
  const result = roundTrip(graph.nodes, graph.edges, 'c-phys', 'p-test')

  it('preserves all node count', () => {
    expect((result.nodes as unknown[]).length).toBe(graph.nodes.length)
  })

  it('preserves all edge count', () => {
    expect((result.edges as unknown[]).length).toBe(graph.edges.length)
  })

  it('preserves all node IDs', () => {
    const origIds = (graph.nodes as RawNode[]).map((n) => n.id).sort()
    const loadedIds = (result.nodes as RawNode[]).map((n) => n.id).sort()
    expect(loadedIds).toEqual(origIds)
  })

  it('preserves all edge IDs', () => {
    const origIds = (graph.edges as RawEdge[]).map((e) => e.id).sort()
    const loadedIds = (result.edges as RawEdge[]).map((e) => e.id).sort()
    expect(loadedIds).toEqual(origIds)
  })
})

describe('canvasSaveLoad — stats-101 template', () => {
  const graph = buildStats101('c-stats', 'p-test')
  const result = roundTrip(graph.nodes, graph.edges, 'c-stats', 'p-test')

  it('preserves all nodes', () => {
    expect((result.nodes as unknown[]).length).toBe(graph.nodes.length)
  })

  it('preserves all edges', () => {
    expect((result.edges as unknown[]).length).toBe(graph.edges.length)
  })

  it('all loaded number-node values are finite or null', () => {
    for (const node of result.nodes as RawNode[]) {
      if (node.type === 'number') {
        const v = node.data.value
        expect(v === null || Number.isFinite(v as number)).toBe(true)
      }
    }
  })
})

// ── canvasId / projectId binding ─────────────────────────────────────────────

describe('canvasSaveLoad — metadata', () => {
  it('restores the correct canvasId and projectId after round-trip', () => {
    const result = roundTrip([], [], 'my-canvas', 'my-project')
    expect(result.canvasId).toBe('my-canvas')
    expect(result.projectId).toBe('my-project')
  })

  it('schemaVersion is always 4 after round-trip', () => {
    const result = roundTrip([], [])
    expect(result.schemaVersion).toBe(4)
  })
})

// ── Legacy V3 migration on load ──────────────────────────────────────────────

describe('canvasSaveLoad — legacy format migration', () => {
  it('loads a legacy V3 project.json correctly', () => {
    const legacyJson = JSON.stringify({
      schemaVersion: 3,
      graph: {
        nodes: [{ id: 'n1', type: 'number', position: { x: 0, y: 0 }, data: { value: 7 } }],
        edges: [],
      },
    })
    const raw = JSON.parse(legacyJson) as unknown
    const result = parseCanvasJson(raw, 'c1', 'p1')
    expect(result.schemaVersion).toBe(4)
    expect((result.nodes as RawNode[])[0].id).toBe('n1')
  })
})
