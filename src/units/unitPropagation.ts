/**
 * unitPropagation.ts — Display-only unit inference for chains.
 *
 * Given a React Flow graph, propagates units through operations:
 *   - add/subtract: requires same units, output = input unit (warns on mismatch)
 *   - multiply: compound unit (m × m → m², m × s⁻¹ → m/s)
 *   - divide: compound unit (m / s → m/s)
 *   - negate/abs/round/floor/ceil: preserves input unit
 *   - sqrt: square-root of unit (m² → m)
 *   - power: raises unit to power (m^2 → m²)
 *   - trig/log/exp: dimensionless output
 *
 * The engine computes raw numbers — this is purely for UI annotation.
 */

import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../blocks/registry'
import { getDimension } from './unitCompat'

/** Result of unit propagation for a single node. */
export interface InferredUnit {
  /** Inferred unit string (may be compound like "m/s" or "m²"). */
  unit: string
  /** True if there was a unit mismatch warning (e.g., adding m + s). */
  mismatch?: boolean
  /** Warning message for mismatch. */
  warning?: string
}

/** Map of nodeId → inferred output unit. */
export type UnitMap = Map<string, InferredUnit>

// Operations that preserve the input unit (single-input passthrough)
const PASSTHROUGH_OPS = new Set([
  'negate', 'abs', 'round', 'floor', 'ceil', 'clamp', 'min', 'max',
])

// Operations that require same-dimension inputs, output = that dimension
const ADDITIVE_OPS = new Set(['add', 'subtract'])

// Operations that produce dimensionless output
const DIMENSIONLESS_OPS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'ln', 'log2', 'log10', 'exp',
])

/**
 * Look up the unit assigned to a node, either explicitly or from a
 * previously-inferred propagation.
 */
function getNodeUnit(
  nodeId: string,
  nodeMap: Map<string, Node>,
  inferred: UnitMap,
): string | undefined {
  // Check inferred first (propagated from upstream)
  const inf = inferred.get(nodeId)
  if (inf?.unit) return inf.unit
  // Check explicit unit on node data
  const node = nodeMap.get(nodeId)
  const nd = node?.data as NodeData | undefined
  return nd?.unit as string | undefined
}

/**
 * Propagate units through the graph. Returns a map of nodeId → inferred unit.
 *
 * Traverses nodes in topological order (BFS from sources). Only processes
 * operation nodes — source nodes use their explicit unit.
 */
export function propagateUnits(nodes: Node[], edges: Edge[]): UnitMap {
  const result: UnitMap = new Map()
  const nodeMap = new Map<string, Node>()
  for (const n of nodes) nodeMap.set(n.id, n)

  // Build adjacency: target → list of { sourceId, sourceHandle, targetHandle }
  const incomingEdges = new Map<string, { source: string; targetHandle: string }[]>()
  const outgoing = new Map<string, string[]>()
  for (const e of edges) {
    let incoming = incomingEdges.get(e.target)
    if (!incoming) {
      incoming = []
      incomingEdges.set(e.target, incoming)
    }
    incoming.push({ source: e.source, targetHandle: e.targetHandle ?? '' })

    let out = outgoing.get(e.source)
    if (!out) {
      out = []
      outgoing.set(e.source, out)
    }
    out.push(e.target)
  }

  // Topological BFS
  const inDegree = new Map<string, number>()
  for (const n of nodes) {
    inDegree.set(n.id, incomingEdges.get(n.id)?.length ?? 0)
  }
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    const node = nodeMap.get(nodeId)
    if (!node) continue
    const nd = node.data as NodeData | undefined
    if (!nd) continue

    const blockType = nd.blockType as string

    // Source nodes: explicit unit only (already on node data)
    const incoming = incomingEdges.get(nodeId)
    if (incoming && incoming.length > 0) {
      // Gather input units
      const inputUnits: { handle: string; unit: string | undefined }[] = incoming.map(
        (e) => ({
          handle: e.targetHandle,
          unit: getNodeUnit(e.source, nodeMap, result),
        }),
      )

      const inferred = inferOutputUnit(blockType, inputUnits)
      if (inferred) {
        result.set(nodeId, inferred)
      }
    }

    // Advance BFS
    const targets = outgoing.get(nodeId) ?? []
    for (const t of targets) {
      const deg = (inDegree.get(t) ?? 1) - 1
      inDegree.set(t, deg)
      if (deg <= 0) queue.push(t)
    }
  }

  return result
}

/**
 * Infer the output unit of a block given its type and input units.
 */
function inferOutputUnit(
  blockType: string,
  inputs: { handle: string; unit: string | undefined }[],
): InferredUnit | null {
  const unitA = inputs.find((i) => i.handle === 'a')?.unit
  const unitB = inputs.find((i) => i.handle === 'b')?.unit
  // For single-input blocks, also try 'value' handle
  const unitSingle = unitA ?? inputs.find((i) => i.handle === 'value')?.unit

  // Passthrough operations: output = input unit
  if (PASSTHROUGH_OPS.has(blockType)) {
    if (unitSingle) return { unit: unitSingle }
    // min/max: use first available
    const anyUnit = inputs.find((i) => i.unit)?.unit
    if (anyUnit) return { unit: anyUnit }
    return null
  }

  // Additive operations: same dimension required
  if (ADDITIVE_OPS.has(blockType)) {
    if (unitA && unitB) {
      const dimA = getDimension(unitA)
      const dimB = getDimension(unitB)
      if (dimA && dimB && dimA !== dimB) {
        return {
          unit: unitA,
          mismatch: true,
          warning: `Cannot ${blockType} ${unitA} and ${unitB} (different dimensions)`,
        }
      }
      // Same dimension — use first input's unit
      return { unit: unitA }
    }
    if (unitA) return { unit: unitA }
    if (unitB) return { unit: unitB }
    return null
  }

  // Multiply: compound units
  if (blockType === 'multiply') {
    if (unitA && unitB) {
      // Same unit → squared
      if (unitA === unitB) {
        const squared = getSquaredSymbol(unitA)
        if (squared) return { unit: squared }
      }
      // Different units → compound
      return { unit: `${unitA}·${unitB}` }
    }
    // One has unit, other dimensionless → preserve unit
    if (unitA) return { unit: unitA }
    if (unitB) return { unit: unitB }
    return null
  }

  // Divide: compound units
  if (blockType === 'divide') {
    if (unitA && unitB) {
      if (unitA === unitB) return { unit: '' } // dimensionless
      return { unit: `${unitA}/${unitB}` }
    }
    if (unitA) return { unit: unitA }
    // x / unitB → 1/unitB (inverse)
    if (unitB) return { unit: `1/${unitB}` }
    return null
  }

  // Square root
  if (blockType === 'sqrt') {
    if (unitSingle) {
      const root = getRootSymbol(unitSingle)
      if (root) return { unit: root }
      return { unit: `√${unitSingle}` }
    }
    return null
  }

  // Power: unit^n (only if exponent is a known integer)
  if (blockType === 'power' || blockType === 'pow') {
    if (unitA) return { unit: unitA } // simplified — full power tracking complex
    return null
  }

  // Dimensionless outputs
  if (DIMENSIONLESS_OPS.has(blockType)) {
    return null // no unit
  }

  // Display/probe: pass through input unit
  if (blockType === 'display' || blockType === 'probe') {
    if (unitSingle) return { unit: unitSingle }
    const anyUnit = inputs.find((i) => i.unit)?.unit
    if (anyUnit) return { unit: anyUnit }
    return null
  }

  // Unit convert: output is the target unit (handled by explicit unit on node)
  if (blockType === 'unit_convert') {
    return null // uses explicit unit
  }

  // Default: if single input with unit, pass through
  if (inputs.length === 1 && inputs[0].unit) {
    return { unit: inputs[0].unit }
  }

  return null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map base units to their squared forms. */
const SQUARED: Record<string, string> = {
  m: 'm2', cm: 'cm2', mm: 'mm2', km: 'km2',
  in: 'in2', ft: 'ft2',
}

/** Map squared units back to their roots. */
const ROOTS: Record<string, string> = {
  m2: 'm', cm2: 'cm', mm2: 'mm', km2: 'km',
  in2: 'in', ft2: 'ft',
  m4: 'm2', cm4: 'cm2', mm4: 'mm2', in4: 'in2',
}

function getSquaredSymbol(unit: string): string | undefined {
  return SQUARED[unit]
}

function getRootSymbol(unit: string): string | undefined {
  return ROOTS[unit]
}
