-- ═══════════════════════════════════════════════════════════════════════════
-- 0012_canvas_name_constraints.sql
--
-- Adds filename-safe CHECK constraint to canvas names, matching the
-- projects_name_safe constraint from 0011. Prevents control chars and
-- filesystem-unsafe characters in canvas names.
-- ═══════════════════════════════════════════════════════════════════════════

-- Canvas name: 1-100 chars, no control chars or filesystem-unsafe chars
ALTER TABLE public.canvases
  DROP CONSTRAINT IF EXISTS canvases_name_safe;

ALTER TABLE public.canvases
  ADD CONSTRAINT canvases_name_safe
    CHECK (
      name ~ '^[^\x00-\x1F\x7F/\\:*?"<>|]+$'
      AND char_length(trim(name)) >= 1
    );

NOTIFY pgrst, 'reload schema';
