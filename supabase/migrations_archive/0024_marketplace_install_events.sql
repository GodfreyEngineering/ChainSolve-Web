-- 0024_marketplace_install_events.sql — Marketplace install/download audit log
--
-- P114: Download/install audit events (future enterprise)
--
-- Records every install, template-fork, or paid purchase event for a
-- marketplace item.  Unlike marketplace_purchases (which is a unique
-- ownership record), this table is an append-only event log that allows
-- multiple entries per (user, item) pair and captures the install method.
--
-- Enterprise note: this table is the foundation for per-item analytics (P115)
-- and the general audit log viewer planned in P126/P127.
--
-- RLS:
--   - Authenticated users can read their own events.
--   - Authenticated users can insert their own events (user_id must match uid).
--   - No UPDATE / DELETE from clients (immutable audit trail).
--   - Service role can insert from edge functions (webhook for purchases).
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_install_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid        NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- install = free item direct install
  -- fork    = project_template forked into user projects
  -- purchase = paid item via Stripe Checkout
  event_type  text        NOT NULL CHECK (event_type IN ('install', 'fork', 'purchase')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_events_item
  ON public.marketplace_install_events (item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mkt_events_user
  ON public.marketplace_install_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.marketplace_install_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own install history
DROP POLICY IF EXISTS "mie_user_select" ON public.marketplace_install_events;
CREATE POLICY "mie_user_select"
  ON public.marketplace_install_events
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Users (and service role) can insert events where user_id = their own uid
DROP POLICY IF EXISTS "mie_user_insert" ON public.marketplace_install_events;
CREATE POLICY "mie_user_insert"
  ON public.marketplace_install_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ── Refresh PostgREST schema cache ────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
