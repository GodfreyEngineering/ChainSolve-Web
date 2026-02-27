/**
 * importProject.ts — Orchestrator for .chainsolvejson import.
 *
 * Reads, parses, validates, and persists a .chainsolvejson file as a new project.
 * Uses the existing service layer (projects, canvases, storage, variables).
 *
 * On failure, attempts cleanup of partially created resources.
 */

import type { ChainsolveJsonV1 } from '../model'
import type { CanvasJSON } from '../../canvasSchema'
import { parseChainsolveJson } from './parse'
import { validateImport, type ValidationResult } from './validate'
import {
  extractImportSummary,
  buildImportReport,
  type ImportReport,
  type ImportSummary,
} from './report'
import { sha256BytesHex } from '../hashes'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ImportProgress {
  phase: 'validating' | 'creating' | 'canvases' | 'assets' | 'done' | 'failed'
  current?: number
  total?: number
}

/** Pure normalization result — no side effects, testable without a backend. */
export interface NormalizedImportPlan {
  newProjectId: string
  newProjectName: string
  activeCanvasId: string
  variables: ChainsolveJsonV1['project']['variables']
  canvasIdRemap: Record<string, string>
  canvases: {
    oldId: string
    newId: string
    name: string
    position: number
    normalizedGraph: CanvasJSON
  }[]
  assets: ChainsolveJsonV1['assets']
}

/**
 * Pure function: compute an import plan from a validated model.
 *
 * Sorts canvases, generates new IDs, normalizes graph fields.
 * Does NOT perform any network I/O — safe for unit tests.
 *
 * @param idGenerator  Function that returns a new UUID. Defaults to crypto.randomUUID().
 *                     Override in tests for deterministic IDs.
 */
export function normalizeImportPlan(
  model: ChainsolveJsonV1,
  idGenerator: () => string = () => crypto.randomUUID(),
): NormalizedImportPlan {
  const newProjectId = idGenerator()

  // Sort canvases by position, compact to 0..N-1
  const sortedCanvases = model.canvases.slice().sort((a, b) => a.position - b.position)

  // Generate new canvas IDs
  const canvasIdRemap: Record<string, string> = {}
  for (const c of sortedCanvases) {
    canvasIdRemap[c.id] = idGenerator()
  }

  // Determine active canvas
  const originalActiveId = model.project.activeCanvasId
  const activeCanvasId =
    originalActiveId && canvasIdRemap[originalActiveId]
      ? canvasIdRemap[originalActiveId]
      : canvasIdRemap[sortedCanvases[0].id]

  // Build normalized canvases with graph IDs rewritten
  const canvases = sortedCanvases.map((c, i) => {
    const newId = canvasIdRemap[c.id]
    return {
      oldId: c.id,
      newId,
      name: c.name,
      position: i,
      normalizedGraph: {
        schemaVersion: 4 as const,
        canvasId: newId,
        projectId: newProjectId,
        nodes: c.graph.nodes,
        edges: c.graph.edges,
        datasetRefs: c.graph.datasetRefs,
      },
    }
  })

  return {
    newProjectId,
    newProjectName: model.project.name,
    activeCanvasId,
    variables: model.project.variables,
    canvasIdRemap,
    canvases,
    assets: model.assets,
  }
}

export interface ImportResult {
  ok: boolean
  projectId: string | null
  report: ImportReport
}

export interface ImportOptions {
  fileName: string
  signal?: AbortSignal
  onProgress?: (progress: ImportProgress) => void
}

// ── Lazy import of service layer (code-split) ───────────────────────────────

async function loadServices() {
  const [projects, canvases, variablesService, canvasStorage, supabaseModule, storageModule] =
    await Promise.all([
      import('../../projects'),
      import('../../canvases'),
      import('../../variablesService'),
      import('../../canvasStorage'),
      import('../../supabase'),
      import('../../storage'),
    ])
  return {
    projects,
    canvases,
    variablesService,
    canvasStorage,
    supabase: supabaseModule.supabase,
    uploadAssetBytes: storageModule.uploadAssetBytes,
  }
}

// ── Pre-import: parse + validate + summary ──────────────────────────────────

export interface PreImportResult {
  model: ChainsolveJsonV1
  summary: ImportSummary
  validation: ValidationResult
}

export async function preImport(text: string): Promise<PreImportResult> {
  const model = parseChainsolveJson(text)
  const summary = extractImportSummary(model)
  const validation = await validateImport(model)
  return { model, summary, validation }
}

// ── Main import orchestrator ────────────────────────────────────────────────

export async function importChainsolveJsonAsNewProject(
  _text: string,
  model: ChainsolveJsonV1,
  validation: ValidationResult,
  opts: ImportOptions,
): Promise<ImportResult> {
  const { fileName, signal, onProgress } = opts
  const emptyOps = {
    projectCreated: false,
    newProjectId: null,
    canvasesImported: 0,
    assetsUploaded: 0,
    unreferencedAssets: [] as string[],
  }

  // If validation failed, return failure report immediately
  if (!validation.ok) {
    return {
      ok: false,
      projectId: null,
      report: buildImportReport(
        fileName,
        model,
        {
          passed: false,
          errors: validation.errors,
          warnings: validation.warnings,
        },
        emptyOps,
        {},
      ),
    }
  }

  const progress = onProgress ?? (() => {})
  progress({ phase: 'creating' })

  if (signal?.aborted) {
    return abortResult(fileName, model, validation)
  }

  const { canvasStorage, supabase, uploadAssetBytes } = await loadServices()

  // Get session for userId
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const userId = session.user.id

  // Compute the pure import plan (sorting, ID generation, normalization)
  const plan = normalizeImportPlan(model)
  const { newProjectId, canvasIdRemap } = plan

  let projectCreated = false
  const createdCanvasIds: string[] = []

  try {
    // 1. Create project row
    const storageKey = `${userId}/${newProjectId}/project.json`
    const { error: projErr } = await supabase.from('projects').insert({
      id: newProjectId,
      owner_id: userId,
      name: plan.newProjectName,
      storage_key: storageKey,
      active_canvas_id: plan.activeCanvasId,
      variables: plan.variables,
    })

    if (projErr) throw new Error(`Failed to create project: ${projErr.message}`)
    projectCreated = true

    if (signal?.aborted) {
      await cleanup(supabase, newProjectId, userId, createdCanvasIds, canvasStorage)
      return abortResult(fileName, model, validation)
    }

    // 2. For each canvas: insert row + upload graph JSON
    for (let i = 0; i < plan.canvases.length; i++) {
      if (signal?.aborted) {
        await cleanup(supabase, newProjectId, userId, createdCanvasIds, canvasStorage)
        return abortResult(fileName, model, validation)
      }

      progress({ phase: 'canvases', current: i + 1, total: plan.canvases.length })

      const c = plan.canvases[i]
      const storagePath = `${userId}/${newProjectId}/canvases/${c.newId}.json`

      // Upload graph JSON to storage
      await canvasStorage.uploadCanvasGraph(userId, newProjectId, c.newId, c.normalizedGraph)

      // Insert canvas DB row
      const { error: canvasErr } = await supabase.from('canvases').insert({
        id: c.newId,
        project_id: newProjectId,
        owner_id: userId,
        name: c.name,
        position: c.position,
        storage_path: storagePath,
      })

      if (canvasErr) throw new Error(`Failed to create canvas "${c.name}": ${canvasErr.message}`)
      createdCanvasIds.push(c.newId)
    }

    // 3. Upload embedded assets (best effort)
    const unreferencedAssets: string[] = []
    let assetsUploaded = 0

    for (let i = 0; i < model.assets.length; i++) {
      if (signal?.aborted) break

      const asset = model.assets[i]

      if (asset.encoding === 'base64') {
        progress({ phase: 'assets', current: i + 1, total: model.assets.length })

        try {
          // Decode base64
          const binary = atob(asset.data)
          const bytes = new Uint8Array(binary.length)
          for (let j = 0; j < binary.length; j++) {
            bytes[j] = binary.charCodeAt(j)
          }

          // Verify sha256 if present
          if (asset.sha256) {
            const computed = await sha256BytesHex(bytes)
            if (computed !== asset.sha256) {
              throw new Error(
                `SHA-256 mismatch for "${asset.name}": expected ${asset.sha256.slice(0, 16)}…, got ${computed.slice(0, 16)}…`,
              )
            }
          }

          // Upload to storage + insert project_assets row via centralized helper
          const kind = asset.mimeType.startsWith('text/csv') ? 'csv' : 'file'
          await uploadAssetBytes(
            newProjectId,
            asset.name,
            asset.mimeType,
            bytes,
            asset.sha256,
            kind,
          )
          assetsUploaded++
        } catch {
          unreferencedAssets.push(asset.name)
        }
      } else {
        // storageRef assets cannot be restored — record as unrestored
        unreferencedAssets.push(`${asset.name} (storageRef: ${asset.storagePath})`)
      }
    }

    // 4. Save an empty project.json for legacy compat
    const { saveProjectJson } = await import('../../storage')
    const pj = {
      schemaVersion: 3 as const,
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      project: { id: newProjectId, name: model.project.name },
      graph: { nodes: [] as unknown[], edges: [] as unknown[] },
      blockVersions: {} as Record<string, string>,
    }
    await saveProjectJson(newProjectId, pj)

    progress({ phase: 'done' })

    return {
      ok: true,
      projectId: newProjectId,
      report: buildImportReport(
        fileName,
        model,
        {
          passed: true,
          errors: [],
          warnings: validation.warnings,
        },
        {
          projectCreated: true,
          newProjectId,
          canvasesImported: createdCanvasIds.length,
          assetsUploaded,
          unreferencedAssets,
        },
        canvasIdRemap,
      ),
    }
  } catch (err: unknown) {
    // Cleanup on failure
    progress({ phase: 'failed' })

    if (projectCreated) {
      await cleanup(supabase, newProjectId, userId, createdCanvasIds, canvasStorage)
    }

    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      projectId: null,
      report: buildImportReport(
        fileName,
        model,
        {
          passed: false,
          errors: [...validation.errors, { code: 'IMPORT_FAILED', message: errorMsg }],
          warnings: validation.warnings,
        },
        emptyOps,
        canvasIdRemap,
      ),
    }
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup(
  supabase: {
    from: (table: string) => {
      delete: () => {
        eq: (col: string, val: string) => { eq: (col: string, val: string) => PromiseLike<unknown> }
      }
    }
  },
  projectId: string,
  userId: string,
  canvasIds: string[],
  canvasStorage: {
    deleteCanvasGraph: (userId: string, projectId: string, canvasId: string) => Promise<void>
  },
): Promise<void> {
  try {
    // Delete canvas storage (best effort)
    for (const cid of canvasIds) {
      try {
        await canvasStorage.deleteCanvasGraph(userId, projectId, cid)
      } catch {
        // best effort
      }
    }

    // Delete canvas rows
    await supabase.from('canvases').delete().eq('project_id', projectId).eq('owner_id', userId)

    // Delete project row (cascades to project_assets)
    await supabase.from('projects').delete().eq('id', projectId).eq('owner_id', userId)
  } catch {
    // Cleanup is best-effort
  }
}

// ── Abort helper ────────────────────────────────────────────────────────────

function abortResult(
  fileName: string,
  model: ChainsolveJsonV1,
  validation: ValidationResult,
): ImportResult {
  return {
    ok: false,
    projectId: null,
    report: buildImportReport(
      fileName,
      model,
      {
        passed: false,
        errors: [{ code: 'ABORTED', message: 'Import cancelled by user.' }],
        warnings: validation.warnings,
      },
      {
        projectCreated: false,
        newProjectId: null,
        canvasesImported: 0,
        assetsUploaded: 0,
        unreferencedAssets: [],
      },
      {},
    ),
  }
}
