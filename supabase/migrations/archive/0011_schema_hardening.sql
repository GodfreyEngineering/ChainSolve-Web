-- ============================================================
-- 0011_schema_hardening.sql
--
-- Schema hardening for v1 beta:
--   1. UNIQUE constraint on (owner_id, name) for projects
--   2. Filename-safe CHECK constraint on project names
--   3. Folder column safety constraint
--   4. Performance indexes for common queries
--   5. Improved enforce_project_limit error message
--   6. Schema cache refresh
--
-- Safe to run on a fresh DB or after previous migrations.
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. UNIQUE constraint: no duplicate project names per user
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_owner_name_unique;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_owner_name_unique UNIQUE (owner_id, name);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Filename-safe CHECK on project names
-- ═══════════════════════════════════════════════════════════════════════════════
-- Rejects: control chars (0x00-0x1F, 0x7F), / \ : * ? " < > |
-- These characters cause problems on Windows/macOS/Linux filesystems.

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_name_safe;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_name_safe
    CHECK (
      name ~ '^[^\x00-\x1F\x7F/\\:*?"<>|]+$'
      AND char_length(trim(name)) >= 1
    );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Folder column safety constraint
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_folder_safe;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_folder_safe
    CHECK (folder IS NULL OR (
      char_length(folder) >= 1
      AND char_length(folder) <= 100
      AND folder ~ '^[^\x00-\x1F\x7F/\\:*?"<>|]+$'
    ));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Performance indexes
-- ═══════════════════════════════════════════════════════════════════════════════

-- List projects sorted by updated_at (the default query pattern)
CREATE INDEX IF NOT EXISTS idx_projects_owner_updated
  ON public.projects (owner_id, updated_at DESC);

-- List canvases in position order
CREATE INDEX IF NOT EXISTS idx_canvases_project_position
  ON public.canvases (project_id, position);

-- Project assets lookup by project (user_id may not exist on all instances)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_assets'
      AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_project_assets_project_user
      ON public.project_assets (project_id, user_id);
  ELSE
    CREATE INDEX IF NOT EXISTS idx_project_assets_project
      ON public.project_assets (project_id);
  END IF;
END
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Improve enforce_project_limit error message
-- ═══════════════════════════════════════════════════════════════════════════════

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
    RAISE EXCEPTION 'CS_PROJECT_LIMIT: Free plan allows % project(s). Delete an existing project or upgrade to Pro.', _max
      USING ERRCODE = 'P0001',
            HINT = 'Upgrade at /app/settings#billing';
  END IF;
  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Schema cache refresh
-- ═══════════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';

COMMIT;
