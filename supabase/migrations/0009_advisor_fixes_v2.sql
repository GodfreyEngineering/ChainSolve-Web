-- 0009_advisor_fixes_v2.sql — Supabase Advisor fixpack v2
-- W5.3.1b: Supersedes 0008 which failed on owner_id vs user_id mismatch.
--
-- This migration auto-detects whether fs_items and project_assets use
-- owner_id or user_id, then creates policies and indexes accordingly.
--
-- Fixes:
--   1. function_search_path_mutable — set_updated_at, set_updated_at_metadata,
--      trigger_set_updated_at, handle_new_user, enforce_project_limit,
--      user_has_active_plan, user_can_write_projects
--   2. auth_rls_initplan — (select auth.uid()) pattern on all RLS policies
--   3. multiple_permissive_policies — dedup projects policies
--   4. unindexed_foreign_keys — FK covering indexes for actual column names
--   5. NOTIFY pgrst, 'reload schema'
--
-- Idempotent: CREATE OR REPLACE / DROP IF EXISTS / IF NOT EXISTS throughout.
-- Safe to re-run.

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════════
-- A1. Fix function_search_path_mutable
--
-- Replace ALL public functions with SET search_path = public in declaration.
-- ═════════════════════════════════════════════════════════════════════════════

-- set_updated_at — the name Supabase advisor flags (may or may not exist yet)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- set_updated_at_metadata — the second name Supabase advisor flags
CREATE OR REPLACE FUNCTION public.set_updated_at_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- trigger_set_updated_at — our original function from 0001
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

-- handle_new_user — from 0001, needs SECURITY DEFINER + search_path
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

-- enforce_project_limit — from 0006
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

-- user_has_active_plan — from 0006
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

-- user_can_write_projects — from 0006
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
-- A2. RLS — profiles (always uses `id`)
-- ═════════════════════════════════════════════════════════════════════════════

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


-- ═════════════════════════════════════════════════════════════════════════════
-- A3. RLS — projects (always uses `owner_id`, dedup all known policy names)
-- ═════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view their own projects"   ON public.projects;
DROP POLICY IF EXISTS "Users can create projects"           ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
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


-- ═════════════════════════════════════════════════════════════════════════════
-- A4. RLS — fs_items (auto-detect owner_id vs user_id)
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _col text;
BEGIN
  -- Detect column: prefer owner_id, fall back to user_id
  SELECT column_name INTO _col
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'fs_items'
     AND column_name  IN ('owner_id', 'user_id')
   ORDER BY CASE column_name WHEN 'owner_id' THEN 0 ELSE 1 END
   LIMIT 1;

  IF _col IS NULL THEN
    RAISE EXCEPTION 'fs_items has neither owner_id nor user_id column';
  END IF;

  RAISE NOTICE 'fs_items owner column detected: %', _col;

  -- Drop ALL known policies (both naming conventions)
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own fs_items"   ON public.fs_items';
  EXECUTE 'DROP POLICY IF EXISTS "Users can create fs_items"           ON public.fs_items';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their own fs_items" ON public.fs_items';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own fs_items" ON public.fs_items';
  EXECUTE 'DROP POLICY IF EXISTS "fs_items_select_own" ON public.fs_items';
  EXECUTE 'DROP POLICY IF EXISTS "fs_items_insert_own" ON public.fs_items';
  EXECUTE 'DROP POLICY IF EXISTS "fs_items_update_own" ON public.fs_items';
  EXECUTE 'DROP POLICY IF EXISTS "fs_items_delete_own" ON public.fs_items';

  -- Create new policies using detected column
  EXECUTE format(
    'CREATE POLICY "fs_items_select_own" ON public.fs_items FOR SELECT TO authenticated USING (%I = (select auth.uid()))',
    _col
  );
  EXECUTE format(
    'CREATE POLICY "fs_items_insert_own" ON public.fs_items FOR INSERT TO authenticated WITH CHECK (%I = (select auth.uid()))',
    _col
  );
  EXECUTE format(
    'CREATE POLICY "fs_items_update_own" ON public.fs_items FOR UPDATE TO authenticated USING (%I = (select auth.uid())) WITH CHECK (%I = (select auth.uid()))',
    _col, _col
  );
  EXECUTE format(
    'CREATE POLICY "fs_items_delete_own" ON public.fs_items FOR DELETE TO authenticated USING (%I = (select auth.uid()))',
    _col
  );

  -- Create FK index on the detected column
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_fs_items_owner ON public.fs_items (%I)',
    _col
  );
END;
$$;

-- These indexes are column-name independent (always exist)
CREATE INDEX IF NOT EXISTS idx_fs_items_parent_id  ON public.fs_items (parent_id);
CREATE INDEX IF NOT EXISTS idx_fs_items_project_id ON public.fs_items (project_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- A4b. RLS — project_assets (auto-detect owner_id vs user_id)
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _col text;
BEGIN
  -- Detect column: prefer owner_id, fall back to user_id
  SELECT column_name INTO _col
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'project_assets'
     AND column_name  IN ('owner_id', 'user_id')
   ORDER BY CASE column_name WHEN 'owner_id' THEN 0 ELSE 1 END
   LIMIT 1;

  IF _col IS NULL THEN
    RAISE EXCEPTION 'project_assets has neither owner_id nor user_id column';
  END IF;

  RAISE NOTICE 'project_assets owner column detected: %', _col;

  -- Drop ALL known policies (both naming conventions)
  EXECUTE 'DROP POLICY IF EXISTS "Users can view their own project_assets"   ON public.project_assets';
  EXECUTE 'DROP POLICY IF EXISTS "Users can create project_assets"           ON public.project_assets';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their own project_assets" ON public.project_assets';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own project_assets" ON public.project_assets';
  EXECUTE 'DROP POLICY IF EXISTS "assets_select_own" ON public.project_assets';
  EXECUTE 'DROP POLICY IF EXISTS "assets_insert_own" ON public.project_assets';
  EXECUTE 'DROP POLICY IF EXISTS "assets_update_own" ON public.project_assets';
  EXECUTE 'DROP POLICY IF EXISTS "assets_delete_own" ON public.project_assets';

  -- Create new policies using detected column
  EXECUTE format(
    'CREATE POLICY "assets_select_own" ON public.project_assets FOR SELECT TO authenticated USING (%I = (select auth.uid()))',
    _col
  );
  EXECUTE format(
    'CREATE POLICY "assets_insert_own" ON public.project_assets FOR INSERT TO authenticated WITH CHECK (%I = (select auth.uid()))',
    _col
  );
  EXECUTE format(
    'CREATE POLICY "assets_update_own" ON public.project_assets FOR UPDATE TO authenticated USING (%I = (select auth.uid())) WITH CHECK (%I = (select auth.uid()))',
    _col, _col
  );
  EXECUTE format(
    'CREATE POLICY "assets_delete_own" ON public.project_assets FOR DELETE TO authenticated USING (%I = (select auth.uid()))',
    _col
  );

  -- Create FK index on the detected column
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_project_assets_owner ON public.project_assets (%I)',
    _col
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON public.project_assets (project_id);


-- ═════════════════════════════════════════════════════════════════════════════
-- A5. RLS — bug_reports (always uses `user_id`, from 0007)
-- ═════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can insert own bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can read own bug reports"   ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_insert_own" ON public.bug_reports;
DROP POLICY IF EXISTS "bug_reports_select_own" ON public.bug_reports;

CREATE POLICY "bug_reports_insert_own"
  ON public.bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "bug_reports_select_own"
  ON public.bug_reports FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));


-- ═════════════════════════════════════════════════════════════════════════════
-- A7. Refresh PostgREST schema cache
-- ═════════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';

COMMIT;
