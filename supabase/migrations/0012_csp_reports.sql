-- 0012_csp_reports.sql — CSP violation report storage
-- W8: Security Perimeter & Reporting
--
-- Stores Content-Security-Policy violation reports POSTed by browsers
-- to /api/security/csp-report.  The endpoint uses service_role to insert
-- (browser CSP reports carry no auth token), so RLS does not gate inserts
-- from the endpoint.  The authenticated INSERT policy is provided for
-- future client-side JS error reporting.
--
-- Dedup: the dedup_key column (UNIQUE) holds SHA-256(key_fields + minute_bucket).
-- The endpoint uses UPSERT with ignoreDuplicates to silently skip duplicates
-- within the same 1-minute window.

BEGIN;

CREATE TABLE IF NOT EXISTS public.csp_reports (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  user_id              uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  page                 text,
  document_uri         text,
  referrer             text,
  violated_directive   text,
  effective_directive  text,
  original_policy      text,
  blocked_uri          text,
  disposition          text,
  user_agent           text,
  raw                  jsonb       NOT NULL DEFAULT '{}',
  dedup_key            text        UNIQUE       -- SHA-256 hash for 1-min dedup
);

ALTER TABLE public.csp_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can INSERT their own reports (user_id must match).
-- The CSP report endpoint uses service_role which bypasses RLS entirely.
CREATE POLICY csp_reports_insert_own
  ON public.csp_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- No SELECT / UPDATE / DELETE for authenticated users.
-- Reports are internal — only service_role / dashboard can read them.

-- Index for admin queries (newest first)
CREATE INDEX IF NOT EXISTS idx_csp_reports_created
  ON public.csp_reports (created_at DESC);

NOTIFY pgrst, 'reload schema';

COMMIT;
