/**
 * templates.test.ts — Validation suite for sample templates.
 *
 * Checks every template in the TEMPLATES registry against invariants:
 *   - schemaVersion === 4
 *   - canvasId / projectId round-trip correctly
 *   - No duplicate node IDs
 *   - No duplicate edge IDs
 *   - All node positions are finite numbers
 *   - All number-block values are finite
 *   - At least one node and one edge
 *   - All edge endpoints reference valid node IDs
 */

import { describe, it, expect } from 'vitest'
import { TEMPLATES } from './index'

type AnyNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}
type AnyEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

describe('Sample templates', () => {
  for (const tmpl of TEMPLATES) {
    describe(tmpl.id, () => {
      const graph = tmpl.buildGraph('test-canvas', 'test-project')
      const nodes = graph.nodes as AnyNode[]
      const edges = graph.edges as AnyEdge[]

      it('has schemaVersion 4', () => {
        expect(graph.schemaVersion).toBe(4)
      })

      it('passes back the supplied canvasId and projectId', () => {
        expect(graph.canvasId).toBe('test-canvas')
        expect(graph.projectId).toBe('test-project')
      })

      it('has at least one node and one edge', () => {
        expect(nodes.length).toBeGreaterThan(0)
        expect(edges.length).toBeGreaterThan(0)
      })

      it('has no duplicate node IDs', () => {
        const ids = nodes.map((n) => n.id)
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('has no duplicate edge IDs', () => {
        const ids = edges.map((e) => e.id)
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('all node positions are finite numbers', () => {
        for (const node of nodes) {
          expect(Number.isFinite(node.position.x)).toBe(true)
          expect(Number.isFinite(node.position.y)).toBe(true)
        }
      })

      it('all number-block values are finite', () => {
        for (const node of nodes) {
          if (node.type === 'number') {
            expect(Number.isFinite(node.data.value as number)).toBe(true)
          }
        }
      })

      it('all edges reference valid node IDs', () => {
        const nodeIds = new Set(nodes.map((n) => n.id))
        for (const edge of edges) {
          expect(
            nodeIds.has(edge.source),
            `edge ${edge.id} source "${edge.source}" not found`,
          ).toBe(true)
          expect(
            nodeIds.has(edge.target),
            `edge ${edge.id} target "${edge.target}" not found`,
          ).toBe(true)
        }
      })

      it('all nodes have a non-empty blockType in data', () => {
        for (const node of nodes) {
          expect(typeof node.data.blockType).toBe('string')
          expect((node.data.blockType as string).length).toBeGreaterThan(0)
        }
      })

      it('has metadata: non-empty name, description, and tags', () => {
        expect(tmpl.name.length).toBeGreaterThan(0)
        expect(tmpl.description.length).toBeGreaterThan(0)
        expect(tmpl.tags.length).toBeGreaterThan(0)
      })
    })
  }
})
