/**
 * POST /api/graph/execute — 10.3: Submit a graph snapshot for evaluation.
 *
 * Accepts a JSON body of shape { snapshot: EngineSnapshotV1, options? }.
 * Stores the job in Supabase `graph_jobs` and returns a job ID that callers
 * can poll via GET /api/graph/{id}/results.
 *
 * Authorization: Bearer JWT (Supabase Auth token) in Authorization header.
 *
 * Request body:
 *   {
 *     "snapshot": { "version": 1, "nodes": [...], "edges": [...] },
 *     "options": {            // optional
 *       "timeoutMs": 30000,   // max evaluation time
 *       "trace": false        // include per-node timing in results
 *     }
 *   }
 *
 * Response 202 (Accepted):
 *   { "jobId": "uuid", "status": "pending", "submittedAt": "ISO8601" }
 *
 * Response 400: invalid request body
 * Response 401: missing or invalid auth token
 * Response 413: snapshot too large (>2MB)
 */

import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024 // 2MB

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: '[CONFIG_INVALID] Missing Supabase credentials' }, 500)
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return json({ ok: false, error: '[UNAUTHORIZED] Bearer token required' }, 401)
  }

  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) {
    return json({ ok: false, error: '[UNAUTHORIZED] Invalid or expired token' }, 401)
  }

  // ── Parse request body ────────────────────────────────────────────────────
  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10)
  if (contentLength > MAX_SNAPSHOT_BYTES) {
    return json({ ok: false, error: '[SNAPSHOT_TOO_LARGE] Snapshot exceeds 2MB limit' }, 413)
  }

  let body: { snapshot: unknown; options?: Record<string, unknown> }
  try {
    body = await request.json() as typeof body
  } catch {
    return json({ ok: false, error: '[INVALID_JSON] Request body must be valid JSON' }, 400)
  }

  if (!body.snapshot || typeof body.snapshot !== 'object') {
    return json({ ok: false, error: '[INVALID_BODY] Missing or invalid snapshot field' }, 400)
  }

  const snapshot = body.snapshot as { version?: number; nodes?: unknown[]; edges?: unknown[] }
  if (snapshot.version !== 1 || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) {
    return json(
      { ok: false, error: '[INVALID_SNAPSHOT] snapshot.version must be 1 with nodes and edges arrays' },
      400,
    )
  }

  // ── Validate body size again after parse ──────────────────────────────────
  const snapshotJson = JSON.stringify(body.snapshot)
  if (snapshotJson.length > MAX_SNAPSHOT_BYTES) {
    return json({ ok: false, error: '[SNAPSHOT_TOO_LARGE] Snapshot exceeds 2MB limit' }, 413)
  }

  // ── Create job record ────────────────────────────────────────────────────
  const submittedAt = new Date().toISOString()
  const { data: job, error: insertErr } = await admin
    .from('graph_jobs')
    .insert({
      user_id: user.id,
      status: 'pending',
      snapshot_json: snapshotJson,
      options_json: body.options ? JSON.stringify(body.options) : null,
      submitted_at: submittedAt,
    })
    .select('id')
    .single()

  if (insertErr || !job) {
    return json(
      { ok: false, error: '[DB_ERROR] Failed to create job record', detail: insertErr?.message },
      500,
    )
  }

  return json(
    { ok: true, jobId: job.id, status: 'pending', submittedAt },
    202,
  )
}
