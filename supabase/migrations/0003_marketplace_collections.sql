-- V3-7.2: Marketplace collections table
-- Curated groupings of marketplace items for featured display on the Explore page.

CREATE TABLE IF NOT EXISTS public.marketplace_collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  cover_image_url text,
  item_ids    uuid[] NOT NULL DEFAULT '{}',
  position    int NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_marketplace_collections_updated_at ON public.marketplace_collections;
CREATE TRIGGER set_marketplace_collections_updated_at
  BEFORE UPDATE ON public.marketplace_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- RLS: public read, service_role write
ALTER TABLE public.marketplace_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketplace_collections_read ON public.marketplace_collections;
CREATE POLICY marketplace_collections_read
  ON public.marketplace_collections
  FOR SELECT
  USING (true);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_marketplace_collections_position
  ON public.marketplace_collections (position);
