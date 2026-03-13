-- ============================================================
-- 0012_fk_cascade_and_indexes.sql
-- ChainSolve — FK cascade hardening and missing FK indexes.
--
-- All FK columns already have ON DELETE CASCADE/SET NULL in the
-- baseline. This migration adds the 2 missing indexes on FK
-- columns for CASCADE DELETE performance.
--
-- All statements are idempotent — safe to run multiple times.
-- ============================================================

BEGIN;

-- =========================================================================
-- 1. Missing FK index: canvases.owner_id
--    The composite idx_canvases_owner_project(owner_id, project_id) exists
--    but a simple owner_id index is needed for efficient CASCADE DELETE
--    lookups when an auth.users row is deleted.
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_canvases_owner_id
  ON public.canvases(owner_id);


-- =========================================================================
-- 2. Missing FK index: marketplace_install_events.user_id
--    The existing idx_mkt_events_user is a partial index
--    (WHERE user_id IS NOT NULL) which doesn't cover the SET NULL
--    operation during profile deletion. A full index is needed.
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_mkt_install_events_user_id
  ON public.marketplace_install_events(user_id);


-- =========================================================================
-- 3. Verify FK cascade behavior on key tables.
--    These are all already ON DELETE CASCADE in the baseline, but we
--    document them here as the audit record for this task.
--
--    Table                       FK Column      References             Action
--    ─────────────────────────   ─────────────  ─────────────────────  ──────────
--    canvases                    project_id     projects(id)           CASCADE  ✓
--    canvases                    owner_id       auth.users(id)         CASCADE  ✓
--    project_assets              project_id     projects(id)           CASCADE  ✓
--    project_assets              user_id        profiles(id)           CASCADE  ✓
--    project_snapshots           project_id     projects(id)           CASCADE  ✓
--    project_snapshots           canvas_id      canvases(id)           CASCADE  ✓
--    project_snapshots           owner_id       profiles(id)           CASCADE  ✓
--    node_comments               project_id     projects(id)           CASCADE  ✓
--    node_comments               canvas_id      canvases(id)           CASCADE  ✓
--    node_comments               owner_id       profiles(id)           CASCADE  ✓
--    simulation_runs             project_id     projects(id)           CASCADE  ✓
--    simulation_runs             owner_id       profiles(id)           CASCADE  ✓
--    fs_items                    project_id     projects(id)           CASCADE  ✓
--    fs_items                    user_id        profiles(id)           CASCADE  ✓
--    fs_items                    parent_id      fs_items(id)           CASCADE  ✓
--    share_links                 project_id     projects(id)           CASCADE  ✓
--    share_links                 created_by     profiles(id)           CASCADE  ✓
--    marketplace_install_events  item_id        marketplace_items(id)  CASCADE  ✓
--    marketplace_install_events  user_id        profiles(id)           SET NULL ✓
-- =========================================================================

COMMIT;
