/**
 * parse.ts — Parse and structurally validate a .chainsolvejson file.
 *
 * Pure function: no side effects, no DOM, no Supabase imports.
 * Returns a typed ChainsolveJsonV1 or throws with a descriptive message.
 */

import type { ChainsolveJsonV1 } from '../model'

// ── Parse errors ────────────────────────────────────────────────────────────

export class ImportParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportParseError'
  }
}

// ── Main parser ─────────────────────────────────────────────────────────────

export function parseChainsolveJson(text: string): ChainsolveJsonV1 {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ImportParseError('File is not valid JSON.')
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ImportParseError('File root must be a JSON object.')
  }

  const obj = raw as Record<string, unknown>

  // ── format + version ────────────────────────────────────────────────────
  if (obj.format !== 'chainsolvejson') {
    throw new ImportParseError(
      `Unsupported format: expected "chainsolvejson", got "${String(obj.format)}".`,
    )
  }
  if (obj.version !== 1) {
    throw new ImportParseError(`Unsupported version: expected 1, got ${String(obj.version)}.`)
  }

  // ── exportedAt ──────────────────────────────────────────────────────────
  requireString(obj, 'exportedAt')

  // ── exporter ────────────────────────────────────────────────────────────
  const exporter = requireObject(obj, 'exporter')
  requireString(exporter, 'appVersion')
  requireString(exporter, 'buildSha')
  requireString(exporter, 'buildTime')
  requireString(exporter, 'buildEnv')
  requireString(exporter, 'engineVersion')
  requireNumber(exporter, 'engineContractVersion')

  // ── hashes ──────────────────────────────────────────────────────────────
  const hashes = requireObject(obj, 'hashes')
  requireString(hashes, 'projectHash')
  requireArray(hashes, 'canvases')
  requireArray(hashes, 'assets')

  for (const ch of hashes.canvases as unknown[]) {
    if (!ch || typeof ch !== 'object')
      throw new ImportParseError('hashes.canvases entry must be an object.')
    const entry = ch as Record<string, unknown>
    requireString(entry, 'id')
    requireString(entry, 'hash')
  }

  // ── project ─────────────────────────────────────────────────────────────
  const project = requireObject(obj, 'project')
  if (project.id !== null && typeof project.id !== 'string') {
    throw new ImportParseError('project.id must be a string or null.')
  }
  requireString(project, 'name')
  // description, activeCanvasId, created_at, updated_at can be null/string
  if (
    !project.variables ||
    typeof project.variables !== 'object' ||
    Array.isArray(project.variables)
  ) {
    throw new ImportParseError('project.variables must be an object.')
  }
  validateVariablesMap(project.variables as Record<string, unknown>)

  // ── canvases ────────────────────────────────────────────────────────────
  const canvases = requireArray(obj, 'canvases')
  if (canvases.length === 0) {
    throw new ImportParseError('Project must contain at least one canvas.')
  }

  for (let i = 0; i < canvases.length; i++) {
    const c = canvases[i]
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      throw new ImportParseError(`canvases[${i}] must be an object.`)
    }
    const canvas = c as Record<string, unknown>
    requireString(canvas, 'id')
    requireString(canvas, 'name')
    requireNumber(canvas, 'position')
    const graph = requireObject(canvas, 'graph')
    validateCanvasGraph(graph, i)
  }

  // ── assets ──────────────────────────────────────────────────────────────
  const assets = requireArray(obj, 'assets')
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i]
    if (!a || typeof a !== 'object' || Array.isArray(a)) {
      throw new ImportParseError(`assets[${i}] must be an object.`)
    }
    validateAsset(a as Record<string, unknown>, i)
  }

  return obj as unknown as ChainsolveJsonV1
}

// ── Canvas graph validation ─────────────────────────────────────────────────

function validateCanvasGraph(graph: Record<string, unknown>, index: number): void {
  if (graph.schemaVersion !== 4) {
    throw new ImportParseError(
      `canvases[${index}].graph.schemaVersion must be 4, got ${String(graph.schemaVersion)}.`,
    )
  }
  if (!Array.isArray(graph.nodes)) {
    throw new ImportParseError(`canvases[${index}].graph.nodes must be an array.`)
  }
  if (!Array.isArray(graph.edges)) {
    throw new ImportParseError(`canvases[${index}].graph.edges must be an array.`)
  }
  if (!Array.isArray(graph.datasetRefs)) {
    throw new ImportParseError(`canvases[${index}].graph.datasetRefs must be an array.`)
  }
}

// ── Variables map validation ────────────────────────────────────────────────

function validateVariablesMap(vars: Record<string, unknown>): void {
  for (const [key, val] of Object.entries(vars)) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      throw new ImportParseError(`variables["${key}"] must be an object.`)
    }
    const v = val as Record<string, unknown>
    if (typeof v.id !== 'string')
      throw new ImportParseError(`variables["${key}"].id must be a string.`)
    if (typeof v.name !== 'string')
      throw new ImportParseError(`variables["${key}"].name must be a string.`)
    if (typeof v.value !== 'number')
      throw new ImportParseError(`variables["${key}"].value must be a number.`)
  }
}

// ── Asset validation ────────────────────────────────────────────────────────

function validateAsset(a: Record<string, unknown>, index: number): void {
  requireString(a, 'name', `assets[${index}]`)
  requireString(a, 'mimeType', `assets[${index}]`)
  requireNumber(a, 'sizeBytes', `assets[${index}]`)
  requireString(a, 'encoding', `assets[${index}]`)

  const encoding = a.encoding as string
  if (encoding === 'base64') {
    if (typeof a.data !== 'string') {
      throw new ImportParseError(`assets[${index}].data must be a string for base64 encoding.`)
    }
    if (typeof a.sha256 !== 'string') {
      throw new ImportParseError(`assets[${index}].sha256 must be a string for base64 encoding.`)
    }
  } else if (encoding === 'storageRef') {
    if (typeof a.storagePath !== 'string') {
      throw new ImportParseError(
        `assets[${index}].storagePath must be a string for storageRef encoding.`,
      )
    }
  } else {
    throw new ImportParseError(
      `assets[${index}].encoding must be "base64" or "storageRef", got "${encoding}".`,
    )
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireString(obj: Record<string, unknown>, key: string, prefix = ''): string {
  const label = prefix ? `${prefix}.${key}` : key
  if (typeof obj[key] !== 'string') {
    throw new ImportParseError(`${label} must be a string.`)
  }
  return obj[key] as string
}

function requireNumber(obj: Record<string, unknown>, key: string, prefix = ''): number {
  const label = prefix ? `${prefix}.${key}` : key
  if (typeof obj[key] !== 'number') {
    throw new ImportParseError(`${label} must be a number.`)
  }
  return obj[key] as number
}

function requireObject(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  if (!obj[key] || typeof obj[key] !== 'object' || Array.isArray(obj[key])) {
    throw new ImportParseError(`${key} must be an object.`)
  }
  return obj[key] as Record<string, unknown>
}

function requireArray(obj: Record<string, unknown>, key: string): unknown[] {
  if (!Array.isArray(obj[key])) {
    throw new ImportParseError(`${key} must be an array.`)
  }
  return obj[key] as unknown[]
}
