/**
 * validate.ts — Deep validation for .chainsolvejson import.
 *
 * Checks secrets, numeric safety, hash integrity, and structural correctness.
 * Pure functions: no side effects, no DOM, no Supabase.
 */

import type { ChainsolveJsonV1, BuildChainsolveJsonArgs } from '../model'
import { EMBED_SIZE_LIMIT, validateNoSecrets, validateFiniteNumbers } from '../model'
import { computeCanvasHash, computeProjectHash } from '../model'

// ── Error types ─────────────────────────────────────────────────────────────

export interface ImportError {
  code: string
  message: string
  path?: string
}

export interface ValidationResult {
  ok: boolean
  errors: ImportError[]
  warnings: ImportError[]
}

// ── Main validation ─────────────────────────────────────────────────────────

export async function validateImport(model: ChainsolveJsonV1): Promise<ValidationResult> {
  const errors: ImportError[] = []
  const warnings: ImportError[] = []

  // 1. Secret check — scan the full serialized JSON for forbidden fields
  const json = JSON.stringify(model)
  const secretCheck = validateNoSecrets(json)
  if (!secretCheck.ok) {
    for (const field of secretCheck.found) {
      errors.push({
        code: 'SECRET_DETECTED',
        message: `Forbidden field "${field}" found in import data.`,
        path: field,
      })
    }
  }

  // 2. Check for email patterns in string values
  checkForEmails(model, errors)

  // 3. Numeric safety — no NaN/Infinity in variables
  if (!validateFiniteNumbers(model.project.variables)) {
    errors.push({
      code: 'INVALID_NUMBER',
      message: 'Variables contain NaN or Infinity values.',
      path: 'project.variables',
    })
  }

  // 4. Numeric safety — nodes/edges
  for (let i = 0; i < model.canvases.length; i++) {
    const c = model.canvases[i]
    if (!validateFiniteNumbers(c.graph.nodes)) {
      errors.push({
        code: 'INVALID_NUMBER',
        message: `Canvas "${c.name}" nodes contain NaN or Infinity values.`,
        path: `canvases[${i}].graph.nodes`,
      })
    }
    if (!validateFiniteNumbers(c.graph.edges)) {
      errors.push({
        code: 'INVALID_NUMBER',
        message: `Canvas "${c.name}" edges contain NaN or Infinity values.`,
        path: `canvases[${i}].graph.edges`,
      })
    }
  }

  // 5. Schema version check
  for (let i = 0; i < model.canvases.length; i++) {
    if (model.canvases[i].graph.schemaVersion !== 4) {
      errors.push({
        code: 'SCHEMA_VERSION',
        message: `Canvas "${model.canvases[i].name}" has schemaVersion ${model.canvases[i].graph.schemaVersion}, expected 4.`,
        path: `canvases[${i}].graph.schemaVersion`,
      })
    }
  }

  // 6. Canvas ID consistency (graph.canvasId should match canvas.id)
  for (let i = 0; i < model.canvases.length; i++) {
    const c = model.canvases[i]
    if (c.graph.canvasId && c.graph.canvasId !== c.id) {
      warnings.push({
        code: 'CANVAS_ID_MISMATCH',
        message: `Canvas "${c.name}" graph.canvasId "${c.graph.canvasId}" differs from canvas.id "${c.id}". Will normalize on import.`,
        path: `canvases[${i}].graph.canvasId`,
      })
    }
  }

  // 7. Duplicate canvas IDs
  const canvasIds = new Set<string>()
  for (let i = 0; i < model.canvases.length; i++) {
    if (canvasIds.has(model.canvases[i].id)) {
      errors.push({
        code: 'DUPLICATE_CANVAS_ID',
        message: `Duplicate canvas ID "${model.canvases[i].id}" at index ${i}.`,
        path: `canvases[${i}].id`,
      })
    }
    canvasIds.add(model.canvases[i].id)
  }

  // 8. Embedded asset size check
  for (let i = 0; i < model.assets.length; i++) {
    const a = model.assets[i]
    if (a.encoding === 'base64' && a.sizeBytes > EMBED_SIZE_LIMIT) {
      errors.push({
        code: 'ASSET_TOO_LARGE',
        message: `Embedded asset "${a.name}" is ${a.sizeBytes} bytes (max ${EMBED_SIZE_LIMIT}).`,
        path: `assets[${i}]`,
      })
    }
  }

  // 9. Hash verification (only if no errors yet — hashing is expensive)
  if (errors.length === 0) {
    await verifyHashes(model, errors)
  }

  return { ok: errors.length === 0, errors, warnings }
}

// ── Hash verification ───────────────────────────────────────────────────────

async function verifyHashes(model: ChainsolveJsonV1, errors: ImportError[]): Promise<void> {
  const variables = model.project.variables

  // Per-canvas hashes
  for (let i = 0; i < model.canvases.length; i++) {
    const c = model.canvases[i]
    const expectedEntry = model.hashes.canvases.find((h) => h.id === c.id)
    if (!expectedEntry) {
      errors.push({
        code: 'MISSING_CANVAS_HASH',
        message: `No hash entry for canvas "${c.name}" (${c.id}).`,
        path: `hashes.canvases`,
      })
      continue
    }

    const computed = await computeCanvasHash(c.graph, variables)
    if (computed !== expectedEntry.hash) {
      errors.push({
        code: 'CANVAS_HASH_MISMATCH',
        message: `Canvas "${c.name}" hash mismatch. Expected: ${expectedEntry.hash.slice(0, 16)}…, got: ${computed.slice(0, 16)}…`,
        path: `canvases[${i}]`,
      })
    }
  }

  // Project hash
  const args: BuildChainsolveJsonArgs = {
    exportedAt: model.exportedAt,
    appVersion: model.exporter.appVersion,
    buildSha: model.exporter.buildSha,
    buildTime: model.exporter.buildTime,
    buildEnv: model.exporter.buildEnv,
    engineVersion: model.exporter.engineVersion,
    engineContractVersion: model.exporter.engineContractVersion,
    projectId: model.project.id,
    projectName: model.project.name,
    activeCanvasId: model.project.activeCanvasId,
    variables,
    createdAt: model.project.created_at,
    updatedAt: model.project.updated_at,
    canvases: model.canvases.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      graph: c.graph,
    })),
    assets: model.assets,
  }

  const computedProjectHash = await computeProjectHash(args)
  if (computedProjectHash !== model.hashes.projectHash) {
    errors.push({
      code: 'PROJECT_HASH_MISMATCH',
      message: `Project hash mismatch. Expected: ${model.hashes.projectHash.slice(0, 16)}…, got: ${computedProjectHash.slice(0, 16)}…`,
      path: 'hashes.projectHash',
    })
  }
}

// ── Email detection ─────────────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

function checkForEmails(model: ChainsolveJsonV1, errors: ImportError[]): void {
  // Check project name/description
  if (EMAIL_REGEX.test(model.project.name)) {
    errors.push({
      code: 'EMAIL_DETECTED',
      message: 'Email address detected in project name.',
      path: 'project.name',
    })
  }
  if (EMAIL_REGEX.test(model.project.description ?? '')) {
    errors.push({
      code: 'EMAIL_DETECTED',
      message: 'Email address detected in project description.',
      path: 'project.description',
    })
  }
}
