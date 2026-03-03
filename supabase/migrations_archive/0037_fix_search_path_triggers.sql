-- D14-1: Fix function_search_path_mutable for trigger functions
--
-- The Supabase security advisor flags SECURITY DEFINER functions that do not
-- explicitly pin search_path. This migration recreates 3 trigger functions
-- from migrations 0031-0033 with SET search_path = public.
--
-- Functions fixed:
--   1. handle_marketplace_likes_count()    (0031)
--   2. handle_marketplace_downloads_count() (0032)
--   3. handle_marketplace_comments_count()  (0033)
--
-- Note: handle_canvases_updated_at() was already fixed in 0016_advisor_fixes_v3.sql.

-- 1. handle_marketplace_likes_count — pin search_path
CREATE OR REPLACE FUNCTION public.handle_marketplace_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- 2. handle_marketplace_downloads_count — pin search_path
CREATE OR REPLACE FUNCTION public.handle_marketplace_downloads_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- 3. handle_marketplace_comments_count — pin search_path
CREATE OR REPLACE FUNCTION public.handle_marketplace_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
