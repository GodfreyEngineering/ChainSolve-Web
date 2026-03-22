-- 0027: Fix RLS performance warnings from Supabase advisor.
--
-- 1. feedback table: Replace auth.uid() with (select auth.uid()) to avoid
--    per-row re-evaluation of the auth function.
-- 2. share_links: Consolidate multiple permissive SELECT policies into one.

SET search_path = public;

-- ── feedback: Fix auth_rls_initplan warnings ─────────────────────────────────

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ── share_links: Consolidate multiple permissive SELECT policies ─────────────
-- Two permissive policies for the same role+action causes each to be evaluated
-- for every query. Merge into a single policy that checks both conditions.

DROP POLICY IF EXISTS "share_links_creator_select" ON public.share_links;
DROP POLICY IF EXISTS "share_links_public_read" ON public.share_links;

CREATE POLICY "share_links_select"
  ON public.share_links FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = created_by
    OR is_active = true
  );
