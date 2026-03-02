/**
 * observability/client.ts — Browser-side error capture + transport.
 *
 * Call initObservability() once at application startup (main.tsx).
 * It is safe to call multiple times — subsequent calls are no-ops.
 *
 * Captures:
 *   - window 'error' events           → client_error
 *   - window 'unhandledrejection'     → client_unhandledrejection
 *   - React ErrorBoundary (manual)    → react_errorboundary (via captureReactBoundary)
 *
 * Rate limiting:  max 5 events / 60-second window / session
 * Deduplication:  identical fingerprint within 60 s is dropped
 * Offline queue:  max 20 events in memory; retried with exponential back-off
 *
 * Transport: POST /api/report/client (JSON)
 *
 * Gating:
 *   VITE_OBS_ENABLED=true   → opt-in to enable (default: disabled)
 *   VITE_OBS_SAMPLE_RATE    → 0.0–1.0, default 1.0
 */

import type {
  ObsEvent,
  ObsEventType,
  ObsEnv,
  ClientErrorPayload,
  ClientRejectionPayload,
  ReactBoundaryPayload,
  Breadcrumb,
} from './types'
import { OBS_EVENT_TYPE, OBS_LIMITS } from './types'
import { redactString, redactUrl, pathOnly, redactTags, makeFingerprint } from './redact'
import { BUILD_SHA, BUILD_ENV } from '../lib/build-info'
import { OBS_ENABLED, OBS_SAMPLE_RATE } from '../lib/env'

// ── Configuration ─────────────────────────────────────────────────────────────

const ENDPOINT = '/api/report/client'
const SESSION_KEY = 'cs_obs_session_v1'

// ── Internal state ────────────────────────────────────────────────────────────

let _initialized = false
const _breadcrumbs: Breadcrumb[] = []
const _queue: ObsEvent[] = []
let _retryTimer: ReturnType<typeof setTimeout> | null = null
let _retryDelay = 1000

// Rate limiter: count of events in the current 60-second window
let _rateBucket = 0
let _rateBucketTs = 0

// Dedup: fingerprint → last sent timestamp
const _dedupMap = new Map<string, number>()

// In-memory error buffer for diagnostics UI (last 20)
const _errorBuffer: ObsEvent[] = []

// ── Session ID ────────────────────────────────────────────────────────────────

function getSessionId(): string {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentEnv(): ObsEnv {
  if (BUILD_ENV === 'production') return 'production'
  if (BUILD_ENV === 'preview') return 'preview'
  return 'development'
}

function currentRoute(): string {
  try {
    return pathOnly(window.location.href) || '/'
  } catch {
    return '/'
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function isEnabled(): boolean {
  return OBS_ENABLED
}

function sampleRate(): number {
  return OBS_SAMPLE_RATE
}

// ── Rate limiting + dedup ─────────────────────────────────────────────────────

function checkRateLimit(): boolean {
  const now = Date.now()
  if (now - _rateBucketTs > 60_000) {
    _rateBucket = 0
    _rateBucketTs = now
  }
  if (_rateBucket >= OBS_LIMITS.RATE_LIMIT_PER_MINUTE) return false
  _rateBucket++
  return true
}

function checkDedup(fingerprint: string): boolean {
  const last = _dedupMap.get(fingerprint)
  if (last !== undefined && Date.now() - last < OBS_LIMITS.DEDUP_WINDOW_MS) return false
  _dedupMap.set(fingerprint, Date.now())
  return true
}

// ── Breadcrumbs ───────────────────────────────────────────────────────────────

/**
 * Add a breadcrumb to the rolling buffer (last 30 actions).
 * Do NOT log user-typed text or dataset contents.
 *
 * @param action  Short verb describing what happened (e.g. 'route_change')
 * @param ctx     Small safe context: only canvasId, projectId, routeType, etc.
 */
export function addBreadcrumb(action: string, ctx?: Record<string, string>): void {
  // E9-2: Redact context values to prevent PII leaking into error reports
  let safeCtx: Record<string, string> | undefined
  if (ctx) {
    safeCtx = {}
    for (const [k, v] of Object.entries(ctx)) {
      safeCtx[k] = redactString(typeof v === 'string' ? v : String(v))
    }
  }
  _breadcrumbs.push({
    ts: new Date().toISOString(),
    action: action.slice(0, 64),
    ctx: safeCtx,
  })
  if (_breadcrumbs.length > OBS_LIMITS.MAX_BREADCRUMBS) {
    _breadcrumbs.shift()
  }
}

function getBreadcrumbs(): Breadcrumb[] {
  return [..._breadcrumbs]
}

// ── Event construction ────────────────────────────────────────────────────────

function buildEvent(
  type: ObsEventType,
  payload: ClientErrorPayload | ClientRejectionPayload | ReactBoundaryPayload,
  tags: Record<string, string> = {},
): ObsEvent {
  return {
    event_id: crypto.randomUUID(),
    event_type: type,
    ts: new Date().toISOString(),
    env: currentEnv(),
    app_version: BUILD_SHA,
    route_path: currentRoute(),
    user_id: null, // filled server-side from JWT if present
    session_id: getSessionId(),
    ua: truncate(navigator.userAgent, OBS_LIMITS.MAX_UA_CHARS),
    cf: {}, // filled server-side
    tags: redactTags(tags),
    payload,
  }
}

// ── Transport ─────────────────────────────────────────────────────────────────

function getAuthHeader(): string | null {
  // Try to read the Supabase session from localStorage without importing supabase client
  // (avoids circular deps; this is best-effort)
  try {
    const keys = Object.keys(localStorage)
    const sbKey = keys.find((k) => k.includes('supabase') && k.includes('auth-token'))
    if (!sbKey) return null
    const raw = localStorage.getItem(sbKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { access_token?: string }
    const token = parsed?.access_token
    if (typeof token === 'string' && token.length > 0) {
      return `Bearer ${token}`
    }
  } catch {
    // best-effort
  }
  return null
}

async function send(event: ObsEvent): Promise<void> {
  const body = JSON.stringify(event)
  if (body.length > OBS_LIMITS.MAX_EVENT_BYTES) {
    return // silently drop oversized events
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = getAuthHeader()
  if (auth) headers['Authorization'] = auth

  const resp = await fetch(ENDPOINT, { method: 'POST', body, headers })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
}

async function sendWithRetry(event: ObsEvent): Promise<void> {
  try {
    await send(event)
    _retryDelay = 1000
  } catch {
    if (_queue.length < OBS_LIMITS.MAX_QUEUE_SIZE) {
      _queue.push(event)
      scheduleRetry()
    }
    // else queue full; drop event silently
  }
}

function scheduleRetry(): void {
  if (_retryTimer !== null) return
  _retryTimer = setTimeout(() => {
    _retryTimer = null
    flushQueue()
  }, _retryDelay)
  _retryDelay = Math.min(_retryDelay * 2, 30_000)
}

function flushQueue(): void {
  if (_queue.length === 0) return
  const batch = _queue.splice(0, 5) // send up to 5 at a time
  for (const ev of batch) {
    send(ev).catch(() => {
      // put back at front if still under limit
      if (_queue.length < OBS_LIMITS.MAX_QUEUE_SIZE) {
        _queue.unshift(ev)
      }
    })
  }
  if (_queue.length > 0) scheduleRetry()
}

// ── Public capture API ────────────────────────────────────────────────────────

/**
 * Capture a JavaScript error event (window 'error').
 * Applies rate limiting, dedup, redaction before sending.
 */
function captureWindowError(e: ErrorEvent): void {
  // G0-4: Skip benign ResizeObserver loop errors — spec-level noise, not actionable.
  if (e.message && e.message.includes('ResizeObserver loop')) return

  const msg = truncate(redactString(e.message ?? 'Unknown error'), OBS_LIMITS.MAX_MESSAGE_CHARS)
  const stack =
    e.error instanceof Error
      ? truncate(redactString(e.error.stack ?? ''), OBS_LIMITS.MAX_STACK_CHARS)
      : undefined
  const fp = makeFingerprint(OBS_EVENT_TYPE.CLIENT_ERROR, msg, currentRoute())
  if (!checkRateLimit() || !checkDedup(fp)) return
  if (Math.random() > sampleRate()) return

  const payload: ClientErrorPayload = {
    message: msg,
    stack,
    filename: e.filename ? redactUrl(e.filename) : undefined,
    lineno: e.lineno,
    colno: e.colno,
    breadcrumbs: getBreadcrumbs(),
  }
  const event = buildEvent(OBS_EVENT_TYPE.CLIENT_ERROR, payload)
  _errorBuffer.push(event)
  if (_errorBuffer.length > 20) _errorBuffer.shift()
  void sendWithRetry(event)
}

/**
 * Capture an unhandled promise rejection.
 */
function captureUnhandledRejection(e: PromiseRejectionEvent): void {
  const raw =
    e.reason instanceof Error ? e.reason.message : String(e.reason ?? 'Unhandled rejection')
  const msg = truncate(redactString(raw), OBS_LIMITS.MAX_MESSAGE_CHARS)
  const fp = makeFingerprint(OBS_EVENT_TYPE.CLIENT_UNHANDLED_REJECTION, msg, currentRoute())
  if (!checkRateLimit() || !checkDedup(fp)) return
  if (Math.random() > sampleRate()) return

  const payload: ClientRejectionPayload = {
    reason: msg,
    breadcrumbs: getBreadcrumbs(),
  }
  const event = buildEvent(OBS_EVENT_TYPE.CLIENT_UNHANDLED_REJECTION, payload)
  _errorBuffer.push(event)
  if (_errorBuffer.length > 20) _errorBuffer.shift()
  void sendWithRetry(event)
}

/**
 * Capture a React ErrorBoundary crash.
 * Call from ErrorBoundary.componentDidCatch().
 */
export function captureReactBoundary(error: Error, componentStack?: string): void {
  if (!_initialized) return
  const msg = truncate(redactString(error.message), OBS_LIMITS.MAX_MESSAGE_CHARS)
  const fp = makeFingerprint(OBS_EVENT_TYPE.REACT_ERROR_BOUNDARY, msg, currentRoute())
  if (!checkRateLimit() || !checkDedup(fp)) return
  if (Math.random() > sampleRate()) return

  const payload: ReactBoundaryPayload = {
    message: msg,
    stack: error.stack
      ? truncate(redactString(error.stack), OBS_LIMITS.MAX_STACK_CHARS)
      : undefined,
    componentStack: componentStack
      ? truncate(redactString(componentStack), OBS_LIMITS.MAX_COMPONENT_STACK_CHARS)
      : undefined,
    breadcrumbs: getBreadcrumbs(),
  }
  const event = buildEvent(OBS_EVENT_TYPE.REACT_ERROR_BOUNDARY, payload)
  _errorBuffer.push(event)
  if (_errorBuffer.length > 20) _errorBuffer.shift()
  void sendWithRetry(event)
}

/**
 * Get the in-memory error buffer (last 20 events) for diagnostics UI.
 */
export function getErrorBuffer(): readonly ObsEvent[] {
  return [..._errorBuffer]
}

/**
 * Flush any queued events immediately (e.g., before unload).
 */
export function flushObservability(): void {
  flushQueue()
}

// ── Initializer ───────────────────────────────────────────────────────────────

/**
 * Install global error handlers and initialize the observability pipeline.
 *
 * Safe to call multiple times — subsequent calls are no-ops.
 * Never throws — failures are silently swallowed so they don't break the app.
 */
export function initObservability(): void {
  if (_initialized) return
  if (!isEnabled()) return

  try {
    _initialized = true

    window.addEventListener('error', captureWindowError)
    window.addEventListener('unhandledrejection', captureUnhandledRejection)

    // Breadcrumb: capture route changes via popstate + initial load
    addBreadcrumb('route_change', { path: currentRoute() })
    window.addEventListener('popstate', () => {
      addBreadcrumb('route_change', { path: currentRoute() })
    })

    // Best-effort flush on unload
    window.addEventListener('beforeunload', flushObservability)
  } catch {
    // Never propagate observability failures to the app
  }
}
