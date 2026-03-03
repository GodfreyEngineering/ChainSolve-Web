-- P119: moderation tools
-- Adds is_moderator flag to profiles and an UPDATE policy so moderators
-- can change review_status on any marketplace item.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN NOT NULL DEFAULT FALSE;

-- Moderators can update review_status on any marketplace item.
DROP POLICY IF EXISTS "mkt_items_moderator_update" ON public.marketplace_items;
CREATE POLICY "mkt_items_moderator_update" ON public.marketplace_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND is_moderator = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND is_moderator = TRUE
    )
  );
