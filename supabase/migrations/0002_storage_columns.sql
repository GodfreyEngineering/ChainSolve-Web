-- ============================================================
-- ChainSolve — Storage column additions
-- Run after 0001_init.sql
-- ============================================================

-- projects: record which storage key holds the project JSON
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS storage_key TEXT;

-- project_assets: discriminator so callers can filter by upload type
ALTER TABLE project_assets
  ADD COLUMN IF NOT EXISTS kind TEXT;

-- Index for fast lookups by kind (e.g. WHERE kind = 'csv')
CREATE INDEX IF NOT EXISTS idx_project_assets_kind ON project_assets(kind);
