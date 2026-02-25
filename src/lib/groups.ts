/**
 * groups.ts — Pure utility functions for block group manipulation.
 *
 * Groups use React Flow's parent-child mechanism: a csGroup node acts as
 * the parent; member nodes store `parentId` and positions are relative to
 * the group node's position. This gives us native drag-parent-drags-children
 * behavior with zero custom movement logic.
 *
 * Groups do NOT participate in evaluation — `blockType: '__group__'` is not
 * in BLOCK_REGISTRY, so evaluate.ts silently skips them.
 */

import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../blocks/types'

// ── Constants ────────────────────────────────────────────────────────────────

const GROUP_PADDING = 40
const GROUP_HEADER_HEIGHT = 36
const DEFAULT_NODE_WIDTH = 168
const DEFAULT_NODE_HEIGHT = 60
const DEFAULT_GROUP_COLOR = '#1CABB0'

/** Shared counter for generating unique group/node IDs. */
let groupIdCounter = 0

export function nextGroupId(): string {
  return `group_${Date.now()}_${++groupIdCounter}`
}

export function nextNodeId(): string {
  return `node_${Date.now()}_${++groupIdCounter}`
}

// ── Proxy handle types ───────────────────────────────────────────────────────

export interface ProxyHandle {
  id: string
  type: 'source' | 'target'
  label: string
  /** Original edge ID this proxy represents. */
  originalEdgeId: string
}

// ── Create group ─────────────────────────────────────────────────────────────

/**
 * Create a group from selected node IDs.
 * Returns the new group node and updated node array (with parentId set + relative positions).
 */
export function createGroup(
  selectedIds: string[],
  allNodes: Node<NodeData>[],
): { groupNode: Node<NodeData>; updatedNodes: Node<NodeData>[] } {
  const members = allNodes.filter((n) => selectedIds.includes(n.id))
  if (members.length < 2) throw new Error('Need at least 2 nodes to create a group')

  // Compute bounding box of selected nodes (absolute positions)
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const n of members) {
    const w = (n.measured?.width as number | undefined) ?? DEFAULT_NODE_WIDTH
    const h = (n.measured?.height as number | undefined) ?? DEFAULT_NODE_HEIGHT
    if (n.position.x < minX) minX = n.position.x
    if (n.position.y < minY) minY = n.position.y
    if (n.position.x + w > maxX) maxX = n.position.x + w
    if (n.position.y + h > maxY) maxY = n.position.y + h
  }

  const groupX = minX - GROUP_PADDING
  const groupY = minY - GROUP_PADDING - GROUP_HEADER_HEIGHT
  const groupW = maxX - minX + 2 * GROUP_PADDING
  const groupH = maxY - minY + 2 * GROUP_PADDING + GROUP_HEADER_HEIGHT

  const groupId = nextGroupId()

  const groupNode: Node<NodeData> = {
    id: groupId,
    type: 'csGroup',
    position: { x: groupX, y: groupY },
    style: { width: groupW, height: groupH },
    data: {
      blockType: '__group__',
      label: 'Group',
      groupColor: DEFAULT_GROUP_COLOR,
      groupCollapsed: false,
    },
  }

  const selectedSet = new Set(selectedIds)
  const updatedNodes = allNodes.map((n) => {
    if (!selectedSet.has(n.id)) return n
    return {
      ...n,
      parentId: groupId,
      position: {
        x: n.position.x - groupX,
        y: n.position.y - groupY,
      },
    }
  })

  return { groupNode, updatedNodes }
}

// ── Ungroup ──────────────────────────────────────────────────────────────────

/**
 * Dissolve a group: convert member positions back to absolute, remove parentId,
 * and delete the group node.
 */
export function ungroupNodes(groupId: string, allNodes: Node<NodeData>[]): Node<NodeData>[] {
  const group = allNodes.find((n) => n.id === groupId)
  if (!group) return allNodes

  return allNodes
    .filter((n) => n.id !== groupId)
    .map((n) => {
      if (n.parentId !== groupId) return n
      const updated = { ...n }
      updated.position = {
        x: n.position.x + group.position.x,
        y: n.position.y + group.position.y,
      }
      delete (updated as Record<string, unknown>).parentId
      return updated
    })
}

// ── Auto-resize ──────────────────────────────────────────────────────────────

/**
 * Recompute group bounds from member positions and resize accordingly.
 * Returns the updated group node, or null if group not found / no members.
 */
export function autoResizeGroup(
  groupId: string,
  allNodes: Node<NodeData>[],
): Node<NodeData> | null {
  const group = allNodes.find((n) => n.id === groupId)
  if (!group) return null

  const members = allNodes.filter((n) => n.parentId === groupId && !n.hidden)
  if (members.length === 0) return null

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const m of members) {
    const w = (m.measured?.width as number | undefined) ?? DEFAULT_NODE_WIDTH
    const h = (m.measured?.height as number | undefined) ?? DEFAULT_NODE_HEIGHT
    if (m.position.x < minX) minX = m.position.x
    if (m.position.y < minY) minY = m.position.y
    if (m.position.x + w > maxX) maxX = m.position.x + w
    if (m.position.y + h > maxY) maxY = m.position.y + h
  }

  const newW = maxX - minX + 2 * GROUP_PADDING
  const newH = maxY - minY + 2 * GROUP_PADDING + GROUP_HEADER_HEIGHT

  // Adjust group position so padding is maintained
  const dx = minX - GROUP_PADDING
  const dy = minY - GROUP_PADDING - GROUP_HEADER_HEIGHT

  // Shift member positions if the group origin moved
  const shiftX = dx
  const shiftY = dy

  return {
    ...group,
    position: {
      x: group.position.x + shiftX,
      y: group.position.y + shiftY,
    },
    style: { ...group.style, width: newW, height: newH },
  }
}

// ── Collapse ─────────────────────────────────────────────────────────────────

/**
 * Collapse a group: hide members, reroute cross-boundary edges to proxy handles.
 */
export function collapseGroup(
  groupId: string,
  allNodes: Node<NodeData>[],
  allEdges: Edge[],
): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const memberIds = new Set(allNodes.filter((n) => n.parentId === groupId).map((n) => n.id))
  if (memberIds.size === 0) return { nodes: allNodes, edges: allEdges }

  const proxyHandles: ProxyHandle[] = []
  let inCount = 0
  let outCount = 0

  const updatedEdges = allEdges.map((e) => {
    const srcInside = memberIds.has(e.source)
    const tgtInside = memberIds.has(e.target)

    if (srcInside && tgtInside) {
      // Internal edge — hide it
      return { ...e, hidden: true }
    }

    if (!srcInside && tgtInside) {
      // Inbound edge — reroute target to group proxy handle
      const handleId = `proxy_in_${inCount++}`
      const srcNode = allNodes.find((n) => n.id === e.source)
      proxyHandles.push({
        id: handleId,
        type: 'target',
        label: srcNode?.data.label ?? `in ${inCount}`,
        originalEdgeId: e.id,
      })
      return {
        ...e,
        target: groupId,
        targetHandle: handleId,
        data: {
          ...((e.data as Record<string, unknown>) ?? {}),
          __proxy: true,
          __proxyOriginal: { target: e.target, targetHandle: e.targetHandle },
        },
      }
    }

    if (srcInside && !tgtInside) {
      // Outbound edge — reroute source to group proxy handle
      const handleId = `proxy_out_${outCount++}`
      const tgtNode = allNodes.find((n) => n.id === e.target)
      proxyHandles.push({
        id: handleId,
        type: 'source',
        label: tgtNode?.data.label ?? `out ${outCount}`,
        originalEdgeId: e.id,
      })
      return {
        ...e,
        source: groupId,
        sourceHandle: handleId,
        data: {
          ...((e.data as Record<string, unknown>) ?? {}),
          __proxy: true,
          __proxyOriginal: { source: e.source, sourceHandle: e.sourceHandle },
        },
      }
    }

    return e // External edge — unchanged
  })

  const updatedNodes = allNodes.map((n) => {
    if (memberIds.has(n.id)) {
      return { ...n, hidden: true }
    }
    if (n.id === groupId) {
      return {
        ...n,
        data: { ...n.data, groupCollapsed: true, __proxyHandles: proxyHandles },
        style: { ...n.style, width: 200, height: 36 + proxyHandles.length * 24 + 40 },
      }
    }
    return n
  })

  return { nodes: updatedNodes, edges: updatedEdges }
}

// ── Expand ───────────────────────────────────────────────────────────────────

/**
 * Expand a group: show members, restore original edge routing, remove proxies.
 */
export function expandGroup(
  groupId: string,
  allNodes: Node<NodeData>[],
  allEdges: Edge[],
): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const memberIds = new Set(allNodes.filter((n) => n.parentId === groupId).map((n) => n.id))

  // Restore edges
  const updatedEdges = allEdges.map((e) => {
    const data = e.data as Record<string, unknown> | undefined
    if (data?.__proxy) {
      const original = data.__proxyOriginal as Record<string, string>
      const restored: Edge = { ...e }
      if (original.target) {
        restored.target = original.target
        restored.targetHandle = original.targetHandle
      }
      if (original.source) {
        restored.source = original.source
        restored.sourceHandle = original.sourceHandle
      }
      // Remove proxy data
      const cleanData = { ...data }
      delete cleanData.__proxy
      delete cleanData.__proxyOriginal
      restored.data = Object.keys(cleanData).length > 0 ? cleanData : undefined
      return restored
    }
    // Unhide internal edges
    if (e.hidden && memberIds.has(e.source) && memberIds.has(e.target)) {
      const { hidden: _, ...rest } = e
      return rest as Edge
    }
    return e
  })

  // Show members and resize group
  const members = allNodes.filter((n) => n.parentId === groupId)
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const m of members) {
    const w = (m.measured?.width as number | undefined) ?? DEFAULT_NODE_WIDTH
    const h = (m.measured?.height as number | undefined) ?? DEFAULT_NODE_HEIGHT
    if (m.position.x < minX) minX = m.position.x
    if (m.position.y < minY) minY = m.position.y
    if (m.position.x + w > maxX) maxX = m.position.x + w
    if (m.position.y + h > maxY) maxY = m.position.y + h
  }

  const groupW = maxX - minX + 2 * GROUP_PADDING
  const groupH = maxY - minY + 2 * GROUP_PADDING + GROUP_HEADER_HEIGHT

  const updatedNodes = allNodes.map((n) => {
    if (memberIds.has(n.id)) {
      const { hidden: _, ...rest } = n
      return rest as Node<NodeData>
    }
    if (n.id === groupId) {
      const cleanData = { ...n.data }
      delete (cleanData as Record<string, unknown>).__proxyHandles
      return {
        ...n,
        data: { ...cleanData, groupCollapsed: false },
        style: {
          ...n.style,
          width: members.length > 0 ? groupW : n.style?.width,
          height: members.length > 0 ? groupH : n.style?.height,
        },
      }
    }
    return n
  })

  return { nodes: updatedNodes, edges: updatedEdges }
}

// ── Canonical snapshot ───────────────────────────────────────────────────────

/**
 * Produce a canonical snapshot for saving: temporarily expands all collapsed
 * groups so edges are in their original (non-proxy) form. Preserves
 * `groupCollapsed: true` so the next load can re-collapse.
 */
export function getCanonicalSnapshot(
  nodes: Node<NodeData>[],
  edges: Edge[],
): { nodes: Node<NodeData>[]; edges: Edge[] } {
  let currentNodes = [...nodes]
  let currentEdges = [...edges]

  const collapsedGroups = currentNodes.filter(
    (n) => n.type === 'csGroup' && (n.data as NodeData).groupCollapsed,
  )

  for (const g of collapsedGroups) {
    const result = expandGroup(g.id, currentNodes, currentEdges)
    currentNodes = result.nodes
    currentEdges = result.edges
  }

  // Re-mark as collapsed (expand clears the flag) so reload can re-collapse
  currentNodes = currentNodes.map((n) => {
    if (n.type === 'csGroup' && collapsedGroups.find((g) => g.id === n.id)) {
      return { ...n, data: { ...n.data, groupCollapsed: true } }
    }
    return n
  })

  return { nodes: currentNodes, edges: currentEdges }
}

// ── Template insertion ───────────────────────────────────────────────────────

export interface TemplatePayload {
  nodes: Record<string, unknown>[]
  edges: Record<string, unknown>[]
}

/**
 * Insert a template at a given position. Generates new IDs for all nodes/edges,
 * creates a new group, and sets parentId on members.
 */
export function insertTemplate(
  payload: TemplatePayload,
  position: { x: number; y: number },
  name: string,
  color: string,
): { groupNode: Node<NodeData>; memberNodes: Node<NodeData>[]; edges: Edge[] } {
  const idMap = new Map<string, string>()

  // Generate new IDs
  for (const n of payload.nodes) {
    const oldId = n.id as string
    idMap.set(oldId, nextNodeId())
  }

  const groupId = nextGroupId()

  // Compute bounding box from template nodes to set group size
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const n of payload.nodes) {
    const pos = n.position as { x: number; y: number }
    const w = DEFAULT_NODE_WIDTH
    const h = DEFAULT_NODE_HEIGHT
    if (pos.x < minX) minX = pos.x
    if (pos.y < minY) minY = pos.y
    if (pos.x + w > maxX) maxX = pos.x + w
    if (pos.y + h > maxY) maxY = pos.y + h
  }

  const groupW = maxX - minX + 2 * GROUP_PADDING
  const groupH = maxY - minY + 2 * GROUP_PADDING + GROUP_HEADER_HEIGHT

  const groupNode: Node<NodeData> = {
    id: groupId,
    type: 'csGroup',
    position,
    style: { width: groupW, height: groupH },
    data: {
      blockType: '__group__',
      label: name,
      groupColor: color,
      groupCollapsed: false,
    },
  }

  // Create member nodes with new IDs and relative positions
  const memberNodes: Node<NodeData>[] = payload.nodes.map((n) => {
    const pos = n.position as { x: number; y: number }
    return {
      ...(n as Record<string, unknown>),
      id: idMap.get(n.id as string)!,
      parentId: groupId,
      position: {
        x: pos.x - minX + GROUP_PADDING,
        y: pos.y - minY + GROUP_PADDING + GROUP_HEADER_HEIGHT,
      },
    } as Node<NodeData>
  })

  // Remap edges
  const edges: Edge[] = payload.edges.map((e) => ({
    ...(e as Record<string, unknown>),
    id: `edge_${Date.now()}_${++groupIdCounter}`,
    source: idMap.get(e.source as string) ?? (e.source as string),
    target: idMap.get(e.target as string) ?? (e.target as string),
  })) as Edge[]

  return { groupNode, memberNodes, edges }
}
