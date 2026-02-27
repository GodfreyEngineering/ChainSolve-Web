/**
 * auditModel.ts — Pure data model for the audit PDF report.
 *
 * Supports both single-canvas (v1) and multi-canvas (v2) export.
 * All builder functions are side-effect-free and can be unit-tested
 * without any DOM or pdf-lib dependency.
 */

import type { Node, Edge } from '@xyflow/react'
import type { Value } from '../../engine/value'
import type { EngineEvalResult, EngineDiagnostic } from '../../engine/wasm-types'
import { formatValue } from '../../engine/value'
import { formatValueFull } from '../../engine/valueFormat'

// ── Shared types ─────────────────────────────────────────────────────────────

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
  valueKind?: string
}

// ── Single-canvas model (v1) ─────────────────────────────────────────────────

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

// ── Multi-canvas types (v2) ──────────────────────────────────────────────────

export interface ExportOptions {
  includeImages: boolean
  scope: 'active' | 'project'
}

export interface CanvasAuditSection {
  canvasId: string
  canvasName: string
  position: number
  nodeCount: number
  edgeCount: number
  snapshotHash: string
  healthSummary: string
  evalElapsedMs: number
  evalPartial: boolean
  diagnosticCounts: { info: number; warning: number; error: number }
  diagnostics: AuditDiagnosticRow[]
  nodeValues: AuditNodeRow[]
  graphImageBytes: Uint8Array | null
  imageError?: string
  captureRung?: string
}

export interface ProjectAuditModel {
  meta: AuditMeta & {
    exportScope: 'project'
    totalCanvases: number
    activeCanvasId: string | null
  }
  projectHash: string
  canvases: CanvasAuditSection[]
  exportOptions?: ExportOptions
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function countDiagnostics(diagnostics: EngineDiagnostic[]) {
  const counts = { info: 0, warning: 0, error: 0 }
  for (const d of diagnostics) {
    if (d.level in counts) {
      counts[d.level as keyof typeof counts]++
    }
  }
  return counts
}

function mapDiagnostics(diagnostics: EngineDiagnostic[]): AuditDiagnosticRow[] {
  return diagnostics.map((d) => ({
    nodeId: d.nodeId ?? '',
    level: d.level,
    code: d.code,
    message: d.message,
  }))
}

function mapNodeValues(nodes: Node[], evalResult: EngineEvalResult): AuditNodeRow[] {
  const evalNodes = nodes.filter(
    (n) => (n.data as Record<string, unknown>).blockType !== '__group__',
  )
  return evalNodes.map((n) => {
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
      valueKind: raw?.kind,
    }
  })
}

function evalNodeCount(nodes: Node[]): number {
  return nodes.filter((n) => (n.data as Record<string, unknown>).blockType !== '__group__').length
}

// ── Single-canvas builder (v1, preserved) ────────────────────────────────────

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
  return {
    meta: {
      projectName: args.projectName,
      projectId: args.projectId,
      exportTimestamp: args.exportTimestamp,
      buildVersion: args.buildVersion,
      buildSha: args.buildSha,
      buildTime: args.buildTime,
      buildEnv: args.buildEnv,
      engineVersion: args.engineVersion,
      contractVersion: args.contractVersion,
      nodeCount: evalNodeCount(args.nodes),
      edgeCount: args.edges.length,
    },
    snapshotHash: args.snapshotHash,
    healthSummary: args.healthSummary,
    evalElapsedMs: args.evalResult.elapsedUs / 1000,
    evalPartial: args.evalResult.partial ?? false,
    diagnosticCounts: countDiagnostics(args.evalResult.diagnostics),
    diagnostics: mapDiagnostics(args.evalResult.diagnostics),
    nodeValues: mapNodeValues(args.nodes, args.evalResult),
  }
}

// ── Per-canvas section builder (v2) ──────────────────────────────────────────

export interface BuildCanvasSectionArgs {
  canvasId: string
  canvasName: string
  position: number
  nodes: Node[]
  edges: Edge[]
  evalResult: EngineEvalResult
  healthSummary: string
  snapshotHash: string
  graphImageBytes: Uint8Array | null
  imageError?: string
  captureRung?: string
}

export function buildCanvasAuditSection(args: BuildCanvasSectionArgs): CanvasAuditSection {
  return {
    canvasId: args.canvasId,
    canvasName: args.canvasName,
    position: args.position,
    nodeCount: evalNodeCount(args.nodes),
    edgeCount: args.edges.length,
    snapshotHash: args.snapshotHash,
    healthSummary: args.healthSummary,
    evalElapsedMs: args.evalResult.elapsedUs / 1000,
    evalPartial: args.evalResult.partial ?? false,
    diagnosticCounts: countDiagnostics(args.evalResult.diagnostics),
    diagnostics: mapDiagnostics(args.evalResult.diagnostics),
    nodeValues: mapNodeValues(args.nodes, args.evalResult),
    graphImageBytes: args.graphImageBytes,
    imageError: args.imageError,
    captureRung: args.captureRung,
  }
}

// ── Project-level model builder (v2) ─────────────────────────────────────────

export interface BuildProjectAuditModelArgs {
  projectName: string
  projectId: string | null
  exportTimestamp: string
  buildVersion: string
  buildSha: string
  buildTime: string
  buildEnv: string
  engineVersion: string
  contractVersion: number
  activeCanvasId: string | null
  projectHash: string
  canvases: CanvasAuditSection[]
  exportOptions?: ExportOptions
}

export function buildProjectAuditModel(args: BuildProjectAuditModelArgs): ProjectAuditModel {
  const totalNodes = args.canvases.reduce((sum, c) => sum + c.nodeCount, 0)
  const totalEdges = args.canvases.reduce((sum, c) => sum + c.edgeCount, 0)

  return {
    meta: {
      projectName: args.projectName,
      projectId: args.projectId,
      exportTimestamp: args.exportTimestamp,
      buildVersion: args.buildVersion,
      buildSha: args.buildSha,
      buildTime: args.buildTime,
      buildEnv: args.buildEnv,
      engineVersion: args.engineVersion,
      contractVersion: args.contractVersion,
      nodeCount: totalNodes,
      edgeCount: totalEdges,
      exportScope: 'project',
      totalCanvases: args.canvases.length,
      activeCanvasId: args.activeCanvasId,
    },
    projectHash: args.projectHash,
    canvases: [...args.canvases].sort((a, b) => a.position - b.position),
    exportOptions: args.exportOptions,
  }
}
