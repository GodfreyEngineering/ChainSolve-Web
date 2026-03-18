/**
 * GET /api/graph/{id}/results — 10.3: Poll execution results for a job.
 *
 * Returns the current status and (if complete) results for a graph job
 * submitted via POST /api/graph/execute.
 *
 * Authorization: Bearer JWT (Supabase Auth token).
 * Users can only access their own jobs.
 *
 * Response 200 — job found:
 *   {
 *     "jobId": "uuid",
 *     "status": "pending" | "running" | "completed" | "failed",
 *     "submittedAt": "ISO8601",
 *     "completedAt": "ISO8601" | null,
 *     "result": { "values": {...}, "diagnostics": [...] } | null,
 *     "error": { "code": "...", "message": "..." } | null
 *   }
 *
 * Response 401: missing or invalid auth token
 * Response 404: job not found or belongs to another user
 */

import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context
  const jobId = params.id as string

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

  // ── Fetch job (user-scoped) ───────────────────────────────────────────────
  const { data: job, error: fetchErr } = await admin
    .from('graph_jobs')
    .select('id, user_id, status, submitted_at, completed_at, result_json, error_json')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !job) {
    return json({ ok: false, error: '[NOT_FOUND] Job not found' }, 404)
  }

  // ── Parse stored JSON safely ──────────────────────────────────────────────
  let result: unknown = null
  let error: unknown = null

  try {
    if (job.result_json) result = JSON.parse(job.result_json as string)
  } catch {
    result = null
  }
  try {
    if (job.error_json) error = JSON.parse(job.error_json as string)
  } catch {
    error = null
  }

  return json(
    {
      ok: true,
      jobId: job.id,
      status: job.status,
      submittedAt: job.submitted_at,
      completedAt: job.completed_at ?? null,
      result,
      error,
    },
    200,
  )
}
