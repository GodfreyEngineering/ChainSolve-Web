-- 0002_add_projects_folder.sql
-- V2-001: Add missing `folder` column to `projects` table.
--
-- The consolidated baseline (0001) already defines this column, but production
-- databases provisioned before the consolidation may lack it.  This migration
-- is idempotent: `IF NOT EXISTS` ensures it is a no-op on databases that
-- already have the column (fresh or post-baseline).
--
-- The column stores a user-chosen label for organizing projects into folders.
-- NULL means root / uncategorized.  See also: `fs_items` (per-project tree).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS folder text;

COMMENT ON COLUMN public.projects.folder
  IS 'Optional folder label for project organization. NULL = root/uncategorized.';
