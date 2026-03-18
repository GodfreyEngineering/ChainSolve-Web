/**
 * branchService.ts — 5.9: Project branch management.
 *
 * Provides CRUD operations for project branches (named lines of snapshot
 * history). Each branch maintains its own sequence of project_snapshots.
 *
 * Branches allow engineers to:
 *  - Create named experiments ("v2-aero", "pid-tuning", "backup-before-refactor")
 *  - Switch between branches (loads the latest snapshot from that branch)
 *  - Compare branch states (node/edge count diff)
 *  - Delete experimental branches (cannot delete 'main')
 *
 * Schema:
 *  - project_branches: branch metadata (name, description, forked_from)
 *  - project_snapshots.branch_name: partitions snapshot history by branch
 */

import { supabase } from './supabase'
import { ServiceError } from './errors'
import { createSnapshot, loadSnapshot, type ProjectSnapshot } from './snapshotService'
import type { Node, Edge } from '@xyflow/react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProjectBranch {
  id: string
  branch_name: string
  description: string | null
  created_at: string
  /** Number of snapshots on this branch. */
  snapshot_count: number
  /** Label of the latest snapshot. */
  latest_label: string | null
  /** Timestamp of the latest snapshot. */
  latest_at: string | null
}

// ── Private helpers ──────────────────────────────────────────────────────────

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new ServiceError('NOT_AUTHENTICATED', 'Not authenticated')
  return session
}

// ── Exported operations ──────────────────────────────────────────────────────

/**
 * List all branches for a project canvas.
 * Returns branches with snapshot count and latest snapshot metadata.
 */
export async function listBranches(projectId: string, canvasId: string): Promise<ProjectBranch[]> {
  const { data, error } = await supabase.rpc('get_branches', {
    p_project_id: projectId,
    p_canvas_id: canvasId,
  })
  if (error) throw new ServiceError('BRANCH_LIST_FAILED', error.message)
  return (data ?? []) as ProjectBranch[]
}

/**
 * Ensure the 'main' branch record exists for a project canvas.
 * Called on first save if branches table has no 'main' entry yet.
 */
export async function ensureMainBranch(projectId: string, canvasId: string): Promise<void> {
  const session = await requireSession()
  const { error } = await supabase.from('project_branches').upsert(
    {
      project_id: projectId,
      canvas_id: canvasId,
      owner_id: session.user.id,
      branch_name: 'main',
      description: 'Default branch',
    },
    { onConflict: 'project_id,canvas_id,branch_name', ignoreDuplicates: true },
  )
  if (error) throw new ServiceError('BRANCH_CREATE_FAILED', error.message)
}

/**
 * Create a new branch by forking from a snapshot (or current state).
 * The new branch's first snapshot is a copy of the fork point.
 */
export async function createBranch(
  projectId: string,
  canvasId: string,
  branchName: string,
  description: string | null,
  forkedFromSnapshotId: string | null,
  /** Current canvas state to save as the branch's first snapshot. */
  nodes: Node[],
  edges: Edge[],
): Promise<ProjectBranch> {
  const session = await requireSession()

  // Validate branch name
  if (!/^[\w-]{1,64}$/.test(branchName)) {
    throw new ServiceError(
      'BRANCH_INVALID_NAME',
      'Branch name must be 1–64 alphanumeric/hyphen/underscore characters',
    )
  }

  // Insert branch record
  const { data, error } = await supabase
    .from('project_branches')
    .insert({
      project_id: projectId,
      canvas_id: canvasId,
      owner_id: session.user.id,
      branch_name: branchName,
      description,
      forked_from_snapshot_id: forkedFromSnapshotId ?? null,
    })
    .select('id,branch_name,description,created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new ServiceError('BRANCH_EXISTS', `Branch "${branchName}" already exists`)
    }
    throw new ServiceError('BRANCH_CREATE_FAILED', error.message)
  }

  // Save current state as the first snapshot on the new branch
  await createSnapshot(projectId, canvasId, nodes as unknown[], edges as unknown[], {
    label: `Fork: ${branchName}`,
    branchName,
  })

  return {
    id: data.id,
    branch_name: data.branch_name,
    description: data.description ?? null,
    created_at: data.created_at,
    snapshot_count: 1,
    latest_label: `Fork: ${branchName}`,
    latest_at: new Date().toISOString(),
  }
}

/**
 * Delete a branch and all its snapshots.
 * Cannot delete the 'main' branch.
 */
export async function deleteBranch(
  projectId: string,
  canvasId: string,
  branchName: string,
): Promise<void> {
  if (branchName === 'main') {
    throw new ServiceError('BRANCH_DELETE_MAIN', 'Cannot delete the main branch')
  }

  // Delete branch record (cascade deletes snapshots via RLS + FK policy)
  const { error } = await supabase
    .from('project_branches')
    .delete()
    .eq('project_id', projectId)
    .eq('canvas_id', canvasId)
    .eq('branch_name', branchName)

  if (error) throw new ServiceError('BRANCH_DELETE_FAILED', error.message)

  // Also delete all snapshots on this branch (branch delete may not cascade)
  await supabase
    .from('project_snapshots')
    .delete()
    .eq('project_id', projectId)
    .eq('canvas_id', canvasId)
    .eq('branch_name', branchName)
}

/**
 * Get the latest snapshot on a branch.
 * Returns null if the branch has no snapshots.
 */
export async function getLatestBranchSnapshot(
  projectId: string,
  canvasId: string,
  branchName: string,
): Promise<ProjectSnapshot | null> {
  const { data, error } = await supabase
    .from('project_snapshots')
    .select(
      'id,project_id,canvas_id,owner_id,snapshot_storage_path,label,format_version,node_count,edge_count,created_at',
    )
    .eq('project_id', projectId)
    .eq('canvas_id', canvasId)
    .eq('branch_name', branchName)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new ServiceError('SNAPSHOT_LOAD_FAILED', error.message)
  return data as ProjectSnapshot | null
}

/**
 * Switch to a branch: load the latest snapshot from that branch.
 * Returns the graph nodes and edges, or null if branch has no snapshots.
 */
export async function switchToBranch(
  projectId: string,
  canvasId: string,
  branchName: string,
): Promise<{ nodes: Node[]; edges: Edge[] } | null> {
  const snapshot = await getLatestBranchSnapshot(projectId, canvasId, branchName)
  if (!snapshot) return null
  const graph = await loadSnapshot(snapshot)
  return graph as { nodes: Node[]; edges: Edge[] }
}
