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

// ── Private helper ──────────────────────────────────────────────────────────

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session
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

  const { error } = await supabase.storage
    .from('projects')
    .upload(key, blob, { upsert: true, contentType: 'application/json' })

  if (error) throw new Error(`Canvas upload failed: ${error.message}`)
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
    throw new Error(`Canvas download failed: ${error.message}`)
  }
  if (!data) return null

  return JSON.parse(await data.text())
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
    throw new Error(`Canvas delete failed: ${error.message}`)
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
