-- P110: Review gate v0
-- Adds review_status to marketplace_items and restricts the public browse
-- view to approved items only.

ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected'));

-- Update public SELECT policy to only show items that are both published
-- and approved.
DROP POLICY IF EXISTS "mkt_items_public_select" ON public.marketplace_items;
CREATE POLICY "mkt_items_public_select" ON public.marketplace_items
  FOR SELECT
  USING (is_published = true AND review_status = 'approved');

-- Authors can still see their own items regardless of review status.
DROP POLICY IF EXISTS "mkt_items_author_select" ON public.marketplace_items;
CREATE POLICY "mkt_items_author_select" ON public.marketplace_items
  FOR SELECT TO authenticated
  USING (author_id = (select auth.uid()));
