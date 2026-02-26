import dagre from 'dagre'

export type LayoutDirection = 'LR' | 'TB'

interface LayoutNode {
  id: string
  width: number
  height: number
}

interface LayoutEdge {
  source: string
  target: string
}

/**
 * Compute an auto-layout for a set of nodes using dagre.
 * Returns a map of node ID → top-left position.
 */
export function autoLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  direction: LayoutDirection = 'LR',
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  })

  for (const node of nodes) {
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
  for (const node of nodes) {
    const laid = g.node(node.id)
    // dagre returns center coordinates; convert to top-left
    positions.set(node.id, {
      x: laid.x - node.width / 2,
      y: laid.y - node.height / 2,
    })
  }

  return positions
}
