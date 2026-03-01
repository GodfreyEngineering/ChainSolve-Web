-- E10-1: Server-side comment rate limiting.
--
-- Adds a BEFORE INSERT trigger on marketplace_comments that enforces a
-- maximum of 5 comments per user per 60-second sliding window. This
-- hardens the client-side rate limit against direct API calls.

CREATE OR REPLACE FUNCTION public.enforce_comment_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
    FROM public.marketplace_comments
   WHERE user_id = NEW.user_id
     AND created_at > now() - interval '60 seconds';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded — max 5 per minute'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_rate_limit ON public.marketplace_comments;
CREATE TRIGGER trg_comment_rate_limit
  BEFORE INSERT ON public.marketplace_comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_rate_limit();
