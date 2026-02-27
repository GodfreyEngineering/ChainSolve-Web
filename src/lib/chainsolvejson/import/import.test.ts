import { describe, it, expect } from 'vitest'
import { parseChainsolveJson, ImportParseError } from './parse'
import { validateImport } from './validate'
import { extractImportSummary, buildImportReport } from './report'
import {
  buildChainsolveJsonExport,
  buildEmbeddedAsset,
  buildReferencedAsset,
  EMBED_SIZE_LIMIT,
  type BuildChainsolveJsonArgs,
} from '../model'
import type { ChainsolveJsonV1 } from '../model'
import type { VariablesMap } from '../../variables'

// ── Test fixtures ───────────────────────────────────────────────────────────

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
    activeCanvasId: 'canvas-0',
    variables: testVariables,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-27T11:00:00Z',
    canvases: [
      {
        id: 'canvas-0',
        name: 'Sheet 1',
        position: 0,
        graph: {
          schemaVersion: 4,
          canvasId: 'canvas-0',
          projectId: 'proj-1',
          nodes: [{ id: 'n-0', type: 'constant', position: { x: 0, y: 0 }, data: { value: 42 } }],
          edges: [],
          datasetRefs: [],
        },
      },
    ],
    assets: [],
    ...overrides,
  }
}

/** Build a valid exported model and serialize it for parse testing. */
async function makeValidJson(overrides?: Partial<BuildChainsolveJsonArgs>): Promise<string> {
  const model = await buildChainsolveJsonExport(makeArgs(overrides))
  return JSON.stringify(model, null, 2)
}

// ── parseChainsolveJson ─────────────────────────────────────────────────────

describe('parseChainsolveJson', () => {
  it('parses valid exported JSON', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    expect(model.format).toBe('chainsolvejson')
    expect(model.version).toBe(1)
    expect(model.project.name).toBe('Test Project')
    expect(model.canvases).toHaveLength(1)
  })

  it('rejects non-JSON input', () => {
    expect(() => parseChainsolveJson('not json')).toThrow(ImportParseError)
    expect(() => parseChainsolveJson('not json')).toThrow('not valid JSON')
  })

  it('rejects array root', () => {
    expect(() => parseChainsolveJson('[]')).toThrow(ImportParseError)
    expect(() => parseChainsolveJson('[]')).toThrow('JSON object')
  })

  it('rejects wrong format field', () => {
    const json = JSON.stringify({ format: 'other', version: 1 })
    expect(() => parseChainsolveJson(json)).toThrow('Unsupported format')
  })

  it('rejects unsupported version', () => {
    const json = JSON.stringify({ format: 'chainsolvejson', version: 99 })
    expect(() => parseChainsolveJson(json)).toThrow('Unsupported version')
  })

  it('rejects missing exporter', () => {
    const json = JSON.stringify({
      format: 'chainsolvejson',
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
    })
    expect(() => parseChainsolveJson(json)).toThrow('exporter must be an object')
  })

  it('rejects empty canvases array', async () => {
    const model = await buildChainsolveJsonExport(makeArgs())
    const raw = JSON.parse(JSON.stringify(model))
    raw.canvases = []
    expect(() => parseChainsolveJson(JSON.stringify(raw))).toThrow('at least one canvas')
  })

  it('rejects canvas with wrong schemaVersion', async () => {
    const model = await buildChainsolveJsonExport(makeArgs())
    const raw = JSON.parse(JSON.stringify(model))
    raw.canvases[0].graph.schemaVersion = 3
    expect(() => parseChainsolveJson(JSON.stringify(raw))).toThrow('schemaVersion must be 4')
  })

  it('validates variable objects', async () => {
    const model = await buildChainsolveJsonExport(makeArgs())
    const raw = JSON.parse(JSON.stringify(model))
    raw.project.variables = { bad: 'string' }
    expect(() => parseChainsolveJson(JSON.stringify(raw))).toThrow('must be an object')
  })

  it('validates asset encoding', async () => {
    const model = await buildChainsolveJsonExport(makeArgs())
    const raw = JSON.parse(JSON.stringify(model))
    raw.assets = [
      {
        name: 'test.csv',
        mimeType: 'text/csv',
        sizeBytes: 100,
        encoding: 'unknown',
      },
    ]
    expect(() => parseChainsolveJson(JSON.stringify(raw))).toThrow(
      'must be "base64" or "storageRef"',
    )
  })
})

// ── validateImport ──────────────────────────────────────────────────────────

describe('validateImport', () => {
  it('returns ok for valid exported model', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    const result = await validateImport(model)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects NaN in variables', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    // Inject NaN (bypass parse validation)
    ;(model.project.variables as Record<string, { id: string; name: string; value: number }>)[
      'bad'
    ] = { id: 'bad', name: 'bad', value: NaN }
    const result = await validateImport(model)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'INVALID_NUMBER')).toBe(true)
  })

  it('detects duplicate canvas IDs', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    // Duplicate the first canvas
    model.canvases.push({ ...model.canvases[0] })
    // Also add a matching hash entry for the duplicate
    model.hashes.canvases.push({ ...model.hashes.canvases[0] })
    const result = await validateImport(model)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'DUPLICATE_CANVAS_ID')).toBe(true)
  })

  it('warns on canvasId mismatch', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    // graph.canvasId is different from canvas.id
    model.canvases[0].graph.canvasId = 'wrong-id'
    const result = await validateImport(model)
    // This is a warning, not an error (hash will fail though)
    expect(result.warnings.some((w) => w.code === 'CANVAS_ID_MISMATCH')).toBe(true)
  })

  it('detects hash mismatch', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    // Tamper with the project hash
    model.hashes.projectHash = 'deadbeef'.repeat(8)
    const result = await validateImport(model)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'PROJECT_HASH_MISMATCH')).toBe(true)
  })

  it('detects canvas hash mismatch', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    // Tamper with canvas hash
    model.hashes.canvases[0].hash = 'deadbeef'.repeat(8)
    const result = await validateImport(model)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.code === 'CANVAS_HASH_MISMATCH')).toBe(true)
  })

  it('verifies hashes pass for unmodified export', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    const result = await validateImport(model)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })
})

// ── extractImportSummary ────────────────────────────────────────────────────

describe('extractImportSummary', () => {
  it('extracts correct counts', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    const summary = extractImportSummary(model)
    expect(summary.projectName).toBe('Test Project')
    expect(summary.canvasCount).toBe(1)
    expect(summary.variableCount).toBe(2)
    expect(summary.embeddedAssetCount).toBe(0)
    expect(summary.referencedAssetCount).toBe(0)
    expect(summary.totalEmbeddedBytes).toBe(0)
    expect(summary.exportedAt).toBe('2026-02-27T12:00:00.000Z')
  })

  it('counts embedded and referenced assets separately', async () => {
    const model: ChainsolveJsonV1 = {
      format: 'chainsolvejson',
      version: 1,
      exportedAt: '2026-02-27T12:00:00.000Z',
      exporter: {
        appVersion: '1.0.0',
        buildSha: 'abc',
        buildTime: '2026-01-01',
        buildEnv: 'test',
        engineVersion: '0.1.0',
        engineContractVersion: 1,
      },
      hashes: { projectHash: '', canvases: [], assets: [] },
      project: {
        id: 'p1',
        name: 'Test',
        description: '',
        activeCanvasId: null,
        variables: {},
        created_at: null,
        updated_at: null,
      },
      canvases: [],
      assets: [
        {
          name: 'a.csv',
          mimeType: 'text/csv',
          sizeBytes: 500,
          encoding: 'base64' as const,
          data: 'abc',
          sha256: 'abc',
        },
        {
          name: 'b.csv',
          mimeType: 'text/csv',
          sizeBytes: 1000,
          encoding: 'base64' as const,
          data: 'def',
          sha256: 'def',
        },
        {
          name: 'c.bin',
          mimeType: 'application/octet-stream',
          sizeBytes: 20_000_000,
          encoding: 'storageRef' as const,
          storagePath: '/path/to/c.bin',
          sha256: null,
        },
      ],
    }
    const summary = extractImportSummary(model)
    expect(summary.embeddedAssetCount).toBe(2)
    expect(summary.referencedAssetCount).toBe(1)
    expect(summary.totalEmbeddedBytes).toBe(1500)
  })
})

// ── buildImportReport ───────────────────────────────────────────────────────

describe('buildImportReport', () => {
  it('produces complete report structure', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    const report = buildImportReport(
      'test.chainsolvejson',
      model,
      { passed: true, errors: [], warnings: [] },
      {
        projectCreated: true,
        newProjectId: 'new-proj-1',
        canvasesImported: 1,
        assetsUploaded: 0,
        unreferencedAssets: [],
      },
      { 'canvas-0': 'new-canvas-0' },
    )

    expect(report.fileName).toBe('test.chainsolvejson')
    expect(report.fileMeta.format).toBe('chainsolvejson')
    expect(report.fileMeta.projectName).toBe('Test Project')
    expect(report.counts.canvases).toBe(1)
    expect(report.counts.variables).toBe(2)
    expect(report.validation.passed).toBe(true)
    expect(report.operations.projectCreated).toBe(true)
    expect(report.operations.newProjectId).toBe('new-proj-1')
    expect(report.canvasIdRemap).toEqual({ 'canvas-0': 'new-canvas-0' })
  })

  it('includes errors in failed report', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    const report = buildImportReport(
      'test.chainsolvejson',
      model,
      {
        passed: false,
        errors: [{ code: 'SECRET_DETECTED', message: 'Forbidden field found' }],
        warnings: [],
      },
      {
        projectCreated: false,
        newProjectId: null,
        canvasesImported: 0,
        assetsUploaded: 0,
        unreferencedAssets: [],
      },
      {},
    )

    expect(report.validation.passed).toBe(false)
    expect(report.validation.errors).toHaveLength(1)
    expect(report.validation.errors[0].code).toBe('SECRET_DETECTED')
    expect(report.operations.projectCreated).toBe(false)
  })
})

// ── Round-trip: export → parse → validate ───────────────────────────────────

describe('round-trip', () => {
  it('export → parse → validate passes for single canvas', async () => {
    const json = await makeValidJson()
    const model = parseChainsolveJson(json)
    const result = await validateImport(model)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('export → parse → validate passes for multiple canvases', async () => {
    const json = await makeValidJson({
      canvases: [
        {
          id: 'c-0',
          name: 'Sheet A',
          position: 0,
          graph: {
            schemaVersion: 4,
            canvasId: 'c-0',
            projectId: 'proj-1',
            nodes: [{ id: 'n1', type: 'constant', position: { x: 0, y: 0 }, data: { value: 1 } }],
            edges: [],
            datasetRefs: [],
          },
        },
        {
          id: 'c-1',
          name: 'Sheet B',
          position: 1,
          graph: {
            schemaVersion: 4,
            canvasId: 'c-1',
            projectId: 'proj-1',
            nodes: [{ id: 'n2', type: 'constant', position: { x: 100, y: 0 }, data: { value: 2 } }],
            edges: [],
            datasetRefs: [],
          },
        },
      ],
      activeCanvasId: 'c-0',
    })
    const model = parseChainsolveJson(json)
    expect(model.canvases).toHaveLength(2)
    const result = await validateImport(model)
    expect(result.ok).toBe(true)
  })

  it('export → parse → validate passes with variables', async () => {
    const json = await makeValidJson({
      variables: {
        x: { id: 'x', name: 'x_val', value: 3.14 },
        y: { id: 'y', name: 'y_val', value: -100 },
      },
    })
    const model = parseChainsolveJson(json)
    const result = await validateImport(model)
    expect(result.ok).toBe(true)
    expect(Object.keys(model.project.variables)).toHaveLength(2)
  })
})

// ── Asset helpers ──────────────────────────────────────────────────────────

describe('buildEmbeddedAsset', () => {
  it('produces valid structure with sha256', async () => {
    const bytes = new TextEncoder().encode('hello,world\n1,2')
    const asset = await buildEmbeddedAsset('test.csv', 'text/csv', bytes)
    expect(asset.encoding).toBe('base64')
    expect(asset.name).toBe('test.csv')
    expect(asset.mimeType).toBe('text/csv')
    expect(asset.sizeBytes).toBe(bytes.length)
    expect(asset.data).toBeTruthy()
    expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('round-trips bytes through base64', async () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64])
    const asset = await buildEmbeddedAsset('bin.dat', 'application/octet-stream', original)
    const decoded = Uint8Array.from(atob(asset.data), (c) => c.charCodeAt(0))
    expect(decoded).toEqual(original)
  })
})

describe('buildReferencedAsset', () => {
  it('produces valid structure', () => {
    const asset = buildReferencedAsset(
      'big.bin',
      'application/octet-stream',
      20_000_000,
      '/path',
      null,
    )
    expect(asset.encoding).toBe('storageRef')
    expect(asset.storagePath).toBe('/path')
    expect(asset.sha256).toBeNull()
    expect(asset.sizeBytes).toBe(20_000_000)
  })
})

describe('EMBED_SIZE_LIMIT', () => {
  it('is 10 MB', () => {
    expect(EMBED_SIZE_LIMIT).toBe(10 * 1024 * 1024)
  })
})

// ── Round-trip with assets ───────────────────────────────────────────────

describe('round-trip with assets', () => {
  it('export → parse → validate passes with embedded asset', async () => {
    const bytes = new TextEncoder().encode('col1,col2\n1,2\n3,4')
    const embeddedAsset = await buildEmbeddedAsset('data.csv', 'text/csv', bytes)
    const json = await makeValidJson({ assets: [embeddedAsset] })
    const model = parseChainsolveJson(json)
    expect(model.assets).toHaveLength(1)
    expect(model.assets[0].encoding).toBe('base64')
    const result = await validateImport(model)
    expect(result.ok).toBe(true)
  })

  it('export → parse → validate passes with referenced asset', async () => {
    const refAsset = buildReferencedAsset(
      'large.bin',
      'application/octet-stream',
      20_000_000,
      '/bucket/path',
      null,
    )
    const json = await makeValidJson({ assets: [refAsset] })
    const model = parseChainsolveJson(json)
    expect(model.assets).toHaveLength(1)
    expect(model.assets[0].encoding).toBe('storageRef')
    const result = await validateImport(model)
    expect(result.ok).toBe(true)
  })

  it('export → parse → validate passes with mixed assets', async () => {
    const bytes = new TextEncoder().encode('x,y\n10,20')
    const embedded = await buildEmbeddedAsset('small.csv', 'text/csv', bytes)
    const referenced = buildReferencedAsset(
      'big.bin',
      'application/octet-stream',
      50_000_000,
      '/path/big',
      null,
    )
    const json = await makeValidJson({ assets: [embedded, referenced] })
    const model = parseChainsolveJson(json)
    expect(model.assets).toHaveLength(2)
    const result = await validateImport(model)
    expect(result.ok).toBe(true)
  })

  it('summary correctly counts embedded and referenced assets', async () => {
    const bytes = new TextEncoder().encode('a,b\n1,2')
    const embedded = await buildEmbeddedAsset('a.csv', 'text/csv', bytes)
    const referenced = buildReferencedAsset(
      'b.bin',
      'application/octet-stream',
      99_000_000,
      '/p',
      null,
    )
    const json = await makeValidJson({ assets: [embedded, referenced] })
    const model = parseChainsolveJson(json)
    const summary = extractImportSummary(model)
    expect(summary.embeddedAssetCount).toBe(1)
    expect(summary.referencedAssetCount).toBe(1)
    expect(summary.totalEmbeddedBytes).toBe(bytes.length)
  })
})
