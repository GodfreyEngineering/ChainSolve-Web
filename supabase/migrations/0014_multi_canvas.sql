-- 0014_multi_canvas.sql — Multi-canvas "Sheets" per project (W10.7)
--
-- Creates the `canvases` metadata table and adds `active_canvas_id` to
-- `projects`.  Each canvas's graph JSON is stored in Supabase Storage at
-- {userId}/{projectId}/canvases/{canvasId}.json — the DB only holds metadata
-- and a storage_path pointer.
--
-- Ordering: integer `position` with a unique constraint per project.
-- Deletion: hard delete; "at least one canvas" enforced client-side.
-- RLS: owner_id = (select auth.uid()) pattern (matches 0011 canonical style).
--
-- active_canvas_id on projects is stored as a plain uuid column with an index
-- (no FK) to avoid circular dependency between projects ↔ canvases.  Enforced
-- at the application level.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Create canvases table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.canvases (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  position      int         NOT NULL,
  storage_path  text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT canvases_project_position_unique UNIQUE (project_id, position)
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_canvases_project_id ON public.canvases (project_id);
CREATE INDEX IF NOT EXISTS idx_canvases_owner_project ON public.canvases (owner_id, project_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. updated_at trigger (matches existing pattern from 0001)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_canvases_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_canvases_updated_at
  BEFORE UPDATE ON public.canvases
  FOR EACH ROW EXECUTE FUNCTION public.handle_canvases_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. RLS (canonical style from 0011)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.canvases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "canvases_select_own" ON public.canvases
  FOR SELECT TO authenticated
  USING (owner_id = (select auth.uid()));

CREATE POLICY "canvases_insert_own" ON public.canvases
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "canvases_update_own" ON public.canvases
  FOR UPDATE TO authenticated
  USING (owner_id = (select auth.uid()))
  WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "canvases_delete_own" ON public.canvases
  FOR DELETE TO authenticated
  USING (owner_id = (select auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Add active_canvas_id to projects (no FK — avoids circular dependency)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS active_canvas_id uuid;

CREATE INDEX IF NOT EXISTS idx_projects_active_canvas ON public.projects (active_canvas_id)
  WHERE active_canvas_id IS NOT NULL;

COMMIT;
