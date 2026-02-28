-- Migration: 0021_verified_author
-- P109: Gate marketplace item creation behind a verified_author flag on profiles.
--
-- Design:
--   - profiles.verified_author is admin-managed (defaults false).
--   - The INSERT policy on marketplace_items is tightened so only users whose
--     profile has verified_author=true can create items.
--   - Authors who are not yet verified see a notice in the author dashboard.

BEGIN;

-- 1. Add verified_author flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_author BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Replace the open INSERT policy with a verified-author-gated one
DROP POLICY IF EXISTS "mkt_items_author_insert" ON public.marketplace_items;
CREATE POLICY "mkt_items_author_insert"
  ON public.marketplace_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = (select auth.uid())
         AND verified_author = true
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
