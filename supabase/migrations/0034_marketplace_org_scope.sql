-- D10-1: Org-scoped marketplace items ("Company Library")
--
-- Adds org_id column to marketplace_items so items can be scoped to an
-- organization. When org_id IS NOT NULL the item is only visible to
-- members of that org. Public items keep org_id = NULL.
--
-- RLS: org members can SELECT items belonging to their org, regardless
-- of is_published (company library items may be internal drafts).

BEGIN;

-- 1. Add org_id column (nullable — public items have NULL)
ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS org_id uuid
    REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mkt_items_org ON public.marketplace_items(org_id);

-- 2. RLS: org members can read items scoped to their org
DROP POLICY IF EXISTS "mkt_items_org_member_select" ON public.marketplace_items;
CREATE POLICY "mkt_items_org_member_select"
  ON public.marketplace_items
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = marketplace_items.org_id
        AND om.user_id = (select auth.uid())
    )
  );

-- 3. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
