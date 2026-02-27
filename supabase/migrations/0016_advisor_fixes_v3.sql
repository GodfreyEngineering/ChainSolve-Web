-- 0016_advisor_fixes_v3.sql — Supabase Advisor fixpack v3
--
-- Fixes two remaining advisor warnings:
--
-- 1. function_search_path_mutable (lint 0011):
--    handle_canvases_updated_at() from 0014_multi_canvas.sql was created
--    without SET search_path. Recreate with SET search_path = public.
--
-- 2. rls_enabled_no_policy on observability_events (from 0013):
--    RLS is enabled but zero policies exist. The table is written exclusively
--    by service_role (which bypasses RLS) and should never be readable by
--    authenticated users. Add an explicit deny-all SELECT policy for
--    authenticated to silence the advisor and document the intent.
--
-- Idempotent: CREATE OR REPLACE + DROP IF EXISTS.
-- Safe to re-run.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Fix handle_canvases_updated_at — add SET search_path
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_canvases_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Explicit deny-all policy on observability_events
--
-- This table is written by service_role only (bypasses RLS).
-- Adding a deny-all policy for authenticated makes the intent explicit
-- and silences the rls_enabled_no_policy advisor warning.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "obs_events_deny_all" ON public.observability_events;

CREATE POLICY "obs_events_deny_all"
  ON public.observability_events
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Refresh PostgREST schema cache
-- ═══════════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';

COMMIT;
