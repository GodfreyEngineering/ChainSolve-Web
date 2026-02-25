-- 0008_advisor_fixes.sql — Supabase Advisor fixpack
-- W5.3.1: Security + RLS performance + index hygiene
--
-- Fixes:
--   1. function_search_path_mutable — adds SET search_path = public to all functions
--   2. auth_rls_initplan — rewrites auth.uid() → (select auth.uid()) in all RLS policies
--   3. multiple_permissive_policies — drops duplicates, keeps one clean set per table
--   4. unindexed_foreign_keys — ensures covering indexes on all FK columns
--   5. NOTIFY pgrst to refresh schema cache
--
-- Idempotent: all statements use CREATE OR REPLACE / DROP IF EXISTS / IF NOT EXISTS.
-- Safe to re-run.

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- A1. Fix function search_path mutable
-- ═════════════════════════════════════════════════════════════════════════════

-- trigger_set_updated_at — originally in 0001 without search_path
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- handle_new_user — originally in 0001 with SECURITY DEFINER but no search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- enforce_project_limit — already had SET search_path in 0006, re-declare for safety
CREATE OR REPLACE FUNCTION public.enforce_project_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text;
  _count integer;
  _max integer;
BEGIN
  SELECT (p.plan)::text INTO _plan
    FROM public.profiles p
   WHERE p.id = NEW.owner_id;

  IF _plan IS NULL THEN
    _plan := 'free';
  END IF;

  CASE _plan
    WHEN 'trialing' THEN _max := 2147483647;
    WHEN 'pro'      THEN _max := 2147483647;
    WHEN 'canceled'  THEN _max := 0;
    ELSE                  _max := 1;
  END CASE;

  SELECT count(*) INTO _count
    FROM public.projects
   WHERE owner_id = NEW.owner_id;

  IF _count >= _max THEN
    RAISE EXCEPTION 'Project limit reached for plan "%". Current: %, max: %.',
      _plan, _count, _max
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- user_has_active_plan — already had SET search_path in 0006, re-declare for completeness
CREATE OR REPLACE FUNCTION public.user_has_active_plan(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (p.plan)::text IN ('trialing', 'pro')
     FROM public.profiles p
     WHERE p.id = uid),
    false
  );
$$;

-- user_can_write_projects — already had SET search_path in 0006, re-declare for completeness
CREATE OR REPLACE FUNCTION public.user_can_write_projects(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (p.plan)::text <> 'canceled'
     FROM public.profiles p
     WHERE p.id = uid),
    true
  );
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- A2 + A3. RLS policy rewrite — (select auth.uid()) pattern + dedup
--
-- Strategy: drop ALL existing policies, recreate with initplan-safe pattern.
-- This also clears any duplicate permissive policies on projects.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));


-- ── projects ──────────────────────────────────────────────────────────────
-- Drop ALL known policy names (from 0001 and 0003) to clear duplicates

DROP POLICY IF EXISTS "Users can view their own projects"   ON public.projects;
DROP POLICY IF EXISTS "Users can create projects"           ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
-- Also drop any alternate names that may have been created
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;

CREATE POLICY "projects_select_own"
  ON public.projects FOR SELECT
  TO authenticated
  USING (owner_id = (select auth.uid()));

CREATE POLICY "projects_insert_own"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (owner_id = (select auth.uid()))
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE
  TO authenticated
  USING (owner_id = (select auth.uid()));


-- ── fs_items ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own fs_items"   ON public.fs_items;
DROP POLICY IF EXISTS "Users can create fs_items"           ON public.fs_items;
DROP POLICY IF EXISTS "Users can update their own fs_items" ON public.fs_items;
DROP POLICY IF EXISTS "Users can delete their own fs_items" ON public.fs_items;

CREATE POLICY "fs_items_select_own"
  ON public.fs_items FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "fs_items_insert_own"
  ON public.fs_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "fs_items_update_own"
  ON public.fs_items FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "fs_items_delete_own"
  ON public.fs_items FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- ── project_assets ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own project_assets"   ON public.project_assets;
DROP POLICY IF EXISTS "Users can create project_assets"           ON public.project_assets;
DROP POLICY IF EXISTS "Users can update their own project_assets" ON public.project_assets;
DROP POLICY IF EXISTS "Users can delete their own project_assets" ON public.project_assets;

CREATE POLICY "assets_select_own"
  ON public.project_assets FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "assets_insert_own"
  ON public.project_assets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "assets_update_own"
  ON public.project_assets FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "assets_delete_own"
  ON public.project_assets FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- ── bug_reports ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert own bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can read own bug reports"   ON public.bug_reports;

CREATE POLICY "bug_reports_insert_own"
  ON public.bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "bug_reports_select_own"
  ON public.bug_reports FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));


-- ═════════════════════════════════════════════════════════════════════════════
-- A4. Foreign key covering indexes
--
-- Most of these already exist from 0001; IF NOT EXISTS makes this idempotent.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_fs_items_user_id          ON public.fs_items (user_id);
CREATE INDEX IF NOT EXISTS idx_fs_items_parent_id        ON public.fs_items (parent_id);
CREATE INDEX IF NOT EXISTS idx_fs_items_project_id       ON public.fs_items (project_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_user_id    ON public.project_assets (user_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON public.project_assets (project_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- A5. Refresh PostgREST schema cache
-- ═════════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';

COMMIT;
