-- I4-1: Source-based categorisation for Explore ecosystem.
--
-- Adds is_official flag to marketplace_items so the UI can distinguish
-- between ChainSolve official content, community uploads, and enterprise
-- org uploads without expensive JOINs on every browse query.
--
-- is_official is denormalised from profiles.verified_author.
-- A trigger auto-sets is_official on INSERT based on the author's
-- verified_author flag. Admins can also set it manually via UPDATE.

BEGIN;

-- 1. Add is_official column
ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_mkt_items_official
  ON public.marketplace_items(is_official)
  WHERE is_published = true;

-- 2. Backfill: mark existing items from verified authors as official
UPDATE public.marketplace_items mi
   SET is_official = true
  FROM public.profiles p
 WHERE mi.author_id = p.id
   AND p.verified_author = true;

-- 3. Trigger: auto-set is_official on new item creation
CREATE OR REPLACE FUNCTION public.handle_marketplace_item_official()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT verified_author INTO NEW.is_official
    FROM public.profiles
   WHERE id = NEW.author_id;
  -- If profile not found, default to false
  IF NEW.is_official IS NULL THEN
    NEW.is_official := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mkt_items_official ON public.marketplace_items;
CREATE TRIGGER trg_mkt_items_official
  BEFORE INSERT ON public.marketplace_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_item_official();

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
