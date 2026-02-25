-- 0006_entitlements_enforcement.sql
--
-- Backend enforcement of plan-based limits:
--   1. Helper function: user_has_active_plan(uid)
--   2. Helper function: user_can_write_projects(uid)
--   3. BEFORE INSERT trigger on projects — enforces maxProjects per plan
--   4. Tighten storage policies: uploads INSERT/UPDATE gated by active plan;
--      projects INSERT/UPDATE blocked for canceled users
--   5. Index on projects(owner_id) for fast project-count lookups
--
-- Idempotent: all statements use CREATE OR REPLACE / IF NOT EXISTS / DROP IF EXISTS.
-- Safe to re-run.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. user_has_active_plan — true for trialing or pro
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_has_active_plan(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.plan IN ('trialing', 'pro')
     FROM public.profiles p
     WHERE p.id = uid),
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. user_can_write_projects — false only for canceled users
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_can_write_projects(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.plan <> 'canceled'
     FROM public.profiles p
     WHERE p.id = uid),
    true  -- if no profile row yet, allow (new user)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger: enforce project limit on INSERT
--    free / past_due → max 1 project
--    trialing / pro  → unlimited
--    canceled        → 0 (cannot create)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_project_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.plan_status;
  _count integer;
  _max integer;
BEGIN
  -- Read the user's plan
  SELECT p.plan INTO _plan
    FROM public.profiles p
   WHERE p.id = NEW.owner_id;

  -- Default to 'free' if no profile exists yet
  IF _plan IS NULL THEN
    _plan := 'free';
  END IF;

  -- Determine limit
  CASE _plan
    WHEN 'trialing' THEN _max := 2147483647; -- effectively unlimited
    WHEN 'pro'      THEN _max := 2147483647;
    WHEN 'canceled'  THEN _max := 0;
    ELSE                  _max := 1;          -- free, past_due
  END CASE;

  -- Count existing projects
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

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS trg_enforce_project_limit ON public.projects;
CREATE TRIGGER trg_enforce_project_limit
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_project_limit();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tighten storage policies
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. uploads bucket: only trialing/pro can INSERT or UPDATE
DROP POLICY IF EXISTS "uploads bucket: users insert own files" ON storage.objects;
CREATE POLICY "uploads bucket: users insert own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.user_has_active_plan(auth.uid())
  );

DROP POLICY IF EXISTS "uploads bucket: users update own files" ON storage.objects;
CREATE POLICY "uploads bucket: users update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.user_has_active_plan(auth.uid())
  );

-- 4b. projects bucket: block writes for canceled users
DROP POLICY IF EXISTS "projects bucket: users insert own files" ON storage.objects;
CREATE POLICY "projects bucket: users insert own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'projects'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.user_can_write_projects(auth.uid())
  );

DROP POLICY IF EXISTS "projects bucket: users update own files" ON storage.objects;
CREATE POLICY "projects bucket: users update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'projects'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.user_can_write_projects(auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Index for fast project count lookups
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_projects_owner_id
  ON public.projects (owner_id);

CREATE INDEX IF NOT EXISTS idx_projects_owner_updated
  ON public.projects (owner_id, updated_at DESC);

COMMIT;
