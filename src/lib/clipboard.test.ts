/**
 * clipboard.test.ts — K1-2: Tests for multi-sheet selection/copy semantics.
 *
 * Verifies that copy/paste preserves internal chains within a selection,
 * remaps IDs properly (no collisions), and works across sheets.
 */

import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../blocks/types'
import { copyToClipboard, pasteFromClipboard } from './clipboard'

// ── Helpers ──────────────────────────────────────────────────────────────────

function mkNode(id: string, x = 0, y = 0, parentId?: string): Node<NodeData> {
  return {
    id,
    type: 'csSource',
    position: { x, y },
    data: { blockType: 'constant', label: id } as NodeData,
    ...(parentId ? { parentId } : {}),
  }
}

function mkEdge(id: string, source: string, target: string): Edge {
  return { id, source, target }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('clipboard — cross-sheet semantics (K1-2)', () => {
  // ── Empty clipboard (must run first — module-level state) ──────────────────

  it('paste returns null when clipboard is empty', () => {
    expect(pasteFromClipboard()).toBeNull()
  })

  // ── Copy preserves internal chains ─────────────────────────────────────────

  it('copy preserves edges where both endpoints are selected', () => {
    const nodes = [mkNode('A'), mkNode('B'), mkNode('C')]
    const edges = [mkEdge('e1', 'A', 'B'), mkEdge('e2', 'B', 'C')]
    // Select A and B only
    copyToClipboard([nodes[0], nodes[1]], edges)
    const result = pasteFromClipboard()!
    expect(result).not.toBeNull()
    // Only e1 (A→B) should be preserved; e2 (B→C) has C outside selection
    expect(result.edges).toHaveLength(1)
  })

  it('copy excludes edges where one endpoint is outside selection', () => {
    const nodes = [mkNode('A'), mkNode('B'), mkNode('C')]
    const edges = [mkEdge('e1', 'A', 'C')] // A selected, C not
    copyToClipboard([nodes[0], nodes[1]], edges)
    const result = pasteFromClipboard()!
    // e1 (A→C) should be excluded: C is not in selection
    expect(result.edges).toHaveLength(0)
  })

  // ── Paste remaps IDs ───────────────────────────────────────────────────────

  it('paste generates fresh node IDs different from originals', () => {
    const nodes = [mkNode('A'), mkNode('B')]
    copyToClipboard(nodes, [])
    const result = pasteFromClipboard()!
    const pastedIds = result.nodes.map((n) => n.id)
    expect(pastedIds).not.toContain('A')
    expect(pastedIds).not.toContain('B')
    // All pasted IDs are unique
    expect(new Set(pastedIds).size).toBe(pastedIds.length)
  })

  it('paste remaps edge source and target to new IDs', () => {
    const nodes = [mkNode('A'), mkNode('B')]
    const edges = [mkEdge('e1', 'A', 'B')]
    copyToClipboard(nodes, edges)
    const result = pasteFromClipboard()!
    expect(result.edges).toHaveLength(1)
    const edge = result.edges[0]
    // Source and target should NOT be the originals
    expect(edge.source).not.toBe('A')
    expect(edge.target).not.toBe('B')
    // Source and target should match pasted node IDs
    const pastedIds = new Set(result.nodes.map((n) => n.id))
    expect(pastedIds.has(edge.source)).toBe(true)
    expect(pastedIds.has(edge.target)).toBe(true)
  })

  // ── No ID collisions across multiple pastes ────────────────────────────────

  it('multiple pastes produce unique IDs (no collisions)', () => {
    const nodes = [mkNode('A'), mkNode('B')]
    const edges = [mkEdge('e1', 'A', 'B')]
    copyToClipboard(nodes, edges)

    const paste1 = pasteFromClipboard()!
    const paste2 = pasteFromClipboard()!
    const paste3 = pasteFromClipboard()!

    const allNodeIds = [
      ...paste1.nodes.map((n) => n.id),
      ...paste2.nodes.map((n) => n.id),
      ...paste3.nodes.map((n) => n.id),
    ]
    // All 6 node IDs must be unique
    expect(new Set(allNodeIds).size).toBe(6)

    const allEdgeIds = [paste1.edges[0].id, paste2.edges[0].id, paste3.edges[0].id]
    expect(new Set(allEdgeIds).size).toBe(3)
  })

  // ── Position offset ────────────────────────────────────────────────────────

  it('successive pastes offset positions incrementally', () => {
    const nodes = [mkNode('A', 100, 200)]
    copyToClipboard(nodes, [])

    const paste1 = pasteFromClipboard()!
    const paste2 = pasteFromClipboard()!

    // First paste: offset = 30*1 = 30
    expect(paste1.nodes[0].position.x).toBe(130)
    expect(paste1.nodes[0].position.y).toBe(230)
    // Second paste: offset = 30*2 = 60
    expect(paste2.nodes[0].position.x).toBe(160)
    expect(paste2.nodes[0].position.y).toBe(260)
  })

  // ── parentId remapping (group nodes) ───────────────────────────────────────

  it('paste remaps parentId when parent is in selection', () => {
    const groupNode = mkNode('G1', 0, 0)
    const childNode = mkNode('child1', 10, 10, 'G1')
    copyToClipboard([groupNode, childNode], [])
    const result = pasteFromClipboard()!

    const pastedChild = result.nodes.find((n) => n.parentId !== undefined)
    expect(pastedChild).toBeDefined()
    // parentId should be remapped to the new group ID, not the original
    expect(pastedChild!.parentId).not.toBe('G1')
    // parentId should match the other pasted node
    const pastedGroup = result.nodes.find((n) => n.id !== pastedChild!.id)
    expect(pastedChild!.parentId).toBe(pastedGroup!.id)
  })

  it('paste strips parentId when parent is not in selection', () => {
    // Only copy child, not the group parent
    const childNode = mkNode('child1', 10, 10, 'G1')
    copyToClipboard([childNode], [])
    const result = pasteFromClipboard()!

    expect(result.nodes).toHaveLength(1)
    // parentId should be stripped (undefined) since G1 wasn't in selection
    expect(result.nodes[0].parentId).toBeUndefined()
  })

  // ── Empty selection no-op ────────────────────────────────────────────────

  it('copy with empty selection does not overwrite clipboard', () => {
    const nodes = [mkNode('A')]
    copyToClipboard(nodes, [])
    // Copy empty selection — should be a no-op
    copyToClipboard([], [])
    // Previous clipboard data should still be intact
    const result = pasteFromClipboard()!
    expect(result).not.toBeNull()
    expect(result.nodes).toHaveLength(1)
  })

  // ── Pasted nodes are marked selected ───────────────────────────────────────

  it('all pasted nodes have selected=true', () => {
    const nodes = [mkNode('A'), mkNode('B')]
    copyToClipboard(nodes, [])
    const result = pasteFromClipboard()!
    for (const n of result.nodes) {
      expect(n.selected).toBe(true)
    }
  })

  // ── Chain integrity: A→B→C all selected ────────────────────────────────────

  it('full chain copy-paste preserves all internal edges with remapped IDs', () => {
    const nodes = [mkNode('A'), mkNode('B'), mkNode('C')]
    const edges = [mkEdge('e1', 'A', 'B'), mkEdge('e2', 'B', 'C')]
    copyToClipboard(nodes, edges)
    const result = pasteFromClipboard()!

    expect(result.nodes).toHaveLength(3)
    expect(result.edges).toHaveLength(2)

    const pastedIds = new Set(result.nodes.map((n) => n.id))
    // All edge endpoints point to pasted nodes
    for (const e of result.edges) {
      expect(pastedIds.has(e.source)).toBe(true)
      expect(pastedIds.has(e.target)).toBe(true)
    }
    // No original IDs remain
    expect(pastedIds.has('A')).toBe(false)
    expect(pastedIds.has('B')).toBe(false)
    expect(pastedIds.has('C')).toBe(false)
  })
})
