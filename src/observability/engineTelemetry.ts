/**
 * observability/engineTelemetry.ts — Engine evaluation telemetry (OBS-02).
 *
 * Records per-eval metrics (eval time, node/edge counts, partial flag) after
 * each WASM engine evaluation and sends them to /api/observability/engine.
 *
 * Sampled at OBS_SAMPLE_RATE to avoid flooding — engine evals fire frequently.
 * Gated by OBS_ENABLED. Safe to call unconditionally.
 */

import { OBS_ENABLED, OBS_SAMPLE_RATE } from '../lib/env'
import { BUILD_SHA, BUILD_ENV } from '../lib/build-info'

const ENDPOINT = '/api/observability/engine'
const SESSION_KEY = 'cs_obs_session_v1'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSessionId(): string {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as { id?: string; day?: string }
      if (parsed.day === today && typeof parsed.id === 'string') {
        return parsed.id
      }
    }
    const id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, day: today }))
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function getAuthHeader(): string | null {
  try {
    const keys = Object.keys(localStorage)
    const sbKey = keys.find((k) => k.includes('supabase') && k.includes('auth-token'))
    if (!sbKey) return null
    const raw = localStorage.getItem(sbKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { access_token?: string }
    const token = parsed?.access_token
    if (typeof token === 'string' && token.length > 0) return `Bearer ${token}`
  } catch {
    // best-effort
  }
  return null
}

function currentEnv(): string {
  if (BUILD_ENV === 'production') return 'production'
  if (BUILD_ENV === 'preview') return 'preview'
  return 'development'
}

/** Truncate a UUID to first 8 chars — enough to correlate without full exposure. */
function uuidPrefix(id: string | null | undefined): string | undefined {
  if (!id || id.length < 8) return undefined
  return id.slice(0, 8)
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface EngineEvalOpts {
  projectId?: string
  canvasId?: string
}

/**
 * Record engine evaluation telemetry.
 * Sampled at OBS_SAMPLE_RATE — not every eval is sent.
 */
export function recordEngineEval(
  evalKind: 'snapshot' | 'patch',
  evalTimeUs: number,
  nodeCount: number,
  edgeCount: number,
  dirtyNodeCount: number,
  isPartial: boolean,
  opts?: EngineEvalOpts,
): void {
  if (!OBS_ENABLED) return
  if (Math.random() > OBS_SAMPLE_RATE) return
  if (!Number.isFinite(evalTimeUs) || evalTimeUs < 0) return

  const payload: Record<string, unknown> = {
    eval_kind: evalKind,
    eval_time_us: Math.round(evalTimeUs),
    node_count: nodeCount,
    edge_count: edgeCount,
    dirty_node_count: dirtyNodeCount,
    is_partial: isPartial,
  }
  if (opts?.projectId) payload['project_ref'] = uuidPrefix(opts.projectId)
  if (opts?.canvasId) payload['canvas_ref'] = uuidPrefix(opts.canvasId)

  const body = JSON.stringify({
    event_id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    env: currentEnv(),
    app_version: BUILD_SHA,
    route_path: window.location.pathname,
    session_id: getSessionId(),
    payload,
  })

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = getAuthHeader()
  if (auth) headers['Authorization'] = auth

  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
  } else {
    fetch(ENDPOINT, { method: 'POST', body, headers }).catch(() => {})
  }
}
