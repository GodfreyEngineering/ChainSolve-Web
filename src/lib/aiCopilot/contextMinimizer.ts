/**
 * Context Pack Minimizer (AI-3).
 *
 * Takes a graph + optional selection/diagnostics and returns the minimal
 * subgraph needed for a Copilot request. Strips unnecessary fields and
 * limits hop depth to keep token usage low and preserve privacy.
 */

import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../../blocks/types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface MinimalNode {
  id: string
  blockType: string
  label: string
  inputBindings?: Record<string, unknown>
  value?: unknown
}

export interface MinimalEdge {
  id: string
  source: string
  sourceHandle?: string | null
  target: string
  targetHandle?: string | null
}

export interface ContextPack {
  nodes: MinimalNode[]
  edges: MinimalEdge[]
  diagnostics?: ContextDiagnostic[]
}

export interface ContextDiagnostic {
  level: 'info' | 'warn'
  code: string
  message: string
  nodeIds?: string[]
}

export interface MinimizeOptions {
  /** IDs of selected/focus nodes. If empty, uses all nodes. */
  selectedNodeIds?: string[]
  /** How many hops from selected nodes to include. Default 1. */
  depth?: number
  /** Max total nodes in the context pack. Default 50. */
  maxNodes?: number
  /** Diagnostics to include. */
  diagnostics?: ContextDiagnostic[]
  /** Strip user-entered labels (privacy). Default false. */
  stripLabels?: boolean
}

// ── Core ─────────────────────────────────────────────────────────────────────

/**
 * Build a minimal context pack from the full graph.
 * Always returns a bounded set of nodes/edges suitable for an AI prompt.
 */
export function buildContextPack(
  nodes: Node<NodeData>[],
  edges: Edge[],
  opts: MinimizeOptions = {},
): ContextPack {
  const { selectedNodeIds = [], depth = 1, maxNodes = 50, diagnostics, stripLabels = false } = opts

  // If no selection, use all nodes (capped)
  const seedIds =
    selectedNodeIds.length > 0 ? new Set(selectedNodeIds) : new Set(nodes.map((n) => n.id))

  // BFS to expand neighborhood
  const included = new Set<string>()
  let frontier = new Set(seedIds)

  for (let hop = 0; hop <= depth && frontier.size > 0; hop++) {
    const nextFrontier = new Set<string>()
    for (const nodeId of frontier) {
      if (included.size >= maxNodes) break
      included.add(nodeId)
    }
    if (included.size >= maxNodes) break

    // Only expand neighbors if we haven't reached max depth
    if (hop < depth) {
      for (const edge of edges) {
        if (frontier.has(edge.source) && !included.has(edge.target)) {
          nextFrontier.add(edge.target)
        }
        if (frontier.has(edge.target) && !included.has(edge.source)) {
          nextFrontier.add(edge.source)
        }
      }
    }
    frontier = nextFrontier
  }

  // Add remaining frontier nodes up to maxNodes
  for (const nodeId of frontier) {
    if (included.size >= maxNodes) break
    included.add(nodeId)
  }

  // Build node map for lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Build minimal nodes
  const minNodes: MinimalNode[] = []
  for (const id of included) {
    const node = nodeMap.get(id)
    if (!node) continue
    const data = node.data as NodeData
    const minNode: MinimalNode = {
      id: node.id,
      blockType: data.blockType,
      label: stripLabels ? data.blockType : data.label || data.blockType,
    }
    if (data.inputBindings && Object.keys(data.inputBindings).length > 0) {
      minNode.inputBindings = data.inputBindings
    }
    if (data.value !== undefined && data.value !== null) {
      minNode.value = data.value
    }
    minNodes.push(minNode)
  }

  // Filter edges to only those connecting included nodes
  const minEdges: MinimalEdge[] = edges
    .filter((e) => included.has(e.source) && included.has(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle,
    }))

  const pack: ContextPack = { nodes: minNodes, edges: minEdges }
  if (diagnostics && diagnostics.length > 0) {
    pack.diagnostics = diagnostics
  }
  return pack
}

/**
 * Estimate the token count for a context pack (rough heuristic).
 * ~4 chars per token on average.
 */
export function estimateContextTokens(pack: ContextPack): number {
  const json = JSON.stringify(pack)
  return Math.ceil(json.length / 4)
}
