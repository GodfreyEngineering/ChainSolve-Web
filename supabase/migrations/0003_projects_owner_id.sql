-- ============================================================
-- Migration 0003: Rename projects.user_id → owner_id
--                 and update all dependent RLS policies.
--
-- Idempotent: the DO block only renames if user_id still exists.
-- Safe to run on a DB that is already on owner_id (no-op).
-- ============================================================

-- 1. Rename column (idempotent guard)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'projects'
      AND  column_name  = 'user_id'
  ) THEN
    ALTER TABLE public.projects RENAME COLUMN user_id TO owner_id;
    -- Update the index created in 0001 to reflect the new column name
    DROP INDEX IF EXISTS idx_projects_user_id;
    CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
  END IF;
END $$;

-- 2. Drop the old RLS policies (reference user_id; may already be gone)
DROP POLICY IF EXISTS "Users can view their own projects"   ON public.projects;
DROP POLICY IF EXISTS "Users can create projects"           ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- 3. Recreate policies using owner_id
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
