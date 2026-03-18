/**
 * experiments.ts — Experiment tracking API (2.103).
 *
 * CRUD for experiment runs + checkpoints.  All calls go to Supabase;
 * RLS ensures users only see their own runs.
 */

import { supabase } from './supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExperimentRun {
  id: string
  userId: string
  projectId: string
  canvasId: string | null
  name: string
  runType: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  finishedAt: string | null
  durationS: number | null
  params: Record<string, unknown>
  metrics: Record<string, unknown>
  history: Array<Record<string, unknown>> | null
  tags: string[]
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ExperimentCheckpoint {
  id: string
  runId: string
  epoch: number
  metrics: Record<string, unknown>
  weightsPath: string | null
  createdAt: string
}

export interface CreateRunInput {
  projectId: string
  canvasId?: string
  name?: string
  runType?: string
  params?: Record<string, unknown>
  tags?: string[]
  notes?: string
}

export interface UpdateRunInput {
  status?: ExperimentRun['status']
  metrics?: Record<string, unknown>
  history?: Array<Record<string, unknown>>
  finishedAt?: string
  durationS?: number
  notes?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToRun(row: Record<string, unknown>): ExperimentRun {
  return {
    id:          row.id as string,
    userId:      row.user_id as string,
    projectId:   row.project_id as string,
    canvasId:    row.canvas_id as string | null,
    name:        row.name as string,
    runType:     row.run_type as string,
    status:      row.status as ExperimentRun['status'],
    startedAt:   row.started_at as string,
    finishedAt:  row.finished_at as string | null,
    durationS:   row.duration_s as number | null,
    params:      (row.params as Record<string, unknown>) ?? {},
    metrics:     (row.metrics as Record<string, unknown>) ?? {},
    history:     row.history as Array<Record<string, unknown>> | null,
    tags:        (row.tags as string[]) ?? [],
    notes:       row.notes as string | null,
    createdAt:   row.created_at as string,
    updatedAt:   row.updated_at as string,
  }
}

// ── Experiment runs ────────────────────────────────────────────────────────────

/**
 * Start a new experiment run.
 * Returns the new run row.
 */
export async function createRun(input: CreateRunInput): Promise<ExperimentRun> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('[EXPERIMENT_NO_USER] Not authenticated')

  const row = {
    user_id:    user.id,
    project_id: input.projectId,
    canvas_id:  input.canvasId ?? null,
    name:       input.name ?? `Run ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    run_type:   input.runType ?? 'neural_network',
    params:     input.params ?? {},
    tags:       input.tags ?? [],
    notes:      input.notes ?? null,
    status:     'running',
  }

  const { data, error } = await supabase
    .from('experiment_runs')
    .insert(row)
    .select()
    .single()

  if (error) throw new Error(`[EXPERIMENT_CREATE_FAILED] ${error.message}`)
  return rowToRun(data as Record<string, unknown>)
}

/**
 * Update a run (metrics, status, history, notes).
 */
export async function updateRun(id: string, input: UpdateRunInput): Promise<void> {
  const updates: Record<string, unknown> = {}
  if (input.status    !== undefined) updates.status      = input.status
  if (input.metrics   !== undefined) updates.metrics     = input.metrics
  if (input.history   !== undefined) updates.history     = input.history
  if (input.finishedAt !== undefined) updates.finished_at = input.finishedAt
  if (input.durationS !== undefined) updates.duration_s  = input.durationS
  if (input.notes     !== undefined) updates.notes       = input.notes

  const { error } = await supabase
    .from('experiment_runs')
    .update(updates)
    .eq('id', id)

  if (error) throw new Error(`[EXPERIMENT_UPDATE_FAILED] ${error.message}`)
}

/**
 * Mark a run as completed and record final metrics.
 */
export async function completeRun(
  id: string,
  metrics: Record<string, unknown>,
  history?: Array<Record<string, unknown>>,
): Promise<void> {
  const now = new Date().toISOString()
  await updateRun(id, {
    status:      'completed',
    metrics,
    history,
    finishedAt:  now,
  })
}

/**
 * Fetch all runs for a project, newest first.
 */
export async function getRunsForProject(
  projectId: string,
  limit = 100,
): Promise<ExperimentRun[]> {
  const { data, error } = await supabase
    .from('experiment_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`[EXPERIMENT_LIST_FAILED] ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(rowToRun)
}

/**
 * Delete a run (and its checkpoints via cascade).
 */
export async function deleteRun(id: string): Promise<void> {
  const { error } = await supabase
    .from('experiment_runs')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`[EXPERIMENT_DELETE_FAILED] ${error.message}`)
}

// ── Checkpoints ───────────────────────────────────────────────────────────────

/**
 * Save a model checkpoint for a specific training epoch.
 */
export async function saveCheckpoint(
  runId: string,
  epoch: number,
  metrics: Record<string, unknown>,
  weightsPath?: string,
): Promise<void> {
  const { error } = await supabase
    .from('experiment_checkpoints')
    .insert({
      run_id:       runId,
      epoch,
      metrics,
      weights_path: weightsPath ?? null,
    })

  if (error) throw new Error(`[CHECKPOINT_SAVE_FAILED] ${error.message}`)
}

/**
 * Get all checkpoints for a run, ordered by epoch.
 */
export async function getCheckpoints(runId: string): Promise<ExperimentCheckpoint[]> {
  const { data, error } = await supabase
    .from('experiment_checkpoints')
    .select('*')
    .eq('run_id', runId)
    .order('epoch', { ascending: true })

  if (error) throw new Error(`[CHECKPOINT_LIST_FAILED] ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id:          row.id as string,
    runId:       row.run_id as string,
    epoch:       row.epoch as number,
    metrics:     (row.metrics as Record<string, unknown>) ?? {},
    weightsPath: row.weights_path as string | null,
    createdAt:   row.created_at as string,
  }))
}
