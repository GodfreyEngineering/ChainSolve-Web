/**
 * evaluate.ts — Pure, synchronous evaluation engine.
 *
 * Algorithm:
 *  1. Build an in-edge map (target → edges) and out-edge map (source → edges).
 *  2. Kahn's topological sort. Nodes in cycles never reach in-degree 0 and
 *     are therefore not evaluated — their result stays absent from the map
 *     (treated as error by downstream nodes).
 *  3. Evaluate nodes in topological order. Source nodes call evaluate() with
 *     an empty inputs array; operation nodes pass the computed Values of their
 *     upstream connections.
 *  4. Returns Map<nodeId, Value>.
 */

import type { Edge } from '@xyflow/react'
import { BLOCK_REGISTRY, type NodeData } from '../blocks/registry'
import { type Value, mkScalar, mkError } from './value'

// Re-export formatValue from value.ts so existing import paths still work.
export { formatValue } from './value'

/** Minimal node shape we need — avoids importing the full RF Node type. */
interface SlimNode {
  id: string
  data: NodeData
}

export function evaluateGraph(
  nodes: ReadonlyArray<SlimNode>,
  edges: ReadonlyArray<Edge>,
): Map<string, Value> {
  // ── 1. Build adjacency maps ─────────────────────────────────────────────────

  /** target nodeId → edges entering it */
  const inEdges = new Map<string, Edge[]>()
  /** source nodeId → edges leaving it */
  const outEdges = new Map<string, Edge[]>()

  for (const node of nodes) {
    inEdges.set(node.id, [])
    outEdges.set(node.id, [])
  }

  for (const edge of edges) {
    inEdges.get(edge.target)?.push(edge)
    outEdges.get(edge.source)?.push(edge)
  }

  // ── 2. Kahn's topological sort ─────────────────────────────────────────────

  const inDegree = new Map<string, number>()
  for (const node of nodes) {
    inDegree.set(node.id, (inEdges.get(node.id) ?? []).length)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const edge of outEdges.get(id) ?? []) {
      const newDeg = (inDegree.get(edge.target) ?? 0) - 1
      inDegree.set(edge.target, newDeg)
      if (newDeg === 0) queue.push(edge.target)
    }
  }
  // Nodes not in `order` are part of cycles — they produce errors implicitly
  // because their results are never written into `results`.

  // ── 3. Evaluate in topological order ───────────────────────────────────────

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const results = new Map<string, Value>()

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId)
    if (!node) continue

    const def = BLOCK_REGISTRY.get(node.data.blockType)
    if (!def) continue

    const inputValues: Array<Value | null> = def.inputs.map((port) => {
      const edge = (inEdges.get(nodeId) ?? []).find((e) => e.targetHandle === port.id)
      const overrides = node.data.portOverrides as Record<string, boolean> | undefined
      const manualVals = node.data.manualValues as Record<string, number> | undefined
      const overrideActive = overrides?.[port.id] === true

      if (edge && !overrideActive) {
        // Connected, no manual override — use upstream computed value.
        const upstream = results.get(edge.source)
        // Upstream not yet evaluated (cycle) → return null.
        return upstream !== undefined ? upstream : null
      }
      // Not connected, or override active — use manual value as scalar.
      const manual = manualVals?.[port.id]
      return manual !== undefined ? mkScalar(manual) : null
    })

    try {
      const result = def.evaluate(inputValues, node.data)
      results.set(nodeId, result)
    } catch (err) {
      results.set(nodeId, mkError(err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  return results
}
