/**
 * xlsxModel.ts — Pure adapter that converts an AuditModel into
 * write-excel-file SheetData arrays.
 *
 * Each exported function returns a SheetData (Row[]) and an optional
 * Columns definition. All functions are pure (no side effects, no DOM)
 * and are fully unit-testable.
 */

import type { Row, SheetData } from 'write-excel-file/browser'
import type { AuditModel, AuditDiagnosticRow, AuditNodeRow } from '../pdf/auditModel'

/** Column definition compatible with write-excel-file. */
type Columns = { width?: number }[]

// ── Style constants ──────────────────────────────────────────────────────────

const HEADER_STYLE = {
  fontWeight: 'bold' as const,
  backgroundColor: '#1CABB0',
  color: '#FFFFFF',
}

// ── Summary sheet ────────────────────────────────────────────────────────────

export interface SummaryRow {
  data: SheetData
  columns: Columns
}

export function buildSummarySheet(model: AuditModel): SummaryRow {
  const meta = model.meta
  const rows: SheetData = [
    headerRow(['Field', 'Value']),
    kvRow('Project Name', meta.projectName),
    kvRow('Project ID', meta.projectId ?? '(scratch)'),
    kvRow('Export Timestamp', meta.exportTimestamp),
    kvRow('Build Version', meta.buildVersion),
    kvRow('Build SHA', meta.buildSha),
    kvRow('Build Time', meta.buildTime),
    kvRow('Build Env', meta.buildEnv),
    kvRow('Engine Version', meta.engineVersion),
    kvRow('Contract Version', String(meta.contractVersion)),
    kvRow('Node Count', String(meta.nodeCount)),
    kvRow('Edge Count', String(meta.edgeCount)),
    kvRow('Snapshot Hash', model.snapshotHash),
    kvRow('Eval Elapsed (ms)', String(model.evalElapsedMs)),
    kvRow('Eval Partial', String(model.evalPartial)),
    kvRow('Diagnostics (info)', String(model.diagnosticCounts.info)),
    kvRow('Diagnostics (warning)', String(model.diagnosticCounts.warning)),
    kvRow('Diagnostics (error)', String(model.diagnosticCounts.error)),
  ]
  return { data: rows, columns: [{ width: 24 }, { width: 50 }] }
}

// ── Variables sheet ──────────────────────────────────────────────────────────

export interface VariablesSheetData {
  data: SheetData
  columns: Columns
}

export function buildVariablesSheet(
  variables: Record<string, { id: string; name: string; value: number; description?: string }>,
): VariablesSheetData {
  const rows: SheetData = [headerRow(['ID', 'Name', 'Value', 'Description'])]
  const sorted = Object.values(variables).sort((a, b) => a.name.localeCompare(b.name))
  for (const v of sorted) {
    rows.push([
      { type: String, value: v.id },
      { type: String, value: v.name },
      { type: Number, value: v.value },
      { type: String, value: v.description ?? '' },
    ])
  }
  return { data: rows, columns: [{ width: 20 }, { width: 20 }, { width: 14 }, { width: 36 }] }
}

// ── Node Values sheet ────────────────────────────────────────────────────────

export interface NodeValuesSheetData {
  data: SheetData
  columns: Columns
}

export function buildNodeValuesSheet(nodeValues: AuditNodeRow[]): NodeValuesSheetData {
  const rows: SheetData = [headerRow(['Node ID', 'Label', 'Block Type', 'Compact', 'Full'])]
  for (const n of nodeValues) {
    rows.push([
      { type: String, value: n.nodeId },
      { type: String, value: n.label },
      { type: String, value: n.blockType },
      { type: String, value: n.compact },
      { type: String, value: n.full },
    ])
  }
  return {
    data: rows,
    columns: [{ width: 16 }, { width: 20 }, { width: 16 }, { width: 24 }, { width: 40 }],
  }
}

// ── Diagnostics sheet ────────────────────────────────────────────────────────

export interface DiagnosticsSheetData {
  data: SheetData
  columns: Columns
}

export function buildDiagnosticsSheet(diagnostics: AuditDiagnosticRow[]): DiagnosticsSheetData {
  const rows: SheetData = [headerRow(['Node ID', 'Level', 'Code', 'Message'])]
  for (const d of diagnostics) {
    rows.push([
      { type: String, value: d.nodeId },
      { type: String, value: d.level },
      { type: String, value: d.code },
      { type: String, value: d.message },
    ])
  }
  return {
    data: rows,
    columns: [{ width: 16 }, { width: 10 }, { width: 16 }, { width: 50 }],
  }
}

// ── Graph Health sheet ───────────────────────────────────────────────────────

export interface HealthSheetData {
  data: SheetData
  columns: Columns
}

export function buildHealthSheet(healthSummary: string): HealthSheetData {
  const lines = healthSummary.split('\n').filter((l) => l.trim().length > 0)
  const rows: SheetData = [headerRow(['Health Report'])]
  for (const line of lines) {
    rows.push([{ type: String, value: line }])
  }
  return { data: rows, columns: [{ width: 80 }] }
}

// ── Full workbook assembly ───────────────────────────────────────────────────

export interface XlsxWorkbook {
  sheets: SheetData[]
  sheetNames: string[]
  columns: Columns[]
}

export function buildAuditWorkbook(
  model: AuditModel,
  variables: Record<string, { id: string; name: string; value: number; description?: string }>,
): XlsxWorkbook {
  const summary = buildSummarySheet(model)
  const vars = buildVariablesSheet(variables)
  const nodeVals = buildNodeValuesSheet(model.nodeValues)
  const diags = buildDiagnosticsSheet(model.diagnostics)
  const health = buildHealthSheet(model.healthSummary)

  return {
    sheets: [summary.data, vars.data, nodeVals.data, diags.data, health.data],
    sheetNames: ['Summary', 'Variables', 'Node Values', 'Diagnostics', 'Graph Health'],
    columns: [summary.columns, vars.columns, nodeVals.columns, diags.columns, health.columns],
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function headerRow(labels: string[]): Row {
  return labels.map((label) => ({
    type: String as StringConstructor,
    value: label,
    ...HEADER_STYLE,
  }))
}

function kvRow(field: string, value: string): Row {
  return [
    { type: String, value: field, fontWeight: 'bold' as const },
    { type: String, value },
  ]
}
