/**
 * projects.ts — project CRUD operations against Supabase.
 *
 * All operations require an authenticated session.
 * Projects table uses `owner_id` (see migration 0003).
 *
 * PROJ-01: Conflict detection uses the `save_project_metadata` RPC which
 * performs a Compare-And-Swap on `updated_at` atomically in Postgres.
 * The blob is uploaded to storage first; then the RPC checks the CAS and
 * updates the DB. If conflict: true, the blob is a no-op (overwritten next
 * successful save). The caller is responsible for showing a resolution UI.
 */

import type { VariablesMap } from './variables'
import { supabase } from './supabase'
import {
  saveProjectJson,
  uploadProjectBlob,
  loadProjectJson,
  listProjectAssets,
  downloadAssetBytes,
  uploadAssetBytes,
} from './storage'
import { listCanvases, loadCanvasGraph, createCanvas, setActiveCanvas } from './canvases'
import { dlog } from '../observability/debugLog'
import { ServiceError, isRetryableError } from './errors'
import { validateProjectName } from './validateProjectName'

// ── Schema versioning ─────────────────────────────────────────────────────────

/**
 * Current schema version for project.json.
 * V1: scalar-only graph (W1-W4).
 * V2: adds Value type system, data/vector/table blocks (W5).
 * V3: adds csGroup node type with parentId-based grouping (W7).
 * V1 → V2 → V3 migrations are transparent (no structural change needed).
 */
export const SCHEMA_VERSION = 3 as const

// ── Public types ──────────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string
  owner_id: string
  name: string
  description: string | null
  storage_key: string | null
  active_canvas_id: string | null
  folder: string | null
  created_at: string
  updated_at: string
}

/**
 * Canonical project.json wire format.
 * schemaVersion 1: scalar-only (W1-W4)
 * schemaVersion 2: polymorphic Value system, data/vector/table blocks (W5+)
 * See docs/PROJECT_FORMAT.md for the full versioning contract.
 */
export interface ProjectJSON {
  schemaVersion: 1 | 2 | 3
  /** Monotonically increasing; incremented on every save. */
  formatVersion: number
  createdAt: string
  updatedAt: string
  project: {
    id: string
    name: string
  }
  graph: {
    nodes: unknown[]
    edges: unknown[]
  }
  /**
   * blockType → semver string. Populated in W8 for deterministic replays.
   * Empty object is valid for all schema versions.
   */
  blockVersions: Record<string, string>
}

// ── Private helpers ───────────────────────────────────────────────────────────

const SELECT_COLS =
  'id,owner_id,name,description,storage_key,active_canvas_id,folder,created_at,updated_at'

function buildJson(
  projectId: string,
  projectName: string,
  nodes: unknown[],
  edges: unknown[],
  prev?: Pick<ProjectJSON, 'createdAt' | 'formatVersion'>,
): ProjectJSON {
  return {
    schemaVersion: SCHEMA_VERSION,
    formatVersion: (prev?.formatVersion ?? 0) + 1,
    createdAt: prev?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    project: { id: projectId, name: projectName },
    graph: { nodes, edges },
    blockVersions: {},
  }
}

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new ServiceError('NOT_AUTHENTICATED', 'Not authenticated')
  return session
}

/** Map a Supabase error to a ServiceError with the appropriate code. */
function mapDbError(msg: string, context: string): ServiceError {
  if (msg.includes('projects_owner_name_unique')) {
    return new ServiceError('DUPLICATE_PROJECT_NAME', 'A project with that name already exists')
  }
  if (msg.includes('CS_PROJECT_LIMIT')) {
    return new ServiceError(
      'PROJECT_LIMIT_REACHED',
      'Project limit reached. Delete an existing project or upgrade to Pro.',
    )
  }
  if (msg.includes('projects_name_safe') || msg.includes('projects_name_length')) {
    return new ServiceError('INVALID_PROJECT_NAME', 'Project name contains invalid characters')
  }
  return new ServiceError('DB_ERROR', `${context}: ${msg}`, false)
}

function assertValidName(name: string): void {
  const v = validateProjectName(name)
  if (!v.ok) throw new ServiceError('INVALID_PROJECT_NAME', v.error ?? 'Invalid project name')
}

/**
 * Find a unique project name for the current user.
 * If "My Project" is taken, tries "My Project (2)", "My Project (3)", etc.
 */
export async function resolveUniqueName(desiredName: string): Promise<string> {
  const session = await requireSession()
  const { data } = await supabase
    .from('projects')
    .select('name')
    .eq('owner_id', session.user.id)
    .like('name', `${desiredName}%`)

  const existing = new Set((data ?? []).map((r: { name: string }) => r.name))
  if (!existing.has(desiredName)) return desiredName

  for (let i = 2; i <= 100; i++) {
    const candidate = `${desiredName} (${i})`
    if (!existing.has(candidate)) return candidate
  }
  return `${desiredName} (${crypto.randomUUID().slice(0, 8)})`
}

export async function readUpdatedAt(projectId: string): Promise<string | null> {
  const { data } = await supabase.from('projects').select('updated_at').eq('id', projectId).single()
  return (data as { updated_at: string } | null)?.updated_at ?? null
}

// ── Exported operations ───────────────────────────────────────────────────────

/** Read a single project row. Used by CanvasPage to anchor conflict detection + resolve active canvas. */
export async function readProjectRow(projectId: string): Promise<{
  name: string
  updated_at: string
  active_canvas_id: string | null
  variables: VariablesMap
} | null> {
  const { data } = await supabase
    .from('projects')
    .select('name,updated_at,active_canvas_id,variables')
    .eq('id', projectId)
    .single()
  if (!data) return null
  const row = data as {
    name: string
    updated_at: string
    active_canvas_id: string | null
    variables: VariablesMap | null
  }
  return { ...row, variables: row.variables ?? {} }
}

/**
 * Silently delete ghost projects: rows with no storage_key created > 10 min ago.
 * These are left by failed duplication/import operations. Best-effort — never throws.
 * BUG-06
 */
async function cleanupGhostProjects(): Promise<void> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('projects')
      .select('id')
      .is('storage_key', null)
      .lt('created_at', tenMinutesAgo)

    if (data && data.length > 0) {
      for (const ghost of data) {
        try {
          await supabase.from('projects').delete().eq('id', ghost.id)
          dlog.info('persistence', 'Cleaned up ghost project', { projectId: ghost.id })
        } catch {
          // ignore per-item errors
        }
      }
    }
  } catch {
    // Never crash the app for cleanup errors
  }
}

/** Return all projects for the current user, newest first. */
export async function listProjects(): Promise<ProjectRow[]> {
  // BUG-06: Clean up ghost projects from failed duplications (fire-and-forget)
  cleanupGhostProjects().catch(() => {})

  const { data, error } = await supabase
    .from('projects')
    .select(SELECT_COLS)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to list projects: ${error.message}`)

  // Deduplicate by id as a defensive measure (should never happen but just in case)
  const seen = new Set<string>()
  return ((data ?? []) as ProjectRow[]).filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
}

/**
 * Return the number of projects owned by the current user.
 * Lightweight head-only query — does not fetch row data.
 * Returns 0 when unauthenticated.
 */
export async function getProjectCount(): Promise<number> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return 0

  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })

  if (error) throw new Error(`Failed to count projects: ${error.message}`)
  return count ?? 0
}

/** Create a new project row + empty project.json in storage + first canvas. */
export async function createProject(name: string, folder?: string | null): Promise<ProjectRow> {
  assertValidName(name)
  const session = await requireSession()
  const uniqueName = await resolveUniqueName(name.trim())
  const projectId = crypto.randomUUID()
  const storageKey = `${session.user.id}/${projectId}/project.json`

  const row: Record<string, unknown> = {
    id: projectId,
    owner_id: session.user.id,
    name: uniqueName,
    storage_key: storageKey,
  }
  if (folder) row.folder = folder

  const { data, error } = await supabase.from('projects').insert(row).select(SELECT_COLS).single()

  if (error) throw mapDbError(error.message, 'Failed to create project')
  if (!data) throw new ServiceError('DB_ERROR', 'Failed to create project')
  const proj = data as ProjectRow

  const pj = buildJson(proj.id, name, [], [])
  await saveProjectJson(proj.id, pj)

  // Create the first canvas so SheetsBar shows immediately on load
  const canvas = await createCanvas(proj.id, 'Sheet 1')
  await setActiveCanvas(proj.id, canvas.id)

  // Re-read to get the updated_at set by the storage_key stamp
  const updated = await readUpdatedAt(proj.id)
  return { ...proj, updated_at: updated ?? proj.updated_at }
}

/**
 * Create a new project pre-populated from a built-in template.
 * Calls the template's buildGraph factory, then persists the result.
 */
export async function createProjectFromTemplate(templateId: string): Promise<ProjectRow> {
  const { TEMPLATES } = await import('../templates/index')
  const tmpl = TEMPLATES.find((t) => t.id === templateId)
  if (!tmpl) throw new Error(`Unknown template: ${templateId}`)

  const session = await requireSession()
  const uniqueName = await resolveUniqueName(tmpl.name)
  const projectId = crypto.randomUUID()
  const canvasId = crypto.randomUUID()
  const storageKey = `${session.user.id}/${projectId}/project.json`

  const { data, error } = await supabase
    .from('projects')
    .insert({
      id: projectId,
      owner_id: session.user.id,
      name: uniqueName,
      storage_key: storageKey,
    })
    .select(SELECT_COLS)
    .single()

  if (error) throw mapDbError(error.message, 'Failed to create project')
  if (!data) throw new ServiceError('DB_ERROR', 'Failed to create project')
  const proj = data as ProjectRow

  const graph = tmpl.buildGraph(canvasId, projectId)
  const pj = buildJson(proj.id, uniqueName, graph.nodes, graph.edges)
  await saveProjectJson(proj.id, pj)

  // Create the first canvas with the template graph
  const canvasRow = await createCanvas(proj.id, 'Sheet 1', {
    nodes: graph.nodes,
    edges: graph.edges,
  })
  await setActiveCanvas(proj.id, canvasRow.id)

  const updated = await readUpdatedAt(proj.id)
  return { ...proj, updated_at: updated ?? proj.updated_at }
}

/** Load and parse the project.json from storage. Accepts V1 and V2 transparently. */
export async function loadProject(projectId: string): Promise<ProjectJSON> {
  dlog.debug('persistence', 'Loading project', { projectId })
  const raw = await loadProjectJson(projectId)
  const pj = raw as Partial<ProjectJSON>

  if (pj.schemaVersion === 1 || pj.schemaVersion === 2 || pj.schemaVersion === 3) {
    // V1 → V2 → V3: no structural migration needed.
    // V1 nodes are all scalar; V2 adds data/vector/table; V3 adds groups (csGroup + parentId).
    dlog.info('persistence', 'Project loaded', { projectId, schemaVersion: pj.schemaVersion })
    return raw as ProjectJSON
  }
  dlog.error('persistence', 'Unsupported schemaVersion', {
    projectId,
    schemaVersion: String(pj.schemaVersion ?? 'missing'),
  })
  throw new Error(`Unsupported schemaVersion: ${String(pj.schemaVersion ?? 'missing')}`)
}

/**
 * PROJ-01: Save graph to storage with atomic CAS conflict detection.
 *
 * Steps:
 * 1. Build and upload the project JSON blob to storage.
 * 2. Call save_project_metadata RPC with the storage key and knownUpdatedAt.
 *    The RPC atomically checks the current updated_at and updates the row.
 * 3. If conflict: true, return without overwriting — caller shows resolution UI.
 *
 * E8-1: When `skipConflictCheck` is true, skip the CAS and just do the
 * upload + a plain storage_key update. Used when the caller has already
 * verified there is no conflict (avoids false positives from same-session
 * writes that bump updated_at between check and save).
 */
export async function saveProject(
  projectId: string,
  projectName: string,
  nodes: unknown[],
  edges: unknown[],
  knownUpdatedAt: string,
  prev?: Pick<ProjectJSON, 'createdAt' | 'formatVersion'>,
  skipConflictCheck?: boolean,
): Promise<{ updatedAt: string; conflict: boolean }> {
  const pj = buildJson(projectId, projectName, nodes, edges, prev)

  if (skipConflictCheck) {
    // Caller already verified no conflict — plain save without CAS.
    await saveProjectJson(projectId, pj)
    const freshUpdatedAt = (await readUpdatedAt(projectId)) ?? new Date().toISOString()
    dlog.info('persistence', 'Project saved (skip-check)', { projectId })
    return { updatedAt: freshUpdatedAt, conflict: false }
  }

  // PROJ-01: Upload blob first (no DB update), then CAS via RPC.
  const storageKey = await uploadProjectBlob(projectId, pj)

  type RpcRow = { updated_at: string; conflict: boolean }
  const { data, error } = await supabase.rpc('save_project_metadata', {
    p_id: projectId,
    p_known_updated_at: knownUpdatedAt,
    p_name: projectName,
    p_storage_key: storageKey,
    p_variables: null,
  })

  if (error) {
    throw new ServiceError('DB_ERROR', `save_project_metadata failed: ${error.message}`, true)
  }

  const row = (data as RpcRow[] | null)?.[0]
  if (!row) {
    throw new ServiceError('DB_ERROR', 'save_project_metadata returned no rows', true)
  }

  if (row.conflict) {
    dlog.warn('persistence', 'Conflict detected', { projectId })
    return { updatedAt: row.updated_at, conflict: true }
  }

  dlog.info('persistence', 'Project saved (atomic CAS)', { projectId, formatVersion: pj.formatVersion })
  return { updatedAt: row.updated_at, conflict: false }
}

/** Rename a project row. Returns the new DB updated_at. */
export async function renameProject(projectId: string, name: string): Promise<string> {
  assertValidName(name)
  const { data, error } = await supabase
    .from('projects')
    .update({ name: name.trim() })
    .eq('id', projectId)
    .select('updated_at')
    .single()

  if (error) throw mapDbError(error.message, 'Rename failed')
  return (data as { updated_at: string }).updated_at
}

/**
 * Delete a project: clean up storage files first, then remove the DB row.
 * Storage errors are logged but do not block deletion — a missing blob is
 * harmless, while a stuck DB row is not.
 */
export async function deleteProject(projectId: string): Promise<void> {
  const session = await requireSession()
  const userId = session.user.id
  const prefix = `${userId}/${projectId}/`

  // Clean up project.json in the "projects" bucket
  try {
    const { data: projFiles } = await supabase.storage.from('projects').list(prefix)
    if (projFiles?.length) {
      await supabase.storage.from('projects').remove(projFiles.map((f) => `${prefix}${f.name}`))
    }
  } catch {
    // Storage cleanup is best-effort
  }

  // Clean up per-canvas JSONs in the "projects" bucket (W10.7)
  try {
    const canvasPrefix = `${prefix}canvases/`
    const { data: canvasFiles } = await supabase.storage.from('projects').list(canvasPrefix)
    if (canvasFiles?.length) {
      await supabase.storage
        .from('projects')
        .remove(canvasFiles.map((f) => `${canvasPrefix}${f.name}`))
    }
  } catch {
    // Storage cleanup is best-effort
  }

  // Clean up uploads in the "uploads" bucket
  try {
    const uploadPrefix = `${userId}/${projectId}/uploads/`
    const { data: uploadFiles } = await supabase.storage.from('uploads').list(uploadPrefix)
    if (uploadFiles?.length) {
      await supabase.storage
        .from('uploads')
        .remove(uploadFiles.map((f) => `${uploadPrefix}${f.name}`))
    }
  } catch {
    // Storage cleanup is best-effort
  }

  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw new Error(`Delete failed: ${error.message}`)
}

/**
 * Create a new project that is a copy of the source project's graph + variables + canvases + assets.
 *
 * BUG-05 fixes:
 * - Full rollback (deleteProject) if any step fails after the DB row is created.
 * - Legacy projects with no canvas rows: fall back to the monolithic project.json graph.
 */
export async function duplicateProject(sourceId: string, newName: string): Promise<ProjectRow> {
  assertValidName(newName)
  const session = await requireSession()
  const uniqueName = await resolveUniqueName(newName.trim())
  const projectId = crypto.randomUUID()
  const storageKey = `${session.user.id}/${projectId}/project.json`

  // Copy variables from source project
  const srcRow = await readProjectRow(sourceId)
  const srcVariables = srcRow?.variables ?? {}

  const { data, error } = await supabase
    .from('projects')
    .insert({
      id: projectId,
      owner_id: session.user.id,
      name: uniqueName,
      storage_key: storageKey,
      variables: srcVariables,
    })
    .select(SELECT_COLS)
    .single()

  if (error) throw mapDbError(error.message, 'Failed to create project row')
  if (!data) throw new ServiceError('DB_ERROR', 'Failed to create project row')
  const newProj = data as ProjectRow

  // Rollback helper: delete the project row if anything goes wrong
  const rollback = async () => {
    try {
      await deleteProject(newProj.id)
    } catch {
      // Best-effort — log but don't mask the original error
      dlog.error('persistence', 'Rollback failed for duplicate', { projectId: newProj.id })
    }
  }

  try {
    let srcGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }
    try {
      const src = await loadProject(sourceId)
      srcGraph = src.graph
    } catch {
      // If source has no storage file, start empty (tolerated)
    }

    const pj = buildJson(newProj.id, newName, srcGraph.nodes, srcGraph.edges)
    await saveProjectJson(newProj.id, pj)

    // Copy canvases (rows + per-canvas storage JSON)
    const sourceCanvases = await listCanvases(sourceId)
    let firstNewCanvasId: string | null = null

    if (sourceCanvases.length > 0) {
      // Modern project: copy each canvas
      for (const canvas of sourceCanvases) {
        const graph = await loadCanvasGraph(sourceId, canvas.id)
        const newCanvas = await createCanvas(newProj.id, canvas.name, {
          nodes: graph.nodes,
          edges: graph.edges,
        })
        if (firstNewCanvasId === null) firstNewCanvasId = newCanvas.id
      }
    } else {
      // Legacy project: no canvas rows — create one canvas from the monolithic project.json graph
      dlog.info('persistence', 'Legacy project detected during duplication — using project.json graph', {
        sourceId,
      })
      const newCanvas = await createCanvas(newProj.id, 'Sheet 1', {
        nodes: srcGraph.nodes,
        edges: srcGraph.edges,
      })
      firstNewCanvasId = newCanvas.id
    }

    if (firstNewCanvasId) {
      await setActiveCanvas(newProj.id, firstNewCanvasId)
    }

    // Copy project assets (metadata + bytes)
    const srcAssets = await listProjectAssets(sourceId)
    for (const asset of srcAssets) {
      const bytes = await downloadAssetBytes(asset.storage_path)
      await uploadAssetBytes(
        newProj.id,
        asset.name,
        asset.mime_type ?? 'application/octet-stream',
        bytes,
        asset.sha256,
        asset.kind ?? 'csv',
      )
    }
  } catch (err) {
    await rollback()
    throw err
  }

  const updated = await readUpdatedAt(newProj.id)
  return { ...newProj, updated_at: updated ?? newProj.updated_at }
}

/** Result of validateProjectJSON — ok or a structured error. */
export type ProjectJSONValidation =
  | { ok: true; json: ProjectJSON; warnings: string[] }
  | { ok: false; error: string }

/**
 * PROJ-06: Validate and normalise an unknown JSON blob as a ProjectJSON.
 *
 * - Checks required top-level fields.
 * - Warns (does not fail) on future schemaVersion so older clients can still import.
 * - Fills in missing optional fields with safe defaults.
 * - Returns structured warnings for the UI to display.
 */
export function validateProjectJSON(raw: unknown): ProjectJSONValidation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Not a valid project file (expected a JSON object)' }
  }
  const obj = raw as Record<string, unknown>

  // schemaVersion
  const sv = obj.schemaVersion
  if (typeof sv !== 'number') {
    return { ok: false, error: 'Missing or invalid schemaVersion field' }
  }
  if (sv < 1) {
    return { ok: false, error: `Unrecognised schemaVersion ${sv}` }
  }

  // project.name
  const project = obj.project as Record<string, unknown> | undefined
  if (!project || typeof project.name !== 'string' || !project.name.trim()) {
    return { ok: false, error: 'Missing project.name field' }
  }

  // graph
  const graph = obj.graph as Record<string, unknown> | undefined
  if (!graph) {
    return { ok: false, error: 'Missing graph field' }
  }

  const warnings: string[] = []

  // Future schema warning
  if (sv > SCHEMA_VERSION) {
    warnings.push(
      `This file uses schemaVersion ${sv} which is newer than this version supports (${SCHEMA_VERSION}). ` +
        `Some features may not load correctly.`,
    )
  }

  // Normalise optional fields
  const normalised: ProjectJSON = {
    schemaVersion: Math.min(sv, SCHEMA_VERSION) as 1 | 2 | 3,
    formatVersion: typeof obj.formatVersion === 'number' ? obj.formatVersion : 0,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
    project: {
      id: typeof project.id === 'string' ? project.id : crypto.randomUUID(),
      name: (project.name as string).trim(),
    },
    graph: {
      nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
      edges: Array.isArray(graph.edges) ? graph.edges : [],
    },
    blockVersions:
      graph.blockVersions && typeof graph.blockVersions === 'object' && !Array.isArray(graph.blockVersions)
        ? (graph.blockVersions as Record<string, string>)
        : typeof obj.blockVersions === 'object' && !Array.isArray(obj.blockVersions) && obj.blockVersions !== null
          ? (obj.blockVersions as Record<string, string>)
          : {},
  }

  if (!Array.isArray(graph.nodes)) {
    warnings.push('graph.nodes was missing or invalid — importing with empty node list')
  }
  if (!Array.isArray(graph.edges)) {
    warnings.push('graph.edges was missing or invalid — importing with empty edge list')
  }

  return { ok: true, json: normalised, warnings }
}

/**
 * Import a parsed project.json blob as a new project.
 * Validates schemaVersion and rebinds IDs to a fresh DB row.
 */
export async function importProject(json: ProjectJSON, overrideName?: string): Promise<ProjectRow> {
  if (json.schemaVersion !== 1 && json.schemaVersion !== 2 && json.schemaVersion !== 3) {
    throw new Error(`Cannot import: unsupported schemaVersion ${String(json.schemaVersion)}`)
  }

  const rawName = overrideName ?? json.project?.name ?? 'Imported Project'
  assertValidName(rawName)
  const session = await requireSession()
  const name = await resolveUniqueName(rawName.trim())
  const projectId = crypto.randomUUID()
  const storageKey = `${session.user.id}/${projectId}/project.json`

  const { data, error } = await supabase
    .from('projects')
    .insert({ id: projectId, owner_id: session.user.id, name, storage_key: storageKey })
    .select(SELECT_COLS)
    .single()

  if (error) throw mapDbError(error.message, 'Failed to create project row')
  if (!data) throw new ServiceError('DB_ERROR', 'Failed to create project row')
  const proj = data as ProjectRow

  const graphData = json.graph ?? { nodes: [], edges: [] }
  const pj: ProjectJSON = {
    schemaVersion: SCHEMA_VERSION,
    formatVersion: (json.formatVersion ?? 0) + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    project: { id: proj.id, name },
    graph: graphData,
    blockVersions: json.blockVersions ?? {},
  }
  await saveProjectJson(proj.id, pj)

  // Create the first canvas with the imported graph
  const canvasRow = await createCanvas(proj.id, 'Sheet 1', {
    nodes: graphData.nodes,
    edges: graphData.edges,
  })
  await setActiveCanvas(proj.id, canvasRow.id)

  const updated = await readUpdatedAt(proj.id)
  return { ...proj, updated_at: updated ?? proj.updated_at }
}

// ── Save with retry ─────────────────────────────────────────────────────────

const RETRY_DELAYS = [1000, 2000, 4000]

/**
 * Save with automatic retry for transient failures.
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 * Non-retryable errors (conflicts, auth) are thrown immediately.
 */
export async function saveProjectWithRetry(
  ...args: Parameters<typeof saveProject>
): Promise<ReturnType<typeof saveProject>> {
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await saveProject(...args)
    } catch (err) {
      lastError = err
      if (err instanceof ServiceError && err.code === 'SAVE_CONFLICT') throw err
      if (attempt < RETRY_DELAYS.length && isRetryableError(err)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
        continue
      }
      throw err
    }
  }
  throw lastError
}

// ── L4-2: Folder + bulk operations ──────────────────────────────────────────

/** Move a project to a folder. Pass null to move back to root. */
export async function moveToFolder(projectId: string, folder: string | null): Promise<void> {
  const { error } = await supabase.from('projects').update({ folder }).eq('id', projectId)
  if (error) throw new Error(`Move to folder failed: ${error.message}`)
}

/** Move multiple projects to a folder in one go. */
export async function bulkMoveToFolder(projectIds: string[], folder: string | null): Promise<void> {
  if (projectIds.length === 0) return
  const { error } = await supabase.from('projects').update({ folder }).in('id', projectIds)
  if (error) throw new Error(`Bulk move failed: ${error.message}`)
}

/** Delete multiple projects. Storage cleanup is best-effort per project. */
export async function bulkDeleteProjects(projectIds: string[]): Promise<void> {
  for (const id of projectIds) {
    await deleteProject(id)
  }
}

/**
 * Return distinct folder names for the current user's projects.
 * Returns a sorted array of non-null folder strings.
 */
export async function listFolders(): Promise<string[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('folder')
    .not('folder', 'is', null)
    .order('folder', { ascending: true })

  if (error) throw new Error(`Failed to list folders: ${error.message}`)
  const seen = new Set<string>()
  for (const row of data ?? []) {
    const f = (row as { folder: string }).folder
    if (f) seen.add(f)
  }
  return [...seen].sort((a, b) => a.localeCompare(b))
}
