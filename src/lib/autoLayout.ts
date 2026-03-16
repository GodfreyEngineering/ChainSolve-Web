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
  /** Whether this node is a group (csGroup). */
  isGroup?: boolean
}

interface LayoutEdge {
  source: string
  target: string
}

/** Padding inside a group around its children. */
const GROUP_PADDING_X = 20
const GROUP_PADDING_TOP = 40 // extra space for group header/label
const GROUP_PADDING_BOTTOM = 20
const CHILD_GAP = 20

export interface AutoLayoutResult {
  positions: Map<string, { x: number; y: number }>
  /** Updated group dimensions after fitting children. */
  groupSizes: Map<string, { width: number; height: number }>
}

/**
 * Compute an auto-layout for a set of nodes using dagre.
 *
 * Returns positions and updated group sizes. For nodes with a parentId,
 * positions are RELATIVE to their parent group (React Flow convention).
 * Group nodes are sized to fit their children.
 *
 * 4.18 enhancements:
 * - Supports all 4 directions (LR, TB, RL, BT)
 * - Pinned nodes are excluded from layout (preserve user positioning)
 * - Group children are laid out in a grid within their parent
 *
 * A.4: Returns relative positions for grouped children and computes
 * group sizes, so the caller can properly update both positions and
 * dimensions without stripping group membership.
 */
export function autoLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  direction: LayoutDirection = 'LR',
): AutoLayoutResult {
  // 4.18: Separate pinned vs layoutable nodes
  const layoutable = nodes.filter((n) => !n.pinned)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // A.4: Group children by parent for group-aware layout.
  // Children of a group are excluded from the dagre layout entirely;
  // they are positioned in a grid relative to their parent.
  const grouped = new Map<string, LayoutNode[]>()
  const ungrouped: LayoutNode[] = []
  for (const node of layoutable) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      const group = grouped.get(node.parentId) ?? []
      group.push(node)
      grouped.set(node.parentId, group)
    } else {
      ungrouped.push(node)
    }
  }

  // A.4: Pre-compute group sizes based on their children so dagre
  // can allocate enough space for the group node in the layout.
  const groupSizes = new Map<string, { width: number; height: number }>()
  for (const [parentId, children] of grouped) {
    const cols = Math.ceil(Math.sqrt(children.length))
    const rows = Math.ceil(children.length / cols)
    const maxChildWidth = Math.max(...children.map((c) => c.width))
    const maxChildHeight = Math.max(...children.map((c) => c.height))
    const width = GROUP_PADDING_X * 2 + cols * maxChildWidth + (cols - 1) * CHILD_GAP
    const height =
      GROUP_PADDING_TOP + rows * maxChildHeight + (rows - 1) * CHILD_GAP + GROUP_PADDING_BOTTOM
    groupSizes.set(parentId, { width, height })
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
    // For group nodes, use the pre-computed size that fits all children
    const groupSize = groupSizes.get(node.id)
    g.setNode(node.id, {
      width: groupSize?.width ?? node.width,
      height: groupSize?.height ?? node.height,
    })
  }

  for (const edge of edges) {
    // Only add edges where both endpoints are in the dagre layout set
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()

  // Position ungrouped nodes (including group parents)
  for (const node of ungrouped) {
    const laid = g.node(node.id)
    const groupSize = groupSizes.get(node.id)
    const w = groupSize?.width ?? node.width
    const h = groupSize?.height ?? node.height
    // dagre returns center coordinates; convert to top-left
    positions.set(node.id, {
      x: laid.x - w / 2,
      y: laid.y - h / 2,
    })
  }

  // A.4: Position group children RELATIVE to their parent (React Flow convention).
  // When a node has parentId set, React Flow interprets position as relative
  // to the parent's top-left corner. Previous code used absolute coords which
  // broke group membership on the canvas.
  for (const [_parentId, children] of grouped) {
    const cols = Math.ceil(Math.sqrt(children.length))
    const maxChildWidth = Math.max(...children.map((c) => c.width))
    const maxChildHeight = Math.max(...children.map((c) => c.height))
    children.forEach((child, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      // Positions are relative to parent top-left
      positions.set(child.id, {
        x: GROUP_PADDING_X + col * (maxChildWidth + CHILD_GAP),
        y: GROUP_PADDING_TOP + row * (maxChildHeight + CHILD_GAP),
      })
    })
  }

  return { positions, groupSizes }
}
