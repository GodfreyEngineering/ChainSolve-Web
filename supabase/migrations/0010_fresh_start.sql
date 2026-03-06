-- ============================================================
-- 0010_fresh_start.sql
--
-- Full data wipe + schema tightening for v1 beta launch.
--
-- What this does:
--   1. Deletes ALL auth users (cascades to profiles + all owned data)
--   2. Truncates every public table (belt-and-suspenders after cascade)
--   3. Empties all storage buckets (projects, uploads, marketplace)
--   4. Adds missing CHECK constraints on name columns
--   5. Adds is_moderator self-promotion guard to profiles RLS
--   6. Adds canvas-count-per-project enforcement trigger
--   7. Consolidates duplicate updated_at functions into one
--   8. Re-applies developer auto-flag trigger (from 0009)
--
-- Safe to run on a fresh DB or after previous migrations.
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. DELETE ALL AUTH USERS (cascades to profiles via FK)
-- ═══════════════════════════════════════════════════════════════════════════════

DELETE FROM auth.users;

-- Belt-and-suspenders: if any FK cascades were deferred, truncate everything.
-- CASCADE handles inter-table dependencies.

TRUNCATE TABLE public.profiles CASCADE;
TRUNCATE TABLE public.projects CASCADE;
TRUNCATE TABLE public.canvases CASCADE;
TRUNCATE TABLE public.fs_items CASCADE;
TRUNCATE TABLE public.project_assets CASCADE;
TRUNCATE TABLE public.organizations CASCADE;
TRUNCATE TABLE public.org_members CASCADE;
TRUNCATE TABLE public.marketplace_items CASCADE;
TRUNCATE TABLE public.marketplace_purchases CASCADE;
TRUNCATE TABLE public.marketplace_install_events CASCADE;
TRUNCATE TABLE public.marketplace_likes CASCADE;
TRUNCATE TABLE public.marketplace_comments CASCADE;
TRUNCATE TABLE public.bug_reports CASCADE;
TRUNCATE TABLE public.suggestions CASCADE;
TRUNCATE TABLE public.group_templates CASCADE;
TRUNCATE TABLE public.stripe_events CASCADE;
TRUNCATE TABLE public.audit_log CASCADE;
TRUNCATE TABLE public.observability_events CASCADE;
TRUNCATE TABLE public.csp_reports CASCADE;
TRUNCATE TABLE public.ai_org_policies CASCADE;
TRUNCATE TABLE public.ai_usage_monthly CASCADE;
TRUNCATE TABLE public.ai_request_log CASCADE;
TRUNCATE TABLE public.user_sessions CASCADE;
TRUNCATE TABLE public.user_preferences CASCADE;
TRUNCATE TABLE public.user_terms_log CASCADE;
TRUNCATE TABLE public.user_reports CASCADE;
TRUNCATE TABLE public.student_verifications CASCADE;
TRUNCATE TABLE public.avatar_reports CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. EMPTY ALL STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════════════════════════

DELETE FROM storage.objects WHERE bucket_id IN ('projects', 'uploads', 'marketplace');


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. SCHEMA TIGHTENING — CHECK constraints on name/text columns
-- ═══════════════════════════════════════════════════════════════════════════════

-- projects.name: 1-100 chars, no control characters
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_name_length;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_name_length
    CHECK (char_length(name) >= 1 AND char_length(name) <= 100);

-- canvases.name: 1-100 chars
ALTER TABLE public.canvases
  DROP CONSTRAINT IF EXISTS canvases_name_length;
ALTER TABLE public.canvases
  ADD CONSTRAINT canvases_name_length
    CHECK (char_length(name) >= 1 AND char_length(name) <= 100);

-- profiles.full_name: max 100 chars (nullable, but if set, must be reasonable)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_full_name_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_length
    CHECK (full_name IS NULL OR char_length(full_name) <= 100);

-- profiles.avatar_url: max 2048 chars (URLs)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_avatar_url_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_url_length
    CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048);

-- projects.description: max 500 chars
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_description_length;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_description_length
    CHECK (description IS NULL OR char_length(description) <= 500);

-- group_templates.name: 1-100 chars
ALTER TABLE public.group_templates
  DROP CONSTRAINT IF EXISTS group_templates_name_length;
ALTER TABLE public.group_templates
  ADD CONSTRAINT group_templates_name_length
    CHECK (char_length(name) >= 1 AND char_length(name) <= 100);

-- bug_reports.title: 1-200 chars
ALTER TABLE public.bug_reports
  DROP CONSTRAINT IF EXISTS bug_reports_title_length;
ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_title_length
    CHECK (char_length(title) >= 1 AND char_length(title) <= 200);

-- suggestions.title: 1-200 chars
ALTER TABLE public.suggestions
  DROP CONSTRAINT IF EXISTS suggestions_title_length;
ALTER TABLE public.suggestions
  ADD CONSTRAINT suggestions_title_length
    CHECK (char_length(title) >= 1 AND char_length(title) <= 200);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. TIGHTEN PROFILES UPDATE RLS — prevent is_moderator self-promotion
-- ═══════════════════════════════════════════════════════════════════════════════

-- The baseline policy (0005) checks is_developer, is_admin, is_student but
-- NOT is_moderator. A user could SET is_moderator=true on their own profile.
-- Fix: add is_moderator to the "no self-promote" guard.

DROP POLICY IF EXISTS profiles_update ON public.profiles;

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_moderator = true
    )
  )
  WITH CHECK (
    -- Own-update path: prevent self-promotion of ALL role flags
    (
      id = (select auth.uid())
      AND is_developer IS NOT DISTINCT FROM (
        SELECT p.is_developer FROM public.profiles p WHERE p.id = (select auth.uid())
      )
      AND is_admin IS NOT DISTINCT FROM (
        SELECT p.is_admin FROM public.profiles p WHERE p.id = (select auth.uid())
      )
      AND is_moderator IS NOT DISTINCT FROM (
        SELECT p.is_moderator FROM public.profiles p WHERE p.id = (select auth.uid())
      )
      AND is_student IS NOT DISTINCT FROM (
        SELECT p.is_student FROM public.profiles p WHERE p.id = (select auth.uid())
      )
      AND verified_author IS NOT DISTINCT FROM (
        SELECT p.verified_author FROM public.profiles p WHERE p.id = (select auth.uid())
      )
    )
    OR
    -- Moderator path: can update any profile
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_moderator = true
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. CANVAS COUNT ENFORCEMENT (per project)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Free: max 2 canvases per project. Pro+: unlimited.
-- Mirrors the TS-side canCreateCanvas() entitlement check.

CREATE OR REPLACE FUNCTION public.enforce_canvas_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan text;
  _is_dev boolean;
  _is_admin boolean;
  _is_student boolean;
  _count integer;
  _max integer;
BEGIN
  SELECT (p.plan)::text, p.is_developer, p.is_admin, p.is_student
    INTO _plan, _is_dev, _is_admin, _is_student
    FROM public.profiles p WHERE p.id = NEW.owner_id;

  IF _plan IS NULL THEN _plan := 'free'; END IF;

  -- Developer/admin: unlimited
  IF COALESCE(_is_dev, false) OR COALESCE(_is_admin, false) THEN
    RETURN NEW;
  END IF;

  -- Student with free plan: pro-equivalent (unlimited)
  IF COALESCE(_is_student, false) AND _plan = 'free' THEN
    RETURN NEW;
  END IF;

  CASE _plan
    WHEN 'trialing'   THEN _max := 2147483647;
    WHEN 'pro'        THEN _max := 2147483647;
    WHEN 'enterprise' THEN _max := 2147483647;
    WHEN 'canceled'   THEN _max := 0;
    ELSE                   _max := 2;  -- free, past_due
  END CASE;

  SELECT count(*) INTO _count
    FROM public.canvases
   WHERE project_id = NEW.project_id;

  IF _count >= _max THEN
    RAISE EXCEPTION 'Canvas limit reached for plan "%". Current: %, max: %.', _plan, _count, _max
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_canvas_limit ON public.canvases;
CREATE TRIGGER trg_enforce_canvas_limit BEFORE INSERT ON public.canvases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_canvas_limit();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. CONSOLIDATE DUPLICATE updated_at FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- The baseline defined 4 identical functions for updated_at:
--   trigger_set_updated_at, set_updated_at, set_updated_at_metadata,
--   handle_canvases_updated_at, handle_marketplace_items_updated_at
-- Consolidate triggers to use trigger_set_updated_at only.

-- Re-point canvases trigger
DROP TRIGGER IF EXISTS trg_canvases_updated_at ON public.canvases;
CREATE TRIGGER trg_canvases_updated_at BEFORE UPDATE ON public.canvases
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Re-point marketplace_items trigger
DROP TRIGGER IF EXISTS trg_mkt_items_updated_at ON public.marketplace_items;
CREATE TRIGGER trg_mkt_items_updated_at BEFORE UPDATE ON public.marketplace_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Re-point group_templates trigger
DROP TRIGGER IF EXISTS set_updated_at_group_templates ON public.group_templates;
CREATE TRIGGER set_updated_at_group_templates BEFORE UPDATE ON public.group_templates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Re-point user_preferences trigger (if exists)
DROP TRIGGER IF EXISTS set_updated_at ON public.user_preferences;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Drop the now-unused duplicate functions
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at_metadata() CASCADE;
DROP FUNCTION IF EXISTS public.handle_canvases_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.handle_marketplace_items_updated_at() CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. DEVELOPER AUTO-FLAG TRIGGER (re-apply from 0009)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_auto_developer_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'ben.godfrey@chainsolve.co.uk' THEN
    NEW.is_developer := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_developer_flag ON public.profiles;
CREATE TRIGGER trg_auto_developer_flag
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_developer_flag();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. ADD MISSING updated_at TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- project_assets: has updated_at column but no trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.project_assets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_assets
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- marketplace_comments: has updated_at column but no trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.marketplace_comments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.marketplace_comments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- organizations: has updated_at column but no trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.organizations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. REFRESH SCHEMA CACHE
-- ═══════════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';

COMMIT;
