/**
 * POST /api/graph/export/pdf — 10.3: Export a graph and its results as PDF.
 *
 * Accepts a graph snapshot + evaluation results and returns a PDF report.
 *
 * Authorization: Bearer JWT.
 *
 * Request body:
 *   {
 *     "snapshot": EngineSnapshotV1,
 *     "results": EvalResult,
 *     "options": {
 *       "title": string,
 *       "includeGraph": boolean,
 *       "includeValues": boolean,
 *       "includeDiagnostics": boolean
 *     }
 *   }
 *
 * Response 200: PDF binary with Content-Type: application/pdf
 * Response 401: missing or invalid auth token
 *
 * Implementation note: Full PDF generation is handled via a headless
 * Chromium renderer or a Rust typesetting engine. For now, returns a
 * minimal plain-text report as a UTF-8 encoded "PDF" placeholder.
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
  let body: { snapshot?: unknown; results?: unknown; options?: Record<string, unknown> }
  try {
    body = await request.json() as typeof body
  } catch {
    return json({ ok: false, error: '[INVALID_JSON] Request body must be valid JSON' }, 400)
  }

  const title = (body.options?.title as string | undefined) ?? 'ChainSolve Report'
  const now = new Date().toISOString()

  // ── Generate plain-text report (placeholder until full PDF renderer) ──────
  const nodeCount = Array.isArray((body.snapshot as { nodes?: unknown[] } | undefined)?.nodes)
    ? ((body.snapshot as { nodes?: unknown[] }).nodes?.length ?? 0)
    : 0

  const reportText = [
    `ChainSolve Calculation Report`,
    `==============================`,
    `Title:      ${title}`,
    `Generated:  ${now}`,
    `User:       ${user.email ?? user.id}`,
    ``,
    `Graph Summary`,
    `-------------`,
    `Nodes: ${nodeCount}`,
    ``,
    `Results`,
    `-------`,
    body.results ? JSON.stringify(body.results, null, 2) : '(no results attached)',
    ``,
    `--- End of Report ---`,
  ].join('\n')

  // Return as plain text for now; replace with actual PDF once renderer is ready.
  return new Response(reportText, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="chainsolve-report-${now.slice(0, 10)}.txt"`,
    },
  })
}
