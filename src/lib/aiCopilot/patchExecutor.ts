/**
 * patchExecutor.ts — safe patch executor for AI copilot ops.
 *
 * Validates ops against current canvas state, prevents invalid edges
 * (fan-in > 1), ensures unique IDs, and rejects destructive ops unless
 * the permission gate has been passed.
 *
 * Returns the new nodes/edges arrays (immutable — does not mutate inputs).
 */

import type { Node, Edge } from '@xyflow/react'
import type { AiPatchOp, AiNodeSpec, AiEdgeSpec } from './types'
import type { NodeData } from '../../blocks/types'
import { BLOCK_REGISTRY } from '../../blocks/registry'

// ── Validation types ────────────────────────────────────────────────────────

export interface PatchValidationError {
  opIndex: number
  op: string
  message: string
}

export interface PatchResult {
  nodes: Node<NodeData>[]
  edges: Edge[]
  errors: PatchValidationError[]
  appliedCount: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Convert an AI node spec to a React Flow node. */
function aiNodeToRfNode(spec: AiNodeSpec): Node<NodeData> {
  const def = BLOCK_REGISTRY.get(spec.blockType)
  const defaultData = def?.defaultData ?? { blockType: spec.blockType, label: spec.blockType }
  return {
    id: spec.id,
    type: def?.nodeKind ?? 'csOperation',
    position: {
      x: isFiniteNumber(spec.position?.x) ? spec.position!.x : Math.random() * 400 + 100,
      y: isFiniteNumber(spec.position?.y) ? spec.position!.y : Math.random() * 400 + 100,
    },
    data: {
      ...defaultData,
      ...(spec.data ?? {}),
      label: spec.label ?? def?.label ?? spec.blockType,
    } as NodeData,
  }
}

/** Convert an AI edge spec to a React Flow edge. */
function aiEdgeToRfEdge(spec: AiEdgeSpec): Edge {
  return {
    id: spec.id,
    source: spec.source,
    sourceHandle: spec.sourceHandle ?? 'out',
    target: spec.target,
    targetHandle: spec.targetHandle ?? 'value',
  }
}

// ── Main executor ───────────────────────────────────────────────────────────

/**
 * Apply a list of AI patch ops to the current canvas state.
 *
 * @param ops  The patch operations (from AI response, already validated by zod)
 * @param currentNodes  Current React Flow nodes
 * @param currentEdges  Current React Flow edges
 * @param destructiveAllowed  If false, removeNode/removeEdge ops are rejected
 * @returns New nodes/edges + any validation errors
 */
export function applyPatchOps(
  ops: AiPatchOp[],
  currentNodes: Node<NodeData>[],
  currentEdges: Edge[],
  destructiveAllowed: boolean,
): PatchResult {
  let nodes = [...currentNodes]
  let edges = [...currentEdges]
  const errors: PatchValidationError[] = []
  let appliedCount = 0

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]

    switch (op.op) {
      case 'addNode': {
        if (!op.node?.id || !op.node?.blockType) {
          errors.push({ opIndex: i, op: op.op, message: 'Missing node id or blockType' })
          break
        }
        if (nodes.some((n) => n.id === op.node.id)) {
          errors.push({ opIndex: i, op: op.op, message: `Duplicate node id: ${op.node.id}` })
          break
        }
        if (!BLOCK_REGISTRY.has(op.node.blockType)) {
          errors.push({
            opIndex: i,
            op: op.op,
            message: `Unknown blockType: ${op.node.blockType}`,
          })
          break
        }
        nodes = [...nodes, aiNodeToRfNode(op.node)]
        appliedCount++
        break
      }

      case 'addEdge': {
        if (!op.edge?.id || !op.edge?.source || !op.edge?.target) {
          errors.push({ opIndex: i, op: op.op, message: 'Missing edge id, source, or target' })
          break
        }
        if (edges.some((e) => e.id === op.edge.id)) {
          errors.push({ opIndex: i, op: op.op, message: `Duplicate edge id: ${op.edge.id}` })
          break
        }
        // Check source and target exist
        if (!nodes.some((n) => n.id === op.edge.source)) {
          errors.push({
            opIndex: i,
            op: op.op,
            message: `Source node not found: ${op.edge.source}`,
          })
          break
        }
        if (!nodes.some((n) => n.id === op.edge.target)) {
          errors.push({
            opIndex: i,
            op: op.op,
            message: `Target node not found: ${op.edge.target}`,
          })
          break
        }
        // Fan-in check: only one edge per target handle
        const targetHandle = op.edge.targetHandle ?? 'value'
        const existingFanIn = edges.some(
          (e) => e.target === op.edge.target && (e.targetHandle ?? 'value') === targetHandle,
        )
        if (existingFanIn) {
          errors.push({
            opIndex: i,
            op: op.op,
            message: `Fan-in violation: ${op.edge.target}:${targetHandle} already connected`,
          })
          break
        }
        edges = [...edges, aiEdgeToRfEdge(op.edge)]
        appliedCount++
        break
      }

      case 'updateNodeData': {
        if (!op.nodeId) {
          errors.push({ opIndex: i, op: op.op, message: 'Missing nodeId' })
          break
        }
        const nodeIdx = nodes.findIndex((n) => n.id === op.nodeId)
        if (nodeIdx === -1) {
          errors.push({ opIndex: i, op: op.op, message: `Node not found: ${op.nodeId}` })
          break
        }
        // Sanitize: reject NaN/Infinity in data values
        const sanitized = sanitizeData(op.data)
        const updated = {
          ...nodes[nodeIdx],
          data: { ...(nodes[nodeIdx].data as NodeData), ...sanitized },
        }
        nodes = [...nodes.slice(0, nodeIdx), updated, ...nodes.slice(nodeIdx + 1)]
        appliedCount++
        break
      }

      case 'removeNode': {
        if (!destructiveAllowed) {
          errors.push({ opIndex: i, op: op.op, message: 'Destructive op requires confirmation' })
          break
        }
        if (!op.nodeId) {
          errors.push({ opIndex: i, op: op.op, message: 'Missing nodeId' })
          break
        }
        if (!nodes.some((n) => n.id === op.nodeId)) {
          errors.push({ opIndex: i, op: op.op, message: `Node not found: ${op.nodeId}` })
          break
        }
        nodes = nodes.filter((n) => n.id !== op.nodeId)
        // Also remove connected edges
        edges = edges.filter((e) => e.source !== op.nodeId && e.target !== op.nodeId)
        appliedCount++
        break
      }

      case 'removeEdge': {
        if (!destructiveAllowed) {
          errors.push({ opIndex: i, op: op.op, message: 'Destructive op requires confirmation' })
          break
        }
        if (!op.edgeId) {
          errors.push({ opIndex: i, op: op.op, message: 'Missing edgeId' })
          break
        }
        if (!edges.some((e) => e.id === op.edgeId)) {
          errors.push({ opIndex: i, op: op.op, message: `Edge not found: ${op.edgeId}` })
          break
        }
        edges = edges.filter((e) => e.id !== op.edgeId)
        appliedCount++
        break
      }

      case 'setInputBinding': {
        if (!op.nodeId || !op.portId || !op.binding) {
          errors.push({ opIndex: i, op: op.op, message: 'Missing nodeId, portId, or binding' })
          break
        }
        const bindNodeIdx = nodes.findIndex((n) => n.id === op.nodeId)
        if (bindNodeIdx === -1) {
          errors.push({ opIndex: i, op: op.op, message: `Node not found: ${op.nodeId}` })
          break
        }
        const bindNode = nodes[bindNodeIdx]
        const nodeData = bindNode.data as NodeData
        const updatedBindings = { ...(nodeData.inputBindings ?? {}), [op.portId]: op.binding }
        const updatedNode = {
          ...bindNode,
          data: { ...nodeData, inputBindings: updatedBindings },
        }
        nodes = [...nodes.slice(0, bindNodeIdx), updatedNode, ...nodes.slice(bindNodeIdx + 1)]
        appliedCount++
        break
      }

      case 'createVariable':
      case 'updateVariable': {
        // Variable ops are handled by the caller (variables store), not here.
        // We just count them as applied.
        appliedCount++
        break
      }

      default: {
        errors.push({ opIndex: i, op: (op as { op: string }).op, message: 'Unknown op type' })
      }
    }
  }

  return { nodes, edges, errors, appliedCount }
}

/**
 * Sanitize data values — replace NaN/Infinity with 0.
 * Prevents corrupt values from being persisted.
 */
function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'number' && !Number.isFinite(val)) {
      result[key] = 0
    } else {
      result[key] = val
    }
  }
  return result
}
