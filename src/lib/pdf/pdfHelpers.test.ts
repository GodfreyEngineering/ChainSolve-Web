/**
 * Unit tests for PDF export pure helpers.
 *
 * Run with: npm run test:unit
 */

import { describe, it, expect } from 'vitest'
import { stableStringify } from './stableStringify'
import { sha256Hex } from './sha256'
import { buildAuditModel, buildCanvasAuditSection, buildProjectAuditModel } from './auditModel'
import type { EngineEvalResult } from '../../engine/wasm-types'

// ── stableStringify ──────────────────────────────────────────────────────────

describe('stableStringify', () => {
  it('sorts object keys deterministically', () => {
    const a = stableStringify({ z: 1, a: 2, m: 3 })
    const b = stableStringify({ a: 2, m: 3, z: 1 })
    expect(a).toBe(b)
    expect(a).toBe('{"a":2,"m":3,"z":1}')
  })

  it('sorts nested object keys', () => {
    const result = stableStringify({ b: { y: 1, x: 2 }, a: 3 })
    expect(result).toBe('{"a":3,"b":{"x":2,"y":1}}')
  })

  it('preserves array order', () => {
    const result = stableStringify([3, 1, 2])
    expect(result).toBe('[3,1,2]')
  })

  it('handles null and primitives', () => {
    expect(stableStringify(null)).toBe('null')
    expect(stableStringify(42)).toBe('42')
    expect(stableStringify('hello')).toBe('"hello"')
    expect(stableStringify(true)).toBe('true')
  })

  it('handles empty objects and arrays', () => {
    expect(stableStringify({})).toBe('{}')
    expect(stableStringify([])).toBe('[]')
  })

  it('is deterministic for identical inputs', () => {
    const obj = { nodes: [{ id: 'a', data: { x: 1, y: 2 } }], edges: [] }
    const r1 = stableStringify(obj)
    const r2 = stableStringify(obj)
    expect(r1).toBe(r2)
  })
})

// ── sha256Hex ────────────────────────────────────────────────────────────────

describe('sha256Hex', () => {
  it('produces a 64-char hex string', async () => {
    const hash = await sha256Hex('hello')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('returns known hash for known input', async () => {
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const hash = await sha256Hex('hello')
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('produces stable output for the same input', async () => {
    const input = stableStringify({ a: 1, b: [2, 3] })
    const h1 = await sha256Hex(input)
    const h2 = await sha256Hex(input)
    expect(h1).toBe(h2)
  })

  it('produces different hash for different input', async () => {
    const h1 = await sha256Hex('hello')
    const h2 = await sha256Hex('world')
    expect(h1).not.toBe(h2)
  })
})

// ── buildAuditModel ──────────────────────────────────────────────────────────

describe('buildAuditModel', () => {
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

  it('excludes group nodes from node values', () => {
    const model = buildAuditModel({
      projectName: 'Test Project',
      projectId: 'proj-123',
      exportTimestamp: '2026-02-27T12:00:00Z',
      buildVersion: '1.0.0',
      buildSha: 'abc1234',
      buildTime: '2026-02-27T00:00:00Z',
      buildEnv: 'test',
      engineVersion: '0.5.0',
      contractVersion: 3,
      nodes: fakeNodes as never,
      edges: fakeEdges as never,
      evalResult: fakeEvalResult,
      healthSummary: 'Nodes: 2\nEdges: 1',
      snapshotHash: 'deadbeef',
    })

    // Group node excluded — only n1 and n2
    expect(model.nodeValues).toHaveLength(2)
    expect(model.nodeValues.map((nv) => nv.nodeId)).toEqual(['n1', 'n2'])
  })

  it('counts diagnostics by level', () => {
    const model = buildAuditModel({
      projectName: 'Test',
      projectId: null,
      exportTimestamp: '2026-02-27T12:00:00Z',
      buildVersion: '1.0.0',
      buildSha: 'abc',
      buildTime: '2026-02-27',
      buildEnv: 'test',
      engineVersion: '0.5.0',
      contractVersion: 3,
      nodes: fakeNodes as never,
      edges: fakeEdges as never,
      evalResult: fakeEvalResult,
      healthSummary: '',
      snapshotHash: 'deadbeef',
    })

    expect(model.diagnosticCounts).toEqual({ info: 1, warning: 1, error: 0 })
    expect(model.diagnostics).toHaveLength(2)
  })

  it('computes elapsed ms from microseconds', () => {
    const model = buildAuditModel({
      projectName: 'Test',
      projectId: null,
      exportTimestamp: '2026-02-27T12:00:00Z',
      buildVersion: '1.0.0',
      buildSha: 'abc',
      buildTime: '2026-02-27',
      buildEnv: 'test',
      engineVersion: '0.5.0',
      contractVersion: 3,
      nodes: fakeNodes as never,
      edges: fakeEdges as never,
      evalResult: fakeEvalResult,
      healthSummary: '',
      snapshotHash: 'deadbeef',
    })

    expect(model.evalElapsedMs).toBeCloseTo(1.234)
  })

  it('populates meta fields correctly', () => {
    const model = buildAuditModel({
      projectName: 'My Project',
      projectId: 'proj-456',
      exportTimestamp: '2026-02-27T12:00:00Z',
      buildVersion: '2.0.0',
      buildSha: 'def5678',
      buildTime: '2026-02-27T08:00:00Z',
      buildEnv: 'production',
      engineVersion: '1.0.0',
      contractVersion: 5,
      nodes: fakeNodes as never,
      edges: fakeEdges as never,
      evalResult: fakeEvalResult,
      healthSummary: 'OK',
      snapshotHash: 'cafe0000',
    })

    expect(model.meta.projectName).toBe('My Project')
    expect(model.meta.projectId).toBe('proj-456')
    expect(model.meta.buildVersion).toBe('2.0.0')
    expect(model.meta.engineVersion).toBe('1.0.0')
    expect(model.meta.contractVersion).toBe(5)
    expect(model.meta.nodeCount).toBe(2) // groups excluded
    expect(model.meta.edgeCount).toBe(1)
    expect(model.snapshotHash).toBe('cafe0000')
  })

  it('formats node values with compact and full precision', () => {
    const model = buildAuditModel({
      projectName: 'Test',
      projectId: null,
      exportTimestamp: '2026-02-27T12:00:00Z',
      buildVersion: '1.0.0',
      buildSha: 'abc',
      buildTime: '2026-02-27',
      buildEnv: 'test',
      engineVersion: '0.5.0',
      contractVersion: 3,
      nodes: fakeNodes as never,
      edges: fakeEdges as never,
      evalResult: fakeEvalResult,
      healthSummary: '',
      snapshotHash: 'deadbeef',
    })

    const n1Row = model.nodeValues.find((nv) => nv.nodeId === 'n1')!
    expect(n1Row.compact).toBe('5')
    expect(n1Row.full).toBe('5')
    expect(n1Row.blockType).toBe('number')
    expect(n1Row.label).toBe('Input A')
  })
})

// ── buildCanvasAuditSection ──────────────────────────────────────────────────

describe('buildCanvasAuditSection', () => {
  const fakeNodes = [
    {
      id: 'n1',
      type: 'csSource',
      position: { x: 0, y: 0 },
      data: { blockType: 'number', label: 'Input A', value: 5 },
    },
    {
      id: 'g1',
      type: 'csGroup',
      position: { x: 0, y: 0 },
      data: { blockType: '__group__', label: 'Group 1' },
    },
  ]

  const fakeEdges = [
    { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n1', targetHandle: 'in' },
  ]

  const fakeEvalResult: EngineEvalResult = {
    values: { n1: { kind: 'scalar', value: 5 } },
    diagnostics: [],
    elapsedUs: 500,
    partial: false,
  }

  it('builds a canvas section with correct fields', () => {
    const section = buildCanvasAuditSection({
      canvasId: 'canvas-1',
      canvasName: 'Sheet 1',
      position: 0,
      nodes: fakeNodes as never,
      edges: fakeEdges as never,
      evalResult: fakeEvalResult,
      healthSummary: 'OK',
      snapshotHash: 'abc123',
      graphImageDataUrl: null,
    })

    expect(section.canvasId).toBe('canvas-1')
    expect(section.canvasName).toBe('Sheet 1')
    expect(section.position).toBe(0)
    expect(section.nodeCount).toBe(1) // groups excluded
    expect(section.edgeCount).toBe(1)
    expect(section.snapshotHash).toBe('abc123')
    expect(section.graphImageDataUrl).toBeNull()
  })

  it('records image error for non-active canvases', () => {
    const section = buildCanvasAuditSection({
      canvasId: 'canvas-2',
      canvasName: 'Sheet 2',
      position: 1,
      nodes: fakeNodes as never,
      edges: fakeEdges as never,
      evalResult: fakeEvalResult,
      healthSummary: '',
      snapshotHash: 'def456',
      graphImageDataUrl: null,
      imageError: 'Non-active canvas',
    })

    expect(section.imageError).toBe('Non-active canvas')
    expect(section.graphImageDataUrl).toBeNull()
  })

  it('excludes group nodes from node values', () => {
    const section = buildCanvasAuditSection({
      canvasId: 'canvas-1',
      canvasName: 'Sheet 1',
      position: 0,
      nodes: fakeNodes as never,
      edges: fakeEdges as never,
      evalResult: fakeEvalResult,
      healthSummary: '',
      snapshotHash: 'abc',
      graphImageDataUrl: null,
    })

    expect(section.nodeValues).toHaveLength(1)
    expect(section.nodeValues[0].nodeId).toBe('n1')
  })
})

// ── buildProjectAuditModel ───────────────────────────────────────────────────

describe('buildProjectAuditModel', () => {
  const fakeSection1 = buildCanvasAuditSection({
    canvasId: 'c1',
    canvasName: 'Sheet 1',
    position: 0,
    nodes: [
      {
        id: 'n1',
        type: 'csSource',
        position: { x: 0, y: 0 },
        data: { blockType: 'number', label: 'A' },
      },
    ] as never,
    edges: [] as never,
    evalResult: { values: {}, diagnostics: [], elapsedUs: 100, partial: false },
    healthSummary: 'OK',
    snapshotHash: 'hash1',
    graphImageDataUrl: 'data:image/png;base64,abc',
  })

  const fakeSection2 = buildCanvasAuditSection({
    canvasId: 'c2',
    canvasName: 'Sheet 2',
    position: 1,
    nodes: [
      {
        id: 'n2',
        type: 'csSource',
        position: { x: 0, y: 0 },
        data: { blockType: 'number', label: 'B' },
      },
      {
        id: 'n3',
        type: 'csOperation',
        position: { x: 200, y: 0 },
        data: { blockType: 'add', label: 'Add' },
      },
    ] as never,
    edges: [
      { id: 'e1', source: 'n2', sourceHandle: 'out', target: 'n3', targetHandle: 'in' },
    ] as never,
    evalResult: { values: {}, diagnostics: [], elapsedUs: 200, partial: false },
    healthSummary: 'OK',
    snapshotHash: 'hash2',
    graphImageDataUrl: null,
    imageError: 'Non-active canvas',
  })

  it('aggregates node and edge counts across all canvases', () => {
    const model = buildProjectAuditModel({
      projectName: 'Multi Canvas Project',
      projectId: 'proj-1',
      exportTimestamp: '2026-02-27T12:00:00Z',
      buildVersion: '1.0.0',
      buildSha: 'abc1234',
      buildTime: '2026-02-27',
      buildEnv: 'test',
      engineVersion: '0.5.0',
      contractVersion: 3,
      activeCanvasId: 'c1',
      projectHash: 'projhash',
      canvases: [fakeSection1, fakeSection2],
    })

    expect(model.meta.nodeCount).toBe(3) // 1 + 2
    expect(model.meta.edgeCount).toBe(1) // 0 + 1
    expect(model.meta.totalCanvases).toBe(2)
    expect(model.meta.exportScope).toBe('project')
  })

  it('sorts canvases by position', () => {
    const model = buildProjectAuditModel({
      projectName: 'Test',
      projectId: 'proj-1',
      exportTimestamp: '2026-02-27T12:00:00Z',
      buildVersion: '1.0.0',
      buildSha: 'abc',
      buildTime: '2026-02-27',
      buildEnv: 'test',
      engineVersion: '0.5.0',
      contractVersion: 3,
      activeCanvasId: 'c1',
      projectHash: 'hash',
      // Deliberately pass in reverse order
      canvases: [fakeSection2, fakeSection1],
    })

    expect(model.canvases[0].canvasId).toBe('c1')
    expect(model.canvases[1].canvasId).toBe('c2')
  })

  it('preserves project hash and active canvas ID', () => {
    const model = buildProjectAuditModel({
      projectName: 'Test',
      projectId: 'proj-1',
      exportTimestamp: '2026-02-27T12:00:00Z',
      buildVersion: '1.0.0',
      buildSha: 'abc',
      buildTime: '2026-02-27',
      buildEnv: 'test',
      engineVersion: '0.5.0',
      contractVersion: 3,
      activeCanvasId: 'c1',
      projectHash: 'myhash',
      canvases: [fakeSection1],
    })

    expect(model.projectHash).toBe('myhash')
    expect(model.meta.activeCanvasId).toBe('c1')
  })

  it('project hash is stable for same ordered inputs', async () => {
    const hashInputs = ['hash1', 'hash2']
    const h1 = await sha256Hex(stableStringify(hashInputs))
    const h2 = await sha256Hex(stableStringify(hashInputs))
    expect(h1).toBe(h2)
  })

  it('project hash changes when canvas order changes', async () => {
    const h1 = await sha256Hex(stableStringify(['hash1', 'hash2']))
    const h2 = await sha256Hex(stableStringify(['hash2', 'hash1']))
    expect(h1).not.toBe(h2)
  })
})
