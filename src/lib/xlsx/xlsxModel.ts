/**
 * xlsxModel.ts — Pure adapter that converts an AuditModel into
 * write-excel-file SheetData arrays.
 *
 * Each exported function returns a SheetData (Row[]) and an optional
 * Columns definition. All functions are pure (no side effects, no DOM)
 * and are fully unit-testable.
 */

import type { Row, SheetData } from 'write-excel-file/browser'
import type {
  AuditModel,
  AuditDiagnosticRow,
  AuditNodeRow,
  CanvasAuditSection,
  ProjectAuditModel,
} from '../pdf/auditModel'
import type { VariablesMap } from '../variables'
import { SAFE_MAX_TABLE_ROWS, SAFE_MAX_TABLE_COLS, MAX_CELL_CHARS } from './constants'
import { sanitizeSheetName, dedupeSheetNames } from './sheetNames'

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

/** Truncate a string to MAX_CELL_CHARS if needed. */
function capCell(s: string): string {
  return s.length > MAX_CELL_CHARS ? s.slice(0, MAX_CELL_CHARS) : s
}

// ══════════════════════════════════════════════════════════════════════════════
// Project-level builders (v2 — all sheets)
// ══════════════════════════════════════════════════════════════════════════════

// ── Table export type ────────────────────────────────────────────────────────

export interface TableExport {
  canvasPosition: number
  canvasName: string
  canvasId: string
  nodeId: string
  nodeLabel: string
  columns: string[]
  rows: number[][]
  truncated: boolean
  originalRowCount: number
  originalColCount: number
}

// ── Project summary sheet ────────────────────────────────────────────────────

export function buildProjectSummarySheet(model: ProjectAuditModel): SummaryRow {
  const meta = model.meta
  const rows: SheetData = [
    headerRow(['Field', 'Value']),
    kvRow('Project Name', meta.projectName),
    kvRow('Project ID', meta.projectId ?? '(scratch)'),
    kvRow('Export Scope', meta.exportScope),
    kvRow('Export Timestamp', meta.exportTimestamp),
    kvRow('Build Version', meta.buildVersion),
    kvRow('Build SHA', meta.buildSha),
    kvRow('Build Time', meta.buildTime),
    kvRow('Build Env', meta.buildEnv),
    kvRow('Engine Version', meta.engineVersion),
    kvRow('Contract Version', String(meta.contractVersion)),
    kvRow('Total Canvases', String(meta.totalCanvases)),
    kvRow('Total Nodes', String(meta.nodeCount)),
    kvRow('Total Edges', String(meta.edgeCount)),
    kvRow('Project Hash', model.projectHash),
    kvRow('Active Canvas ID', meta.activeCanvasId ?? '(none)'),
  ]
  if (model.exportOptions) {
    kvRow('Include Images', String(model.exportOptions.includeImages))
  }
  return { data: rows, columns: [{ width: 24 }, { width: 50 }] }
}

// ── Canvases (TOC) sheet ─────────────────────────────────────────────────────

export function buildCanvasesSheet(canvases: CanvasAuditSection[]): {
  data: SheetData
  columns: Columns
} {
  const rows: SheetData = [
    headerRow(['#', 'Canvas Name', 'Canvas ID', 'Nodes', 'Edges', 'Snapshot Hash']),
  ]
  for (const c of canvases) {
    rows.push([
      { type: Number, value: c.position },
      { type: String, value: c.canvasName },
      { type: String, value: c.canvasId },
      { type: Number, value: c.nodeCount },
      { type: Number, value: c.edgeCount },
      { type: String, value: c.snapshotHash },
    ])
  }
  return {
    data: rows,
    columns: [
      { width: 6 },
      { width: 24 },
      { width: 20 },
      { width: 8 },
      { width: 8 },
      { width: 50 },
    ],
  }
}

// ── Combined Node Values sheet ───────────────────────────────────────────────

export function buildCombinedNodeValuesSheet(canvases: CanvasAuditSection[]): NodeValuesSheetData {
  const rows: SheetData = [
    headerRow([
      'Canvas #',
      'Canvas Name',
      'Node ID',
      'Label',
      'Block Type',
      'Value Kind',
      'Compact',
      'Full',
    ]),
  ]
  for (const c of canvases) {
    for (const n of c.nodeValues) {
      rows.push([
        { type: Number, value: c.position },
        { type: String, value: c.canvasName },
        { type: String, value: n.nodeId },
        { type: String, value: n.label },
        { type: String, value: n.blockType },
        { type: String, value: n.valueKind ?? '' },
        { type: String, value: capCell(n.compact) },
        { type: String, value: capCell(n.full) },
      ])
    }
  }
  return {
    data: rows,
    columns: [
      { width: 10 },
      { width: 20 },
      { width: 16 },
      { width: 20 },
      { width: 16 },
      { width: 10 },
      { width: 24 },
      { width: 40 },
    ],
  }
}

// ── Combined Diagnostics sheet ───────────────────────────────────────────────

export function buildCombinedDiagnosticsSheet(
  canvases: CanvasAuditSection[],
): DiagnosticsSheetData {
  const rows: SheetData = [
    headerRow(['Canvas #', 'Canvas Name', 'Node ID', 'Level', 'Code', 'Message']),
  ]
  for (const c of canvases) {
    for (const d of c.diagnostics) {
      rows.push([
        { type: Number, value: c.position },
        { type: String, value: c.canvasName },
        { type: String, value: d.nodeId },
        { type: String, value: d.level },
        { type: String, value: d.code },
        { type: String, value: capCell(d.message) },
      ])
    }
  }
  return {
    data: rows,
    columns: [
      { width: 10 },
      { width: 20 },
      { width: 16 },
      { width: 10 },
      { width: 16 },
      { width: 50 },
    ],
  }
}

// ── Combined Health sheet ────────────────────────────────────────────────────

export function buildCombinedHealthSheet(canvases: CanvasAuditSection[]): HealthSheetData {
  const rows: SheetData = [headerRow(['Canvas #', 'Canvas Name', 'Health Report'])]
  for (const c of canvases) {
    const lines = c.healthSummary.split('\n').filter((l) => l.trim().length > 0)
    for (const line of lines) {
      rows.push([
        { type: Number, value: c.position },
        { type: String, value: c.canvasName },
        { type: String, value: line },
      ])
    }
  }
  return {
    data: rows,
    columns: [{ width: 10 }, { width: 20 }, { width: 80 }],
  }
}

// ── Table worksheet builder ──────────────────────────────────────────────────

export function buildTableSheet(table: TableExport): { data: SheetData; columns: Columns } {
  const cols = table.columns.slice(0, SAFE_MAX_TABLE_COLS)
  const dataRows = table.rows.slice(0, SAFE_MAX_TABLE_ROWS)

  const rows: SheetData = []

  // Note row if truncated
  if (table.truncated) {
    const note = `Truncated: ${table.originalRowCount} rows × ${table.originalColCount} cols → ${dataRows.length} rows × ${cols.length} cols`
    rows.push([{ type: String, value: note, fontWeight: 'bold' as const }])
  }

  // Source info row
  rows.push([
    {
      type: String,
      value: `Source: ${table.canvasName} / ${table.nodeLabel} (${table.nodeId})`,
      fontWeight: 'bold' as const,
    },
  ])

  // Header row
  rows.push(headerRow(cols))

  // Data rows
  for (const row of dataRows) {
    rows.push(
      cols.map((_col, ci) => ({
        type: Number as NumberConstructor,
        value: row[ci] ?? 0,
      })),
    )
  }

  const columns: Columns = cols.map(() => ({ width: 14 }))
  return { data: rows, columns }
}

// ── Project workbook assembly ────────────────────────────────────────────────

export function buildProjectWorkbook(
  model: ProjectAuditModel,
  variables: VariablesMap,
  tables: TableExport[],
): XlsxWorkbook {
  const summary = buildProjectSummarySheet(model)
  const canvasesToc = buildCanvasesSheet(model.canvases)
  const vars = buildVariablesSheet(variables)
  const nodeVals = buildCombinedNodeValuesSheet(model.canvases)
  const diags = buildCombinedDiagnosticsSheet(model.canvases)
  const health = buildCombinedHealthSheet(model.canvases)

  const sheets: SheetData[] = [
    summary.data,
    canvasesToc.data,
    vars.data,
    nodeVals.data,
    diags.data,
    health.data,
  ]
  const rawNames: string[] = [
    'Summary',
    'Canvases',
    'Variables',
    'Node Values',
    'Diagnostics',
    'Graph Health',
  ]
  const cols: Columns[] = [
    summary.columns,
    canvasesToc.columns,
    vars.columns,
    nodeVals.columns,
    diags.columns,
    health.columns,
  ]

  // Table worksheets
  for (const table of tables) {
    const tableSheet = buildTableSheet(table)
    sheets.push(tableSheet.data)
    rawNames.push(sanitizeSheetName(`T_${table.canvasPosition}_${table.nodeLabel}`))
    cols.push(tableSheet.columns)
  }

  return {
    sheets,
    sheetNames: dedupeSheetNames(rawNames),
    columns: cols,
  }
}
