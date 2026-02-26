/**
 * Canvas clipboard — in-memory copy/paste for selected nodes + edges.
 *
 * Best-effort write to navigator.clipboard (JSON) for potential future
 * cross-tab paste; always reads from the in-memory variable.
 */

import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../blocks/types'
import { nextNodeId } from './groups'

interface ClipboardPayload {
  nodes: Node<NodeData>[]
  edges: Edge[]
}

let clipboardData: ClipboardPayload | null = null
let pasteCounter = 0

/**
 * Copy selected nodes and edges between them to the internal clipboard.
 * Also attempts a best-effort write to the system clipboard.
 */
export function copyToClipboard(selectedNodes: Node<NodeData>[], allEdges: Edge[]): void {
  if (selectedNodes.length === 0) return

  const selectedIds = new Set(selectedNodes.map((n) => n.id))
  const internalEdges = allEdges.filter(
    (e) => selectedIds.has(e.source) && selectedIds.has(e.target),
  )

  clipboardData = { nodes: selectedNodes, edges: internalEdges }
  pasteCounter = 0

  // Best-effort system clipboard write
  try {
    navigator.clipboard?.writeText(JSON.stringify(clipboardData)).catch(() => {})
  } catch {
    // Clipboard API not available
  }
}

/**
 * Paste from in-memory clipboard. Returns new nodes/edges with fresh IDs
 * and offset positions, or null if clipboard is empty.
 */
export function pasteFromClipboard(): { nodes: Node<NodeData>[]; edges: Edge[] } | null {
  if (!clipboardData || clipboardData.nodes.length === 0) return null

  pasteCounter++
  const offset = 30 * pasteCounter

  // Build ID remap: oldId → newId
  const idMap = new Map<string, string>()
  for (const n of clipboardData.nodes) {
    idMap.set(n.id, nextNodeId())
  }

  // Create new nodes with remapped IDs and offset positions
  const nodes: Node<NodeData>[] = clipboardData.nodes.map((n) => {
    const newParentId = n.parentId ? idMap.get(n.parentId) : undefined
    return {
      ...n,
      id: idMap.get(n.id)!,
      position: { x: n.position.x + offset, y: n.position.y + offset },
      selected: true,
      parentId: newParentId, // strip parentId if parent wasn't in selection
    }
  })

  // Create new edges with remapped source/target
  let edgeCounter = 0
  const edges: Edge[] = clipboardData.edges.map((e) => ({
    ...e,
    id: `edge_${Date.now()}_${++edgeCounter}`,
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
  }))

  return { nodes, edges }
}
