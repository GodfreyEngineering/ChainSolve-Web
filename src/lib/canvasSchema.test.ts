import { describe, it, expect, vi } from 'vitest'
import {
  validateCanvasShape,
  sanitizeJsonNumbers,
  buildCanvasJson,
  buildCanvasJsonFromGraph,
  parseCanvasJson,
  migrateV3toV4,
} from './canvasSchema'

// ── validateCanvasShape ──────────────────────────────────────────────────────

describe('validateCanvasShape — valid', () => {
  const valid = {
    schemaVersion: 4,
    canvasId: 'c-1',
    projectId: 'p-1',
    nodes: [],
    edges: [],
    datasetRefs: [],
  }

  it('accepts a minimal valid V4 canvas', () => {
    expect(validateCanvasShape(valid).ok).toBe(true)
    expect(validateCanvasShape(valid).errors).toHaveLength(0)
  })

  it('accepts canvas with populated nodes and edges', () => {
    const c = {
      ...valid,
      nodes: [{ id: 'n1', type: 'number', position: { x: 0, y: 0 }, data: {} }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    }
    expect(validateCanvasShape(c).ok).toBe(true)
  })
})

describe('validateCanvasShape — invalid', () => {
  it('rejects null', () => {
    expect(validateCanvasShape(null).ok).toBe(false)
  })

  it('rejects an array', () => {
    expect(validateCanvasShape([]).ok).toBe(false)
  })

  it('rejects wrong schemaVersion', () => {
    const r = validateCanvasShape({
      schemaVersion: 3,
      canvasId: 'c',
      projectId: 'p',
      nodes: [],
      edges: [],
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes('schemaVersion'))).toBe(true)
  })

  it('rejects missing canvasId', () => {
    const r = validateCanvasShape({ schemaVersion: 4, projectId: 'p', nodes: [], edges: [] })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes('canvasId'))).toBe(true)
  })

  it('rejects empty canvasId', () => {
    const r = validateCanvasShape({
      schemaVersion: 4,
      canvasId: '',
      projectId: 'p',
      nodes: [],
      edges: [],
    })
    expect(r.ok).toBe(false)
  })

  it('rejects missing projectId', () => {
    const r = validateCanvasShape({ schemaVersion: 4, canvasId: 'c', nodes: [], edges: [] })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes('projectId'))).toBe(true)
  })

  it('rejects nodes not array', () => {
    const r = validateCanvasShape({
      schemaVersion: 4,
      canvasId: 'c',
      projectId: 'p',
      nodes: null,
      edges: [],
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes('nodes'))).toBe(true)
  })

  it('rejects edges not array', () => {
    const r = validateCanvasShape({
      schemaVersion: 4,
      canvasId: 'c',
      projectId: 'p',
      nodes: [],
      edges: {},
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes('edges'))).toBe(true)
  })

  it('accumulates multiple errors', () => {
    const r = validateCanvasShape({ schemaVersion: 3, nodes: 'bad', edges: 42 })
    expect(r.errors.length).toBeGreaterThan(1)
  })
})

// ── sanitizeJsonNumbers ──────────────────────────────────────────────────────

describe('sanitizeJsonNumbers', () => {
  it('passes through finite numbers unchanged', () => {
    expect(sanitizeJsonNumbers(42)).toBe(42)
    expect(sanitizeJsonNumbers(-9.81)).toBe(-9.81)
    expect(sanitizeJsonNumbers(0)).toBe(0)
  })

  it('replaces NaN with null', () => {
    expect(sanitizeJsonNumbers(NaN)).toBeNull()
  })

  it('replaces Infinity with null', () => {
    expect(sanitizeJsonNumbers(Infinity)).toBeNull()
  })

  it('replaces -Infinity with null', () => {
    expect(sanitizeJsonNumbers(-Infinity)).toBeNull()
  })

  it('passes through strings, booleans, null unchanged', () => {
    expect(sanitizeJsonNumbers('hello')).toBe('hello')
    expect(sanitizeJsonNumbers(true)).toBe(true)
    expect(sanitizeJsonNumbers(null)).toBeNull()
  })

  it('sanitizes NaN inside an object', () => {
    const result = sanitizeJsonNumbers({ x: NaN, y: 1 }) as Record<string, unknown>
    expect(result.x).toBeNull()
    expect(result.y).toBe(1)
  })

  it('sanitizes Infinity inside a nested object', () => {
    const result = sanitizeJsonNumbers({ data: { value: Infinity } }) as Record<string, unknown>
    expect((result.data as Record<string, unknown>).value).toBeNull()
  })

  it('sanitizes NaN inside an array', () => {
    const result = sanitizeJsonNumbers([1, NaN, 3]) as unknown[]
    expect(result).toEqual([1, null, 3])
  })

  it('sanitizes deeply nested NaN', () => {
    const input = { nodes: [{ data: { inputs: { speed: NaN } } }] }
    const result = sanitizeJsonNumbers(input) as typeof input
    expect(
      (result.nodes[0] as { data: { inputs: { speed: unknown } } }).data.inputs.speed,
    ).toBeNull()
  })
})

// ── buildCanvasJsonFromGraph — NaN/Infinity guard ────────────────────────────

describe('buildCanvasJsonFromGraph — sanitization', () => {
  it('replaces NaN in node data before saving', () => {
    const nodes = [{ id: 'n1', data: { value: NaN } }]
    const result = buildCanvasJsonFromGraph('c', 'p', nodes, [])
    expect((result.nodes[0] as { data: { value: unknown } }).data.value).toBeNull()
  })

  it('replaces Infinity in edge data before saving', () => {
    const edges = [{ id: 'e1', data: { weight: Infinity } }]
    const result = buildCanvasJsonFromGraph('c', 'p', [], edges)
    expect((result.edges[0] as { data: { weight: unknown } }).data.weight).toBeNull()
  })

  it('preserves finite values unchanged', () => {
    const nodes = [{ id: 'n1', data: { value: 3.14 } }]
    const result = buildCanvasJsonFromGraph('c', 'p', nodes, [])
    expect((result.nodes[0] as { data: { value: unknown } }).data.value).toBe(3.14)
  })

  it('returns correct schema metadata', () => {
    const result = buildCanvasJsonFromGraph('canvas-abc', 'proj-xyz', [], [])
    expect(result.schemaVersion).toBe(4)
    expect(result.canvasId).toBe('canvas-abc')
    expect(result.projectId).toBe('proj-xyz')
    expect(result.datasetRefs).toEqual([])
  })
})

// ── parseCanvasJson ──────────────────────────────────────────────────────────

describe('parseCanvasJson — null/missing file', () => {
  it('returns empty canvas for null', () => {
    const r = parseCanvasJson(null, 'c', 'p')
    expect(r.schemaVersion).toBe(4)
    expect(r.canvasId).toBe('c')
    expect(r.nodes).toEqual([])
  })

  it('returns empty canvas for undefined', () => {
    const r = parseCanvasJson(undefined, 'c', 'p')
    expect(r.schemaVersion).toBe(4)
  })
})

describe('parseCanvasJson — valid V4', () => {
  it('returns the canvas object unchanged when shape is valid', () => {
    const input = { schemaVersion: 4, canvasId: 'c', projectId: 'p', nodes: [], edges: [] }
    const r = parseCanvasJson(input, 'c', 'p')
    expect(r).toBe(input)
  })
})

describe('parseCanvasJson — invalid V4 (no crash)', () => {
  it('returns empty canvas and warns when V4 shape is invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const invalid = { schemaVersion: 4, canvasId: '', projectId: '', nodes: null, edges: null }
    const r = parseCanvasJson(invalid, 'fallback-c', 'fallback-p')
    expect(r.canvasId).toBe('fallback-c')
    expect(r.nodes).toEqual([])
    expect(warnSpy).toHaveBeenCalledOnce()
    warnSpy.mockRestore()
  })
})

describe('parseCanvasJson — legacy migration', () => {
  it('migrates a V3 project.json format transparently', () => {
    const legacy = {
      schemaVersion: 3,
      graph: {
        nodes: [{ id: 'n1' }],
        edges: [{ id: 'e1' }],
      },
    }
    const r = parseCanvasJson(legacy, 'c', 'p')
    expect(r.schemaVersion).toBe(4)
    expect(r.nodes).toHaveLength(1)
    expect(r.edges).toHaveLength(1)
  })

  it('migrates a format with no graph key', () => {
    const r = parseCanvasJson({ schemaVersion: 1 }, 'c', 'p')
    expect(r.schemaVersion).toBe(4)
    expect(r.nodes).toEqual([])
  })
})

// ── migrateV3toV4 ────────────────────────────────────────────────────────────

describe('migrateV3toV4', () => {
  it('returns V4 input unchanged', () => {
    const v4 = {
      schemaVersion: 4,
      canvasId: 'c',
      projectId: 'p',
      nodes: [],
      edges: [],
      datasetRefs: [],
    }
    expect(migrateV3toV4(v4, 'ignored', 'ignored')).toBe(v4)
  })

  it('wraps V3 nodes/edges into a V4 canvas', () => {
    const v3 = { schemaVersion: 3, graph: { nodes: [{ id: 'a' }], edges: [] } }
    const r = migrateV3toV4(v3, 'new-c', 'new-p')
    expect(r.schemaVersion).toBe(4)
    expect(r.canvasId).toBe('new-c')
    expect(r.projectId).toBe('new-p')
    expect(r.nodes).toHaveLength(1)
  })

  it('handles missing graph.nodes/edges gracefully', () => {
    const r = migrateV3toV4({ schemaVersion: 2 }, 'c', 'p')
    expect(r.nodes).toEqual([])
    expect(r.edges).toEqual([])
  })
})

// ── buildCanvasJson ───────────────────────────────────────────────────────────

describe('buildCanvasJson', () => {
  it('creates a well-formed empty canvas', () => {
    const c = buildCanvasJson('c-1', 'p-1')
    expect(c.schemaVersion).toBe(4)
    expect(c.canvasId).toBe('c-1')
    expect(c.projectId).toBe('p-1')
    expect(c.nodes).toEqual([])
    expect(c.edges).toEqual([])
    expect(c.datasetRefs).toEqual([])
  })
})
