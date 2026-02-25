/**
 * storage.ts — Supabase Storage helpers for ChainSolve
 *
 * ALL paths MUST start with `{userId}/` so they pass the RLS policy:
 *   (storage.foldername(name))[1] = auth.uid()::text
 *
 * Key conventions:
 *   projects bucket  →  {userId}/{projectId}/project.json
 *   uploads  bucket  →  {userId}/{projectId}/uploads/{timestamp}_{safeFilename}
 *
 * Column mapping vs. the 0001 migration:
 *   task "storage_key"        → projects.storage_key   (added in 0002)
 *   task "original_filename"  → project_assets.name
 *   task "storage_key"        → project_assets.storage_path
 *   task "bytes"              → project_assets.size
 *   task "kind"               → project_assets.kind    (added in 0002)
 */

import { supabase } from './supabase'

// ── Public types ─────────────────────────────────────────────────────────────

export interface ProjectAsset {
  id: string
  project_id: string
  user_id: string
  /** Discriminator: 'csv', 'image', etc. */
  kind: string | null
  /** Original filename at upload time */
  name: string
  /** Full storage path used to retrieve the object */
  storage_path: string
  mime_type: string | null
  /** File size in bytes */
  size: number | null
  created_at: string
}

// ── Private helper ────────────────────────────────────────────────────────────

async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('You must be logged in to access storage.')
  return session
}

/** Replace any character that is not alphanumeric, dot, dash, or underscore. */
function sanitiseFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * Serialise `projectJson` to JSON and upsert it at
 * `{userId}/{projectId}/project.json` in the **projects** bucket.
 * Then stamps `projects.storage_key` in the DB with the same path.
 */
export async function saveProjectJson(projectId: string, projectJson: unknown): Promise<void> {
  const session = await requireSession()
  const userId = session.user.id
  const key = `${userId}/${projectId}/project.json`

  const blob = new Blob([JSON.stringify(projectJson)], { type: 'application/json' })

  const { error: uploadErr } = await supabase.storage
    .from('projects')
    .upload(key, blob, { upsert: true, contentType: 'application/json' })

  if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`)

  const { error: dbErr } = await supabase
    .from('projects')
    .update({ storage_key: key })
    .eq('id', projectId)
    .eq('owner_id', userId) // projects table uses owner_id, not user_id

  if (dbErr) throw new Error(`DB update (storage_key) failed: ${dbErr.message}`)
}

/**
 * Download and JSON-parse the project file from the **projects** bucket.
 * Path used: `{userId}/{projectId}/project.json`
 */
export async function loadProjectJson(projectId: string): Promise<unknown> {
  const session = await requireSession()
  const userId = session.user.id
  const key = `${userId}/${projectId}/project.json`

  const { data, error } = await supabase.storage.from('projects').download(key)
  if (error) throw new Error(`Storage download failed: ${error.message}`)
  if (!data) throw new Error('Storage returned no data')

  return JSON.parse(await data.text())
}

/**
 * Upload a CSV file to the **uploads** bucket at
 * `{userId}/{projectId}/uploads/{timestamp}_{safeFilename}`
 * then insert a row in `public.project_assets`.
 *
 * Returns the `storage_key` (= storage_path in the DB column) so the caller
 * can store or display it.
 */
export async function uploadCsv(projectId: string, file: File): Promise<{ storage_key: string }> {
  const session = await requireSession()
  const userId = session.user.id

  const safe = sanitiseFilename(file.name)
  const key = `${userId}/${projectId}/uploads/${Date.now()}_${safe}`

  const { error: uploadErr } = await supabase.storage.from('uploads').upload(key, file) // no upsert: timestamps keep each upload unique

  if (uploadErr) throw new Error(`CSV upload failed: ${uploadErr.message}`)

  const { error: dbErr } = await supabase.from('project_assets').insert({
    project_id: projectId,
    user_id: userId,
    kind: 'csv',
    name: file.name, // original filename
    storage_path: key, // storage key
    mime_type: file.type || 'text/csv',
    size: file.size, // bytes
  })

  if (dbErr) throw new Error(`project_assets insert failed: ${dbErr.message}`)

  return { storage_key: key }
}

/**
 * Return all `project_assets` rows for `projectId` owned by the current user,
 * newest first.
 */
export async function listProjectAssets(projectId: string): Promise<ProjectAsset[]> {
  const session = await requireSession()
  const userId = session.user.id

  const { data, error } = await supabase
    .from('project_assets')
    .select('id,project_id,user_id,kind,name,storage_path,mime_type,size,created_at')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list assets: ${error.message}`)
  return (data ?? []) as ProjectAsset[]
}

/**
 * Create a short-lived signed download URL for any private object.
 * Throws if the current user is not authenticated.
 *
 * @param bucket        'projects' or 'uploads'
 * @param storage_key   The full object path (as stored in storage_path / storage_key)
 * @param expiresSeconds  How many seconds until the URL expires
 */
export async function getSignedDownloadUrl(
  bucket: 'projects' | 'uploads',
  storage_key: string,
  expiresSeconds: number,
): Promise<string> {
  await requireSession()

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storage_key, expiresSeconds)

  if (error) throw new Error(`Signed URL creation failed: ${error.message}`)
  if (!data?.signedUrl) throw new Error('No signed URL returned')

  return data.signedUrl
}
