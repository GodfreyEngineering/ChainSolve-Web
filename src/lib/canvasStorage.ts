/**
 * canvasStorage.ts — Supabase Storage helpers for per-canvas graph JSON.
 *
 * Storage path convention:
 *   projects bucket → {userId}/{projectId}/canvases/{canvasId}.json
 *
 * All paths must start with `{userId}/` to pass the RLS policy:
 *   (storage.foldername(name))[1] = auth.uid()::text
 */

import { supabase } from './supabase'
import { ServiceError, isRetryableError } from './errors'

// ── Private helpers ─────────────────────────────────────────────────────────

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new ServiceError('NOT_AUTHENTICATED', 'Not authenticated')
  return session
}

const UPLOAD_RETRY_DELAYS = [1000, 2000]

async function uploadBlobWithRetry(key: string, blob: Blob): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt <= UPLOAD_RETRY_DELAYS.length; attempt++) {
    try {
      const { error } = await supabase.storage
        .from('projects')
        .upload(key, blob, { upsert: true, contentType: 'application/json' })
      if (error) throw new ServiceError('STORAGE_ERROR', error.message, true)
      return
    } catch (err) {
      lastError = err
      if (attempt < UPLOAD_RETRY_DELAYS.length && isRetryableError(err)) {
        await new Promise((r) => setTimeout(r, UPLOAD_RETRY_DELAYS[attempt]))
        continue
      }
      throw err
    }
  }
  throw lastError
}

function canvasKey(userId: string, projectId: string, canvasId: string): string {
  return `${userId}/${projectId}/canvases/${canvasId}.json`
}

// ── Exported helpers ────────────────────────────────────────────────────────

/**
 * Upload (upsert) a canvas graph JSON to storage.
 * Path: {userId}/{projectId}/canvases/{canvasId}.json
 */
export async function uploadCanvasGraph(
  ownerId: string,
  projectId: string,
  canvasId: string,
  json: unknown,
): Promise<void> {
  await requireSession()
  const key = canvasKey(ownerId, projectId, canvasId)
  const blob = new Blob([JSON.stringify(json)], { type: 'application/json' })

  await uploadBlobWithRetry(key, blob)
}

/**
 * Download and parse a canvas graph JSON from storage.
 * Returns `null` if the file does not exist (treated as empty graph).
 */
export async function downloadCanvasGraph(
  ownerId: string,
  projectId: string,
  canvasId: string,
): Promise<unknown | null> {
  await requireSession()
  const key = canvasKey(ownerId, projectId, canvasId)

  const { data, error } = await supabase.storage.from('projects').download(key)

  if (error) {
    // Treat 404 / "Object not found" as empty graph
    if (error.message.includes('not found') || error.message.includes('404')) {
      return null
    }
    throw new ServiceError('STORAGE_ERROR', `Canvas download failed: ${error.message}`, true)
  }
  if (!data) return null

  return JSON.parse(await data.text())
}

/**
 * Verify that a canvas graph was successfully persisted to storage by
 * downloading the file and checking its node count matches expectations.
 * Used only on manual saves (Ctrl+S) to avoid doubling reads on autosave.
 */
export async function verifyCanvasGraph(
  ownerId: string,
  projectId: string,
  canvasId: string,
  expectedNodeCount: number,
): Promise<boolean> {
  try {
    const raw = await downloadCanvasGraph(ownerId, projectId, canvasId)
    if (!raw) return false
    const obj = raw as Record<string, unknown>
    const nodes = obj.nodes as unknown[] | undefined
    return Array.isArray(nodes) && nodes.length === expectedNodeCount
  } catch {
    return false
  }
}

/**
 * Delete a canvas graph JSON from storage.
 * Best-effort: does not throw if the file is already gone.
 */
export async function deleteCanvasGraph(
  ownerId: string,
  projectId: string,
  canvasId: string,
): Promise<void> {
  await requireSession()
  const key = canvasKey(ownerId, projectId, canvasId)

  const { error } = await supabase.storage.from('projects').remove([key])

  // Ignore "not found" — file may already be gone
  if (error && !error.message.includes('not found') && !error.message.includes('404')) {
    throw new ServiceError('STORAGE_ERROR', `Canvas delete failed: ${error.message}`, true)
  }
}

/**
 * Delete all canvas graph JSONs for a project (cleanup on project delete).
 * Best-effort: logs errors but does not throw.
 */
export async function deleteAllCanvasGraphs(ownerId: string, projectId: string): Promise<void> {
  await requireSession()
  const prefix = `${ownerId}/${projectId}/canvases/`

  try {
    const { data: files } = await supabase.storage.from('projects').list(prefix)
    if (files?.length) {
      await supabase.storage.from('projects').remove(files.map((f) => `${prefix}${f.name}`))
    }
  } catch {
    // Best-effort cleanup
  }
}
