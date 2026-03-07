/**
 * canvases.ts — CRUD operations for multi-canvas "Sheets" (W10.7).
 *
 * Each project has 1+ canvases. Canvas metadata lives in the `canvases` DB
 * table; graph JSON is stored per-canvas in Supabase Storage at:
 *   {userId}/{projectId}/canvases/{canvasId}.json
 *
 * The active canvas ID is persisted on `projects.active_canvas_id` for
 * cross-device state.
 */

import { supabase } from './supabase'
import {
  uploadCanvasGraph,
  downloadCanvasGraph,
  deleteCanvasGraph,
  verifyCanvasGraph,
} from './canvasStorage'
import {
  buildCanvasJson,
  buildCanvasJsonFromGraph,
  parseCanvasJson,
  type CanvasJSON,
} from './canvasSchema'
import { ServiceError } from './errors'
import { validateProjectName } from './validateProjectName'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CanvasRow {
  id: string
  project_id: string
  owner_id: string
  name: string
  position: number
  storage_path: string
  created_at: string
  updated_at: string
}

// ── Private helpers ─────────────────────────────────────────────────────────

const CANVAS_SELECT = 'id,project_id,owner_id,name,position,storage_path,created_at,updated_at'

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new ServiceError('NOT_AUTHENTICATED', 'Not authenticated')
  return session
}

function assertValidCanvasName(name: string): void {
  const result = validateProjectName(name)
  if (!result.ok) {
    throw new ServiceError('INVALID_PROJECT_NAME', result.error!)
  }
}

/**
 * Throw if `name` clashes (case-insensitive) with an existing canvas in the list.
 * Pass `excludeId` when renaming so the canvas can keep its own name.
 */
export function assertUniqueCanvasName(
  name: string,
  existingCanvases: CanvasRow[],
  excludeId?: string,
): void {
  const normalized = name.trim().toLowerCase()
  const duplicate = existingCanvases.find(
    (c) => c.name.trim().toLowerCase() === normalized && c.id !== excludeId,
  )
  if (duplicate) {
    throw new ServiceError('DUPLICATE_PROJECT_NAME', `A sheet named "${name}" already exists`)
  }
}

// ── Exported operations ─────────────────────────────────────────────────────

/**
 * List all canvases for a project, sorted by position ascending.
 */
export async function listCanvases(projectId: string): Promise<CanvasRow[]> {
  const { data, error } = await supabase
    .from('canvases')
    .select(CANVAS_SELECT)
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  if (error) throw new ServiceError('DB_ERROR', `Failed to list canvases: ${error.message}`, true)
  return (data ?? []) as CanvasRow[]
}

/**
 * Create a new canvas for a project.
 * Uploads an empty graph JSON to storage and inserts a DB row.
 * If this is the first canvas, sets it as active on the project.
 */
export async function createCanvas(
  projectId: string,
  name: string,
  opts?: { nodes?: unknown[]; edges?: unknown[] },
): Promise<CanvasRow> {
  assertValidCanvasName(name)
  const session = await requireSession()
  const userId = session.user.id
  const canvasId = crypto.randomUUID()
  const storagePath = `${userId}/${projectId}/canvases/${canvasId}.json`

  // Determine next position + check uniqueness
  const existing = await listCanvases(projectId)
  assertUniqueCanvasName(name, existing)
  const nextPosition = existing.length > 0 ? Math.max(...existing.map((c) => c.position)) + 1 : 0

  // Upload graph JSON
  const json =
    opts?.nodes || opts?.edges
      ? buildCanvasJsonFromGraph(canvasId, projectId, opts.nodes ?? [], opts.edges ?? [])
      : buildCanvasJson(canvasId, projectId)
  await uploadCanvasGraph(userId, projectId, canvasId, json)

  // Insert DB row
  const { data, error } = await supabase
    .from('canvases')
    .insert({
      id: canvasId,
      project_id: projectId,
      owner_id: userId,
      name,
      position: nextPosition,
      storage_path: storagePath,
    })
    .select(CANVAS_SELECT)
    .single()

  if (error || !data)
    throw new ServiceError('DB_ERROR', error?.message ?? 'Failed to create canvas', true)
  const row = data as CanvasRow

  // If first canvas, set as active
  if (existing.length === 0) {
    await setActiveCanvas(projectId, canvasId)
  }

  return row
}

/**
 * Rename a canvas. Validates name format and uniqueness within the project.
 */
export async function renameCanvas(
  canvasId: string,
  projectId: string,
  name: string,
): Promise<void> {
  assertValidCanvasName(name)
  const existing = await listCanvases(projectId)
  assertUniqueCanvasName(name, existing, canvasId)

  const { error } = await supabase.from('canvases').update({ name }).eq('id', canvasId)

  if (error) throw new ServiceError('DB_ERROR', `Rename canvas failed: ${error.message}`, true)
}

/**
 * Reorder canvases by updating positions in batch.
 * `orderedCanvasIds` is the desired order (index = position).
 */
export async function reorderCanvases(
  projectId: string,
  orderedCanvasIds: string[],
): Promise<void> {
  // Update each canvas position — use sequential updates to respect unique constraint
  // Temporarily shift all to negative positions to avoid conflicts, then set final
  const session = await requireSession()
  const userId = session.user.id

  // Phase 1: shift all to negative (avoid unique constraint violations)
  for (let i = 0; i < orderedCanvasIds.length; i++) {
    const { error } = await supabase
      .from('canvases')
      .update({ position: -(i + 1) })
      .eq('id', orderedCanvasIds[i])
      .eq('owner_id', userId)

    if (error) throw new ServiceError('DB_ERROR', `Reorder phase 1 failed: ${error.message}`, true)
  }

  // Phase 2: set final positions
  for (let i = 0; i < orderedCanvasIds.length; i++) {
    const { error } = await supabase
      .from('canvases')
      .update({ position: i })
      .eq('id', orderedCanvasIds[i])
      .eq('project_id', projectId)
      .eq('owner_id', userId)

    if (error) throw new ServiceError('DB_ERROR', `Reorder phase 2 failed: ${error.message}`, true)
  }
}

/**
 * Delete a canvas — removes DB row and storage JSON.
 * Caller must enforce "at least one canvas" before calling.
 */
export async function deleteCanvas(canvasId: string, projectId: string): Promise<void> {
  const session = await requireSession()
  const userId = session.user.id

  // Delete storage (best-effort)
  try {
    await deleteCanvasGraph(userId, projectId, canvasId)
  } catch {
    // Storage cleanup is best-effort
  }

  // Delete DB row
  const { error } = await supabase
    .from('canvases')
    .delete()
    .eq('id', canvasId)
    .eq('owner_id', userId)

  if (error) throw new ServiceError('DB_ERROR', `Delete canvas failed: ${error.message}`, true)
}

/**
 * Set the active canvas for a project (cross-device persistence).
 * Returns the new projects.updated_at so callers can keep the
 * optimistic-lock timestamp in sync and avoid false conflicts.
 */
export async function setActiveCanvas(projectId: string, canvasId: string): Promise<string> {
  const session = await requireSession()
  const { data, error } = await supabase
    .from('projects')
    .update({ active_canvas_id: canvasId })
    .eq('id', projectId)
    .eq('owner_id', session.user.id)
    .select('updated_at')
    .single()

  if (error) throw new ServiceError('DB_ERROR', `Set active canvas failed: ${error.message}`, true)
  return (data as { updated_at: string }).updated_at
}

/**
 * Read the active_canvas_id from the projects table.
 */
export async function getActiveCanvasId(projectId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('active_canvas_id')
    .eq('id', projectId)
    .single()

  if (error) throw new ServiceError('DB_ERROR', `Read active canvas failed: ${error.message}`, true)
  return (data as { active_canvas_id: string | null })?.active_canvas_id ?? null
}

/**
 * Load the graph JSON for a specific canvas.
 * Returns a parsed CanvasJSON (empty graph if file missing).
 */
export async function loadCanvasGraph(projectId: string, canvasId: string): Promise<CanvasJSON> {
  const session = await requireSession()
  const userId = session.user.id
  const raw = await downloadCanvasGraph(userId, projectId, canvasId)
  return parseCanvasJson(raw, canvasId, projectId)
}

/**
 * Save a canvas graph JSON to storage.
 * Pass `{ verify: true }` to read-back the file and confirm persistence
 * (recommended for manual saves, not for every autosave).
 */
export async function saveCanvasGraph(
  projectId: string,
  canvasId: string,
  nodes: unknown[],
  edges: unknown[],
  opts?: { verify?: boolean },
): Promise<void> {
  const session = await requireSession()
  const userId = session.user.id
  const json = buildCanvasJsonFromGraph(canvasId, projectId, nodes, edges)
  await uploadCanvasGraph(userId, projectId, canvasId, json)

  if (opts?.verify) {
    const ok = await verifyCanvasGraph(userId, projectId, canvasId, nodes.length)
    if (!ok) {
      throw new ServiceError(
        'STORAGE_ERROR',
        'Save verification failed: data did not persist',
        true,
      )
    }
  }
}

/**
 * Load active canvas graph for a project.
 * Resolves active_canvas_id, then downloads the graph.
 * If no active canvas is set, falls back to the first canvas by position.
 */
export async function loadActiveCanvasGraph(
  projectId: string,
): Promise<{ canvasId: string; graph: CanvasJSON } | null> {
  let activeId = await getActiveCanvasId(projectId)

  if (!activeId) {
    // Fallback: first canvas by position
    const canvases = await listCanvases(projectId)
    if (canvases.length === 0) return null
    activeId = canvases[0].id
    // Persist the resolved active
    await setActiveCanvas(projectId, activeId)
  }

  const graph = await loadCanvasGraph(projectId, activeId)
  return { canvasId: activeId, graph }
}

/**
 * Duplicate a canvas — copies graph JSON to a new canvas.
 */
export async function duplicateCanvas(
  projectId: string,
  sourceCanvasId: string,
  newName: string,
): Promise<CanvasRow> {
  assertValidCanvasName(newName)
  const graph = await loadCanvasGraph(projectId, sourceCanvasId)
  return createCanvas(projectId, newName, {
    nodes: graph.nodes,
    edges: graph.edges,
  })
}

/**
 * Migrate a legacy V3 project to multi-canvas.
 *
 * On first open of a legacy project (no canvases rows):
 *   1. Creates a default canvas row "Sheet 1"
 *   2. Uploads the migrated graph JSON to per-canvas storage
 *   3. Sets projects.active_canvas_id
 *   4. Does NOT delete the legacy project.json (left in place)
 *
 * Safe to re-run: if canvases already exist, does nothing.
 */
export async function migrateProjectToMultiCanvas(
  projectId: string,
  legacyNodes: unknown[],
  legacyEdges: unknown[],
): Promise<CanvasRow> {
  // Check if migration already happened
  const existing = await listCanvases(projectId)
  if (existing.length > 0) {
    return existing[0]
  }

  // Create default canvas with the legacy graph
  const canvas = await createCanvas(projectId, 'Sheet 1', {
    nodes: legacyNodes,
    edges: legacyEdges,
  })

  // Set as active
  await setActiveCanvas(projectId, canvas.id)

  return canvas
}
