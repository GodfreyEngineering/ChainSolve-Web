/**
 * observability/rum.ts — Real User Monitoring (RUM) timing utilities (OBS-01).
 *
 * Records latency for key user journeys:
 *   - project_open: time from navigation start to canvas interactive
 *   - save: time for an autosave or manual save round-trip
 *   - engine_eval: time for the WASM engine to evaluate a graph
 *
 * Each event is sent to POST /api/observability/timing (CF Function).
 * Gated by OBS_ENABLED. Safe to call unconditionally — exits early when disabled.
 *
 * Usage:
 *   const stop = startTiming('project_open', { project_ref: 'abc123' })
 *   // ... do work ...
 *   stop() // sends the event
 *
 *   // Or: recordTiming('save', durationMs)
 */

import { OBS_ENABLED, OBS_SAMPLE_RATE } from '../lib/env'
import { BUILD_SHA, BUILD_ENV } from '../lib/build-info'

const ENDPOINT = '/api/observability/timing'
const SESSION_KEY = 'cs_obs_session_v1'

// ── Known event names ─────────────────────────────────────────────────────────

export type RumEventName = 'project_open' | 'save' | 'engine_eval' | 'canvas_switch'

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

// ── Transport ─────────────────────────────────────────────────────────────────

function sendTiming(
  eventName: string,
  durationMs: number,
  opts?: { projectId?: string; canvasId?: string; count?: number },
): void {
  if (!OBS_ENABLED) return
  if (Math.random() > OBS_SAMPLE_RATE) return
  if (!Number.isFinite(durationMs) || durationMs < 0) return

  const payload: Record<string, unknown> = {
    event_name: eventName,
    duration_ms: Math.round(durationMs),
  }
  if (opts?.projectId) payload['project_ref'] = uuidPrefix(opts.projectId)
  if (opts?.canvasId) payload['canvas_ref'] = uuidPrefix(opts.canvasId)
  if (opts?.count !== undefined) payload['count'] = opts.count

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

// ── Public API ────────────────────────────────────────────────────────────────

export interface TimingOpts {
  projectId?: string
  canvasId?: string
  count?: number
}

/**
 * Start a timing measurement. Returns a stop function that records the duration.
 * Calling the stop function multiple times is safe — only the first call sends.
 */
export function startTiming(
  eventName: RumEventName,
  opts?: TimingOpts,
): () => void {
  if (!OBS_ENABLED) return () => {}

  const t0 = performance.now()
  let sent = false

  return () => {
    if (sent) return
    sent = true
    const durationMs = performance.now() - t0
    sendTiming(eventName, durationMs, opts)
  }
}

/**
 * Record a pre-measured duration (when you already have start/end times).
 */
export function recordTiming(
  eventName: RumEventName,
  durationMs: number,
  opts?: TimingOpts,
): void {
  sendTiming(eventName, durationMs, opts)
}
