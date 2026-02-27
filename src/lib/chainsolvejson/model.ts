/**
 * model.ts — Pure builders for the .chainsolvejson v1 export format.
 *
 * All functions are pure (no side effects, no DOM, no imports of supabase).
 * The only async work is SHA-256 hashing via Web Crypto API.
 */

import type { VariablesMap } from '../variables'
import type { CanvasJSON } from '../canvasSchema'
import { sha256Hex, sha256BytesHex, stableStringify } from './hashes'

// ── Format version ──────────────────────────────────────────────────────────

export const CHAINSOLVEJSON_FORMAT = 'chainsolvejson' as const
export const CHAINSOLVEJSON_VERSION = 1 as const

// ── Asset types ─────────────────────────────────────────────────────────────

export interface EmbeddedAsset {
  name: string
  mimeType: string
  sizeBytes: number
  encoding: 'base64'
  data: string
  sha256: string
}

export interface ReferencedAsset {
  name: string
  mimeType: string
  sizeBytes: number
  encoding: 'storageRef'
  storagePath: string
  sha256: string | null
}

export type ExportAsset = EmbeddedAsset | ReferencedAsset

// ── Top-level export shape ──────────────────────────────────────────────────

export interface ChainsolveJsonV1 {
  format: typeof CHAINSOLVEJSON_FORMAT
  version: typeof CHAINSOLVEJSON_VERSION
  exportedAt: string
  exporter: {
    appVersion: string
    buildSha: string
    buildTime: string
    buildEnv: string
    engineVersion: string
    engineContractVersion: number
  }
  hashes: {
    projectHash: string
    canvases: { id: string; hash: string }[]
    assets: { pathOrName: string; sha256: string | null; bytes: number }[]
  }
  project: {
    id: string | null
    name: string
    description: string
    activeCanvasId: string | null
    variables: VariablesMap
    created_at: string | null
    updated_at: string | null
  }
  canvases: {
    id: string
    name: string
    position: number
    graph: CanvasJSON
  }[]
  assets: ExportAsset[]
}

// ── Canvas entry for builder input ──────────────────────────────────────────

export interface CanvasInput {
  id: string
  name: string
  position: number
  graph: CanvasJSON
}

// ── Builder input ───────────────────────────────────────────────────────────

export interface BuildChainsolveJsonArgs {
  exportedAt: string
  appVersion: string
  buildSha: string
  buildTime: string
  buildEnv: string
  engineVersion: string
  engineContractVersion: number
  projectId: string | null
  projectName: string
  activeCanvasId: string | null
  variables: VariablesMap
  createdAt: string | null
  updatedAt: string | null
  canvases: CanvasInput[]
  assets: ExportAsset[]
}

// ── Per-canvas hash ─────────────────────────────────────────────────────────

export async function computeCanvasHash(
  graph: CanvasJSON,
  variables: VariablesMap,
): Promise<string> {
  const input = stableStringify({
    nodes: graph.nodes,
    edges: graph.edges,
    variables,
  })
  return sha256Hex(input)
}

// ── Asset manifest (for project hash) ───────────────────────────────────────

interface AssetManifestEntry {
  name: string
  mimeType: string
  sizeBytes: number
  encoding: string
  storagePath?: string
  sha256: string | null
}

function buildAssetManifest(assets: ExportAsset[]): AssetManifestEntry[] {
  return assets.map((a) => ({
    name: a.name,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    encoding: a.encoding,
    ...(a.encoding === 'storageRef' ? { storagePath: a.storagePath } : {}),
    sha256: a.sha256,
  }))
}

// ── Project hash ────────────────────────────────────────────────────────────

export async function computeProjectHash(args: BuildChainsolveJsonArgs): Promise<string> {
  const input = stableStringify({
    project: {
      id: args.projectId,
      name: args.projectName,
      variables: args.variables,
      activeCanvasId: args.activeCanvasId,
    },
    canvases: args.canvases
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position,
        graph: {
          nodes: c.graph.nodes,
          edges: c.graph.edges,
          datasetRefs: c.graph.datasetRefs,
        },
      })),
    assetsManifest: buildAssetManifest(args.assets),
  })
  return sha256Hex(input)
}

// ── Main builder ────────────────────────────────────────────────────────────

export async function buildChainsolveJsonExport(
  args: BuildChainsolveJsonArgs,
): Promise<ChainsolveJsonV1> {
  // Sort canvases by position (deterministic)
  const sortedCanvases = args.canvases.slice().sort((a, b) => a.position - b.position)

  // Compute per-canvas hashes
  const canvasHashes = await Promise.all(
    sortedCanvases.map(async (c) => ({
      id: c.id,
      hash: await computeCanvasHash(c.graph, args.variables),
    })),
  )

  // Sort assets by (name, storagePath) for determinism
  const sortedAssets = args.assets.slice().sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name)
    if (nameCompare !== 0) return nameCompare
    const pathA = a.encoding === 'storageRef' ? a.storagePath : ''
    const pathB = b.encoding === 'storageRef' ? b.storagePath : ''
    return pathA.localeCompare(pathB)
  })

  // Asset hash manifest for the hashes section
  const assetHashes = sortedAssets.map((a) => ({
    pathOrName: a.encoding === 'storageRef' ? a.storagePath : a.name,
    sha256: a.sha256,
    bytes: a.sizeBytes,
  }))

  // Compute project hash
  const projectHash = await computeProjectHash({
    ...args,
    canvases: sortedCanvases,
    assets: sortedAssets,
  })

  return {
    format: CHAINSOLVEJSON_FORMAT,
    version: CHAINSOLVEJSON_VERSION,
    exportedAt: args.exportedAt,
    exporter: {
      appVersion: args.appVersion,
      buildSha: args.buildSha,
      buildTime: args.buildTime,
      buildEnv: args.buildEnv,
      engineVersion: args.engineVersion,
      engineContractVersion: args.engineContractVersion,
    },
    hashes: {
      projectHash,
      canvases: canvasHashes,
      assets: assetHashes,
    },
    project: {
      id: args.projectId,
      name: args.projectName,
      description: '',
      activeCanvasId: args.activeCanvasId,
      variables: args.variables,
      created_at: args.createdAt,
      updated_at: args.updatedAt,
    },
    canvases: sortedCanvases.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      graph: c.graph,
    })),
    assets: sortedAssets,
  }
}

// ── Helpers for asset construction ──────────────────────────────────────────

/** 10 MB threshold for base64 embedding. */
export const EMBED_SIZE_LIMIT = 10 * 1024 * 1024

/** Build an embedded asset from raw bytes. */
export async function buildEmbeddedAsset(
  name: string,
  mimeType: string,
  bytes: Uint8Array,
): Promise<EmbeddedAsset> {
  const sha256 = await sha256BytesHex(bytes)
  // Convert bytes to base64
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const data = btoa(binary)
  return {
    name,
    mimeType,
    sizeBytes: bytes.length,
    encoding: 'base64',
    data,
    sha256,
  }
}

/** Build a referenced asset (too large to embed). */
export function buildReferencedAsset(
  name: string,
  mimeType: string,
  sizeBytes: number,
  storagePath: string,
  sha256: string | null,
): ReferencedAsset {
  return {
    name,
    mimeType,
    sizeBytes,
    encoding: 'storageRef',
    storagePath,
    sha256,
  }
}

// ── Validation ──────────────────────────────────────────────────────────────

/** Forbidden fields that must never appear in the export. */
const FORBIDDEN_FIELDS = [
  'access_token',
  'refresh_token',
  'anon_key',
  'service_role_key',
  'supabase_url',
  'email',
  'password',
]

/** Check that a serialized export contains no forbidden fields. */
export function validateNoSecrets(json: string): { ok: boolean; found: string[] } {
  const found: string[] = []
  for (const field of FORBIDDEN_FIELDS) {
    if (json.includes(`"${field}"`)) {
      found.push(field)
    }
  }
  return { ok: found.length === 0, found }
}

/** Check that all numeric values are finite (no NaN/Infinity). */
export function validateFiniteNumbers(obj: unknown): boolean {
  if (typeof obj === 'number') {
    return Number.isFinite(obj)
  }
  if (Array.isArray(obj)) {
    return obj.every(validateFiniteNumbers)
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).every(validateFiniteNumbers)
  }
  return true
}
