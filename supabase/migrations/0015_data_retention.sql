-- =========================================================================
-- 7.12: Data retention policy enforcement
-- =========================================================================
--
-- Retention rules:
--   audit_log:            90 days (enterprise: configurable via policy_data_retention_days)
--   observability_events: 30 days
--   csp_reports:          30 days
--   user_sessions:        stale sessions cleaned after 30 days
--   ai_request_log:       90 days
--   stripe_events:        180 days (for dispute resolution)
--
-- This migration adds an RPC that can be called by a scheduled job (cron)
-- to enforce these retention policies.

-- Add configurable retention days to org policies
ALTER TABLE public.ai_org_policies
  ADD COLUMN IF NOT EXISTS policy_data_retention_days integer NOT NULL DEFAULT 90
    CHECK (policy_data_retention_days >= 30 AND policy_data_retention_days <= 3650);

-- =========================================================================
-- cleanup_expired_data() — Enforces retention policies
-- =========================================================================
-- Call via cron (e.g. daily at 03:00 UTC) or GitHub Action.
-- Uses SECURITY DEFINER to bypass RLS for cleanup operations.

CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _audit_deleted     bigint := 0;
  _obs_deleted       bigint := 0;
  _csp_deleted       bigint := 0;
  _sessions_deleted  bigint := 0;
  _ai_log_deleted    bigint := 0;
  _stripe_deleted    bigint := 0;
BEGIN
  -- Audit log: 90 days default
  -- Preserve account_deletion entries for 30 days minimum
  DELETE FROM public.audit_log
  WHERE created_at < now() - INTERVAL '90 days'
    AND event_type NOT IN ('account_deletion_requested', 'account_deleted');
  GET DIAGNOSTICS _audit_deleted = ROW_COUNT;

  -- Account deletion audit entries: 30 days
  DELETE FROM public.audit_log
  WHERE created_at < now() - INTERVAL '30 days'
    AND event_type IN ('account_deletion_requested', 'account_deleted');
  GET DIAGNOSTICS _audit_deleted = _audit_deleted + ROW_COUNT;

  -- Observability events: 30 days
  DELETE FROM public.observability_events
  WHERE ts < now() - INTERVAL '30 days';
  GET DIAGNOSTICS _obs_deleted = ROW_COUNT;

  -- CSP reports: 30 days
  DELETE FROM public.csp_reports
  WHERE created_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS _csp_deleted = ROW_COUNT;

  -- Stale sessions: 30 days since last seen
  DELETE FROM public.user_sessions
  WHERE last_seen_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS _sessions_deleted = ROW_COUNT;

  -- AI request log: 90 days
  DELETE FROM public.ai_request_log
  WHERE created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS _ai_log_deleted = ROW_COUNT;

  -- Stripe events: 180 days
  DELETE FROM public.stripe_events
  WHERE created_at < now() - INTERVAL '180 days';
  GET DIAGNOSTICS _stripe_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'audit_log_deleted', _audit_deleted,
    'observability_deleted', _obs_deleted,
    'csp_reports_deleted', _csp_deleted,
    'sessions_deleted', _sessions_deleted,
    'ai_log_deleted', _ai_log_deleted,
    'stripe_events_deleted', _stripe_deleted,
    'cleaned_at', now()
  );
END;
$$;

-- Only service role should call this (not authenticated users)
REVOKE ALL ON FUNCTION public.cleanup_expired_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_data() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_data() TO service_role;
