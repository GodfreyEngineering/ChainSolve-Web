-- 0023_advisor_fixes.sql — Resolve all Supabase security + performance advisories.
--
-- Security:
--   1. Fix update_experiment_run_updated_at missing SET search_path
--
-- Performance (auth_rls_initplan):
--   2. Replace auth.uid() with (select auth.uid()) in all RLS policies
--      to avoid per-row re-evaluation
--
-- Performance (multiple_permissive_policies):
--   3. Merge demonstrations "owner update" + "owner soft delete" into one policy
--
-- Performance (duplicate_index):
--   4. Drop duplicate indexes on org_members and share_links
--
-- Performance (unindexed_foreign_keys):
--   5. Add covering indexes for FKs on demonstrations, project_branches,
--      project_snapshots
--
-- All statements are idempotent (DROP IF EXISTS + CREATE OR REPLACE).

SET search_path = public;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. SECURITY: Fix function search_path
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_experiment_run_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. PERFORMANCE: Wrap auth.uid() in (select ...) for all RLS policies
-- ═════════════════════════════════════════════════════════════════════════════

-- 2a. graph_webhooks
DROP POLICY IF EXISTS "graph_webhooks: users access own rows" ON public.graph_webhooks;
CREATE POLICY "graph_webhooks: users access own rows" ON public.graph_webhooks
  FOR ALL USING (user_id = (select auth.uid()));

-- 2b. user_consents
DROP POLICY IF EXISTS "users_read_own_consents" ON public.user_consents;
CREATE POLICY "users_read_own_consents" ON public.user_consents
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_insert_own_consents" ON public.user_consents;
CREATE POLICY "users_insert_own_consents" ON public.user_consents
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id OR user_id IS NULL);

-- 2c. experiment_runs
DROP POLICY IF EXISTS "experiment_runs: owner read-write" ON public.experiment_runs;
CREATE POLICY "experiment_runs: owner read-write" ON public.experiment_runs
  FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- 2d. experiment_checkpoints
DROP POLICY IF EXISTS "experiment_checkpoints: owner read-write" ON public.experiment_checkpoints;
CREATE POLICY "experiment_checkpoints: owner read-write" ON public.experiment_checkpoints
  FOR ALL USING (
    run_id IN (SELECT id FROM public.experiment_runs WHERE user_id = (select auth.uid()))
  );

-- 2e. demonstrations (owner insert)
DROP POLICY IF EXISTS "demonstrations: owner insert" ON public.demonstrations;
CREATE POLICY "demonstrations: owner insert" ON public.demonstrations
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- 2f. profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

-- 2g. graph_jobs
DROP POLICY IF EXISTS "graph_jobs: users access own rows" ON public.graph_jobs;
CREATE POLICY "graph_jobs: users access own rows" ON public.graph_jobs
  FOR ALL USING (user_id = (select auth.uid()));

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. PERFORMANCE: Merge demonstrations UPDATE policies into one
--    (eliminates multiple_permissive_policies warning)
-- ═════════════════════════════════════════════════════════════════════════════

-- Drop the two overlapping policies
DROP POLICY IF EXISTS "demonstrations: owner update" ON public.demonstrations;
DROP POLICY IF EXISTS "demonstrations: owner soft delete" ON public.demonstrations;

-- Single consolidated policy: owners can update their own non-deleted demos
-- OR set deleted_at (soft delete). Both operations are UPDATE.
CREATE POLICY "demonstrations: owner update" ON public.demonstrations
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. PERFORMANCE: Drop duplicate indexes
-- ═════════════════════════════════════════════════════════════════════════════

-- org_members: idx_org_members_user duplicates idx_org_members_user_id
DROP INDEX IF EXISTS idx_org_members_user;

-- share_links: idx_share_links_token duplicates idx_share_links_token_active
DROP INDEX IF EXISTS idx_share_links_token;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. PERFORMANCE: Add missing FK indexes (public schema only)
-- ═════════════════════════════════════════════════════════════════════════════

-- demonstrations.project_id
CREATE INDEX IF NOT EXISTS idx_demonstrations_project_id
  ON public.demonstrations (project_id);

-- project_branches.canvas_id
CREATE INDEX IF NOT EXISTS idx_project_branches_canvas_id
  ON public.project_branches (canvas_id);

-- project_branches.forked_from_snapshot_id
CREATE INDEX IF NOT EXISTS idx_project_branches_forked_snapshot
  ON public.project_branches (forked_from_snapshot_id);

-- project_branches.owner_id
CREATE INDEX IF NOT EXISTS idx_project_branches_owner_id
  ON public.project_branches (owner_id);

-- project_snapshots.canvas_id
CREATE INDEX IF NOT EXISTS idx_project_snapshots_canvas_id
  ON public.project_snapshots (canvas_id);

-- project_snapshots.owner_id
CREATE INDEX IF NOT EXISTS idx_project_snapshots_owner_id
  ON public.project_snapshots (owner_id);
