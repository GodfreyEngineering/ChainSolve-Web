-- 0005_consolidate_permissive_policies.sql
--
-- Consolidate multiple permissive RLS policies per table/action/role into
-- single policies. PostgreSQL OR-combines all permissive policies for the
-- same action+role, so multiple policies are semantically identical to one
-- combined policy but slower (each is evaluated independently).
--
-- Supabase performance advisor: "multiple_permissive_policies" warning.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. profiles — UPDATE: merge own-update + moderator-update into one policy
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS profiles_update_own        ON public.profiles;
DROP POLICY IF EXISTS profiles_mod_clear_avatar   ON public.profiles;

-- Consolidated: user can update own profile (no self-promote) OR moderator can update any.
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_moderator = true
    )
  )
  WITH CHECK (
    -- Own-update path: prevent self-promotion of role flags
    (
      id = (select auth.uid())
      AND is_developer IS NOT DISTINCT FROM (
        SELECT p.is_developer FROM public.profiles p WHERE p.id = (select auth.uid())
      )
      AND is_admin IS NOT DISTINCT FROM (
        SELECT p.is_admin FROM public.profiles p WHERE p.id = (select auth.uid())
      )
      AND is_student IS NOT DISTINCT FROM (
        SELECT p.is_student FROM public.profiles p WHERE p.id = (select auth.uid())
      )
    )
    OR
    -- Moderator path: can update any profile
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_moderator = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. marketplace_comments — SELECT: merge public-read + mod-read
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS mkt_comments_public_read ON public.marketplace_comments;
DROP POLICY IF EXISTS mkt_comments_mod_read    ON public.marketplace_comments;

-- Consolidated: non-flagged visible to all, flagged visible to moderators only.
CREATE POLICY mkt_comments_select ON public.marketplace_comments
  FOR SELECT USING (
    is_flagged = false
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND is_moderator = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. marketplace_comments — UPDATE: merge user-flag + mod-update
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS mkt_comments_user_flag  ON public.marketplace_comments;
DROP POLICY IF EXISTS mkt_comments_mod_update ON public.marketplace_comments;

-- Consolidated: any authenticated user can flag (set is_flagged=true),
-- moderators can do any update.
CREATE POLICY mkt_comments_update ON public.marketplace_comments
  FOR UPDATE USING (
    (select auth.uid()) IS NOT NULL
  )
  WITH CHECK (
    -- Regular user: can only set is_flagged = true
    is_flagged = true
    OR
    -- Moderator: unrestricted update
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND is_moderator = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. marketplace_comments — DELETE: merge user + mod + author
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS mkt_comments_user_delete   ON public.marketplace_comments;
DROP POLICY IF EXISTS mkt_comments_mod_delete    ON public.marketplace_comments;
DROP POLICY IF EXISTS mkt_comments_author_delete ON public.marketplace_comments;

-- Consolidated: own comment, moderator, or item author can delete.
CREATE POLICY mkt_comments_delete ON public.marketplace_comments
  FOR DELETE USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND is_moderator = true
    )
    OR EXISTS (
      SELECT 1 FROM public.marketplace_items
      WHERE id = marketplace_comments.item_id
        AND author_id = (select auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. avatar_reports — SELECT: merge own + moderator
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS avatar_reports_own_select ON public.avatar_reports;
DROP POLICY IF EXISTS avatar_reports_mod_select ON public.avatar_reports;

-- Consolidated: own reports or moderator can view all.
CREATE POLICY avatar_reports_select ON public.avatar_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND is_moderator = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. marketplace_install_events — SELECT: merge user + author
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS mie_user_select   ON public.marketplace_install_events;
DROP POLICY IF EXISTS mie_author_select ON public.marketplace_install_events;

-- Consolidated: own events or author of installed item (analytics).
CREATE POLICY mie_select ON public.marketplace_install_events
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.marketplace_items mi
      WHERE mi.id = marketplace_install_events.item_id
        AND mi.author_id = (select auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. user_reports — SELECT: merge own + admin/developer
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS user_reports_select_own ON public.user_reports;
DROP POLICY IF EXISTS user_reports_select_mod ON public.user_reports;

-- Consolidated: own reports or admin/developer can view all.
CREATE POLICY user_reports_select ON public.user_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND (is_admin = true OR is_developer = true)
    )
  );

COMMIT;
