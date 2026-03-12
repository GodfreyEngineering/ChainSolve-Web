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
  AuditLinkedBlockRow,
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

  const sheets: SheetData[] = [summary.data, vars.data, nodeVals.data, diags.data, health.data]
  const sheetNames: string[] = [
    'Summary',
    'Variables',
    'Node Values',
    'Diagnostics',
    'Graph Health',
  ]
  const columns: Columns[] = [
    summary.columns,
    vars.columns,
    nodeVals.columns,
    diags.columns,
    health.columns,
  ]

  // ADV-07: live-linked sheet
  if (model.linkedBlocks.length > 0) {
    const linked = buildLinkedCanvasSheet(model.linkedBlocks, model.meta.projectName)
    sheets.push(linked.data)
    sheetNames.push('Linked Blocks')
    columns.push(linked.columns)
  }

  return { sheets, sheetNames, columns }
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

// ── Live-linked canvas sheet (ADV-07) ────────────────────────────────────────

/** Maps blockType to an Excel formula generator. Inputs are column-F cell refs e.g. "F3". */
const EXCEL_FORMULA: Record<string, (ins: string[]) => string> = {
  add: (ins) => `=${ins.join('+')}`,
  subtract: (ins) => `=${ins[0] ?? '0'}-${ins[1] ?? '0'}`,
  multiply: (ins) => `=${ins.join('*')}`,
  divide: (ins) => `=${ins[0] ?? '0'}/${ins[1] ?? '1'}`,
  power: (ins) => `=${ins[0] ?? '0'}^${ins[1] ?? '1'}`,
  negate: (ins) => `=-${ins[0] ?? '0'}`,
  sqrt: (ins) => `=SQRT(${ins[0] ?? '0'})`,
  abs: (ins) => `=ABS(${ins[0] ?? '0'})`,
  floor: (ins) => `=FLOOR(${ins[0] ?? '0'},1)`,
  ceil: (ins) => `=CEILING(${ins[0] ?? '0'},1)`,
  round: (ins) => `=ROUND(${ins[0] ?? '0'},0)`,
  sin: (ins) => `=SIN(${ins[0] ?? '0'})`,
  cos: (ins) => `=COS(${ins[0] ?? '0'})`,
  tan: (ins) => `=TAN(${ins[0] ?? '0'})`,
  asin: (ins) => `=ASIN(${ins[0] ?? '0'})`,
  acos: (ins) => `=ACOS(${ins[0] ?? '0'})`,
  atan: (ins) => `=ATAN(${ins[0] ?? '0'})`,
  atan2: (ins) => `=ATAN2(${ins[1] ?? '0'},${ins[0] ?? '0'})`,
  exp: (ins) => `=EXP(${ins[0] ?? '0'})`,
  ln: (ins) => `=LN(${ins[0] ?? '0'})`,
  log10: (ins) => `=LOG10(${ins[0] ?? '0'})`,
  log2: (ins) => `=LOG(${ins[0] ?? '0'},2)`,
  min: (ins) => `=MIN(${ins.join(',')})`,
  max: (ins) => `=MAX(${ins.join(',')})`,
  mod: (ins) => `=MOD(${ins[0] ?? '0'},${ins[1] ?? '1'})`,
  percentOf: (ins) => `=${ins[0] ?? '0'}*${ins[1] ?? '0'}/100`,
  reciprocal: (ins) => `=1/${ins[0] ?? '1'}`,
  sign: (ins) => `=SIGN(${ins[0] ?? '0'})`,
}

/** Category → background colour (ARGB hex without #). */
const CATEGORY_COLOUR: Record<string, string> = {
  Source: 'FFF0F9FF', // sky blue tint
  Constant: 'FFF0FFF4', // green tint
  Arithmetic: 'FFFFF7ED', // orange tint
  Trigonometry: 'FFFDF4FF', // purple tint
  Logarithm: 'FFFDF4FF',
  Statistics: 'FFFFFBEB', // amber tint
  Finance: 'FFECFDF5', // emerald tint
  Output: 'FFF8FAFC', // neutral
  Plot: 'FFF8FAFC',
  Data: 'FFEFF6FF', // blue tint
  Operation: 'FFF9FAFB',
  Annotation: 'FFFEF9C3', // yellow tint
}

/** The column letter that holds output values / formulas (1-indexed column 5 = E). */
const OUTPUT_COL = 'E'

export function buildLinkedCanvasSheet(
  linkedBlocks: AuditLinkedBlockRow[],
  canvasName: string,
): { data: SheetData; columns: Columns } {
  // First pass: assign row numbers (1-indexed, data starts at row 3 after 2 header rows)
  const nodeToRow = new Map<string, number>()
  linkedBlocks.forEach((b, i) => nodeToRow.set(b.nodeId, i + 3))

  const rows: SheetData = []

  // Title row
  rows.push([
    {
      type: String as StringConstructor,
      value: `Sheet: ${canvasName}`,
      fontWeight: 'bold' as const,
      span: 5,
    },
  ])

  // Column header row
  rows.push(
    headerRow([
      'Label',
      'Block Type',
      'Category',
      'Literal Input',
      OUTPUT_COL + ' Output / Formula',
    ]),
  )

  // Data rows
  for (const block of linkedBlocks) {
    const rowIdx = nodeToRow.get(block.nodeId)!
    const catColour = CATEGORY_COLOUR[block.category] ?? 'FFF9FAFB'
    const style = {
      backgroundColor: `#${catColour.slice(2)}` as string,
    }

    let outputCell: Row[number]

    if (block.isSource && block.literalValue !== undefined) {
      // Source node: output references the literal input cell (column D)
      outputCell = {
        type: String as StringConstructor,
        value: `=D${rowIdx}`,
        ...style,
      }
    } else {
      // Try to generate Excel formula from input row references
      const inputRefs = block.inputNodeIds
        .map((id) => nodeToRow.get(id))
        .filter((r): r is number => r !== undefined)
        .map((r) => `${OUTPUT_COL}${r}`)

      const formulaGen = EXCEL_FORMULA[block.blockType]
      if (formulaGen && inputRefs.length > 0) {
        outputCell = {
          type: String as StringConstructor,
          value: formulaGen(inputRefs),
          ...style,
        }
      } else {
        // Fallback: literal computed value
        const numVal = parseFloat(block.outputValue)
        outputCell = isNaN(numVal)
          ? { type: String as StringConstructor, value: capCell(block.outputValue), ...style }
          : { type: Number as NumberConstructor, value: numVal, ...style }
      }
    }

    rows.push([
      { type: String as StringConstructor, value: block.label, ...style },
      { type: String as StringConstructor, value: block.blockType, ...style },
      { type: String as StringConstructor, value: block.category, ...style },
      block.isSource && block.literalValue !== undefined
        ? { type: Number as NumberConstructor, value: block.literalValue, ...style }
        : { type: String as StringConstructor, value: '', ...style },
      outputCell,
    ])
  }

  return {
    data: rows,
    columns: [{ width: 22 }, { width: 18 }, { width: 14 }, { width: 16 }, { width: 28 }],
  }
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

  // Per-canvas linked sheets (ADV-07)
  for (const canvas of model.canvases) {
    if (canvas.linkedBlocks.length > 0) {
      const linked = buildLinkedCanvasSheet(canvas.linkedBlocks, canvas.canvasName)
      sheets.push(linked.data)
      rawNames.push(sanitizeSheetName(`L_${canvas.position}_${canvas.canvasName}`))
      cols.push(linked.columns)
    }
  }

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
