-- ============================================================
-- ChainSolve — Add sha256 + updated_at to project_assets
-- Needed for .chainsolvejson asset integrity verification.
-- Idempotent: safe to run multiple times.
-- ============================================================

ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS sha256 TEXT;
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
