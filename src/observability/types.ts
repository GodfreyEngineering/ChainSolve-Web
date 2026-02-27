/**
 * observability/types.ts — Canonical event envelope for all observability events.
 *
 * A single ObsEvent shape is used by all reports:
 *   client errors, unhandled rejections, React boundary crashes,
 *   CSP violations, engine diagnostics, doctor results, server errors.
 *
 * Design constraints:
 *   - Max event JSON: 16 KB (hard cap; enforced by sender before transport)
 *   - Max stacktrace: 8 KB
 *   - No PII: no emails, no tokens, no raw URLs with querystrings
 *   - user_id is a UUID or null; never an email address
 *   - cf data: country + colo + asn only; NO IP storage
 *
 * See docs/observability/overview.md for the full data model.
 */

// ── Event types ───────────────────────────────────────────────────────────────

export const OBS_EVENT_TYPE = {
  CLIENT_ERROR: 'client_error',
  CLIENT_UNHANDLED_REJECTION: 'client_unhandledrejection',
  REACT_ERROR_BOUNDARY: 'react_errorboundary',
  CSP_VIOLATION: 'csp_violation',
  ENGINE_DIAGNOSTICS: 'engine_diagnostics',
  DOCTOR_RESULT: 'doctor_result',
  SERVER_ERROR: 'server_error',
} as const

export type ObsEventType = (typeof OBS_EVENT_TYPE)[keyof typeof OBS_EVENT_TYPE]

// ── Environment ───────────────────────────────────────────────────────────────

export type ObsEnv = 'development' | 'preview' | 'production'

// ── Cloudflare request metadata (filled server-side; never includes IP) ──────

export interface ObsCf {
  country?: string
  colo?: string
  asn?: number
}

// ── Per-event-type payloads ───────────────────────────────────────────────────

export interface ClientErrorPayload {
  message: string // truncated to 2 KB
  stack?: string // truncated to 8 KB
  filename?: string // origin+path only, no query
  lineno?: number
  colno?: number
  breadcrumbs: Breadcrumb[] // last ≤ 30 actions
}

export interface ClientRejectionPayload {
  reason: string // truncated to 2 KB; redacted
  breadcrumbs: Breadcrumb[]
}

export interface ReactBoundaryPayload {
  message: string
  stack?: string // truncated to 8 KB
  componentStack?: string // truncated to 4 KB
  breadcrumbs: Breadcrumb[]
}

export interface CspViolationPayload {
  effectiveDirective: string
  blockedUrl: string // origin+path only
  documentUrl: string // path only (no origin)
  disposition: 'enforce' | 'report' | string
  statusCode?: number
}

export interface EngineDiagnosticsPayload {
  engineVersion: string
  contractVersion: number
  nodeCount: number
  edgeCount: number
  evalDurationUs: number
  diagnostics: Array<{ nodeId?: string; level: string; code: string; message: string }>
  trace: Array<{ nodeId: string; opId: string; durationUs?: number }> // summary only, no values
  workerEvents: WorkerLifecycleEvent[]
}

export interface DoctorResultPayload {
  checks: DoctorCheck[]
  totalDurationMs: number
}

export interface ServerErrorPayload {
  handler: string // e.g. "POST /api/report/client"
  message: string
  statusCode: number
}

export type ObsPayload =
  | ClientErrorPayload
  | ClientRejectionPayload
  | ReactBoundaryPayload
  | CspViolationPayload
  | EngineDiagnosticsPayload
  | DoctorResultPayload
  | ServerErrorPayload

// ── Breadcrumb (action log) ───────────────────────────────────────────────────

export interface Breadcrumb {
  ts: string // ISO timestamp
  action: string // e.g. "route_change", "project_save", "canvas_open"
  /** Small set of safe context keys: canvasId, projectId, feature flags. */
  ctx?: Record<string, string>
}

// ── Doctor check ─────────────────────────────────────────────────────────────

export interface DoctorCheck {
  name: string
  ok: boolean
  message: string
  durationMs: number
}

// ── Worker lifecycle event ────────────────────────────────────────────────────

export interface WorkerLifecycleEvent {
  ts: string
  event: 'start' | 'ready' | 'terminate' | 'error' | 'cancel'
  detail?: string
}

// ── Canonical event envelope ──────────────────────────────────────────────────

export interface ObsEvent {
  /** UUID v4 — unique per event */
  event_id: string
  event_type: ObsEventType
  /** ISO-8601 timestamp from the client */
  ts: string
  env: ObsEnv
  /** Git SHA or package version (from BUILD_SHA / BUILD_VERSION) */
  app_version: string
  /** Current URL path — NO querystring, NO fragment */
  route_path: string
  /** Supabase UUID from JWT, or null if unauthenticated */
  user_id: string | null
  /** Random UUID stored in localStorage; rotated daily */
  session_id: string
  /** User-Agent string, truncated to 500 chars */
  ua: string
  /** Cloudflare geo/network metadata — filled server-side */
  cf: ObsCf
  /** Allowlisted context tags: canvasId, projectId, locale, etc. */
  tags: Record<string, string>
  payload: ObsPayload
}

// ── Size constants ────────────────────────────────────────────────────────────

export const OBS_LIMITS = {
  MAX_EVENT_BYTES: 16_384, // 16 KB total JSON
  MAX_STACK_CHARS: 8_192, // 8 KB stack trace
  MAX_COMPONENT_STACK_CHARS: 4_096,
  MAX_MESSAGE_CHARS: 2_048,
  MAX_BREADCRUMBS: 30,
  MAX_TRACE_ENTRIES: 50,
  MAX_WORKER_EVENTS: 50,
  MAX_UA_CHARS: 500,
  MAX_PATH_CHARS: 512,
  MAX_QUEUE_SIZE: 20,
  RATE_LIMIT_PER_MINUTE: 5,
  DEDUP_WINDOW_MS: 60_000,
} as const

// ── Error codes for the observability pipeline ────────────────────────────────

export const OBS_ERROR_CODES = {
  RATE_LIMITED: '[OBS_RATE_LIMITED]',
  DEDUP_SKIPPED: '[OBS_DEDUP_SKIPPED]',
  PAYLOAD_TOO_LARGE: '[OBS_PAYLOAD_TOO_LARGE]',
  TRANSPORT_FAILED: '[OBS_TRANSPORT_FAILED]',
  QUEUE_FULL: '[OBS_QUEUE_FULL]',
  INIT_FAILED: '[OBS_INIT_FAILED]',
} as const
