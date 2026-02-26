-- 0013_observability_events.sql — Observability event storage
-- W9.8: Observability pipeline
--
-- Stores all client + server observability events:
--   client_error, client_unhandledrejection, react_errorboundary,
--   csp_violation, engine_diagnostics, doctor_result, server_error
--
-- Written exclusively by Cloudflare Pages Functions via service_role.
-- No user-level read/write access (service_role bypasses RLS entirely).
--
-- Retention: no automated cleanup in W9.8. Manual purge SQL:
--   DELETE FROM public.observability_events WHERE created_at < now() - interval '30 days';
-- A scheduled Supabase Edge Function for automated retention is planned for W10+.
--
-- Fingerprint: SHA-256(event_type | message_prefix | route_path) for dedup.
-- Uniqueness is NOT enforced at DB level to avoid blocking bursty inserts;
-- dedup happens at the ingest function level by checking recent fingerprints.
-- If strict dedup is required add: CREATE UNIQUE INDEX on (fingerprint, date_trunc('minute', ts)).

BEGIN;

CREATE TABLE IF NOT EXISTS public.observability_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Client-reported timestamp (may differ from created_at due to clock skew)
  ts           timestamptz NOT NULL,
  -- Environment the event came from (development | preview | production)
  env          text        NOT NULL CHECK (length(env) <= 32),
  -- Git SHA or package version (from BUILD_SHA)
  app_version  text,
  -- Discriminator (see OBS_EVENT_TYPE constants in src/observability/types.ts)
  event_type   text        NOT NULL CHECK (length(event_type) <= 64),
  -- Supabase user UUID; null for unauthenticated or CSP reports
  user_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Random UUID rotated daily per browser session
  session_id   uuid,
  -- Current URL pathname (no querystring; may be null for server-side events)
  route_path   text,
  -- SHA-256(event_type | message_prefix | route_path) for dedup queries
  fingerprint  text,
  -- Event-type-specific payload (redacted before insert)
  payload      jsonb       NOT NULL DEFAULT '{}',
  -- Allowlisted context tags: canvasId, projectId, locale, etc.
  tags         jsonb       NOT NULL DEFAULT '{}',
  -- Cloudflare geo data: country, colo (no IP)
  cf           jsonb       NOT NULL DEFAULT '{}',
  -- Server-side insert timestamp (authoritative; always NOW())
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- No user-level access. Service role writes; dashboard reads.
ALTER TABLE public.observability_events ENABLE ROW LEVEL SECURITY;
-- (No policies needed — zero policies + RLS enabled = no user access)

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Primary query patterns: newest first, filter by type or session or user
CREATE INDEX IF NOT EXISTS idx_obs_events_created
  ON public.observability_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_events_type
  ON public.observability_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_events_session
  ON public.observability_events (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_obs_events_user
  ON public.observability_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_obs_events_fingerprint
  ON public.observability_events (fingerprint, created_at DESC)
  WHERE fingerprint IS NOT NULL;

-- Notify PostgREST to reload schema (required for new tables)
NOTIFY pgrst, 'reload schema';

COMMIT;
