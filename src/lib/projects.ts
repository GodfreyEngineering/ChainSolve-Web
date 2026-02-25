/**
 * projects.ts — project CRUD operations against Supabase.
 *
 * All operations require an authenticated session.
 * Projects table uses `owner_id` (see migration 0003).
 *
 * Conflict detection: before every save we read the DB updated_at and
 * compare it with the value we captured at load time. If the DB is newer,
 * a concurrent write occurred — we return { conflict: true } without
 * overwriting. The caller is responsible for showing a resolution UI.
 *
 * For W8+ we will replace the read-then-write with an atomic Postgres
 * RPC (CAS on updated_at). See docs/PROJECT_FORMAT.md §Conflict detection.
 */

import { supabase } from './supabase'
import { saveProjectJson, loadProjectJson } from './storage'

// ── Schema versioning ─────────────────────────────────────────────────────────

/** Bump only when the JSON shape is incompatible with older readers. */
export const SCHEMA_VERSION = 1 as const

// ── Public types ──────────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string
  owner_id: string
  name: string
  description: string | null
  storage_key: string | null
  created_at: string
  updated_at: string
}

/**
 * Canonical project.json wire format (schemaVersion 1).
 * See docs/PROJECT_FORMAT.md for the full versioning contract.
 */
export interface ProjectJSON {
  schemaVersion: 1
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
   * Empty object is valid for schemaVersion 1.
   */
  blockVersions: Record<string, string>
}

// ── Private helpers ───────────────────────────────────────────────────────────

const SELECT_COLS = 'id,owner_id,name,description,storage_key,created_at,updated_at'

function buildJson(
  projectId: string,
  projectName: string,
  nodes: unknown[],
  edges: unknown[],
  prev?: Pick<ProjectJSON, 'createdAt' | 'formatVersion'>,
): ProjectJSON {
  return {
    schemaVersion: 1,
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
  if (!session) throw new Error('Not authenticated')
  return session
}

async function readUpdatedAt(projectId: string): Promise<string | null> {
  const { data } = await supabase.from('projects').select('updated_at').eq('id', projectId).single()
  return (data as { updated_at: string } | null)?.updated_at ?? null
}

// ── Exported operations ───────────────────────────────────────────────────────

/** Read a single project row (name + updated_at). Used by CanvasPage to anchor conflict detection. */
export async function readProjectRow(
  projectId: string,
): Promise<{ name: string; updated_at: string } | null> {
  const { data } = await supabase
    .from('projects')
    .select('name,updated_at')
    .eq('id', projectId)
    .single()
  return data as { name: string; updated_at: string } | null
}

/** Return all projects for the current user, newest first. */
export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(SELECT_COLS)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to list projects: ${error.message}`)
  return (data ?? []) as ProjectRow[]
}

/** Create a new project row + empty project.json in storage. */
export async function createProject(name: string): Promise<ProjectRow> {
  const session = await requireSession()
  const projectId = crypto.randomUUID()
  const storageKey = `${session.user.id}/${projectId}/project.json`

  const { data, error } = await supabase
    .from('projects')
    .insert({ id: projectId, owner_id: session.user.id, name, storage_key: storageKey })
    .select(SELECT_COLS)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create project')
  const proj = data as ProjectRow

  const pj = buildJson(proj.id, name, [], [])
  await saveProjectJson(proj.id, pj)

  // Re-read to get the updated_at set by the storage_key stamp
  const updated = await readUpdatedAt(proj.id)
  return { ...proj, updated_at: updated ?? proj.updated_at }
}

/** Load and parse the project.json from storage. Throws on schema mismatch. */
export async function loadProject(projectId: string): Promise<ProjectJSON> {
  const raw = await loadProjectJson(projectId)
  const pj = raw as Partial<ProjectJSON>

  if (pj.schemaVersion !== 1) {
    // Migration stub: W3+ will transform older schemas before returning.
    throw new Error(`Unsupported schemaVersion: ${String(pj.schemaVersion ?? 'missing')}`)
  }
  return raw as ProjectJSON
}

/**
 * Save graph to storage with optimistic-lock conflict detection.
 *
 * Returns { conflict: true } when the DB row was updated after we loaded it
 * (indicating a concurrent write from another session). In that case we do
 * NOT overwrite — the caller shows a resolution UI.
 */
export async function saveProject(
  projectId: string,
  projectName: string,
  nodes: unknown[],
  edges: unknown[],
  knownUpdatedAt: string,
  prev?: Pick<ProjectJSON, 'createdAt' | 'formatVersion'>,
): Promise<{ updatedAt: string; conflict: boolean }> {
  // Optimistic lock check
  const dbUpdatedAt = await readUpdatedAt(projectId)
  if (dbUpdatedAt && new Date(dbUpdatedAt) > new Date(knownUpdatedAt)) {
    return { updatedAt: dbUpdatedAt, conflict: true }
  }

  // Write — saveProjectJson also stamps storage_key → triggers DB updated_at
  const pj = buildJson(projectId, projectName, nodes, edges, prev)
  await saveProjectJson(projectId, pj)

  const freshUpdatedAt = (await readUpdatedAt(projectId)) ?? new Date().toISOString()
  return { updatedAt: freshUpdatedAt, conflict: false }
}

/** Rename a project row. Returns the new DB updated_at. */
export async function renameProject(projectId: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from('projects')
    .update({ name })
    .eq('id', projectId)
    .select('updated_at')
    .single()

  if (error) throw new Error(`Rename failed: ${error.message}`)
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

/** Create a new project that is a copy of the source project's graph. */
export async function duplicateProject(sourceId: string, newName: string): Promise<ProjectRow> {
  const session = await requireSession()
  const projectId = crypto.randomUUID()
  const storageKey = `${session.user.id}/${projectId}/project.json`

  const { data, error } = await supabase
    .from('projects')
    .insert({ id: projectId, owner_id: session.user.id, name: newName, storage_key: storageKey })
    .select(SELECT_COLS)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create project row')
  const newProj = data as ProjectRow

  let srcGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }
  try {
    const src = await loadProject(sourceId)
    srcGraph = src.graph
  } catch {
    // If source has no storage file, start empty (tolerated)
  }

  const pj = buildJson(newProj.id, newName, srcGraph.nodes, srcGraph.edges)
  await saveProjectJson(newProj.id, pj)

  const updated = await readUpdatedAt(newProj.id)
  return { ...newProj, updated_at: updated ?? newProj.updated_at }
}

/**
 * Import a parsed project.json blob as a new project.
 * Validates schemaVersion and rebinds IDs to a fresh DB row.
 */
export async function importProject(json: ProjectJSON, overrideName?: string): Promise<ProjectRow> {
  if (json.schemaVersion !== 1) {
    throw new Error(`Cannot import: unsupported schemaVersion ${String(json.schemaVersion)}`)
  }

  const name = overrideName ?? json.project?.name ?? 'Imported Project'
  const session = await requireSession()
  const projectId = crypto.randomUUID()
  const storageKey = `${session.user.id}/${projectId}/project.json`

  const { data, error } = await supabase
    .from('projects')
    .insert({ id: projectId, owner_id: session.user.id, name, storage_key: storageKey })
    .select(SELECT_COLS)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create project row')
  const proj = data as ProjectRow

  const pj: ProjectJSON = {
    schemaVersion: 1,
    formatVersion: (json.formatVersion ?? 0) + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    project: { id: proj.id, name },
    graph: json.graph ?? { nodes: [], edges: [] },
    blockVersions: json.blockVersions ?? {},
  }
  await saveProjectJson(proj.id, pj)

  const updated = await readUpdatedAt(proj.id)
  return { ...proj, updated_at: updated ?? proj.updated_at }
}
