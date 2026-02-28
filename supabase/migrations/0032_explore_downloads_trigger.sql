-- D9-6: Install event tracking — auto-increment downloads_count on marketplace_items.
--
-- When a new row is inserted into marketplace_purchases (install record),
-- automatically increment the downloads_count on the corresponding item.
-- This keeps the denormalised counter in sync without requiring client-side RPCs.
--
-- Privacy: no project content is tracked — only the count changes on the item.

CREATE OR REPLACE FUNCTION public.handle_marketplace_downloads_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.marketplace_items
       SET downloads_count = downloads_count + 1
     WHERE id = NEW.item_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mkt_downloads_count ON public.marketplace_purchases;
CREATE TRIGGER trg_mkt_downloads_count
  AFTER INSERT ON public.marketplace_purchases
  FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_downloads_count();
