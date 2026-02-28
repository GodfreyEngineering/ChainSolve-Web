-- D9-4: Marketplace/Explore comments system (moderated).
--
-- Adds:
--   1. marketplace_comments table (user_id, item_id, content, flagging).
--   2. comments_count denormalised counter on marketplace_items.
--   3. RLS policies for read/write/delete/moderate.
--   4. Client-side rate limiting is handled in the app; server enforces auth.

-- ── 1. Comments table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketplace_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid        NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_flagged boolean     NOT NULL DEFAULT false,
  flag_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_comments_item
  ON public.marketplace_comments (item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mkt_comments_user
  ON public.marketplace_comments (user_id);

-- ── 2. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.marketplace_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-flagged comments
CREATE POLICY "mkt_comments_public_read" ON public.marketplace_comments
  FOR SELECT USING (is_flagged = false);

-- Moderators can read flagged comments too
CREATE POLICY "mkt_comments_mod_read" ON public.marketplace_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_moderator = true
    )
  );

-- Users can insert their own comments
CREATE POLICY "mkt_comments_user_insert" ON public.marketplace_comments
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can delete their own comments
CREATE POLICY "mkt_comments_user_delete" ON public.marketplace_comments
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Any authenticated user can flag a comment (update is_flagged + flag_reason)
CREATE POLICY "mkt_comments_user_flag" ON public.marketplace_comments
  FOR UPDATE USING (
    (SELECT auth.uid()) IS NOT NULL
  ) WITH CHECK (
    is_flagged = true
  );

-- Moderators can update any comment (e.g. unflag, or force-delete via flag)
CREATE POLICY "mkt_comments_mod_update" ON public.marketplace_comments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_moderator = true
    )
  );

-- Moderators can delete any comment
CREATE POLICY "mkt_comments_mod_delete" ON public.marketplace_comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_moderator = true
    )
  );

-- Item authors can delete comments on their own items
CREATE POLICY "mkt_comments_author_delete" ON public.marketplace_comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_items
      WHERE id = marketplace_comments.item_id
        AND author_id = (SELECT auth.uid())
    )
  );

-- ── 3. Comments count (denormalised) ───────────────────────────────────────

ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS comments_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_marketplace_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.marketplace_items
       SET comments_count = comments_count + 1
     WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.marketplace_items
       SET comments_count = GREATEST(comments_count - 1, 0)
     WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mkt_comments_count ON public.marketplace_comments;
CREATE TRIGGER trg_mkt_comments_count
  AFTER INSERT OR DELETE ON public.marketplace_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_comments_count();
