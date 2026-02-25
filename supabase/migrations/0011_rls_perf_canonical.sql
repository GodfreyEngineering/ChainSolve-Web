-- 0011_rls_perf_canonical.sql — RLS Performance + Policy Canonicalization
--
-- Fixes two Supabase Database Linter warnings:
--
--   1. auth_rls_initplan — Some policies use bare auth.uid() which is
--      re-evaluated per row.  Fix: wrap in scalar subselect (select auth.uid())
--      so PostgreSQL evaluates it once as an InitPlan.
--
--   2. multiple_permissive_policies — Accumulated migrations (0001→0009) left
--      duplicate permissive policies for the same (table, role, action).
--      Fix: drop ALL existing policies, recreate exactly ONE per action.
--
-- Strategy:
--   For each public table with RLS, dynamically drop EVERY existing policy
--   (regardless of name), then CREATE the canonical set.  This guarantees no
--   duplicates survive, even from manual dashboard edits or partial migrations.
--
-- Canonical naming: {table}_{action}_own
-- All predicates use: column = (select auth.uid())
--
-- Tables touched: profiles, projects, fs_items, project_assets,
--                 bug_reports, group_templates
-- NOT touched:    stripe_events (no user policies), storage.objects (separate)
--
-- RLS stays ENABLED throughout — never disabled.
-- Wrapped in a transaction: all-or-nothing.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Step 0.  Drop ALL existing policies on the 6 target tables.
--          Uses pg_policies catalog so we catch every name, including unknowns.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _tbl  text;
  _pol  record;
BEGIN
  FOR _tbl IN
    SELECT unnest(ARRAY[
      'profiles', 'projects', 'fs_items',
      'project_assets', 'bug_reports', 'group_templates'
    ])
  LOOP
    FOR _pol IN
      SELECT policyname
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = _tbl
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', _pol.policyname, _tbl);
      RAISE NOTICE 'Dropped policy %.% ', _tbl, _pol.policyname;
    END LOOP;
  END LOOP;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1.  profiles
--     Ownership column: id  (profiles.id = auth.users.id)
--     Actions: SELECT, UPDATE only
--     (INSERT handled by handle_new_user trigger; no user DELETE)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  TO authenticated
  USING  (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2.  projects
--     Ownership column: owner_id  (renamed from user_id in 0003)
--     Actions: SELECT, INSERT, UPDATE, DELETE
--     Note: INSERT is further gated by trg_enforce_project_limit (0006)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY projects_select_own
  ON public.projects FOR SELECT
  TO authenticated
  USING (owner_id = (select auth.uid()));

CREATE POLICY projects_insert_own
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY projects_update_own
  ON public.projects FOR UPDATE
  TO authenticated
  USING  (owner_id = (select auth.uid()))
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY projects_delete_own
  ON public.projects FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3.  fs_items
--     Ownership column: user_id
--     Actions: SELECT, INSERT, UPDATE, DELETE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY fs_items_select_own
  ON public.fs_items FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY fs_items_insert_own
  ON public.fs_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY fs_items_update_own
  ON public.fs_items FOR UPDATE
  TO authenticated
  USING  (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY fs_items_delete_own
  ON public.fs_items FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4.  project_assets
--     Ownership column: user_id
--     Actions: SELECT, INSERT, UPDATE, DELETE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY assets_select_own
  ON public.project_assets FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY assets_insert_own
  ON public.project_assets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY assets_update_own
  ON public.project_assets FOR UPDATE
  TO authenticated
  USING  (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY assets_delete_own
  ON public.project_assets FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5.  bug_reports
--     Ownership column: user_id
--     Actions: SELECT, INSERT only  (reports are immutable, no UPDATE/DELETE)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY bug_reports_select_own
  ON public.bug_reports FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY bug_reports_insert_own
  ON public.bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6.  group_templates
--     Ownership column: owner_id
--     Actions: SELECT, INSERT, UPDATE, DELETE
--     Note: 0010 used (SELECT auth.uid()) — normalizing to lowercase (select ...)
--           and adding explicit WITH CHECK on UPDATE for clarity.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY templates_select_own
  ON public.group_templates FOR SELECT
  TO authenticated
  USING (owner_id = (select auth.uid()));

CREATE POLICY templates_insert_own
  ON public.group_templates FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY templates_update_own
  ON public.group_templates FOR UPDATE
  TO authenticated
  USING  (owner_id = (select auth.uid()))
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY templates_delete_own
  ON public.group_templates FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7.  Refresh PostgREST schema cache
-- ═══════════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';

COMMIT;
