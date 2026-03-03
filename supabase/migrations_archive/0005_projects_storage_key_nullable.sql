-- 0005_projects_storage_key_nullable.sql
--
-- Ensures projects.storage_key is nullable.
--
-- Context: The app now generates storage_key upfront at INSERT time, so
-- NOT NULL is safe for new rows. However, dropping NOT NULL is a safety
-- net: if a storage upload fails after the row is created, the project
-- still exists and the user can retry. The code always re-stamps
-- storage_key via saveProjectJson().
--
-- Idempotent: ALTER COLUMN ... DROP NOT NULL is a no-op if the column
-- is already nullable.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'storage_key'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.projects ALTER COLUMN storage_key DROP NOT NULL;
  END IF;
END
$$;
