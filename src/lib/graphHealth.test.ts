/**
 * graphHealth unit tests.
 *
 * Run with: npm run test:unit
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import {
  getCrossingEdges,
  getCrossingEdgesForGroup,
  computeGraphHealth,
  formatHealthReport,
} from './graphHealth'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mkNode(id: string, parentId?: string, blockType = 'number'): Node {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { blockType, label: id },
    ...(parentId ? { parentId } : {}),
  }
}

function mkGroup(id: string, collapsed = false): Node {
  return {
    id,
    type: 'csGroup',
    position: { x: 0, y: 0 },
    data: { blockType: '__group__', label: id, groupCollapsed: collapsed },
  }
}

function mkEdge(id: string, source: string, target: string): Edge {
  return { id, source, target }
}

// ── getCrossingEdges ─────────────────────────────────────────────────────────

describe('getCrossingEdges', () => {
  it('returns empty when no groups exist', () => {
    const nodes = [mkNode('a'), mkNode('b')]
    const edges = [mkEdge('e1', 'a', 'b')]
    expect(getCrossingEdges(nodes, edges)).toEqual([])
  })

  it('returns empty when all nodes are in the same group', () => {
    const nodes = [mkGroup('g1'), mkNode('a', 'g1'), mkNode('b', 'g1')]
    const edges = [mkEdge('e1', 'a', 'b')]
    expect(getCrossingEdges(nodes, edges)).toEqual([])
  })

  it('detects edges crossing between groups', () => {
    const nodes = [
      mkGroup('g1'),
      mkGroup('g2'),
      mkNode('a', 'g1'),
      mkNode('b', 'g2'),
    ]
    const edges = [mkEdge('e1', 'a', 'b')]
    const result = getCrossingEdges(nodes, edges)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('e1')
  })

  it('detects edges between grouped and ungrouped nodes', () => {
    const nodes = [mkGroup('g1'), mkNode('a', 'g1'), mkNode('b')]
    const edges = [mkEdge('e1', 'a', 'b')]
    expect(getCrossingEdges(nodes, edges)).toHaveLength(1)
  })

  it('handles multiple crossing edges', () => {
    const nodes = [
      mkGroup('g1'),
      mkGroup('g2'),
      mkNode('a', 'g1'),
      mkNode('b', 'g2'),
      mkNode('c', 'g1'),
    ]
    const edges = [mkEdge('e1', 'a', 'b'), mkEdge('e2', 'b', 'c')]
    expect(getCrossingEdges(nodes, edges)).toHaveLength(2)
  })
})

// ── getCrossingEdgesForGroup ─────────────────────────────────────────────────

describe('getCrossingEdgesForGroup', () => {
  it('returns edges crossing a specific group boundary', () => {
    const nodes = [
      mkGroup('g1'),
      mkNode('a', 'g1'),
      mkNode('b', 'g1'),
      mkNode('c'),
    ]
    const edges = [mkEdge('e1', 'a', 'b'), mkEdge('e2', 'a', 'c')]
    const result = getCrossingEdgesForGroup('g1', nodes, edges)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('e2')
  })

  it('returns empty when no edges cross the group boundary', () => {
    const nodes = [mkGroup('g1'), mkNode('a', 'g1'), mkNode('b', 'g1')]
    const edges = [mkEdge('e1', 'a', 'b')]
    expect(getCrossingEdgesForGroup('g1', nodes, edges)).toEqual([])
  })
})

// ── computeGraphHealth ───────────────────────────────────────────────────────

describe('computeGraphHealth', () => {
  it('computes correct counts for a simple graph', () => {
    const nodes = [mkNode('a'), mkNode('b')]
    const edges = [mkEdge('e1', 'a', 'b')]
    const report = computeGraphHealth(nodes, edges)
    expect(report.nodeCount).toBe(2)
    expect(report.edgeCount).toBe(1)
    expect(report.groupCount).toBe(0)
    expect(report.collapsedGroupCount).toBe(0)
    expect(report.orphanCount).toBe(0)
    expect(report.cycleDetected).toBe(false)
    expect(report.warnings).toEqual([])
  })

  it('detects orphan nodes', () => {
    const nodes = [mkNode('a'), mkNode('b'), mkNode('orphan')]
    const edges = [mkEdge('e1', 'a', 'b')]
    const report = computeGraphHealth(nodes, edges)
    expect(report.orphanCount).toBe(1)
    expect(report.warnings).toHaveLength(1)
    expect(report.warnings[0].key).toBe('graphHealth.orphans')
  })

  it('counts groups and collapsed groups', () => {
    const nodes = [
      mkGroup('g1'),
      mkGroup('g2', true),
      mkNode('a', 'g1'),
      mkNode('b', 'g2'),
    ]
    const edges = [mkEdge('e1', 'a', 'b')]
    const report = computeGraphHealth(nodes, edges)
    expect(report.groupCount).toBe(2)
    expect(report.collapsedGroupCount).toBe(1)
    // Groups are excluded from nodeCount
    expect(report.nodeCount).toBe(2)
  })

  it('detects crossing edges', () => {
    const nodes = [
      mkGroup('g1'),
      mkGroup('g2'),
      mkNode('a', 'g1'),
      mkNode('b', 'g2'),
    ]
    const edges = [mkEdge('e1', 'a', 'b')]
    const report = computeGraphHealth(nodes, edges)
    expect(report.crossingEdgeCount).toBe(1)
    expect(report.warnings.some((w) => w.key === 'graphHealth.crossingEdges')).toBe(true)
  })

  it('detects cycles', () => {
    const nodes = [mkNode('a'), mkNode('b'), mkNode('c')]
    const edges = [
      mkEdge('e1', 'a', 'b'),
      mkEdge('e2', 'b', 'c'),
      mkEdge('e3', 'c', 'a'),
    ]
    const report = computeGraphHealth(nodes, edges)
    expect(report.cycleDetected).toBe(true)
    expect(report.warnings.some((w) => w.key === 'graphHealth.cycleDetected')).toBe(true)
  })

  it('does not detect cycles in a DAG', () => {
    const nodes = [mkNode('a'), mkNode('b'), mkNode('c')]
    const edges = [mkEdge('e1', 'a', 'b'), mkEdge('e2', 'a', 'c')]
    const report = computeGraphHealth(nodes, edges)
    expect(report.cycleDetected).toBe(false)
  })

  it('handles empty graph', () => {
    const report = computeGraphHealth([], [])
    expect(report.nodeCount).toBe(0)
    expect(report.edgeCount).toBe(0)
    expect(report.warnings).toEqual([])
  })
})

// ── formatHealthReport ───────────────────────────────────────────────────────

describe('formatHealthReport', () => {
  const mockT = (key: string, opts?: Record<string, unknown>) => {
    if (opts?.count !== undefined) return `${key}(${opts.count})`
    return key
  }

  it('produces a non-empty string', () => {
    const report = computeGraphHealth([mkNode('a')], [])
    const result = formatHealthReport(report, mockT)
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes stats in the output', () => {
    const report = computeGraphHealth(
      [mkNode('a'), mkNode('b')],
      [mkEdge('e1', 'a', 'b')],
    )
    const result = formatHealthReport(report, mockT)
    expect(result).toContain('graphHealth.nodes')
    expect(result).toContain('2')
    expect(result).toContain('graphHealth.edges')
    expect(result).toContain('1')
  })

  it('includes warnings for orphans', () => {
    const report = computeGraphHealth(
      [mkNode('a'), mkNode('b'), mkNode('c')],
      [mkEdge('e1', 'a', 'b')],
    )
    const result = formatHealthReport(report, mockT)
    expect(result).toContain('graphHealth.orphans')
  })
})
