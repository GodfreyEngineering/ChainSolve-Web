-- 0007_fix_entitlement_helpers.sql
--
-- Fix entitlement helper functions to align with the TS-side plan hierarchy:
--
--   developer (is_developer) -> all features
--   admin (is_admin) -> all features
--   enterprise -> all features
--   pro / trialing -> all features
--   student (is_student + plan='free') -> pro-equivalent features
--   free -> limited (no uploads, 1 project)
--   past_due -> limited (same as free)
--   canceled -> no write access
--
-- Bugs fixed:
--   1. user_has_active_plan: did not check is_developer, is_admin, is_student,
--      or 'enterprise' plan. Developers/admins/enterprise/students were denied
--      uploads to the 'uploads' storage bucket.
--   2. enforce_project_limit: did not handle 'enterprise' (treated as free,
--      max 1 project). Developers/admins/students also got max=1.

-- 1. user_has_active_plan — true for any user with paid-equivalent access
CREATE OR REPLACE FUNCTION public.user_has_active_plan(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT
       p.is_developer = true
       OR p.is_admin = true
       OR (p.is_student = true AND (p.plan)::text = 'free')
       OR (p.plan)::text IN ('trialing', 'pro', 'enterprise')
     FROM public.profiles p WHERE p.id = uid),
    false
  );
$$;

-- 2. user_can_write_projects — unchanged (already correct: false only for canceled)
-- No change needed.

-- 3. enforce_project_limit — respect developer/admin/student/enterprise
CREATE OR REPLACE FUNCTION public.enforce_project_limit()
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
    ELSE                   _max := 1;  -- free, past_due
  END CASE;

  SELECT count(*) INTO _count FROM public.projects WHERE owner_id = NEW.owner_id;
  IF _count >= _max THEN
    RAISE EXCEPTION 'Project limit reached for plan "%". Current: %, max: %.', _plan, _count, _max
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
