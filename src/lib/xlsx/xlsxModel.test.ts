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
} from './xlsxModel'
import { buildAuditModel } from '../pdf/auditModel'
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
