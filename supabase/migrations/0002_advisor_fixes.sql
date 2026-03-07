-- 0002_advisor_fixes.sql
-- Resolves Supabase Advisor warnings (security + performance).
-- All statements are idempotent — safe to run on fresh or existing databases.

-- 1. SECURITY: Drop stale function with mutable search_path.
--    handle_canvases_updated_at was replaced by trigger_set_updated_at()
--    which already has SET search_path = public. The old function may still
--    exist in databases that ran early migrations.
DROP FUNCTION IF EXISTS public.handle_canvases_updated_at() CASCADE;

-- 2. PERFORMANCE: Drop duplicate profiles UPDATE policy.
--    The baseline has only profiles_update. Older DBs may also have
--    "Users can update own profile (no role escalation)" from a prior migration.
DROP POLICY IF EXISTS "Users can update own profile (no role escalation)" ON public.profiles;

-- 3. PERFORMANCE: Drop duplicate stripe_events deny-all policy.
--    The baseline keeps stripe_events_deny_all. Drop the redundant
--    stripe_events_no_access policy that some DBs accumulated.
DROP POLICY IF EXISTS stripe_events_no_access ON public.stripe_events;

-- 4. PERFORMANCE: Drop duplicate index on project_assets.
--    The baseline has idx_project_assets_project_id. Drop the older
--    idx_project_assets_project if it exists.
DROP INDEX IF EXISTS idx_project_assets_project;
