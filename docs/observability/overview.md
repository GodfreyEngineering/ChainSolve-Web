# Observability — Overview

> W9.8 | Added 2026-02-26

ChainSolve's observability stack is intentionally minimal, vendor-neutral, and
redaction-first.  All telemetry flows through a single `ObsEvent` envelope
stored in a Supabase table.  No third-party analytics SDK is used.

---

## Goals

- Catch production JS errors before users report them.
- Verify WASM engine health across browser / OS combinations.
- Provide a low-friction diagnostics surface for debugging.
- Never leak PII, auth tokens, or secret keys — even accidentally.

## Non-goals

- Real-time dashboards (query Supabase directly when needed).
- Performance tracing / distributed tracing (out of scope).
- Marketing analytics or user-behaviour tracking.

---

## Event model

Every event is an `ObsEvent` envelope (defined in
`src/observability/types.ts`):

```typescript
interface ObsEvent {
  event_id: string          // UUID v4
  event_type: ObsEventType  // see OBS_EVENT_TYPE constants
  ts: string                // ISO-8601 UTC
  env: 'development' | 'production' | 'test'
  app_version: string       // __CS_VERSION__
  route_path: string        // current pathname, query stripped
  user_id: string | null    // verified JWT subject, or null
  session_id: string        // daily-rotating UUID from localStorage
  ua: string                // redacted user-agent prefix (100 chars)
  cf: ObsCf                 // Cloudflare ray + country (server-added)
  tags: Record<string, string>   // allowlisted metadata
  payload: ObsPayload       // event-type-specific body
}
```

### Event types

| `event_type`                  | Trigger                                      |
|-------------------------------|----------------------------------------------|
| `client_error`                | `window.onerror` / unhandled exception        |
| `client_unhandledrejection`   | `window.onunhandledrejection`                |
| `react_errorboundary`         | React `ErrorBoundary.componentDidCatch`       |
| `csp_violation`               | Browser CSP report sent to `/api/report/csp` |
| `engine_diagnostics`          | Manual export from `/diagnostics` page        |
| `doctor_result`               | `/diagnostics` doctor checks (on-demand)     |
| `server_error`                | Cloudflare Function uncaught error            |

---

## Redaction

**All data is redacted before leaving the client.**  The pipeline:

1. `redactUrl()` — strips `?query` and `#fragment` from any URL.
2. `redactString()` — replaces `Bearer <token>` → `Bearer [TOKEN]`,
   bare JWTs (`eyJ…`) → `[TOKEN]`, email addresses → `[EMAIL]`,
   16-digit CC-like numbers → `[CC]`.
3. `redactObject()` — deep-walks any object/array, applying the above
   plus `[REDACTED]` for keys matching the secret blocklist
   (token, password, api_key, jwt, secret, …).
4. `redactTags()` — allowlist filter on structured tags; unknown keys
   are silently dropped.  Values truncated to 128 characters.

Source: [src/observability/redact.ts](../../src/observability/redact.ts)

Tests: [src/observability/redact.test.ts](../../src/observability/redact.test.ts)

---

## Client pipeline

```
window.onerror / onunhandledrejection
        │
        ▼
  captureWindowError / captureUnhandledRejection
        │
        ├── rate-limit check (5 events / 60 s)
        ├── dedup check (djb2 fingerprint, 60 s window)
        ├── redactObject() on all payload fields
        │
        ▼
  in-memory queue (max 20)
        │
        ▼ (next idle / retry backoff)
  POST /api/report/client
    Authorization: Bearer <supabase-access-token>  (if logged in)
    Content-Type: application/json
    Body: ObsEvent (≤ 32 KB)
```

Source: [src/observability/client.ts](../../src/observability/client.ts)

---

## Storage

Events land in the `observability_events` Supabase table (migration
`0013_observability_events.sql`).  RLS is enabled with **zero user-facing
policies** — only the service role key (used by Cloudflare Functions) can
write or read rows.

Key columns: `id`, `ts`, `env`, `app_version`, `event_type`, `user_id`,
`session_id`, `route_path`, `fingerprint` (SHA-256 dedup key), `payload`
(jsonb), `tags` (jsonb), `cf` (jsonb).

Indexes: `created_at`, `event_type`, `session_id`, `user_id`, `fingerprint`.

---

## Rate limiting and deduplication

| Limit                   | Value         |
|-------------------------|---------------|
| Events per minute       | 5 per session |
| Dedup window            | 60 seconds    |
| In-memory queue         | 20 events     |
| Max event body          | 32 KB (server check) |
| Max stack trace         | 8 KB          |
| Max breadcrumbs         | 30            |

Dedup key = `djb2(event_type + message + route_path)` — same error at the
same route within 60 s is sent only once.

---

## Session ID

`localStorage['cs_obs_session_v1']` — UUID v4, rotated daily (based on
`YYYY-MM-DD` suffix).  Used for correlating events within a session.
Not a user identifier — never joined with PII.

---

## Environment flags

| Variable                     | Effect                                      |
|------------------------------|---------------------------------------------|
| `VITE_OBS_ENABLED=false`     | Disables entire client pipeline             |
| `VITE_OBS_SAMPLE_RATE=0.5`   | Sample 50% of sessions (default 1.0)        |
| `VITE_DIAGNOSTICS_UI_ENABLED=true` | Enables `/diagnostics` in production |

In development (`import.meta.env.DEV`), observability is always enabled and
the diagnostics UI is always accessible.

---

## Related docs

- [csp-reporting.md](./csp-reporting.md) — CSP violation reporting
- [doctor.md](./doctor.md) — in-app health checks
- [runbook.md](./runbook.md) — operational runbook
