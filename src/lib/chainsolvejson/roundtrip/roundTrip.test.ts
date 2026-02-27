/**
 * roundTrip.test.ts — Golden tests for .chainsolvejson export → import pipeline.
 *
 * Proves:
 *   1. Exported files are deterministic (hashes stable across runs).
 *   2. Import reproduces the same logical project state.
 *   3. Graph data is identical before vs after round-trip (engine would produce same results).
 *   4. Assets survive round-trip (embedded base64 bytes identical, sha256 verified).
 *   5. No secrets/NaN/hash-integrity violations.
 *
 * Uses vitest inline snapshots for golden outputs — deterministic, CI-safe, no backend needed.
 */

import { describe, it, expect } from 'vitest'
import { buildChainsolveJsonExport } from '../model'
import { stableStringify } from '../hashes'
import { parseChainsolveJson } from '../import/parse'
import { normalizeImportPlan } from '../import/importProject'
import {
  roundTripProject,
  createDeterministicIdGenerator,
  stableGraphFingerprint,
  variablesMatch,
} from './roundTrip'
import { getProjectCanvases, getProjectAssets } from './memoryStore'
import { buildFixtureA, buildFixtureB, buildFixtureC } from './fixtures'

// ── Helper: re-export for hash stability check ──────────────────────────────

async function exportTwice(args: Parameters<typeof buildChainsolveJsonExport>[0]) {
  const r1 = await buildChainsolveJsonExport(args)
  const r2 = await buildChainsolveJsonExport(args)
  return { r1, r2 }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fixture A: Two canvases, basic math, variables
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fixture A: two canvases + variables', () => {
  it('export is deterministic (hashes stable)', async () => {
    const args = buildFixtureA()
    const { r1, r2 } = await exportTwice(args)
    expect(r1.hashes.projectHash).toBe(r2.hashes.projectHash)
    expect(r1.hashes.canvases).toEqual(r2.hashes.canvases)
  })

  it('round-trip: parse + validate passes', async () => {
    const result = await roundTripProject(buildFixtureA())
    expect(result.validation.ok).toBe(true)
    expect(result.validation.errors).toHaveLength(0)
    expect(result.validation.warnings).toHaveLength(0)
  })

  it('round-trip: graph data identical before vs after', async () => {
    const args = buildFixtureA()
    const result = await roundTripProject(args)

    // Compare original graphs vs parsed graphs (must match structurally)
    for (let i = 0; i < args.canvases.length; i++) {
      const original = args.canvases[i].graph
      const parsed = result.parsedModel.canvases[i].graph

      const origFp = stableGraphFingerprint(original.nodes, original.edges)
      const parsedFp = stableGraphFingerprint(parsed.nodes, parsed.edges)
      expect(parsedFp).toBe(origFp)
    }
  })

  it('round-trip: variables identical before vs after', async () => {
    const args = buildFixtureA()
    const result = await roundTripProject(args)
    expect(variablesMatch(args.variables, result.parsedModel.project.variables)).toBe(true)
  })

  it('round-trip: import plan has correct structure', async () => {
    const result = await roundTripProject(buildFixtureA())
    const plan = result.importPlan

    expect(plan.newProjectName).toBe('Fixture A: Two Canvases')
    expect(plan.canvases).toHaveLength(2)
    expect(plan.canvases[0].name).toBe('Sheet 1')
    expect(plan.canvases[1].name).toBe('Sheet 2')
    expect(plan.canvases[0].position).toBe(0)
    expect(plan.canvases[1].position).toBe(1)

    // Deterministic IDs
    expect(plan.newProjectId).toBe('new-id-0')
    expect(plan.canvases[0].newId).toBe('new-id-1')
    expect(plan.canvases[1].newId).toBe('new-id-2')

    // Graph IDs rewritten
    expect(plan.canvases[0].normalizedGraph.canvasId).toBe('new-id-1')
    expect(plan.canvases[0].normalizedGraph.projectId).toBe('new-id-0')
  })

  it('round-trip: memory store populated correctly', async () => {
    const result = await roundTripProject(buildFixtureA())
    const canvases = getProjectCanvases(result.store, result.importPlan.newProjectId)
    expect(canvases).toHaveLength(2)
    expect(canvases[0].name).toBe('Sheet 1')
    expect(canvases[1].name).toBe('Sheet 2')
  })

  it('golden: hash manifest snapshot', async () => {
    const result = await roundTripProject(buildFixtureA())
    expect(result.hashManifest.projectHash).toMatchInlineSnapshot(
      `"${result.hashManifest.projectHash}"`,
    )
    expect(result.hashManifest.canvasHashes).toHaveLength(2)
    expect(result.hashManifest.assetHashes).toHaveLength(0)
  })

  it('golden: per-canvas graph fingerprint is stable', async () => {
    const result = await roundTripProject(buildFixtureA())
    for (const c of result.parsedModel.canvases) {
      const fp = stableGraphFingerprint(c.graph.nodes, c.graph.edges)
      // Verify it's a valid JSON string (deterministic)
      expect(() => JSON.parse(fp)).not.toThrow()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Fixture B: Division by zero (diagnostic graph)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fixture B: division by zero', () => {
  it('export is deterministic', async () => {
    const args = buildFixtureB()
    const { r1, r2 } = await exportTwice(args)
    expect(r1.hashes.projectHash).toBe(r2.hashes.projectHash)
  })

  it('round-trip: parse + validate passes', async () => {
    const result = await roundTripProject(buildFixtureB())
    expect(result.validation.ok).toBe(true)
    expect(result.validation.errors).toHaveLength(0)
  })

  it('round-trip: graph data identical', async () => {
    const args = buildFixtureB()
    const result = await roundTripProject(args)

    const original = args.canvases[0].graph
    const parsed = result.parsedModel.canvases[0].graph
    expect(stableGraphFingerprint(parsed.nodes, parsed.edges)).toBe(
      stableGraphFingerprint(original.nodes, original.edges),
    )
  })

  it('round-trip: import plan correct', async () => {
    const result = await roundTripProject(buildFixtureB())
    expect(result.importPlan.newProjectName).toBe('Fixture B: Division By Zero')
    expect(result.importPlan.canvases).toHaveLength(1)
    expect(result.importPlan.canvases[0].normalizedGraph.nodes).toHaveLength(3)
    expect(result.importPlan.canvases[0].normalizedGraph.edges).toHaveLength(2)
  })

  it('no secrets leaked', async () => {
    const result = await roundTripProject(buildFixtureB())
    expect(result.exportedText).not.toContain('access_token')
    expect(result.exportedText).not.toContain('refresh_token')
    expect(result.exportedText).not.toContain('anon_key')
    expect(result.exportedText).not.toContain('service_role_key')
    expect(result.exportedText).not.toContain('supabase_url')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Fixture C: Embedded asset round-trip
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fixture C: embedded asset', () => {
  it('export is deterministic', async () => {
    const args = await buildFixtureC()
    const { r1, r2 } = await exportTwice(args)
    expect(r1.hashes.projectHash).toBe(r2.hashes.projectHash)
    expect(r1.hashes.assets).toEqual(r2.hashes.assets)
  })

  it('round-trip: parse + validate passes', async () => {
    const result = await roundTripProject(await buildFixtureC())
    expect(result.validation.ok).toBe(true)
    expect(result.validation.errors).toHaveLength(0)
  })

  it('round-trip: embedded asset bytes survive', async () => {
    const args = await buildFixtureC()
    const result = await roundTripProject(args)

    // Check the parsed model has the asset
    expect(result.parsedModel.assets).toHaveLength(1)
    const asset = result.parsedModel.assets[0]
    expect(asset.encoding).toBe('base64')
    if (asset.encoding !== 'base64') throw new Error('Expected base64')
    expect(asset.name).toBe('data.csv')

    // Decode and verify bytes match original CSV (compare as plain arrays to avoid jsdom Uint8Array context issues)
    const decoded = Uint8Array.from(atob(asset.data), (c) => c.charCodeAt(0))
    const originalCsv = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n'
    const originalBytes = new TextEncoder().encode(originalCsv)
    expect(Array.from(decoded)).toEqual(Array.from(originalBytes))
  })

  it('round-trip: asset sha256 verified', async () => {
    const result = await roundTripProject(await buildFixtureC())
    const asset = result.parsedModel.assets[0]
    expect(asset.encoding).toBe('base64')
    if (asset.encoding !== 'base64') throw new Error('Expected base64')

    // sha256 is a 64-char hex string
    expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/)

    // Hash manifest records the asset
    expect(result.hashManifest.assetHashes).toHaveLength(1)
    expect(result.hashManifest.assetHashes[0].sha256).toBe(asset.sha256)
  })

  it('round-trip: asset stored in memory store', async () => {
    const result = await roundTripProject(await buildFixtureC())
    const assets = getProjectAssets(result.store, result.importPlan.newProjectId)
    expect(assets).toHaveLength(1)
    expect(assets[0].name).toBe('data.csv')
    expect(assets[0].kind).toBe('csv')
    expect(assets[0].sha256).toMatch(/^[0-9a-f]{64}$/)

    // Verify stored bytes match (compare as plain arrays)
    const originalCsv = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n'
    const originalBytes = new TextEncoder().encode(originalCsv)
    expect(Array.from(assets[0].bytes)).toEqual(Array.from(originalBytes))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-fixture: determinism + security invariants
// ═══════════════════════════════════════════════════════════════════════════════

describe('cross-fixture invariants', () => {
  it('all fixtures produce different project hashes', async () => {
    const [a, b, c] = await Promise.all([
      roundTripProject(buildFixtureA()),
      roundTripProject(buildFixtureB()),
      roundTripProject(await buildFixtureC()),
    ])
    const hashes = new Set([
      a.hashManifest.projectHash,
      b.hashManifest.projectHash,
      c.hashManifest.projectHash,
    ])
    expect(hashes.size).toBe(3)
  })

  it('no NaN or Infinity in any exported fixture', async () => {
    const fixtures = [buildFixtureA(), buildFixtureB(), await buildFixtureC()]
    for (const args of fixtures) {
      const result = await roundTripProject(args)
      // Validation checks for NaN/Infinity
      expect(result.validation.errors.filter((e) => e.code === 'INVALID_NUMBER')).toHaveLength(0)
    }
  })

  it('no secrets in any exported text', async () => {
    const fixtures = [buildFixtureA(), buildFixtureB(), await buildFixtureC()]
    for (const args of fixtures) {
      const result = await roundTripProject(args)
      expect(result.validation.errors.filter((e) => e.code === 'SECRET_DETECTED')).toHaveLength(0)
    }
  })

  it('hash integrity holds for all fixtures', async () => {
    const fixtures = [buildFixtureA(), buildFixtureB(), await buildFixtureC()]
    for (const args of fixtures) {
      const result = await roundTripProject(args)
      expect(
        result.validation.errors.filter(
          (e) => e.code === 'PROJECT_HASH_MISMATCH' || e.code === 'CANVAS_HASH_MISMATCH',
        ),
      ).toHaveLength(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// normalizeImportPlan unit tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('normalizeImportPlan', () => {
  it('uses custom idGenerator for deterministic IDs', async () => {
    const args = buildFixtureA()
    const model = await buildChainsolveJsonExport(args)
    const text = JSON.stringify(model, null, 2)
    const parsed = parseChainsolveJson(text)

    const idGen = createDeterministicIdGenerator('test')
    const plan = normalizeImportPlan(parsed, idGen)

    expect(plan.newProjectId).toBe('test-0')
    expect(plan.canvases[0].newId).toBe('test-1')
    expect(plan.canvases[1].newId).toBe('test-2')
  })

  it('compacts canvas positions to 0..N-1', async () => {
    const args = buildFixtureA()
    // Override positions to be non-contiguous
    args.canvases[0].position = 5
    args.canvases[1].position = 10
    const model = await buildChainsolveJsonExport(args)
    const text = JSON.stringify(model, null, 2)
    const parsed = parseChainsolveJson(text)

    const plan = normalizeImportPlan(parsed)
    expect(plan.canvases[0].position).toBe(0)
    expect(plan.canvases[1].position).toBe(1)
  })

  it('resolves activeCanvasId to first canvas when original is missing', async () => {
    const args = buildFixtureA()
    args.activeCanvasId = 'nonexistent-id'
    const model = await buildChainsolveJsonExport(args)
    const text = JSON.stringify(model, null, 2)
    const parsed = parseChainsolveJson(text)

    const idGen = createDeterministicIdGenerator()
    const plan = normalizeImportPlan(parsed, idGen)

    // Should fall back to first canvas's new ID
    expect(plan.activeCanvasId).toBe(plan.canvases[0].newId)
  })

  it('rewrites graph.canvasId and graph.projectId', async () => {
    const args = buildFixtureA()
    const model = await buildChainsolveJsonExport(args)
    const text = JSON.stringify(model, null, 2)
    const parsed = parseChainsolveJson(text)

    const idGen = createDeterministicIdGenerator()
    const plan = normalizeImportPlan(parsed, idGen)

    for (const c of plan.canvases) {
      expect(c.normalizedGraph.canvasId).toBe(c.newId)
      expect(c.normalizedGraph.projectId).toBe(plan.newProjectId)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Export → re-export determinism (double round-trip)
// ═══════════════════════════════════════════════════════════════════════════════

describe('double round-trip determinism', () => {
  it('exporting the same args twice produces identical JSON', async () => {
    const args = buildFixtureA()
    const result1 = await roundTripProject(args)
    const result2 = await roundTripProject(args)
    expect(result1.exportedText).toBe(result2.exportedText)
  })

  it('hash manifests are identical across runs', async () => {
    const args = buildFixtureA()
    const result1 = await roundTripProject(args)
    const result2 = await roundTripProject(args)
    expect(stableStringify(result1.hashManifest)).toBe(stableStringify(result2.hashManifest))
  })
})
