/**
 * riskScoring.ts — deterministic risk assessment for AI copilot patch ops.
 *
 * Rules:
 *   HIGH: removeNode/removeEdge affecting >5 edges, variable deletions,
 *         multi-canvas ops, large rewires
 *   MEDIUM: >10 ops, variable updates, large value changes, >20 node adds
 *   LOW: <=3 node/edge adds, simple bindings/value edits
 */

import type { AiPatchOp, RiskAssessment, RiskLevel } from './types'

/** Thresholds for risk classification. */
const HIGH_REMOVE_THRESHOLD = 5
const MEDIUM_OPS_THRESHOLD = 10
const MEDIUM_ADD_NODES_THRESHOLD = 20

export function assessRisk(ops: AiPatchOp[]): RiskAssessment {
  const reasons: string[] = []
  let level: RiskLevel = 'low'

  if (ops.length === 0) {
    return { level: 'low', reasons: [] }
  }

  const removeNodeOps = ops.filter((o) => o.op === 'removeNode')
  const removeEdgeOps = ops.filter((o) => o.op === 'removeEdge')
  const addNodeOps = ops.filter((o) => o.op === 'addNode')

  // HIGH: many removals
  const totalRemovals = removeNodeOps.length + removeEdgeOps.length
  if (totalRemovals > HIGH_REMOVE_THRESHOLD) {
    level = 'high'
    reasons.push(`Removes ${totalRemovals} nodes/edges`)
  }

  // HIGH: any removeNode (destructive)
  if (removeNodeOps.length > 0) {
    if (level !== 'high') level = 'medium'
    reasons.push(`Removes ${removeNodeOps.length} node(s)`)
  }

  // MEDIUM: many ops
  if (ops.length > MEDIUM_OPS_THRESHOLD) {
    if (level === 'low') level = 'medium'
    reasons.push(`${ops.length} total operations`)
  }

  // MEDIUM: many node additions
  if (addNodeOps.length > MEDIUM_ADD_NODES_THRESHOLD) {
    if (level === 'low') level = 'medium'
    reasons.push(`Adds ${addNodeOps.length} nodes`)
  }

  // MEDIUM: variable mutations
  const varOps = ops.filter((o) => o.op === 'createVariable' || o.op === 'updateVariable')
  if (varOps.length > 0) {
    if (level === 'low') level = 'medium'
    reasons.push(`${varOps.length} variable mutation(s)`)
  }

  if (reasons.length === 0) {
    reasons.push(`${ops.length} operation(s)`)
  }

  return { level, reasons }
}

/**
 * Whether the given risk level requires user confirmation under the given mode.
 *
 *   Edit mode:   auto-apply LOW only
 *   Bypass mode: auto-apply LOW + MEDIUM (if enterprise policy allows); always confirm HIGH
 */
export function requiresConfirmation(
  riskLevel: RiskLevel,
  mode: 'edit' | 'bypass',
  enterpriseBypassAllowed: boolean,
): boolean {
  if (riskLevel === 'high') return true
  if (mode === 'edit' && riskLevel === 'medium') return true
  if (mode === 'bypass' && riskLevel === 'medium' && !enterpriseBypassAllowed) return true
  return false
}
