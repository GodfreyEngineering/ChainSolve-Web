-- 0016_project_branches.sql — 5.9: Graph branching for experimentation.
--
-- Adds branch support to project_snapshots so users can create named
-- branches (e.g., "main", "experiment-aero", "v2-redesign"), switch
-- between them, and compare branch states side-by-side.
--
-- Design:
--   - project_snapshots gains branch_name (default 'main')
--   - project_branches stores branch metadata (name, description, created_from)
--   - Snapshot limit trigger updated to be per (project_id, canvas_id, branch_name)
--   - get_branches() RPC: list all branches for a project
--   - create_branch() RPC: create a new branch by forking from a snapshot

SET search_path = public;

-- ── 1. Add branch_name to project_snapshots ──────────────────────────────────

ALTER TABLE public.project_snapshots
  ADD COLUMN IF NOT EXISTS branch_name TEXT NOT NULL DEFAULT 'main';

-- Index for efficient branch-based queries
CREATE INDEX IF NOT EXISTS idx_snapshots_project_canvas_branch
  ON public.project_snapshots(project_id, canvas_id, branch_name, created_at DESC);

-- ── 2. project_branches table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_branches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  canvas_id       uuid        NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
  owner_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_name     TEXT        NOT NULL,
  description     TEXT,
  /** Snapshot this branch was forked from (NULL for 'main'). */
  forked_from_snapshot_id  uuid REFERENCES public.project_snapshots(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_branches_project_canvas_name UNIQUE (project_id, canvas_id, branch_name)
);

COMMENT ON TABLE public.project_branches IS
  'Named branches for project graph experimentation (5.9).
   Each branch tracks its own line of project_snapshots history.
   The ''main'' branch is auto-created on first save.';

ALTER TABLE public.project_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branches_select_own ON public.project_branches;
CREATE POLICY branches_select_own ON public.project_branches
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS branches_insert_own ON public.project_branches;
CREATE POLICY branches_insert_own ON public.project_branches
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS branches_update_own ON public.project_branches;
CREATE POLICY branches_update_own ON public.project_branches
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS branches_delete_own ON public.project_branches;
CREATE POLICY branches_delete_own ON public.project_branches
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND branch_name <> 'main');

CREATE INDEX IF NOT EXISTS idx_branches_project_canvas
  ON public.project_branches(project_id, canvas_id);

-- ── 3. Update snapshot limit trigger to be per-branch ────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_snapshot_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _excess_count int;
BEGIN
  SELECT COUNT(*) - 20 INTO _excess_count
  FROM public.project_snapshots
  WHERE project_id  = NEW.project_id
    AND canvas_id   = NEW.canvas_id
    AND branch_name = NEW.branch_name;

  IF _excess_count > 0 THEN
    DELETE FROM public.project_snapshots
    WHERE id IN (
      SELECT id FROM public.project_snapshots
      WHERE project_id  = NEW.project_id
        AND canvas_id   = NEW.canvas_id
        AND branch_name = NEW.branch_name
      ORDER BY created_at ASC
      LIMIT _excess_count
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ── 4. get_branches() RPC ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_branches(
  p_project_id  uuid,
  p_canvas_id   uuid
)
RETURNS TABLE (
  id              uuid,
  branch_name     text,
  description     text,
  created_at      timestamptz,
  snapshot_count  bigint,
  latest_label    text,
  latest_at       timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.branch_name,
    b.description,
    b.created_at,
    COUNT(s.id)::bigint AS snapshot_count,
    (SELECT s2.label FROM public.project_snapshots s2
      WHERE s2.project_id = p_project_id AND s2.canvas_id = p_canvas_id
        AND s2.branch_name = b.branch_name
      ORDER BY s2.created_at DESC LIMIT 1) AS latest_label,
    (SELECT s2.created_at FROM public.project_snapshots s2
      WHERE s2.project_id = p_project_id AND s2.canvas_id = p_canvas_id
        AND s2.branch_name = b.branch_name
      ORDER BY s2.created_at DESC LIMIT 1) AS latest_at
  FROM public.project_branches b
  LEFT JOIN public.project_snapshots s
    ON s.project_id = p_project_id
   AND s.canvas_id = p_canvas_id
   AND s.branch_name = b.branch_name
  WHERE b.project_id = p_project_id
    AND b.canvas_id  = p_canvas_id
    AND b.owner_id   = (SELECT auth.uid())
  GROUP BY b.id, b.branch_name, b.description, b.created_at
  ORDER BY b.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_branches(uuid, uuid) TO authenticated;
