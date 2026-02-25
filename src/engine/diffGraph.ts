/**
 * Diff two React Flow graph states and produce PatchOp[] for the engine.
 *
 * Compares previous and next nodes/edges by id. Detects additions,
 * removals, and data changes. Position-only changes are ignored
 * (position is not engine-relevant).
 */

import type { Node, Edge } from '@xyflow/react'
import type { PatchOp, EngineNodeDef, EngineEdgeDef } from './wasm-types.ts'

/** Convert a React Flow node to an engine node def. */
function toEngineNode(node: Node): EngineNodeDef {
  const data = node.data as Record<string, unknown>
  return {
    id: node.id,
    blockType: (data.blockType as string) ?? '',
    data,
  }
}

/** Convert a React Flow edge to an engine edge def. */
function toEngineEdge(edge: Edge): EngineEdgeDef {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle ?? 'out',
    target: edge.target,
    targetHandle: edge.targetHandle ?? 'in',
  }
}

/**
 * Shallow data comparison. We compare the JSON serialization of the data
 * objects to detect changes. This is reliable for node data which contains
 * only JSON-serializable values. Position/selection changes are not
 * included since node.data doesn't contain those fields.
 */
function dataChanged(
  prevData: Record<string, unknown>,
  nextData: Record<string, unknown>,
): boolean {
  return JSON.stringify(prevData) !== JSON.stringify(nextData)
}

/**
 * Generate patch ops to transform the engine state from prev → next.
 * Group nodes (blockType === '__group__') are excluded since they
 * don't participate in evaluation.
 */
export function diffGraph(
  prevNodes: Node[],
  prevEdges: Edge[],
  nextNodes: Node[],
  nextEdges: Edge[],
): PatchOp[] {
  const ops: PatchOp[] = []

  // Filter out group nodes (not engine-relevant).
  const prevEvalNodes = prevNodes.filter(
    (n) => (n.data as Record<string, unknown>).blockType !== '__group__',
  )
  const nextEvalNodes = nextNodes.filter(
    (n) => (n.data as Record<string, unknown>).blockType !== '__group__',
  )

  const prevNodeMap = new Map(prevEvalNodes.map((n) => [n.id, n]))
  const nextNodeMap = new Map(nextEvalNodes.map((n) => [n.id, n]))

  // Removed nodes
  for (const [id] of prevNodeMap) {
    if (!nextNodeMap.has(id)) {
      ops.push({ op: 'removeNode', nodeId: id })
    }
  }

  // Added or changed nodes
  for (const [id, node] of nextNodeMap) {
    const prev = prevNodeMap.get(id)
    if (!prev) {
      ops.push({ op: 'addNode', node: toEngineNode(node) })
    } else if (
      dataChanged(prev.data as Record<string, unknown>, node.data as Record<string, unknown>)
    ) {
      ops.push({
        op: 'updateNodeData',
        nodeId: id,
        data: node.data as Record<string, unknown>,
      })
    }
  }

  // Build edge id sets from eval nodes only.
  const evalNodeIds = new Set(nextEvalNodes.map((n) => n.id))
  const prevEvalEdges = prevEdges.filter(
    (e) => evalNodeIds.has(e.source) || prevNodeMap.has(e.source),
  )
  const nextEvalEdges = nextEdges.filter(
    (e) => evalNodeIds.has(e.source) && evalNodeIds.has(e.target),
  )

  const prevEdgeMap = new Map(prevEvalEdges.map((e) => [e.id, e]))
  const nextEdgeMap = new Map(nextEvalEdges.map((e) => [e.id, e]))

  // Removed edges
  for (const [id] of prevEdgeMap) {
    if (!nextEdgeMap.has(id)) {
      ops.push({ op: 'removeEdge', edgeId: id })
    }
  }

  // Added edges
  for (const [id, edge] of nextEdgeMap) {
    if (!prevEdgeMap.has(id)) {
      ops.push({ op: 'addEdge', edge: toEngineEdge(edge) })
    }
  }

  return ops
}
