import { describe, it, expect } from 'vitest'
import {
  buildChainsolveJsonExport,
  computeCanvasHash,
  computeProjectHash,
  buildEmbeddedAsset,
  buildReferencedAsset,
  validateNoSecrets,
  validateFiniteNumbers,
  CHAINSOLVEJSON_FORMAT,
  CHAINSOLVEJSON_VERSION,
  EMBED_SIZE_LIMIT,
  type BuildChainsolveJsonArgs,
  type CanvasInput,
  type ExportAsset,
} from './model'
import type { CanvasJSON } from '../canvasSchema'
import type { VariablesMap } from '../variables'

// ── Test fixtures ───────────────────────────────────────────────────────────

function makeGraph(nodeCount: number): CanvasJSON {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `node-${i}`,
    type: 'constant',
    position: { x: i * 100, y: 0 },
    data: { label: `Node ${i}`, value: i },
  }))
  return {
    schemaVersion: 4,
    canvasId: 'canvas-1',
    projectId: 'proj-1',
    nodes,
    edges: [],
    datasetRefs: [],
  }
}

function makeCanvas(position: number, name: string): CanvasInput {
  return {
    id: `canvas-${position}`,
    name,
    position,
    graph: {
      schemaVersion: 4,
      canvasId: `canvas-${position}`,
      projectId: 'proj-1',
      nodes: [{ id: `n-${position}`, type: 'constant', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
      datasetRefs: [],
    },
  }
}

const testVariables: VariablesMap = {
  v1: { id: 'v1', name: 'rate', value: 0.05, description: 'Interest rate' },
  v2: { id: 'v2', name: 'periods', value: 12 },
}

function makeArgs(overrides?: Partial<BuildChainsolveJsonArgs>): BuildChainsolveJsonArgs {
  return {
    exportedAt: '2026-02-27T12:00:00.000Z',
    appVersion: '1.0.0',
    buildSha: 'abc123',
    buildTime: '2026-02-27T00:00:00Z',
    buildEnv: 'test',
    engineVersion: '0.1.0',
    engineContractVersion: 1,
    projectId: 'proj-1',
    projectName: 'Test Project',
    activeCanvasId: 'canvas-1',
    variables: testVariables,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-27T11:00:00Z',
    canvases: [makeCanvas(1, 'Sheet 1'), makeCanvas(0, 'Sheet 0')],
    assets: [],
    ...overrides,
  }
}

// ── buildChainsolveJsonExport ───────────────────────────────────────────────

describe('buildChainsolveJsonExport', () => {
  it('produces correct format and version', async () => {
    const result = await buildChainsolveJsonExport(makeArgs())
    expect(result.format).toBe(CHAINSOLVEJSON_FORMAT)
    expect(result.version).toBe(CHAINSOLVEJSON_VERSION)
  })

  it('includes exporter metadata', async () => {
    const result = await buildChainsolveJsonExport(makeArgs())
    expect(result.exporter.appVersion).toBe('1.0.0')
    expect(result.exporter.buildSha).toBe('abc123')
    expect(result.exporter.engineVersion).toBe('0.1.0')
    expect(result.exporter.engineContractVersion).toBe(1)
  })

  it('includes project metadata', async () => {
    const result = await buildChainsolveJsonExport(makeArgs())
    expect(result.project.id).toBe('proj-1')
    expect(result.project.name).toBe('Test Project')
    expect(result.project.description).toBe('')
    expect(result.project.variables).toEqual(testVariables)
    expect(result.project.activeCanvasId).toBe('canvas-1')
  })

  it('sorts canvases by position', async () => {
    const result = await buildChainsolveJsonExport(makeArgs())
    expect(result.canvases).toHaveLength(2)
    expect(result.canvases[0].position).toBe(0)
    expect(result.canvases[0].name).toBe('Sheet 0')
    expect(result.canvases[1].position).toBe(1)
    expect(result.canvases[1].name).toBe('Sheet 1')
  })

  it('computes per-canvas hashes', async () => {
    const result = await buildChainsolveJsonExport(makeArgs())
    expect(result.hashes.canvases).toHaveLength(2)
    for (const ch of result.hashes.canvases) {
      expect(ch.id).toMatch(/^canvas-/)
      expect(ch.hash).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('computes project hash', async () => {
    const result = await buildChainsolveJsonExport(makeArgs())
    expect(result.hashes.projectHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces deterministic output for same input', async () => {
    const args = makeArgs()
    const r1 = await buildChainsolveJsonExport(args)
    const r2 = await buildChainsolveJsonExport(args)
    expect(r1.hashes.projectHash).toBe(r2.hashes.projectHash)
    expect(r1.hashes.canvases).toEqual(r2.hashes.canvases)
  })

  it('hash changes when nodes change', async () => {
    const args1 = makeArgs()
    const args2 = makeArgs({
      canvases: [
        makeCanvas(0, 'Sheet 0'),
        {
          ...makeCanvas(1, 'Sheet 1'),
          graph: makeGraph(5),
        },
      ],
    })
    const r1 = await buildChainsolveJsonExport(args1)
    const r2 = await buildChainsolveJsonExport(args2)
    expect(r1.hashes.projectHash).not.toBe(r2.hashes.projectHash)
  })

  it('hash changes when variables change', async () => {
    const args1 = makeArgs()
    const args2 = makeArgs({
      variables: { v1: { id: 'v1', name: 'rate', value: 0.1 } },
    })
    const r1 = await buildChainsolveJsonExport(args1)
    const r2 = await buildChainsolveJsonExport(args2)
    expect(r1.hashes.projectHash).not.toBe(r2.hashes.projectHash)
  })

  it('sorts assets by name', async () => {
    const assets: ExportAsset[] = [
      buildReferencedAsset('z-file.bin', 'application/octet-stream', 100, '/uploads/z', null),
      buildReferencedAsset('a-file.csv', 'text/csv', 200, '/uploads/a', null),
    ]
    const result = await buildChainsolveJsonExport(makeArgs({ assets }))
    expect(result.assets[0].name).toBe('a-file.csv')
    expect(result.assets[1].name).toBe('z-file.bin')
  })

  it('includes graph schemaVersion 4 in canvases', async () => {
    const result = await buildChainsolveJsonExport(makeArgs())
    for (const c of result.canvases) {
      expect(c.graph.schemaVersion).toBe(4)
    }
  })
})

// ── computeCanvasHash ───────────────────────────────────────────────────────

describe('computeCanvasHash', () => {
  it('returns a 64-char hex string', async () => {
    const graph = makeGraph(3)
    const hash = await computeCanvasHash(graph, testVariables)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', async () => {
    const graph = makeGraph(3)
    const h1 = await computeCanvasHash(graph, testVariables)
    const h2 = await computeCanvasHash(graph, testVariables)
    expect(h1).toBe(h2)
  })

  it('changes when graph nodes differ', async () => {
    const g1 = makeGraph(2)
    const g2 = makeGraph(5)
    const h1 = await computeCanvasHash(g1, testVariables)
    const h2 = await computeCanvasHash(g2, testVariables)
    expect(h1).not.toBe(h2)
  })
})

// ── computeProjectHash ──────────────────────────────────────────────────────

describe('computeProjectHash', () => {
  it('returns a 64-char hex string', async () => {
    const hash = await computeProjectHash(makeArgs())
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', async () => {
    const args = makeArgs()
    const h1 = await computeProjectHash(args)
    const h2 = await computeProjectHash(args)
    expect(h1).toBe(h2)
  })
})

// ── buildEmbeddedAsset ──────────────────────────────────────────────────────

describe('buildEmbeddedAsset', () => {
  it('encodes bytes as base64 with sha256', async () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const asset = await buildEmbeddedAsset('hello.txt', 'text/plain', bytes)
    expect(asset.encoding).toBe('base64')
    expect(asset.sizeBytes).toBe(5)
    expect(asset.data).toBe(btoa('Hello'))
    expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(asset.name).toBe('hello.txt')
    expect(asset.mimeType).toBe('text/plain')
  })
})

// ── buildReferencedAsset ────────────────────────────────────────────────────

describe('buildReferencedAsset', () => {
  it('creates a storageRef asset', () => {
    const asset = buildReferencedAsset(
      'large.bin',
      'application/octet-stream',
      20_000_000,
      '/uploads/large.bin',
      'abc123',
    )
    expect(asset.encoding).toBe('storageRef')
    expect(asset.storagePath).toBe('/uploads/large.bin')
    expect(asset.sizeBytes).toBe(20_000_000)
    expect(asset.sha256).toBe('abc123')
  })

  it('allows null sha256', () => {
    const asset = buildReferencedAsset('x.bin', 'application/octet-stream', 100, '/x', null)
    expect(asset.sha256).toBeNull()
  })
})

// ── EMBED_SIZE_LIMIT ────────────────────────────────────────────────────────

describe('EMBED_SIZE_LIMIT', () => {
  it('is 10 MB', () => {
    expect(EMBED_SIZE_LIMIT).toBe(10 * 1024 * 1024)
  })
})

// ── validateNoSecrets ───────────────────────────────────────────────────────

describe('validateNoSecrets', () => {
  it('passes for clean JSON', () => {
    const json = JSON.stringify({ project: { name: 'Test' } })
    const result = validateNoSecrets(json)
    expect(result.ok).toBe(true)
    expect(result.found).toEqual([])
  })

  it('detects forbidden fields', () => {
    const json = JSON.stringify({
      project: { name: 'Test' },
      access_token: 'secret',
      email: 'user@example.com',
    })
    const result = validateNoSecrets(json)
    expect(result.ok).toBe(false)
    expect(result.found).toContain('access_token')
    expect(result.found).toContain('email')
  })

  it('detects refresh_token', () => {
    const json = JSON.stringify({ refresh_token: 'xxx' })
    expect(validateNoSecrets(json).ok).toBe(false)
  })

  it('detects anon_key', () => {
    const json = JSON.stringify({ anon_key: 'xxx' })
    expect(validateNoSecrets(json).ok).toBe(false)
  })
})

// ── validateFiniteNumbers ───────────────────────────────────────────────────

describe('validateFiniteNumbers', () => {
  it('passes for finite numbers', () => {
    expect(validateFiniteNumbers({ a: 1, b: 2.5, c: -3 })).toBe(true)
  })

  it('passes for nested objects and arrays', () => {
    expect(validateFiniteNumbers({ a: [1, 2, { b: 3 }] })).toBe(true)
  })

  it('fails for NaN', () => {
    expect(validateFiniteNumbers({ a: NaN })).toBe(false)
  })

  it('fails for Infinity', () => {
    expect(validateFiniteNumbers({ a: Infinity })).toBe(false)
  })

  it('fails for -Infinity', () => {
    expect(validateFiniteNumbers({ a: -Infinity })).toBe(false)
  })

  it('passes for strings and nulls', () => {
    expect(validateFiniteNumbers({ a: 'hello', b: null, c: true })).toBe(true)
  })
})

// ── No forbidden fields in export ───────────────────────────────────────────

describe('export contains no forbidden fields', () => {
  it('serialized export has no secret field names', async () => {
    const result = await buildChainsolveJsonExport(makeArgs())
    const json = JSON.stringify(result)
    const check = validateNoSecrets(json)
    expect(check.ok).toBe(true)
  })
})
