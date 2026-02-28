-- 0018_marketplace.sql — Marketplace v0 schema
--
-- P101: marketplace_items + marketplace_purchases tables + storage bucket
-- P102: RLS policies (public browse metadata, gated installs + uploads)
--
-- Design decisions:
--   - marketplace_items.is_published = false guards items in draft
--   - Anyone (anon + authenticated) can SELECT published items (browse)
--   - Only the author can INSERT / UPDATE / DELETE their own items
--   - marketplace_purchases records user installs (one per user per item)
--   - marketplace storage bucket is public-readable (thumbnails);
--     authors upload under their own {user_id}/ prefix
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS
-- Wrapped in a transaction.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. marketplace_items
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.marketplace_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  category        text        NOT NULL DEFAULT 'template',  -- template | block_pack | theme
  version         text        NOT NULL DEFAULT '1.0.0',
  thumbnail_url   text,
  downloads_count int         NOT NULL DEFAULT 0,
  is_published    boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_items_author    ON public.marketplace_items(author_id);
CREATE INDEX IF NOT EXISTS idx_mkt_items_published ON public.marketplace_items(is_published);
CREATE INDEX IF NOT EXISTS idx_mkt_items_category  ON public.marketplace_items(category);
CREATE INDEX IF NOT EXISTS idx_mkt_items_downloads ON public.marketplace_items(downloads_count DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_marketplace_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mkt_items_updated_at ON public.marketplace_items;
CREATE TRIGGER trg_mkt_items_updated_at
  BEFORE UPDATE ON public.marketplace_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_items_updated_at();

-- ─── RLS on marketplace_items ────────────────────────────────────────────────

ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated) can read published items — marketplace browsing
DROP POLICY IF EXISTS "mkt_items_public_read" ON public.marketplace_items;
CREATE POLICY "mkt_items_public_read"
  ON public.marketplace_items
  FOR SELECT
  USING (is_published = true);

-- Authors can read all their own items (including drafts)
DROP POLICY IF EXISTS "mkt_items_author_select" ON public.marketplace_items;
CREATE POLICY "mkt_items_author_select"
  ON public.marketplace_items
  FOR SELECT
  TO authenticated
  USING (author_id = (select auth.uid()));

-- Authors can insert (only under their own author_id)
DROP POLICY IF EXISTS "mkt_items_author_insert" ON public.marketplace_items;
CREATE POLICY "mkt_items_author_insert"
  ON public.marketplace_items
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = (select auth.uid()));

-- Authors can update their own items
DROP POLICY IF EXISTS "mkt_items_author_update" ON public.marketplace_items;
CREATE POLICY "mkt_items_author_update"
  ON public.marketplace_items
  FOR UPDATE
  TO authenticated
  USING (author_id = (select auth.uid()))
  WITH CHECK (author_id = (select auth.uid()));

-- Authors can delete their own items
DROP POLICY IF EXISTS "mkt_items_author_delete" ON public.marketplace_items;
CREATE POLICY "mkt_items_author_delete"
  ON public.marketplace_items
  FOR DELETE
  TO authenticated
  USING (author_id = (select auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. marketplace_purchases (install records)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.marketplace_purchases (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id      uuid        NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  installed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_purchases_user ON public.marketplace_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_mkt_purchases_item ON public.marketplace_purchases(item_id);

-- ─── RLS on marketplace_purchases ────────────────────────────────────────────

ALTER TABLE public.marketplace_purchases ENABLE ROW LEVEL SECURITY;

-- Users can read their own install history
DROP POLICY IF EXISTS "mkt_purchases_user_select" ON public.marketplace_purchases;
CREATE POLICY "mkt_purchases_user_select"
  ON public.marketplace_purchases
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Users can record installs (user_id must equal their own uid)
DROP POLICY IF EXISTS "mkt_purchases_user_insert" ON public.marketplace_purchases;
CREATE POLICY "mkt_purchases_user_insert"
  ON public.marketplace_purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. marketplace storage bucket
--    Public-readable (thumbnails + package manifests served without auth).
--    Authors write under their own {user_id}/ prefix.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('marketplace', 'marketplace', true, 10485760)   -- 10 MB
ON CONFLICT (id) DO NOTHING;

-- Authors upload under their own prefix
DROP POLICY IF EXISTS "marketplace bucket: author insert" ON storage.objects;
CREATE POLICY "marketplace bucket: author insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "marketplace bucket: author update" ON storage.objects;
CREATE POLICY "marketplace bucket: author update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "marketplace bucket: author delete" ON storage.objects;
CREATE POLICY "marketplace bucket: author delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Refresh PostgREST schema cache
-- ═══════════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';

COMMIT;
