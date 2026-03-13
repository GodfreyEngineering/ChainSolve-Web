import dagre from 'dagre'

/** 4.18: All four dagre directions. */
export type LayoutDirection = 'LR' | 'TB' | 'RL' | 'BT'

interface LayoutNode {
  id: string
  width: number
  height: number
  /** If true, node is pinned — its position will not be changed by layout. */
  pinned?: boolean
  /** Parent group ID (if any). Used to respect group boundaries. */
  parentId?: string
}

interface LayoutEdge {
  source: string
  target: string
}

/**
 * Compute an auto-layout for a set of nodes using dagre.
 * Returns a map of node ID → top-left position.
 *
 * 4.18 enhancements:
 * - Supports all 4 directions (LR, TB, RL, BT)
 * - Pinned nodes are excluded from layout (preserve user positioning)
 * - Group children are laid out relative to their parent group
 */
export function autoLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  direction: LayoutDirection = 'LR',
): Map<string, { x: number; y: number }> {
  // 4.18: Separate pinned vs layoutable nodes
  const layoutable = nodes.filter((n) => !n.pinned)
  const layoutableIds = new Set(layoutable.map((n) => n.id))

  // 4.18: Group children by parent for group-aware layout
  const grouped = new Map<string, LayoutNode[]>()
  const ungrouped: LayoutNode[] = []
  for (const node of layoutable) {
    if (node.parentId && layoutableIds.has(node.parentId)) {
      // Skip children — they'll be positioned relative to parent
      const group = grouped.get(node.parentId) ?? []
      group.push(node)
      grouped.set(node.parentId, group)
    } else {
      ungrouped.push(node)
    }
  }

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  })

  for (const node of ungrouped) {
    g.setNode(node.id, { width: node.width, height: node.height })
  }

  for (const edge of edges) {
    // Only add edges where both endpoints are in the layout set
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()

  // Position ungrouped nodes
  for (const node of ungrouped) {
    const laid = g.node(node.id)
    // dagre returns center coordinates; convert to top-left
    positions.set(node.id, {
      x: laid.x - node.width / 2,
      y: laid.y - node.height / 2,
    })
  }

  // 4.18: Position group children relative to their parent position
  for (const [parentId, children] of grouped) {
    const parentPos = positions.get(parentId)
    if (!parentPos) continue
    // Lay out children in a simple grid within the group
    const cols = Math.ceil(Math.sqrt(children.length))
    children.forEach((child, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      positions.set(child.id, {
        x: parentPos.x + 20 + col * (child.width + 20),
        y: parentPos.y + 40 + row * (child.height + 20),
      })
    })
  }

  return positions
}
