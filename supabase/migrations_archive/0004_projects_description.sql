-- ============================================================
-- Migration 0004: Ensure projects.description column exists.
--
-- The column was defined in the original schema but may be
-- absent on DBs created before 0001 included it.
-- Idempotent: ADD COLUMN IF NOT EXISTS is a no-op when the
-- column is already present.
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description text;
