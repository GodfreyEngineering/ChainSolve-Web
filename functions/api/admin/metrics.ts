/**
 * GET /api/admin/metrics
 *
 * Admin-only endpoint: returns P50/P95 latency metrics for RUM timing
 * and web vitals over the last 7 days from observability_events.
 *
 * Authorization: requires a valid Supabase JWT where the user's profile
 * has is_admin = true (verified via service role query).
 *
 * Response: JSON with aggregated metrics by event_name.
 */

import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_ANON_KEY?: string
}

const ALLOWED_ORIGINS: readonly string[] = [
  'https://app.chainsolve.co.uk',
  'http://localhost:5173',
  'http://localhost:4173',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

interface MetricRow {
  event_name: string
  count: number
  p50_ms: number
  p95_ms: number
  mean_ms: number
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Server config error', { status: 500 })
  }

  // ── CORS ───────────────────────────────────────────────────────────────────
  const origin = context.request.headers.get('Origin')
  const cfEnv = (context.env as unknown as Record<string, string>)['CF_PAGES_ENV']
  const isProd = cfEnv === 'production'
  if (isProd && (origin === null || !ALLOWED_ORIGINS.includes(origin))) {
    return new Response('Forbidden', { status: 403 })
  }

  // ── Auth: require is_admin ─────────────────────────────────────────────────
  const authHeader = context.request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const anonKey = (context.env as unknown as Record<string, string>)['SUPABASE_ANON_KEY'] ?? ''
  const anonClient = createClient(SUPABASE_URL, anonKey)
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(authHeader.slice(7))
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check is_admin via service role
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: profileRow } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profileRow || !profileRow.is_admin) {
    return new Response('Forbidden', { status: 403 })
  }

  // ── Query last 7 days of RUM + web_vitals ─────────────────────────────────
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: rows, error: queryError } = await serviceClient
    .from('observability_events')
    .select('event_type, payload')
    .in('event_type', ['rum_timing', 'web_vitals'])
    .gte('ts', since)

  if (queryError) {
    console.error('[admin/metrics] query error:', queryError.message)
    return new Response('Query error', { status: 500 })
  }

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const groups = new Map<string, number[]>()

  for (const row of rows ?? []) {
    const p = row.payload as Record<string, unknown> | null
    if (!p) continue

    let key: string | null = null
    let value: number | null = null

    if (row.event_type === 'rum_timing') {
      key = typeof p['event_name'] === 'string' ? `rum:${p['event_name']}` : null
      value = typeof p['duration_ms'] === 'number' ? (p['duration_ms'] as number) : null
    } else if (row.event_type === 'web_vitals') {
      key = typeof p['metric_name'] === 'string' ? `vitals:${p['metric_name']}` : null
      value = typeof p['value'] === 'number' ? (p['value'] as number) : null
    }

    if (key && value !== null && Number.isFinite(value) && value >= 0) {
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(value)
    }
  }

  const metrics: MetricRow[] = []
  for (const [name, values] of groups) {
    const sorted = [...values].sort((a, b) => a - b)
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    metrics.push({
      event_name: name,
      count: sorted.length,
      p50_ms: Math.round(percentile(sorted, 50)),
      p95_ms: Math.round(percentile(sorted, 95)),
      mean_ms: Math.round(mean),
    })
  }

  metrics.sort((a, b) => a.event_name.localeCompare(b.event_name))

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store',
  }
  if (origin) responseHeaders['Access-Control-Allow-Origin'] = origin
  return new Response(JSON.stringify({ metrics, since, generated_at: new Date().toISOString() }), {
    status: 200,
    headers: responseHeaders,
  })
}
