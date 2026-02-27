/**
 * roundTrip.ts — Export → Serialize → Parse → Validate → Normalize orchestrator.
 *
 * Exercises the full .chainsolvejson pipeline without any backend.
 * Returns structured results for assertion by golden tests.
 *
 * @internal Test-only module.
 */

import {
  buildChainsolveJsonExport,
  type BuildChainsolveJsonArgs,
  type ChainsolveJsonV1,
} from '../model'
import { stableStringify } from '../hashes'
import { parseChainsolveJson } from '../import/parse'
import { validateImport, type ValidationResult } from '../import/validate'
import { normalizeImportPlan, type NormalizedImportPlan } from '../import/importProject'
import {
  createMemoryStore,
  storeProject,
  storeCanvas,
  storeAsset,
  type MemoryStore,
} from './memoryStore'

// ── Types ───────────────────────────────────────────────────────────────────

export interface RoundTripResult {
  /** The built ChainsolveJsonV1 model (pre-serialization). */
  exportModel: ChainsolveJsonV1
  /** Serialized JSON text (what would be in the .chainsolvejson file). */
  exportedText: string
  /** Parsed model from the serialized text. */
  parsedModel: ChainsolveJsonV1
  /** Deep validation result. */
  validation: ValidationResult
  /** Pure import plan (no side effects). */
  importPlan: NormalizedImportPlan
  /** In-memory store after applying the import plan. */
  store: MemoryStore
  /** Hash manifest from the export. */
  hashManifest: {
    projectHash: string
    canvasHashes: { id: string; hash: string }[]
    assetHashes: { pathOrName: string; sha256: string | null; bytes: number }[]
  }
}

// ── Deterministic ID generator ───────────────────────────────────────────────

/**
 * Creates a deterministic ID generator for tests.
 * Produces IDs like "new-id-0", "new-id-1", etc.
 */
export function createDeterministicIdGenerator(prefix = 'new-id'): () => string {
  let counter = 0
  return () => `${prefix}-${counter++}`
}

// ── Main round-trip function ─────────────────────────────────────────────────

/**
 * Full round-trip: build export → serialize → parse → validate → normalize → store.
 *
 * All operations are pure or in-memory. No network I/O.
 */
export async function roundTripProject(args: BuildChainsolveJsonArgs): Promise<RoundTripResult> {
  // 1. Build export model
  const exportModel = await buildChainsolveJsonExport(args)

  // 2. Serialize deterministically (same as real export)
  const raw = stableStringify(exportModel)
  const exportedText = JSON.stringify(JSON.parse(raw), null, 2)

  // 3. Parse
  const parsedModel = parseChainsolveJson(exportedText)

  // 4. Validate
  const validation = await validateImport(parsedModel)

  // 5. Normalize (pure — deterministic IDs for testability)
  const idGen = createDeterministicIdGenerator()
  const importPlan = normalizeImportPlan(parsedModel, idGen)

  // 6. Apply import plan to in-memory store
  const store = createMemoryStore()
  applyPlanToStore(store, importPlan, parsedModel)

  return {
    exportModel,
    exportedText,
    parsedModel,
    validation,
    importPlan,
    store,
    hashManifest: {
      projectHash: exportModel.hashes.projectHash,
      canvasHashes: exportModel.hashes.canvases,
      assetHashes: exportModel.hashes.assets,
    },
  }
}

// ── Apply plan to memory store ───────────────────────────────────────────────

function applyPlanToStore(
  store: MemoryStore,
  plan: NormalizedImportPlan,
  model: ChainsolveJsonV1,
): void {
  // Store project
  storeProject(store, {
    id: plan.newProjectId,
    name: plan.newProjectName,
    activeCanvasId: plan.activeCanvasId,
    variables: plan.variables as Record<string, unknown>,
  })

  // Store canvases
  for (const c of plan.canvases) {
    storeCanvas(store, {
      id: c.newId,
      projectId: plan.newProjectId,
      name: c.name,
      position: c.position,
      graph: c.normalizedGraph,
    })
  }

  // Store embedded assets
  for (const asset of model.assets) {
    if (asset.encoding === 'base64') {
      const binary = atob(asset.data)
      const bytes = new Uint8Array(binary.length)
      for (let j = 0; j < binary.length; j++) {
        bytes[j] = binary.charCodeAt(j)
      }
      storeAsset(store, {
        projectId: plan.newProjectId,
        name: asset.name,
        mimeType: asset.mimeType,
        bytes,
        sha256: asset.sha256,
        kind: asset.mimeType.startsWith('text/csv') ? 'csv' : 'file',
      })
    }
  }
}

// ── Comparison helpers ───────────────────────────────────────────────────────

/**
 * Strip non-deterministic fields from a graph for comparison.
 * Returns a stable string representation of nodes + edges.
 */
export function stableGraphFingerprint(nodes: unknown[], edges: unknown[]): string {
  return stableStringify({ nodes, edges })
}

/**
 * Compare two sets of variables for equivalence.
 * Returns true if the stable serialization matches.
 */
export function variablesMatch(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}
