-- D9-2: Explore content types — tags, likes, and expanded category support.
--
-- Adds:
--   1. tags text[] column on marketplace_items for discoverability.
--   2. likes_count counter on marketplace_items (denormalised for sort perf).
--   3. marketplace_likes table for per-user like deduplication.
--   4. category comment updated to include 'group' and 'custom_block'.

-- ── 1. Tags ──────────────────────────────────────────────────────────────────

ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_mkt_items_tags
  ON public.marketplace_items USING GIN (tags);

-- ── 2. Likes counter ────────────────────────────────────────────────────────

ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS likes_count int NOT NULL DEFAULT 0;

-- ── 3. marketplace_likes (unique per user+item) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketplace_likes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id    uuid        NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

ALTER TABLE public.marketplace_likes ENABLE ROW LEVEL SECURITY;

-- Users can see their own likes
DROP POLICY IF EXISTS "mkt_likes_user_select" ON public.marketplace_likes;
CREATE POLICY "mkt_likes_user_select" ON public.marketplace_likes
  FOR SELECT USING ((select auth.uid()) = user_id);

-- Users can insert their own likes
DROP POLICY IF EXISTS "mkt_likes_user_insert" ON public.marketplace_likes;
CREATE POLICY "mkt_likes_user_insert" ON public.marketplace_likes
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- Users can delete their own likes
DROP POLICY IF EXISTS "mkt_likes_user_delete" ON public.marketplace_likes;
CREATE POLICY "mkt_likes_user_delete" ON public.marketplace_likes
  FOR DELETE USING ((select auth.uid()) = user_id);

-- ── 4. Trigger: auto-update likes_count on insert/delete ─────────────────────

CREATE OR REPLACE FUNCTION public.handle_marketplace_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.marketplace_items
       SET likes_count = likes_count + 1
     WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.marketplace_items
       SET likes_count = GREATEST(likes_count - 1, 0)
     WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mkt_likes_count ON public.marketplace_likes;
CREATE TRIGGER trg_mkt_likes_count
  AFTER INSERT OR DELETE ON public.marketplace_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_likes_count();

-- ── 5. Category comment ─────────────────────────────────────────────────────

COMMENT ON COLUMN public.marketplace_items.category IS
  'Content type: template | block_pack | theme | group | custom_block';
