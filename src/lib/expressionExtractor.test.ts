/**
 * expressionExtractor.test.ts — E6-1: Unit tests for expression tree extraction.
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { mkScalar } from '../engine/value'
import type { Value } from '../engine/value'
import {
  buildExpressionTree,
  renderExpressionText,
  renderExpressionSubstituted,
} from './expressionExtractor'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeNode(id: string, blockType: string, label: string, value?: number): Node {
  return {
    id,
    type: 'csSource',
    position: { x: 0, y: 0 },
    data: { blockType, label, value },
  }
}

function makeEdge(id: string, source: string, target: string, targetHandle = 'a'): Edge {
  return { id, source, target, sourceHandle: 'out', targetHandle }
}

// ── buildExpressionTree ─────────────────────────────────────────────────────

describe('buildExpressionTree', () => {
  it('returns null for non-existent node', () => {
    const result = buildExpressionTree('missing', [], [], new Map())
    expect(result).toBeNull()
  })

  it('builds a leaf node for a number source', () => {
    const nodes = [makeNode('n1', 'number', 'Mass', 10)]
    const computed = new Map<string, Value>([['n1', mkScalar(10)]])
    const tree = buildExpressionTree('n1', nodes, [], computed)
    expect(tree).not.toBeNull()
    expect(tree!.opType).toBe('number')
    expect(tree!.label).toBe('Mass')
    expect(tree!.sourceValue).toBe(10)
    expect(tree!.portOrder).toHaveLength(0)
  })

  it('builds a simple add chain: a + b', () => {
    const nodes = [
      makeNode('n1', 'number', 'A', 3),
      makeNode('n2', 'number', 'B', 4),
      makeNode('add', 'add', 'Add'),
    ]
    const edges = [makeEdge('e1', 'n1', 'add', 'a'), makeEdge('e2', 'n2', 'add', 'b')]
    const computed = new Map<string, Value>([
      ['n1', mkScalar(3)],
      ['n2', mkScalar(4)],
      ['add', mkScalar(7)],
    ])

    const tree = buildExpressionTree('add', nodes, edges, computed)
    expect(tree).not.toBeNull()
    expect(tree!.opType).toBe('add')
    expect(tree!.portOrder).toEqual(['a', 'b'])
    expect(tree!.inputs['a']?.label).toBe('A')
    expect(tree!.inputs['b']?.label).toBe('B')
  })

  it('builds a display → add → numbers chain', () => {
    const nodes = [
      makeNode('n1', 'number', 'X', 3),
      makeNode('n2', 'number', 'Y', 4),
      makeNode('add', 'add', 'Add'),
      makeNode('disp', 'display', 'Display'),
    ]
    const edges = [
      makeEdge('e1', 'n1', 'add', 'a'),
      makeEdge('e2', 'n2', 'add', 'b'),
      makeEdge('e3', 'add', 'disp', 'value'),
    ]
    const computed = new Map<string, Value>([
      ['n1', mkScalar(3)],
      ['n2', mkScalar(4)],
      ['add', mkScalar(7)],
      ['disp', mkScalar(7)],
    ])

    const tree = buildExpressionTree('disp', nodes, edges, computed)
    expect(tree).not.toBeNull()
    expect(tree!.opType).toBe('display')
    expect(tree!.inputs['value']?.opType).toBe('add')
    expect(tree!.inputs['value']?.inputs['a']?.label).toBe('X')
  })

  it('handles diamond DAG (shared subgraph)', () => {
    // n1 feeds both add inputs
    const nodes = [makeNode('n1', 'number', 'V', 5), makeNode('add', 'add', 'Add')]
    const edges = [makeEdge('e1', 'n1', 'add', 'a'), makeEdge('e2', 'n1', 'add', 'b')]
    const computed = new Map<string, Value>([
      ['n1', mkScalar(5)],
      ['add', mkScalar(10)],
    ])

    const tree = buildExpressionTree('add', nodes, edges, computed)
    expect(tree).not.toBeNull()
    // Both inputs should reference the same node
    expect(tree!.inputs['a']?.nodeId).toBe('n1')
    expect(tree!.inputs['b']?.nodeId).toBe('n1')
    // Same object reference (memoized)
    expect(tree!.inputs['a']).toBe(tree!.inputs['b'])
  })
})

// ── renderExpressionText ────────────────────────────────────────────────────

describe('renderExpressionText', () => {
  it('renders a number source', () => {
    const nodes = [makeNode('n1', 'number', 'Mass', 10)]
    const computed = new Map<string, Value>([['n1', mkScalar(10)]])
    const tree = buildExpressionTree('n1', nodes, [], computed)!
    expect(renderExpressionText(tree)).toBe('Mass [10]')
  })

  it('renders add(A, B) as infix', () => {
    const nodes = [
      makeNode('n1', 'number', 'A', 3),
      makeNode('n2', 'number', 'B', 4),
      makeNode('add', 'add', 'Add'),
    ]
    const edges = [makeEdge('e1', 'n1', 'add', 'a'), makeEdge('e2', 'n2', 'add', 'b')]
    const computed = new Map<string, Value>([
      ['n1', mkScalar(3)],
      ['n2', mkScalar(4)],
      ['add', mkScalar(7)],
    ])
    const tree = buildExpressionTree('add', nodes, edges, computed)!
    expect(renderExpressionText(tree)).toBe('(A [3] + B [4])')
  })

  it('renders sin(x) as function call', () => {
    const nodes = [makeNode('n1', 'number', 'Angle', 1.5), makeNode('sin', 'sin', 'Sin')]
    const edges = [makeEdge('e1', 'n1', 'sin', 'a')]
    const computed = new Map<string, Value>([
      ['n1', mkScalar(1.5)],
      ['sin', mkScalar(Math.sin(1.5))],
    ])
    const tree = buildExpressionTree('sin', nodes, edges, computed)!
    expect(renderExpressionText(tree)).toBe('sin(Angle [1.5])')
  })

  it('renders display node transparently', () => {
    const nodes = [makeNode('n1', 'number', 'X', 42), makeNode('disp', 'display', 'Result')]
    const edges = [makeEdge('e1', 'n1', 'disp', 'value')]
    const computed = new Map<string, Value>([
      ['n1', mkScalar(42)],
      ['disp', mkScalar(42)],
    ])
    const tree = buildExpressionTree('disp', nodes, edges, computed)!
    expect(renderExpressionText(tree)).toBe('X [42]')
  })

  it('renders engineering ops as function calls', () => {
    const nodes = [
      makeNode('m', 'number', 'Mass', 10),
      makeNode('a', 'number', 'Acc', 9.81),
      makeNode('fma', 'eng.mechanics.force_ma', 'F=ma'),
    ]
    const edges = [makeEdge('e1', 'm', 'fma', 'm'), makeEdge('e2', 'a', 'fma', 'a')]
    const computed = new Map<string, Value>([
      ['m', mkScalar(10)],
      ['a', mkScalar(9.81)],
      ['fma', mkScalar(98.1)],
    ])
    const tree = buildExpressionTree('fma', nodes, edges, computed)!
    expect(renderExpressionText(tree)).toBe('F=ma(Mass [10], Acc [9.81])')
  })

  it('renders nested expression: (A + B) * C', () => {
    const nodes = [
      makeNode('a', 'number', 'A', 3),
      makeNode('b', 'number', 'B', 4),
      makeNode('c', 'number', 'C', 2),
      makeNode('add', 'add', 'Add'),
      makeNode('mul', 'multiply', 'Multiply'),
    ]
    const edges = [
      makeEdge('e1', 'a', 'add', 'a'),
      makeEdge('e2', 'b', 'add', 'b'),
      makeEdge('e3', 'add', 'mul', 'a'),
      makeEdge('e4', 'c', 'mul', 'b'),
    ]
    const computed = new Map<string, Value>([
      ['a', mkScalar(3)],
      ['b', mkScalar(4)],
      ['c', mkScalar(2)],
      ['add', mkScalar(7)],
      ['mul', mkScalar(14)],
    ])
    const tree = buildExpressionTree('mul', nodes, edges, computed)!
    expect(renderExpressionText(tree)).toBe('((A [3] + B [4]) * C [2])')
  })
})

// ── renderExpressionSubstituted ─────────────────────────────────────────────

describe('renderExpressionSubstituted', () => {
  it('renders values only: (3 + 4)', () => {
    const nodes = [
      makeNode('n1', 'number', 'A', 3),
      makeNode('n2', 'number', 'B', 4),
      makeNode('add', 'add', 'Add'),
    ]
    const edges = [makeEdge('e1', 'n1', 'add', 'a'), makeEdge('e2', 'n2', 'add', 'b')]
    const computed = new Map<string, Value>([
      ['n1', mkScalar(3)],
      ['n2', mkScalar(4)],
      ['add', mkScalar(7)],
    ])
    const tree = buildExpressionTree('add', nodes, edges, computed)!
    expect(renderExpressionSubstituted(tree)).toBe('(3 + 4)')
  })

  it('renders nested: (3 + 4) * 2', () => {
    const nodes = [
      makeNode('a', 'number', 'A', 3),
      makeNode('b', 'number', 'B', 4),
      makeNode('c', 'number', 'C', 2),
      makeNode('add', 'add', 'Add'),
      makeNode('mul', 'multiply', 'Multiply'),
    ]
    const edges = [
      makeEdge('e1', 'a', 'add', 'a'),
      makeEdge('e2', 'b', 'add', 'b'),
      makeEdge('e3', 'add', 'mul', 'a'),
      makeEdge('e4', 'c', 'mul', 'b'),
    ]
    const computed = new Map<string, Value>([
      ['a', mkScalar(3)],
      ['b', mkScalar(4)],
      ['c', mkScalar(2)],
      ['add', mkScalar(7)],
      ['mul', mkScalar(14)],
    ])
    const tree = buildExpressionTree('mul', nodes, edges, computed)!
    expect(renderExpressionSubstituted(tree)).toBe('((3 + 4) * 2)')
  })

  it('renders unary: sin(1.5)', () => {
    const nodes = [makeNode('n1', 'number', 'X', 1.5), makeNode('sin', 'sin', 'Sin')]
    const edges = [makeEdge('e1', 'n1', 'sin', 'a')]
    const computed = new Map<string, Value>([
      ['n1', mkScalar(1.5)],
      ['sin', mkScalar(Math.sin(1.5))],
    ])
    const tree = buildExpressionTree('sin', nodes, edges, computed)!
    expect(renderExpressionSubstituted(tree)).toBe('sin(1.5)')
  })
})
