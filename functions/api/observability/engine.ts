/**
 * POST /api/observability/engine
 *
 * Ingests engine evaluation telemetry events (OBS-02).
 * Stores as observability_events rows with event_type = 'engine_eval'.
 *
 * Payload fields:
 *   eval_time_us    — engine elapsed time in microseconds (integer)
 *   node_count      — total nodes in graph at eval time
 *   edge_count      — total edges in graph at eval time
 *   dirty_node_count — nodes actually evaluated (may be < node_count for incremental)
 *   is_partial      — whether the eval hit the time budget and returned partial results
 *   eval_kind       — 'snapshot' or 'patch'
 *
 * Security:
 *   - Same-origin check in production.
 *   - Body size cap: 2 KB.
 *   - Numeric range validation.
 */

import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_ANON_KEY?: string
}

const MAX_BODY_BYTES = 2_048

const ALLOWED_ORIGINS: readonly string[] = [
  'https://app.chainsolve.co.uk',
  'http://localhost:5173',
  'http://localhost:4173',
]

const ALLOWED_EVAL_KINDS = new Set(['snapshot', 'patch'])

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeInt(v: unknown, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return null
  return Math.round(v)
}

function str(v: unknown, maxLen = 64): string {
  if (typeof v !== 'string') return ''
  return v.length > maxLen ? v.slice(0, maxLen) : v
}

async function resolveUserId(
  authHeader: string | null,
  supabaseUrl: string,
  anonKey: string,
): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  try {
    const client = createClient(supabaseUrl, anonKey)
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token)
    if (error || !user) return null
    return user.id
  } catch {
    return null
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Server config error', { status: 500 })
  }

  // ── Origin check ───────────────────────────────────────────────────────────
  const origin = context.request.headers.get('Origin')
  const cfEnv = (context.env as unknown as Record<string, string>)['CF_PAGES_ENV']
  const isProd = cfEnv === 'production'
  if (isProd && (origin === null || !ALLOWED_ORIGINS.includes(origin))) {
    return new Response('Forbidden', { status: 403 })
  }

  // ── Body size ──────────────────────────────────────────────────────────────
  const raw = await context.request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return new Response('Payload too large', { status: 413 })
  }

  // ── Parse ──────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // ── Extract payload ────────────────────────────────────────────────────────
  const payload =
    typeof body['payload'] === 'object' && body['payload'] !== null
      ? (body['payload'] as Record<string, unknown>)
      : {}

  const evalTimeUs = safeInt(payload['eval_time_us'], 60_000_000) // 60s cap
  if (evalTimeUs === null) {
    return new Response('Invalid eval_time_us', { status: 400 })
  }

  const nodeCount = safeInt(payload['node_count'], 10_000)
  if (nodeCount === null) {
    return new Response('Invalid node_count', { status: 400 })
  }

  const edgeCount = safeInt(payload['edge_count'], 100_000)
  if (edgeCount === null) {
    return new Response('Invalid edge_count', { status: 400 })
  }

  const dirtyNodeCount = safeInt(payload['dirty_node_count'], 10_000)
  if (dirtyNodeCount === null) {
    return new Response('Invalid dirty_node_count', { status: 400 })
  }

  const isPartial = typeof payload['is_partial'] === 'boolean' ? payload['is_partial'] : false

  const evalKind = str(payload['eval_kind'])
  if (!ALLOWED_EVAL_KINDS.has(evalKind)) {
    return new Response('Invalid eval_kind', { status: 400 })
  }

  const projectRef = str(payload['project_ref'] ?? '', 16) || undefined
  const canvasRef = str(payload['canvas_ref'] ?? '', 16) || undefined

  const ts = str(body['ts']) || new Date().toISOString()
  const env = str(body['env']).slice(0, 32) || 'unknown'
  const appVersion = str(body['app_version']).slice(0, 64)
  const routePath = str(body['route_path']).slice(0, 512)
  const sessionId = str(body['session_id']).slice(0, 64)

  // ── CF metadata ────────────────────────────────────────────────────────────
  const cf = {
    country: context.request.headers.get('CF-IPCountry') ?? undefined,
    colo: context.request.headers.get('CF-Ray')?.split('-')[1] ?? undefined,
  }

  // ── User resolution ────────────────────────────────────────────────────────
  const authHeader = context.request.headers.get('Authorization')
  const anonKey = (context.env as unknown as Record<string, string>)['SUPABASE_ANON_KEY'] ?? ''
  const userId = await resolveUserId(authHeader, SUPABASE_URL, anonKey)

  // ── Insert ─────────────────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error } = await supabase.from('observability_events').insert({
    ts,
    env,
    app_version: appVersion,
    event_type: 'engine_eval',
    user_id: userId,
    session_id: sessionId || null,
    route_path: routePath,
    fingerprint: null,
    payload: {
      eval_time_us: evalTimeUs,
      node_count: nodeCount,
      edge_count: edgeCount,
      dirty_node_count: dirtyNodeCount,
      is_partial: isPartial,
      eval_kind: evalKind,
      ...(projectRef ? { project_ref: projectRef } : {}),
      ...(canvasRef ? { canvas_ref: canvasRef } : {}),
    },
    tags: {},
    cf,
  })

  if (error) {
    console.error('[obs/engine] insert error:', error.message)
    return new Response('Error', { status: 500 })
  }

  return new Response(null, { status: 204 })
}
