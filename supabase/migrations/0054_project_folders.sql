-- 0054_project_folders.sql — L4-2: Add folder column for project organization.
--
-- Adds a nullable `folder` text column to the projects table.
-- NULL = root (uncategorized). Non-null = folder label.
-- No nesting — folders are flat string labels owned implicitly
-- by the project owner via existing RLS policies.

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS folder text;

COMMENT ON COLUMN public.projects.folder
  IS 'Optional folder label for project organization. NULL = root/uncategorized.';

-- Index for efficient folder listing per owner.
CREATE INDEX IF NOT EXISTS idx_projects_owner_folder
  ON public.projects (owner_id, folder)
  WHERE folder IS NOT NULL;

COMMIT;
