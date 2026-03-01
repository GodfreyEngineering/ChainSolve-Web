-- D14-3: Consolidate multiple permissive policies for performance
--
-- The Supabase performance advisor warns when multiple permissive policies
-- exist for the same role + action on a table, because PostgreSQL evaluates
-- each policy separately and ORs the results. Merging into a single policy
-- with explicit OR logic is more efficient.
--
-- Tables consolidated:
--   1. audit_log: 2 SELECT → 1
--   2. marketplace_items: 4 SELECT → 1, 2 UPDATE → 1
--      (also drops orphan mkt_items_public_read from 0018)

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. audit_log SELECT — merge user_select + org_admin_select
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "audit_log_user_select" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_org_admin_select" ON public.audit_log;

CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    -- User can see their own events
    user_id = (SELECT auth.uid())
    OR
    -- Org owners/admins can see org events
    (
      org_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.org_members AS m
        WHERE m.org_id = audit_log.org_id
          AND m.user_id = (SELECT auth.uid())
          AND m.role IN ('owner', 'admin')
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. marketplace_items SELECT — merge public_read + public_select +
--    author_select + org_member_select into one policy
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop all existing SELECT policies (including orphaned mkt_items_public_read)
DROP POLICY IF EXISTS "mkt_items_public_read" ON public.marketplace_items;
DROP POLICY IF EXISTS "mkt_items_public_select" ON public.marketplace_items;
DROP POLICY IF EXISTS "mkt_items_author_select" ON public.marketplace_items;
DROP POLICY IF EXISTS "mkt_items_org_member_select" ON public.marketplace_items;

-- Single consolidated SELECT policy
CREATE POLICY "mkt_items_select" ON public.marketplace_items
  FOR SELECT
  USING (
    -- Public browse: published + approved items (anon + authenticated)
    (is_published = true AND review_status = 'approved')
    OR
    -- Author can see all their own items (incl. drafts, pending)
    (author_id = (SELECT auth.uid()))
    OR
    -- Org members can see items scoped to their org
    (
      org_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.org_members om
        WHERE om.org_id = marketplace_items.org_id
          AND om.user_id = (SELECT auth.uid())
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. marketplace_items UPDATE — merge author_update + moderator_update
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "mkt_items_author_update" ON public.marketplace_items;
DROP POLICY IF EXISTS "mkt_items_moderator_update" ON public.marketplace_items;

CREATE POLICY "mkt_items_update" ON public.marketplace_items
  FOR UPDATE TO authenticated
  USING (
    -- Authors can update their own items
    author_id = (SELECT auth.uid())
    OR
    -- Moderators can update any item (review_status, flags)
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_moderator = TRUE
    )
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_moderator = TRUE
    )
  );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
