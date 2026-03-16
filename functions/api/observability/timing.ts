/**
 * POST /api/observability/timing
 *
 * Ingests RUM (Real User Monitoring) timing events.
 * Stores as observability_events rows with event_type = 'rum_timing'.
 *
 * Security:
 *   - Same-origin check in production.
 *   - Body size cap: 4 KB.
 *   - Event name allowlist.
 */

import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_ANON_KEY?: string
}

const MAX_BODY_BYTES = 4_096

const ALLOWED_ORIGINS: readonly string[] = [
  'https://app.chainsolve.co.uk',
  'http://localhost:5173',
  'http://localhost:4173',
]

const ALLOWED_EVENTS = new Set([
  'project_open',
  'save',
  'save_failure',
  'engine_eval',
  'canvas_switch',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown, max = 256): string {
  if (typeof v !== 'string') return ''
  return v.length > max ? v.slice(0, max) : v
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

  const eventName = str(payload['event_name'])
  if (!ALLOWED_EVENTS.has(eventName)) {
    return new Response('Unknown event', { status: 400 })
  }

  const durationMs = typeof payload['duration_ms'] === 'number' ? payload['duration_ms'] : null
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return new Response('Invalid duration', { status: 400 })
  }

  const projectRef = str(payload['project_ref']).slice(0, 16) || undefined
  const canvasRef = str(payload['canvas_ref']).slice(0, 16) || undefined
  const count =
    typeof payload['count'] === 'number' && Number.isFinite(payload['count'])
      ? Math.round(payload['count'] as number)
      : undefined

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
    event_type: 'rum_timing',
    user_id: userId,
    session_id: sessionId || null,
    route_path: routePath,
    fingerprint: null,
    payload: {
      event_name: eventName,
      duration_ms: Math.round(durationMs),
      ...(projectRef ? { project_ref: projectRef } : {}),
      ...(canvasRef ? { canvas_ref: canvasRef } : {}),
      ...(count !== undefined ? { count } : {}),
    },
    tags: {},
    cf,
  })

  if (error) {
    console.error('[obs/timing] insert error:', error.message)
    return new Response('Error', { status: 500 })
  }

  return new Response(null, { status: 204 })
}
