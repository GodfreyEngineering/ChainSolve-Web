-- 0025_marketplace_analytics_policy.sql — Analytics SELECT policy for authors
--
-- P115: Marketplace analytics (privacy constrained)
--
-- Allows verified authors to SELECT install events for items they own.
-- Combined with server-side aggregation (never returning raw user_id to the
-- client), this provides privacy-safe per-item analytics.
--
-- Privacy invariants:
--   - The service layer aggregates counts before returning them to the client.
--   - No per-user identity (name, email, user_id) is ever surfaced in analytics.
--   - Only aggregate counts (total, last-30-days, by event_type) are returned.
--
-- Idempotent.

BEGIN;

DROP POLICY IF EXISTS "mie_author_select" ON public.marketplace_install_events;
CREATE POLICY "mie_author_select"
  ON public.marketplace_install_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.marketplace_items mi
      WHERE  mi.id        = marketplace_install_events.item_id
        AND  mi.author_id = (select auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
