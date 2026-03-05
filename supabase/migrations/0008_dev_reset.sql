-- ============================================================
-- 0008_dev_reset.sql — DEV ONLY
--
-- Wipe all user data for v1 beta fresh start.
-- Schema, RLS policies, functions, and triggers are preserved.
--
-- Safe to run multiple times (TRUNCATE is idempotent).
-- ============================================================

BEGIN;

-- Truncate all user-facing data tables.
-- CASCADE handles FK dependencies automatically.
TRUNCATE TABLE public.profiles CASCADE;
TRUNCATE TABLE public.projects CASCADE;
TRUNCATE TABLE public.canvases CASCADE;
TRUNCATE TABLE public.fs_items CASCADE;
TRUNCATE TABLE public.project_assets CASCADE;
TRUNCATE TABLE public.organizations CASCADE;
TRUNCATE TABLE public.org_members CASCADE;

-- Marketplace
TRUNCATE TABLE public.marketplace_items CASCADE;
TRUNCATE TABLE public.marketplace_purchases CASCADE;
TRUNCATE TABLE public.marketplace_install_events CASCADE;
TRUNCATE TABLE public.marketplace_likes CASCADE;
TRUNCATE TABLE public.marketplace_comments CASCADE;

-- User-generated content
TRUNCATE TABLE public.bug_reports CASCADE;
TRUNCATE TABLE public.suggestions CASCADE;
TRUNCATE TABLE public.group_templates CASCADE;
TRUNCATE TABLE public.user_reports CASCADE;
TRUNCATE TABLE public.avatar_reports CASCADE;

-- Billing / Stripe
TRUNCATE TABLE public.stripe_events CASCADE;

-- Observability / audit (non-PII but stale)
TRUNCATE TABLE public.audit_log CASCADE;
TRUNCATE TABLE public.observability_events CASCADE;
TRUNCATE TABLE public.csp_reports CASCADE;

-- AI features
TRUNCATE TABLE public.ai_org_policies CASCADE;
TRUNCATE TABLE public.ai_usage_monthly CASCADE;
TRUNCATE TABLE public.ai_request_log CASCADE;

-- Sessions / preferences
TRUNCATE TABLE public.user_sessions CASCADE;
TRUNCATE TABLE public.user_preferences CASCADE;
TRUNCATE TABLE public.user_terms_log CASCADE;
TRUNCATE TABLE public.student_verifications CASCADE;

COMMIT;
