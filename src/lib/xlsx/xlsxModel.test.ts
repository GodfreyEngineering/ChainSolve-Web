/**
 * Unit tests for XLSX model adapter (xlsxModel.ts).
 *
 * Run with: npm run test:unit
 */

import { describe, it, expect } from 'vitest'
import {
  buildSummarySheet,
  buildVariablesSheet,
  buildNodeValuesSheet,
  buildDiagnosticsSheet,
  buildHealthSheet,
  buildAuditWorkbook,
  buildProjectSummarySheet,
  buildCanvasesSheet,
  buildCombinedNodeValuesSheet,
  buildCombinedDiagnosticsSheet,
  buildCombinedHealthSheet,
  buildTableSheet,
  buildProjectWorkbook,
  type TableExport,
} from './xlsxModel'
import { sanitizeSheetName, dedupeSheetNames } from './sheetNames'
import { buildAuditModel, buildCanvasAuditSection, buildProjectAuditModel } from '../pdf/auditModel'
import type { EngineEvalResult } from '../../engine/wasm-types'

// ── Shared fixtures ──────────────────────────────────────────────────────────

const fakeNodes = [
  {
    id: 'n1',
    type: 'csSource',
    position: { x: 0, y: 0 },
    data: { blockType: 'number', label: 'Input A', value: 5 },
  },
  {
    id: 'n2',
    type: 'csOperation',
    position: { x: 200, y: 0 },
    data: { blockType: 'add', label: 'Add' },
  },
  {
    id: 'g1',
    type: 'csGroup',
    position: { x: 0, y: 0 },
    data: { blockType: '__group__', label: 'Group 1' },
  },
]

const fakeEdges = [
  { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n2', targetHandle: 'in' },
]

const fakeEvalResult: EngineEvalResult = {
  values: {
    n1: { kind: 'scalar', value: 5 },
    n2: { kind: 'scalar', value: 10 },
  },
  diagnostics: [
    { nodeId: 'n2', level: 'warning', code: 'W001', message: 'Test warning' },
    { level: 'info', code: 'I001', message: 'Test info' },
  ],
  elapsedUs: 1234,
  partial: false,
}

function makeModel() {
  return buildAuditModel({
    projectName: 'Test Project',
    projectId: 'proj-123',
    exportTimestamp: '2026-02-27T12:00:00Z',
    buildVersion: '1.0.0',
    buildSha: 'abc1234',
    buildTime: '2026-02-27T10:00:00Z',
    buildEnv: 'test',
    engineVersion: '0.1.0',
    contractVersion: 1,
    nodes: fakeNodes as Parameters<typeof buildAuditModel>[0]['nodes'],
    edges: fakeEdges,
    evalResult: fakeEvalResult,
    healthSummary: 'Nodes: 2\nEdges: 1\nOrphans: 0',
    snapshotHash: 'deadbeefcafe',
  })
}

const fakeVariables = {
  v1: { id: 'v1', name: 'alpha', value: 3.14, description: 'Pi approx' },
  v2: { id: 'v2', name: 'beta', value: 42 },
}

// ── buildSummarySheet ────────────────────────────────────────────────────────

describe('buildSummarySheet', () => {
  it('produces a header row + 18 key-value rows', () => {
    const model = makeModel()
    const { data, columns } = buildSummarySheet(model)
    // header + 17 KV rows
    expect(data).toHaveLength(18)
    expect(columns).toHaveLength(2)
  })

  it('header row has bold styling', () => {
    const { data } = buildSummarySheet(makeModel())
    const header = data[0]!
    expect(header[0]).toMatchObject({ value: 'Field', fontWeight: 'bold' })
    expect(header[1]).toMatchObject({ value: 'Value', fontWeight: 'bold' })
  })

  it('includes project name in data', () => {
    const { data } = buildSummarySheet(makeModel())
    const nameRow = data[1]!
    expect(nameRow[1]).toMatchObject({ value: 'Test Project' })
  })

  it('includes snapshot hash', () => {
    const { data } = buildSummarySheet(makeModel())
    const hashRow = data.find(
      (row) =>
        Array.isArray(row) &&
        row[0] &&
        typeof row[0] === 'object' &&
        'value' in row[0] &&
        row[0].value === 'Snapshot Hash',
    )
    expect(hashRow).toBeDefined()
    expect(hashRow![1]).toMatchObject({ value: 'deadbeefcafe' })
  })
})

// ── buildVariablesSheet ──────────────────────────────────────────────────────

describe('buildVariablesSheet', () => {
  it('produces header + sorted variable rows', () => {
    const { data, columns } = buildVariablesSheet(fakeVariables)
    // header + 2 variables
    expect(data).toHaveLength(3)
    expect(columns).toHaveLength(4)
  })

  it('sorts variables alphabetically by name', () => {
    const { data } = buildVariablesSheet(fakeVariables)
    // alpha < beta
    const row1 = data[1]!
    const row2 = data[2]!
    expect(row1[1]).toMatchObject({ value: 'alpha' })
    expect(row2[1]).toMatchObject({ value: 'beta' })
  })

  it('uses Number type for value column', () => {
    const { data } = buildVariablesSheet(fakeVariables)
    const row1 = data[1]!
    expect(row1[2]).toMatchObject({ type: Number, value: 3.14 })
  })

  it('handles empty variables', () => {
    const { data } = buildVariablesSheet({})
    expect(data).toHaveLength(1) // header only
  })
})

// ── buildNodeValuesSheet ─────────────────────────────────────────────────────

describe('buildNodeValuesSheet', () => {
  it('produces header + node rows (excludes groups)', () => {
    const model = makeModel()
    const { data, columns } = buildNodeValuesSheet(model.nodeValues)
    // header + 2 eval nodes (group excluded by model builder)
    expect(data).toHaveLength(3)
    expect(columns).toHaveLength(5)
  })

  it('includes node ID and label', () => {
    const model = makeModel()
    const { data } = buildNodeValuesSheet(model.nodeValues)
    expect(data[1]![0]).toMatchObject({ value: 'n1' })
    expect(data[1]![1]).toMatchObject({ value: 'Input A' })
  })
})

// ── buildDiagnosticsSheet ────────────────────────────────────────────────────

describe('buildDiagnosticsSheet', () => {
  it('produces header + diagnostic rows', () => {
    const model = makeModel()
    const { data, columns } = buildDiagnosticsSheet(model.diagnostics)
    // header + 2 diagnostics
    expect(data).toHaveLength(3)
    expect(columns).toHaveLength(4)
  })

  it('handles empty diagnostics', () => {
    const { data } = buildDiagnosticsSheet([])
    expect(data).toHaveLength(1) // header only
  })

  it('includes level and message', () => {
    const model = makeModel()
    const { data } = buildDiagnosticsSheet(model.diagnostics)
    expect(data[1]![1]).toMatchObject({ value: 'warning' })
    expect(data[1]![3]).toMatchObject({ value: 'Test warning' })
  })
})

// ── buildHealthSheet ─────────────────────────────────────────────────────────

describe('buildHealthSheet', () => {
  it('splits health summary into rows', () => {
    const { data, columns } = buildHealthSheet('Nodes: 2\nEdges: 1\nOrphans: 0')
    // header + 3 lines
    expect(data).toHaveLength(4)
    expect(columns).toHaveLength(1)
  })

  it('skips blank lines', () => {
    const { data } = buildHealthSheet('Line 1\n\n\nLine 2')
    expect(data).toHaveLength(3) // header + 2 non-blank
  })
})

// ── buildAuditWorkbook ───────────────────────────────────────────────────────

describe('buildAuditWorkbook', () => {
  it('produces 5 sheets with correct names', () => {
    const model = makeModel()
    const wb = buildAuditWorkbook(model, fakeVariables)
    expect(wb.sheets).toHaveLength(5)
    expect(wb.sheetNames).toEqual([
      'Summary',
      'Variables',
      'Node Values',
      'Diagnostics',
      'Graph Health',
    ])
    expect(wb.columns).toHaveLength(5)
  })

  it('each sheet has data with at least a header row', () => {
    const model = makeModel()
    const wb = buildAuditWorkbook(model, fakeVariables)
    for (const sheet of wb.sheets) {
      expect(sheet.length).toBeGreaterThanOrEqual(1)
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// W14b.2 — Sheet name helpers
// ══════════════════════════════════════════════════════════════════════════════

describe('sanitizeSheetName', () => {
  it('removes forbidden characters', () => {
    expect(sanitizeSheetName('Sales [Q1]: 2026')).toBe('Sales Q1 2026')
  })

  it('truncates to 31 characters', () => {
    const long = 'A'.repeat(40)
    expect(sanitizeSheetName(long)).toHaveLength(31)
  })

  it('collapses whitespace', () => {
    expect(sanitizeSheetName('  hello   world  ')).toBe('hello world')
  })

  it('returns "Sheet" for empty input', () => {
    expect(sanitizeSheetName('')).toBe('Sheet')
    expect(sanitizeSheetName('***')).toBe('Sheet')
  })

  it('handles mixed forbidden chars', () => {
    expect(sanitizeSheetName('a\\b/c*d[e]f:g?h')).toBe('abcdefgh')
  })
})

describe('dedupeSheetNames', () => {
  it('returns names unchanged when unique', () => {
    expect(dedupeSheetNames(['A', 'B', 'C'])).toEqual(['A', 'B', 'C'])
  })

  it('appends (2), (3) for duplicates', () => {
    expect(dedupeSheetNames(['Sheet', 'Sheet', 'Sheet'])).toEqual([
      'Sheet',
      'Sheet (2)',
      'Sheet (3)',
    ])
  })

  it('is case-insensitive', () => {
    const result = dedupeSheetNames(['Test', 'test', 'TEST'])
    expect(result[0]).toBe('Test')
    expect(result[1]).toBe('test (2)')
    expect(result[2]).toBe('TEST (3)')
  })

  it('respects 31-char limit with suffix', () => {
    const longName = 'A'.repeat(31)
    const result = dedupeSheetNames([longName, longName])
    expect(result[1]!.length).toBeLessThanOrEqual(31)
    expect(result[1]).toContain(' (2)')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// W14b.2 — Project-level builders
// ══════════════════════════════════════════════════════════════════════════════

// ── Project fixture helpers ─────────────────────────────────────────────────

function makeCanvasSection(position: number, name: string) {
  return buildCanvasAuditSection({
    canvasId: `canvas-${position}`,
    canvasName: name,
    position,
    nodes: fakeNodes as Parameters<typeof buildCanvasAuditSection>[0]['nodes'],
    edges: fakeEdges,
    evalResult: fakeEvalResult,
    healthSummary: `Nodes: 2\nEdges: 1`,
    snapshotHash: `hash-${position}`,
    graphImageBytes: null,
  })
}

function makeProjectModel() {
  const canvases = [makeCanvasSection(1, 'Sheet 1'), makeCanvasSection(2, 'Sheet 2')]
  return buildProjectAuditModel({
    projectName: 'Test Project',
    projectId: 'proj-123',
    exportTimestamp: '2026-02-27T12:00:00Z',
    buildVersion: '1.0.0',
    buildSha: 'abc1234',
    buildTime: '2026-02-27T10:00:00Z',
    buildEnv: 'test',
    engineVersion: '0.1.0',
    contractVersion: 1,
    activeCanvasId: 'canvas-1',
    projectHash: 'projecthash123',
    canvases,
  })
}

const fakeTable: TableExport = {
  canvasPosition: 1,
  canvasName: 'Sheet 1',
  canvasId: 'canvas-1',
  nodeId: 'n-tbl',
  nodeLabel: 'My Table',
  columns: ['A', 'B', 'C'],
  rows: [
    [1, 2, 3],
    [4, 5, 6],
  ],
  truncated: false,
  originalRowCount: 2,
  originalColCount: 3,
}

// ── buildProjectSummarySheet ────────────────────────────────────────────────

describe('buildProjectSummarySheet', () => {
  it('produces header + project-level KV rows', () => {
    const model = makeProjectModel()
    const { data, columns } = buildProjectSummarySheet(model)
    expect(data.length).toBeGreaterThanOrEqual(15)
    expect(columns).toHaveLength(2)
  })

  it('includes export scope field', () => {
    const { data } = buildProjectSummarySheet(makeProjectModel())
    const scopeRow = data.find(
      (row) =>
        Array.isArray(row) &&
        row[0] &&
        typeof row[0] === 'object' &&
        'value' in row[0] &&
        row[0].value === 'Export Scope',
    )
    expect(scopeRow).toBeDefined()
    expect(scopeRow![1]).toMatchObject({ value: 'project' })
  })

  it('includes total canvases', () => {
    const { data } = buildProjectSummarySheet(makeProjectModel())
    const row = data.find(
      (r) =>
        Array.isArray(r) &&
        r[0] &&
        typeof r[0] === 'object' &&
        'value' in r[0] &&
        r[0].value === 'Total Canvases',
    )
    expect(row).toBeDefined()
    expect(row![1]).toMatchObject({ value: '2' })
  })
})

// ── buildCanvasesSheet ──────────────────────────────────────────────────────

describe('buildCanvasesSheet', () => {
  it('produces header + one row per canvas', () => {
    const model = makeProjectModel()
    const { data, columns } = buildCanvasesSheet(model.canvases)
    // header + 2 canvases
    expect(data).toHaveLength(3)
    expect(columns).toHaveLength(6)
  })

  it('includes canvas name and position', () => {
    const model = makeProjectModel()
    const { data } = buildCanvasesSheet(model.canvases)
    expect(data[1]![0]).toMatchObject({ value: 1 })
    expect(data[1]![1]).toMatchObject({ value: 'Sheet 1' })
  })
})

// ── buildCombinedNodeValuesSheet ────────────────────────────────────────────

describe('buildCombinedNodeValuesSheet', () => {
  it('merges node values from all canvases', () => {
    const model = makeProjectModel()
    const { data } = buildCombinedNodeValuesSheet(model.canvases)
    // header + 2 nodes per canvas × 2 canvases = 5
    expect(data).toHaveLength(5)
  })

  it('includes canvas position and name columns', () => {
    const model = makeProjectModel()
    const { data, columns } = buildCombinedNodeValuesSheet(model.canvases)
    expect(columns).toHaveLength(8) // 2 prefix + 6 data
    // First data row should have canvas position
    expect(data[1]![0]).toMatchObject({ value: 1 })
    expect(data[1]![1]).toMatchObject({ value: 'Sheet 1' })
  })
})

// ── buildCombinedDiagnosticsSheet ───────────────────────────────────────────

describe('buildCombinedDiagnosticsSheet', () => {
  it('merges diagnostics from all canvases', () => {
    const model = makeProjectModel()
    const { data } = buildCombinedDiagnosticsSheet(model.canvases)
    // header + 2 diagnostics per canvas × 2 canvases = 5
    expect(data).toHaveLength(5)
  })

  it('has 6 columns (2 prefix + 4 data)', () => {
    const model = makeProjectModel()
    const { columns } = buildCombinedDiagnosticsSheet(model.canvases)
    expect(columns).toHaveLength(6)
  })
})

// ── buildCombinedHealthSheet ────────────────────────────────────────────────

describe('buildCombinedHealthSheet', () => {
  it('merges health lines from all canvases', () => {
    const model = makeProjectModel()
    const { data } = buildCombinedHealthSheet(model.canvases)
    // header + 2 lines per canvas ("Nodes: 2", "Edges: 1") × 2 canvases = 5
    expect(data).toHaveLength(5)
  })

  it('has 3 columns', () => {
    const model = makeProjectModel()
    const { columns } = buildCombinedHealthSheet(model.canvases)
    expect(columns).toHaveLength(3)
  })
})

// ── buildTableSheet ─────────────────────────────────────────────────────────

describe('buildTableSheet', () => {
  it('produces source info + header + data rows', () => {
    const { data } = buildTableSheet(fakeTable)
    // source row + header + 2 data rows = 4
    expect(data).toHaveLength(4)
  })

  it('includes truncation note row when truncated', () => {
    const truncated: TableExport = {
      ...fakeTable,
      truncated: true,
      originalRowCount: 300000,
      originalColCount: 600,
    }
    const { data } = buildTableSheet(truncated)
    // note + source + header + 2 data = 5
    expect(data).toHaveLength(5)
    const note = data[0]![0]
    expect(note).toMatchObject({ fontWeight: 'bold' })
    expect((note as { value: string }).value).toContain('Truncated')
  })

  it('uses Number type for data cells', () => {
    const { data } = buildTableSheet(fakeTable)
    // Last row, first cell
    const lastRow = data[data.length - 1]!
    expect(lastRow[0]).toMatchObject({ type: Number, value: 4 })
  })

  it('generates columns matching table column count', () => {
    const { columns } = buildTableSheet(fakeTable)
    expect(columns).toHaveLength(3)
  })
})

// ── buildProjectWorkbook ────────────────────────────────────────────────────

describe('buildProjectWorkbook', () => {
  it('produces 6 fixed sheets + table sheets', () => {
    const model = makeProjectModel()
    const wb = buildProjectWorkbook(model, fakeVariables, [fakeTable])
    expect(wb.sheets).toHaveLength(7) // 6 fixed + 1 table
    expect(wb.sheetNames).toHaveLength(7)
    expect(wb.columns).toHaveLength(7)
  })

  it('has correct fixed sheet names', () => {
    const model = makeProjectModel()
    const wb = buildProjectWorkbook(model, fakeVariables, [])
    expect(wb.sheetNames.slice(0, 6)).toEqual([
      'Summary',
      'Canvases',
      'Variables',
      'Node Values',
      'Diagnostics',
      'Graph Health',
    ])
  })

  it('table sheet names use T_{pos}_{label} pattern', () => {
    const model = makeProjectModel()
    const wb = buildProjectWorkbook(model, fakeVariables, [fakeTable])
    expect(wb.sheetNames[6]).toBe('T_1_My Table')
  })

  it('deduplicates table sheet names', () => {
    const model = makeProjectModel()
    const table2: TableExport = { ...fakeTable, nodeId: 'n-tbl2' }
    const wb = buildProjectWorkbook(model, fakeVariables, [fakeTable, table2])
    expect(wb.sheetNames[6]).toBe('T_1_My Table')
    expect(wb.sheetNames[7]).toBe('T_1_My Table (2)')
  })

  it('works with zero tables', () => {
    const model = makeProjectModel()
    const wb = buildProjectWorkbook(model, fakeVariables, [])
    expect(wb.sheets).toHaveLength(6)
    expect(wb.sheetNames).toHaveLength(6)
  })
})
