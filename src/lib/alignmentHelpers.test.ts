/**
 * alignmentHelpers.test.ts — E7-2: Unit tests for alignment/distribution helpers.
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { computeAlignment } from './alignmentHelpers'

// Helper to build a minimal Node with position and measured size.
function mkNode(id: string, x: number, y: number, w = 100, h = 50): Node {
  return {
    id,
    type: 'csSource',
    position: { x, y },
    measured: { width: w, height: h },
    data: {},
  }
}

describe('computeAlignment', () => {
  it('returns empty map for fewer than 2 nodes', () => {
    const result = computeAlignment([mkNode('a', 10, 20)], 'align-left')
    expect(result.size).toBe(0)
  })

  // ── Align ops ─────────────────────────────────────────────────────────────

  it('align-left: all nodes snap to leftmost x', () => {
    const nodes = [mkNode('a', 50, 10), mkNode('b', 200, 30), mkNode('c', 100, 50)]
    const result = computeAlignment(nodes, 'align-left')
    expect(result.get('a')!.x).toBe(50)
    expect(result.get('b')!.x).toBe(50)
    expect(result.get('c')!.x).toBe(50)
    // Y values unchanged
    expect(result.get('a')!.y).toBe(10)
    expect(result.get('b')!.y).toBe(30)
    expect(result.get('c')!.y).toBe(50)
  })

  it('align-right: all nodes snap right edges to rightmost', () => {
    // a: x=50 w=100 → right=150
    // b: x=200 w=100 → right=300
    // c: x=100 w=80  → right=180
    const nodes = [mkNode('a', 50, 10, 100), mkNode('b', 200, 30, 100), mkNode('c', 100, 50, 80)]
    const result = computeAlignment(nodes, 'align-right')
    expect(result.get('a')!.x).toBe(200) // 300 - 100
    expect(result.get('b')!.x).toBe(200) // 300 - 100
    expect(result.get('c')!.x).toBe(220) // 300 - 80
  })

  it('align-top: all nodes snap to topmost y', () => {
    const nodes = [mkNode('a', 10, 50), mkNode('b', 20, 10), mkNode('c', 30, 80)]
    const result = computeAlignment(nodes, 'align-top')
    expect(result.get('a')!.y).toBe(10)
    expect(result.get('b')!.y).toBe(10)
    expect(result.get('c')!.y).toBe(10)
    // X values unchanged
    expect(result.get('a')!.x).toBe(10)
    expect(result.get('b')!.x).toBe(20)
    expect(result.get('c')!.x).toBe(30)
  })

  it('align-bottom: all nodes snap bottom edges to lowest', () => {
    // a: y=50 h=50 → bottom=100
    // b: y=10 h=60 → bottom=70
    // c: y=80 h=50 → bottom=130
    const nodes = [mkNode('a', 10, 50, 100, 50), mkNode('b', 20, 10, 100, 60), mkNode('c', 30, 80)]
    const result = computeAlignment(nodes, 'align-bottom')
    expect(result.get('a')!.y).toBe(80) // 130 - 50
    expect(result.get('b')!.y).toBe(70) // 130 - 60
    expect(result.get('c')!.y).toBe(80) // 130 - 50
  })

  // ── Distribute ops ─────────────────────────────────────────────────────────

  it('distribute-h returns empty for fewer than 3 nodes', () => {
    const nodes = [mkNode('a', 50, 10), mkNode('b', 200, 30)]
    const result = computeAlignment(nodes, 'distribute-h')
    expect(result.size).toBe(0)
  })

  it('distribute-h spaces nodes evenly', () => {
    // a: x=0 w=100; b: x=300 w=100; c: x=100 w=100
    // total span = 300+100-0 = 400; total node width = 300; gap = (400-300)/2 = 50
    // sorted: a(0), c(100), b(300) → a=0, c=0+100+50=150, b=150+100+50=300
    const nodes = [mkNode('a', 0, 0, 100), mkNode('b', 300, 0, 100), mkNode('c', 100, 0, 100)]
    const result = computeAlignment(nodes, 'distribute-h')
    expect(result.get('a')!.x).toBe(0)
    expect(result.get('c')!.x).toBe(150)
    expect(result.get('b')!.x).toBe(300)
  })

  it('distribute-v returns empty for fewer than 3 nodes', () => {
    const nodes = [mkNode('a', 0, 50), mkNode('b', 0, 200)]
    const result = computeAlignment(nodes, 'distribute-v')
    expect(result.size).toBe(0)
  })

  it('distribute-v spaces nodes evenly', () => {
    // a: y=0 h=50; b: y=250 h=50; c: y=100 h=50
    // total span = 250+50-0 = 300; total h = 150; gap = (300-150)/2 = 75
    // sorted: a(0), c(100), b(250) → a=0, c=0+50+75=125, b=125+50+75=250
    const nodes = [mkNode('a', 0, 0), mkNode('b', 0, 250), mkNode('c', 0, 100)]
    const result = computeAlignment(nodes, 'distribute-v')
    expect(result.get('a')!.y).toBe(0)
    expect(result.get('c')!.y).toBe(125)
    expect(result.get('b')!.y).toBe(250)
  })
})
