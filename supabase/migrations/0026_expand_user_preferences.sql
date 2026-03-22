-- 0026: Expand user_preferences with workspace layout settings.
--
-- These columns persist canvas workspace state that was previously only
-- stored in localStorage. After this migration, the app can sync layout
-- preferences across devices.

SET search_path = public;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS inspector_mode        text    NOT NULL DEFAULT 'floating'
    CHECK (inspector_mode IN ('floating', 'sidebar')),
  ADD COLUMN IF NOT EXISTS dock_height           integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS dock_default_tab      text    NOT NULL DEFAULT 'output'
    CHECK (dock_default_tab IN ('output', 'problems', 'console', 'notes', 'history')),
  ADD COLUMN IF NOT EXISTS formula_bar_visible   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS eval_mode             text    NOT NULL DEFAULT 'reactive'
    CHECK (eval_mode IN ('reactive', 'manual')),
  ADD COLUMN IF NOT EXISTS sidebar_width         integer NOT NULL DEFAULT 320,
  ADD COLUMN IF NOT EXISTS canvas_zoom_level     float8  NOT NULL DEFAULT 1.0;

-- Sensible range constraints
ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_pref_dock_height_range;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_pref_dock_height_range
    CHECK (dock_height >= 100 AND dock_height <= 800);

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_pref_sidebar_width_range;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_pref_sidebar_width_range
    CHECK (sidebar_width >= 200 AND sidebar_width <= 600);

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_pref_zoom_range;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_pref_zoom_range
    CHECK (canvas_zoom_level >= 0.1 AND canvas_zoom_level <= 5.0);
