/**
 * snapshotService.ts — CRUD for project_snapshots (ADV-03).
 *
 * Each snapshot stores a canvas graph JSON in Supabase Storage at:
 *   {userId}/{projectId}/snapshots/{canvasId}/{snapshotId}.json
 * and records metadata in the project_snapshots table.
 */

import { supabase } from './supabase'
import { ServiceError } from './errors'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectSnapshot {
  id: string
  project_id: string
  canvas_id: string
  owner_id: string
  snapshot_storage_path: string
  label: string | null
  format_version: number | null
  node_count: number | null
  edge_count: number | null
  created_at: string
}

export interface SnapshotGraph {
  nodes: unknown[]
  edges: unknown[]
}

// ── Private helpers ──────────────────────────────────────────────────────────

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new ServiceError('NOT_AUTHENTICATED', 'Not authenticated')
  return session
}

function snapshotKey(userId: string, projectId: string, canvasId: string, snapshotId: string) {
  return `${userId}/${projectId}/snapshots/${canvasId}/${snapshotId}.json`
}

const SNAPSHOT_SELECT =
  'id,project_id,canvas_id,owner_id,snapshot_storage_path,label,format_version,node_count,edge_count,created_at'

// ── Exported operations ──────────────────────────────────────────────────────

/**
 * List all snapshots for a project, newest first.
 * Optionally filter by canvasId.
 */
export async function listSnapshots(
  projectId: string,
  canvasId?: string,
): Promise<ProjectSnapshot[]> {
  let query = supabase
    .from('project_snapshots')
    .select(SNAPSHOT_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (canvasId) {
    query = query.eq('canvas_id', canvasId)
  }

  const { data, error } = await query
  if (error) {
    throw new ServiceError('DB_ERROR', `Failed to list snapshots: ${error.message}`, true)
  }
  return (data ?? []) as ProjectSnapshot[]
}

/**
 * Save a snapshot of the current canvas graph.
 * Uploads graph JSON to storage, then inserts a DB row.
 *
 * Options:
 *  - label: human-readable label for the snapshot
 *  - branchName: branch this snapshot belongs to (default: 'main')
 */
export async function createSnapshot(
  projectId: string,
  canvasId: string,
  nodes: unknown[],
  edges: unknown[],
  labelOrOptions?: string | { label?: string; branchName?: string },
): Promise<ProjectSnapshot> {
  const session = await requireSession()
  const userId = session.user.id
  const snapshotId = crypto.randomUUID()
  const storagePath = snapshotKey(userId, projectId, canvasId, snapshotId)

  const label =
    typeof labelOrOptions === 'string' ? labelOrOptions : (labelOrOptions?.label ?? null)
  const branchName =
    typeof labelOrOptions === 'object' ? (labelOrOptions?.branchName ?? 'main') : 'main'

  // Upload graph JSON
  const payload = { nodes, edges, snapshot_id: snapshotId, canvas_id: canvasId }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const { error: uploadErr } = await supabase.storage
    .from('projects')
    .upload(storagePath, blob, { upsert: false, contentType: 'application/json' })

  if (uploadErr) {
    throw new ServiceError('STORAGE_ERROR', `Snapshot upload failed: ${uploadErr.message}`, true)
  }

  // Insert DB row
  const { data, error } = await supabase
    .from('project_snapshots')
    .insert({
      id: snapshotId,
      project_id: projectId,
      canvas_id: canvasId,
      owner_id: userId,
      snapshot_storage_path: storagePath,
      label: label ?? null,
      branch_name: branchName,
      format_version: 1,
      node_count: nodes.length,
      edge_count: edges.length,
    })
    .select(SNAPSHOT_SELECT)
    .single()

  if (error || !data) {
    throw new ServiceError('DB_ERROR', error?.message ?? 'Failed to create snapshot', true)
  }
  return data as ProjectSnapshot
}

/**
 * Load the graph JSON for a snapshot from storage.
 */
export async function loadSnapshot(snapshot: ProjectSnapshot): Promise<SnapshotGraph> {
  await requireSession()
  const { data, error } = await supabase.storage
    .from('projects')
    .download(snapshot.snapshot_storage_path)

  if (error) {
    throw new ServiceError('STORAGE_ERROR', `Snapshot download failed: ${error.message}`, true)
  }
  if (!data) throw new ServiceError('STORAGE_ERROR', 'Snapshot file is empty', false)

  const parsed = JSON.parse(await data.text()) as Record<string, unknown>
  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
  }
}

/**
 * Update the label of a snapshot.
 */
export async function renameSnapshot(snapshotId: string, label: string): Promise<void> {
  const session = await requireSession()
  const { error } = await supabase
    .from('project_snapshots')
    .update({ label })
    .eq('id', snapshotId)
    .eq('owner_id', session.user.id)

  if (error) {
    throw new ServiceError('DB_ERROR', `Rename snapshot failed: ${error.message}`, true)
  }
}

/**
 * Delete a snapshot — removes DB row and storage JSON.
 */
export async function deleteSnapshot(snapshot: ProjectSnapshot): Promise<void> {
  const session = await requireSession()

  // Remove storage (best-effort)
  await supabase.storage.from('projects').remove([snapshot.snapshot_storage_path])

  const { error } = await supabase
    .from('project_snapshots')
    .delete()
    .eq('id', snapshot.id)
    .eq('owner_id', session.user.id)

  if (error) {
    throw new ServiceError('DB_ERROR', `Delete snapshot failed: ${error.message}`, true)
  }
}
