/**
 * auditModel.ts — Pure data model for the audit PDF report.
 *
 * buildAuditModel is completely side-effect-free and can be unit-tested
 * without any DOM or pdf-lib dependency.
 */

import type { Node, Edge } from '@xyflow/react'
import type { Value } from '../../engine/value'
import type { EngineEvalResult, EngineDiagnostic } from '../../engine/wasm-types'
import { formatValue } from '../../engine/value'
import { formatValueFull } from '../../engine/valueFormat'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuditMeta {
  projectName: string
  projectId: string | null
  exportTimestamp: string
  buildVersion: string
  buildSha: string
  buildTime: string
  buildEnv: string
  engineVersion: string
  contractVersion: number
  nodeCount: number
  edgeCount: number
}

export interface AuditDiagnosticRow {
  nodeId: string
  level: string
  code: string
  message: string
}

export interface AuditNodeRow {
  nodeId: string
  label: string
  blockType: string
  compact: string
  full: string
}

export interface AuditModel {
  meta: AuditMeta
  snapshotHash: string
  healthSummary: string
  evalElapsedMs: number
  evalPartial: boolean
  diagnosticCounts: { info: number; warning: number; error: number }
  diagnostics: AuditDiagnosticRow[]
  nodeValues: AuditNodeRow[]
}

// ── Builder ──────────────────────────────────────────────────────────────────

export interface BuildAuditModelArgs {
  projectName: string
  projectId: string | null
  exportTimestamp: string
  buildVersion: string
  buildSha: string
  buildTime: string
  buildEnv: string
  engineVersion: string
  contractVersion: number
  nodes: Node[]
  edges: Edge[]
  evalResult: EngineEvalResult
  healthSummary: string
  snapshotHash: string
}

export function buildAuditModel(args: BuildAuditModelArgs): AuditModel {
  const {
    projectName,
    projectId,
    exportTimestamp,
    buildVersion,
    buildSha,
    buildTime,
    buildEnv,
    engineVersion,
    contractVersion,
    nodes,
    edges,
    evalResult,
    healthSummary,
    snapshotHash,
  } = args

  // Filter out group nodes for the value table
  const evalNodes = nodes.filter(
    (n) => (n.data as Record<string, unknown>).blockType !== '__group__',
  )

  // Diagnostic counts
  const diagnosticCounts = { info: 0, warning: 0, error: 0 }
  for (const d of evalResult.diagnostics) {
    if (d.level in diagnosticCounts) {
      diagnosticCounts[d.level as keyof typeof diagnosticCounts]++
    }
  }

  // Diagnostics table
  const diagnostics: AuditDiagnosticRow[] = evalResult.diagnostics.map((d: EngineDiagnostic) => ({
    nodeId: d.nodeId ?? '',
    level: d.level,
    code: d.code,
    message: d.message,
  }))

  // Node value table
  const nodeValues: AuditNodeRow[] = evalNodes.map((n) => {
    const data = n.data as Record<string, unknown>
    const blockType = data.blockType as string
    const label = (data.label as string) ?? blockType
    const raw = evalResult.values[n.id] as Value | undefined
    return {
      nodeId: n.id,
      label,
      blockType,
      compact: formatValue(raw),
      full: formatValueFull(raw),
    }
  })

  return {
    meta: {
      projectName,
      projectId,
      exportTimestamp,
      buildVersion,
      buildSha,
      buildTime,
      buildEnv,
      engineVersion,
      contractVersion,
      nodeCount: evalNodes.length,
      edgeCount: edges.length,
    },
    snapshotHash,
    healthSummary,
    evalElapsedMs: evalResult.elapsedUs / 1000,
    evalPartial: evalResult.partial ?? false,
    diagnosticCounts,
    diagnostics,
    nodeValues,
  }
}
