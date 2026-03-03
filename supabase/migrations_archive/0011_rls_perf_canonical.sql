-- 0011_rls_perf_canonical.sql — RLS Performance + Policy Canonicalization
--
-- Fixes two Supabase Database Linter warnings:
--
--   1. auth_rls_initplan — Some policies use bare auth.uid() which is
--      re-evaluated per row.  Fix: wrap in scalar subselect (select auth.uid())
--      so PostgreSQL evaluates it once as an InitPlan.
--
--   2. multiple_permissive_policies — Accumulated migrations (0001→0009) and
--      manual dashboard edits left duplicate permissive policies for the same
--      (table, role, action).  Fix: drop ALL existing policies, then recreate
--      exactly ONE per (table, action).
--
-- Strategy:
--   A single DO $$ block that:
--     1. Detects the actual ownership column for each table at runtime via
--        information_schema.columns (prefers owner_id, falls back to user_id).
--        This handles environments where columns were renamed manually.
--     2. Drops EVERY existing policy on the 6 target tables (via pg_policies
--        catalog — catches every name, including unknowns).
--     3. Creates the canonical policy set using the detected column names.
--
-- Canonical naming: {table}_{action}_own
-- All predicates use: column = (select auth.uid())
--
-- Tables touched: profiles, projects, fs_items, project_assets,
--                 bug_reports, group_templates
-- NOT touched:    stripe_events (no user policies), storage.objects (separate)
--
-- RLS stays ENABLED throughout — never disabled.
-- Wrapped in a transaction: all-or-nothing.  If ANY step fails, everything
-- rolls back and the pre-existing policies remain intact.

BEGIN;

DO $$
DECLARE
  -- Detected ownership columns (filled in Phase 1)
  _projects_col   text;
  _fs_col         text;
  _assets_col     text;
  _bugs_col       text;
  _templates_col  text;
  -- Loop vars
  _tbl  text;
  _pol  record;
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Phase 1: Detect ownership columns via information_schema
  --
  -- For each table, look for owner_id first, then user_id.
  -- profiles is special: its PK `id` IS the auth user id (always).
  -- ═══════════════════════════════════════════════════════════════════════════

  -- projects
  SELECT column_name INTO _projects_col
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'projects'
     AND column_name IN ('owner_id', 'user_id')
   ORDER BY CASE column_name WHEN 'owner_id' THEN 0 ELSE 1 END
   LIMIT 1;
  IF _projects_col IS NULL THEN
    RAISE EXCEPTION 'projects: neither owner_id nor user_id column found';
  END IF;

  -- fs_items
  SELECT column_name INTO _fs_col
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'fs_items'
     AND column_name IN ('owner_id', 'user_id')
   ORDER BY CASE column_name WHEN 'owner_id' THEN 0 ELSE 1 END
   LIMIT 1;
  IF _fs_col IS NULL THEN
    RAISE EXCEPTION 'fs_items: neither owner_id nor user_id column found';
  END IF;

  -- project_assets
  SELECT column_name INTO _assets_col
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'project_assets'
     AND column_name IN ('owner_id', 'user_id')
   ORDER BY CASE column_name WHEN 'owner_id' THEN 0 ELSE 1 END
   LIMIT 1;
  IF _assets_col IS NULL THEN
    RAISE EXCEPTION 'project_assets: neither owner_id nor user_id column found';
  END IF;

  -- bug_reports
  SELECT column_name INTO _bugs_col
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'bug_reports'
     AND column_name IN ('owner_id', 'user_id')
   ORDER BY CASE column_name WHEN 'owner_id' THEN 0 ELSE 1 END
   LIMIT 1;
  IF _bugs_col IS NULL THEN
    RAISE EXCEPTION 'bug_reports: neither owner_id nor user_id column found';
  END IF;

  -- group_templates
  SELECT column_name INTO _templates_col
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'group_templates'
     AND column_name IN ('owner_id', 'user_id')
   ORDER BY CASE column_name WHEN 'owner_id' THEN 0 ELSE 1 END
   LIMIT 1;
  IF _templates_col IS NULL THEN
    RAISE EXCEPTION 'group_templates: neither owner_id nor user_id column found';
  END IF;

  RAISE NOTICE 'Detected ownership columns — projects: %  fs_items: %  project_assets: %  bug_reports: %  group_templates: %',
    _projects_col, _fs_col, _assets_col, _bugs_col, _templates_col;


  -- ═══════════════════════════════════════════════════════════════════════════
  -- Phase 2: Drop ALL existing policies on the 6 target tables.
  --          Uses pg_policies catalog so we catch every name, including
  --          unknowns from dashboard edits or partial migration runs.
  -- ═══════════════════════════════════════════════════════════════════════════

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
      RAISE NOTICE 'Dropped policy %.%', _tbl, _pol.policyname;
    END LOOP;
  END LOOP;


  -- ═══════════════════════════════════════════════════════════════════════════
  -- Phase 3: Create canonical policies — exactly ONE per (table, action).
  --
  -- profiles.id is always the ownership column (PK = auth.users.id).
  -- All other tables use the column detected in Phase 1.
  -- All predicates use (select auth.uid()) for InitPlan optimization.
  -- ═══════════════════════════════════════════════════════════════════════════

  -- ── 1. profiles ──────────────────────────────────────────────────────────
  --    Ownership: id
  --    Actions: SELECT, UPDATE only
  --    (INSERT handled by handle_new_user trigger; no user DELETE)

  EXECUTE 'CREATE POLICY profiles_select_own ON public.profiles'
    || ' FOR SELECT TO authenticated'
    || ' USING (id = (select auth.uid()))';

  EXECUTE 'CREATE POLICY profiles_update_own ON public.profiles'
    || ' FOR UPDATE TO authenticated'
    || ' USING (id = (select auth.uid()))'
    || ' WITH CHECK (id = (select auth.uid()))';


  -- ── 2. projects ──────────────────────────────────────────────────────────
  --    Actions: SELECT, INSERT, UPDATE, DELETE
  --    INSERT further gated by trg_enforce_project_limit (0006)

  EXECUTE format(
    'CREATE POLICY projects_select_own ON public.projects'
    || ' FOR SELECT TO authenticated'
    || ' USING (%I = (select auth.uid()))',
    _projects_col);

  EXECUTE format(
    'CREATE POLICY projects_insert_own ON public.projects'
    || ' FOR INSERT TO authenticated'
    || ' WITH CHECK (%I = (select auth.uid()))',
    _projects_col);

  EXECUTE format(
    'CREATE POLICY projects_update_own ON public.projects'
    || ' FOR UPDATE TO authenticated'
    || ' USING (%I = (select auth.uid()))'
    || ' WITH CHECK (%I = (select auth.uid()))',
    _projects_col, _projects_col);

  EXECUTE format(
    'CREATE POLICY projects_delete_own ON public.projects'
    || ' FOR DELETE TO authenticated'
    || ' USING (%I = (select auth.uid()))',
    _projects_col);


  -- ── 3. fs_items ──────────────────────────────────────────────────────────
  --    Actions: SELECT, INSERT, UPDATE, DELETE

  EXECUTE format(
    'CREATE POLICY fs_items_select_own ON public.fs_items'
    || ' FOR SELECT TO authenticated'
    || ' USING (%I = (select auth.uid()))',
    _fs_col);

  EXECUTE format(
    'CREATE POLICY fs_items_insert_own ON public.fs_items'
    || ' FOR INSERT TO authenticated'
    || ' WITH CHECK (%I = (select auth.uid()))',
    _fs_col);

  EXECUTE format(
    'CREATE POLICY fs_items_update_own ON public.fs_items'
    || ' FOR UPDATE TO authenticated'
    || ' USING (%I = (select auth.uid()))'
    || ' WITH CHECK (%I = (select auth.uid()))',
    _fs_col, _fs_col);

  EXECUTE format(
    'CREATE POLICY fs_items_delete_own ON public.fs_items'
    || ' FOR DELETE TO authenticated'
    || ' USING (%I = (select auth.uid()))',
    _fs_col);


  -- ── 4. project_assets ────────────────────────────────────────────────────
  --    Actions: SELECT, INSERT, UPDATE, DELETE

  EXECUTE format(
    'CREATE POLICY assets_select_own ON public.project_assets'
    || ' FOR SELECT TO authenticated'
    || ' USING (%I = (select auth.uid()))',
    _assets_col);

  EXECUTE format(
    'CREATE POLICY assets_insert_own ON public.project_assets'
    || ' FOR INSERT TO authenticated'
    || ' WITH CHECK (%I = (select auth.uid()))',
    _assets_col);

  EXECUTE format(
    'CREATE POLICY assets_update_own ON public.project_assets'
    || ' FOR UPDATE TO authenticated'
    || ' USING (%I = (select auth.uid()))'
    || ' WITH CHECK (%I = (select auth.uid()))',
    _assets_col, _assets_col);

  EXECUTE format(
    'CREATE POLICY assets_delete_own ON public.project_assets'
    || ' FOR DELETE TO authenticated'
    || ' USING (%I = (select auth.uid()))',
    _assets_col);


  -- ── 5. bug_reports ───────────────────────────────────────────────────────
  --    Actions: SELECT, INSERT only (reports are immutable — no UPDATE/DELETE)

  EXECUTE format(
    'CREATE POLICY bug_reports_select_own ON public.bug_reports'
    || ' FOR SELECT TO authenticated'
    || ' USING (%I = (select auth.uid()))',
    _bugs_col);

  EXECUTE format(
    'CREATE POLICY bug_reports_insert_own ON public.bug_reports'
    || ' FOR INSERT TO authenticated'
    || ' WITH CHECK (%I = (select auth.uid()))',
    _bugs_col);


  -- ── 6. group_templates ───────────────────────────────────────────────────
  --    Actions: SELECT, INSERT, UPDATE, DELETE

  EXECUTE format(
    'CREATE POLICY templates_select_own ON public.group_templates'
    || ' FOR SELECT TO authenticated'
    || ' USING (%I = (select auth.uid()))',
    _templates_col);

  EXECUTE format(
    'CREATE POLICY templates_insert_own ON public.group_templates'
    || ' FOR INSERT TO authenticated'
    || ' WITH CHECK (%I = (select auth.uid()))',
    _templates_col);

  EXECUTE format(
    'CREATE POLICY templates_update_own ON public.group_templates'
    || ' FOR UPDATE TO authenticated'
    || ' USING (%I = (select auth.uid()))'
    || ' WITH CHECK (%I = (select auth.uid()))',
    _templates_col, _templates_col);

  EXECUTE format(
    'CREATE POLICY templates_delete_own ON public.group_templates'
    || ' FOR DELETE TO authenticated'
    || ' USING (%I = (select auth.uid()))',
    _templates_col);


  RAISE NOTICE 'Canonical RLS policies created (22 total across 6 tables).';

END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- Refresh PostgREST schema cache
-- ═══════════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';

COMMIT;
