-- ============================================================
-- 0013_rls_hardening.sql
-- ChainSolve — RLS policy hardening pass.
--
-- Audit of all 34 tables with RLS enabled:
-- - All tables have appropriate SELECT/INSERT/UPDATE/DELETE policies
-- - All policies scope to auth.uid() or use service_role bypass
-- - This migration fixes minor gaps found during audit
--
-- All statements are idempotent — safe to run multiple times.
-- ============================================================

BEGIN;

-- =========================================================================
-- 1. marketplace_likes: add explicit TO authenticated role
--    Existing policies omit the role clause, which defaults to PUBLIC
--    (includes anon). Tighten to authenticated only.
-- =========================================================================

DROP POLICY IF EXISTS mkt_likes_user_select ON public.marketplace_likes;
CREATE POLICY mkt_likes_user_select ON public.marketplace_likes
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS mkt_likes_user_insert ON public.marketplace_likes;
CREATE POLICY mkt_likes_user_insert ON public.marketplace_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS mkt_likes_user_delete ON public.marketplace_likes;
CREATE POLICY mkt_likes_user_delete ON public.marketplace_likes
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));


-- =========================================================================
-- 2. marketplace_purchases: add DELETE policy
--    Users should be able to "uninstall" a purchased item.
-- =========================================================================

DROP POLICY IF EXISTS mkt_purchases_user_delete ON public.marketplace_purchases;
CREATE POLICY mkt_purchases_user_delete ON public.marketplace_purchases
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));


-- =========================================================================
-- 3. student_verifications: add INSERT policy for authenticated users
--    Currently only SELECT exists. While the Cloudflare Function uses
--    service_role for inserts, having an authenticated INSERT policy
--    is defense-in-depth (scoped to own user_id).
-- =========================================================================

DROP POLICY IF EXISTS student_verif_insert_own ON public.student_verifications;
CREATE POLICY student_verif_insert_own ON public.student_verifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));


-- =========================================================================
-- 4. Audit summary — all 34 tables verified
--
--  Table                       RLS  SELECT  INSERT  UPDATE  DELETE  Notes
--  ────────────────────────    ───  ──────  ──────  ──────  ──────  ─────
--  profiles                     ✓    ✓       -       ✓       -     No self-delete (cascade from auth.users)
--  organizations                ✓    ✓       ✓       ✓       ✓     Owner-scoped
--  org_members                  ✓    ✓       ✓       ✓       ✓     Owner/admin-scoped
--  projects                     ✓    ✓       ✓       ✓       ✓     Owner-scoped
--  canvases                     ✓    ✓       ✓       ✓       ✓     Owner-scoped
--  fs_items                     ✓    ✓       ✓       ✓       ✓     User-scoped
--  project_assets               ✓    ✓       ✓       ✓       ✓     User-scoped
--  stripe_events                ✓    deny    deny    deny    deny  Service-role only
--  bug_reports                  ✓    ✓       ✓       -       -     User reads own; insert only
--  suggestions                  ✓    ✓       ✓       -       -     User reads own; insert only
--  group_templates              ✓    ✓       ✓       ✓       ✓     Owner-scoped
--  csp_reports                  ✓    -       ✓       -       -     Insert only (service reads)
--  observability_events         ✓    deny    deny    deny    deny  Service-role only
--  marketplace_items            ✓    ✓       ✓       ✓       ✓     Author/published scoping
--  marketplace_purchases        ✓    ✓       ✓       -       ✓     User-scoped (DELETE added)
--  marketplace_install_events   ✓    ✓       ✓       -       -     User/author-scoped
--  marketplace_likes            ✓    ✓       ✓       -       ✓     User-scoped (tightened)
--  marketplace_comments         ✓    ✓       ✓       ✓       ✓     Author+mod scoping
--  marketplace_collections      ✓    ✓       -       -       -     Public read-only
--  avatar_reports               ✓    ✓       -       ✓       -     Reporter + mod scoping
--  audit_log                    ✓    ✓       ✓       -       -     User + admin scoping
--  ai_org_policies              ✓    ✓       -       ✓       -     Org admin-scoped
--  ai_usage_monthly             ✓    ✓       -       -       -     Owner read-only
--  ai_request_log               ✓    ✓       -       -       -     Owner read-only
--  user_sessions                ✓    ✓       ✓       ✓       ✓     User-scoped
--  user_preferences             ✓    ✓       ✓       ✓       -     User-scoped
--  user_terms_log               ✓    ✓       ✓       -       -     User-scoped (immutable)
--  user_reports                 ✓    ✓       ✓       ✓       -     Reporter + mod scoping
--  student_verifications        ✓    ✓       ✓       -       -     User-scoped (INSERT added)
--  math_constants               ✓    ✓       -       -       -     Public read-only
--  simulation_runs              ✓    ✓       ✓       ✓       ✓     Owner-scoped
--  project_snapshots            ✓    ✓       ✓       -       ✓     Owner-scoped (immutable)
--  share_links                  ✓    ✓       ✓       ✓       ✓     Creator + public token read
--  node_comments                ✓    ✓       ✓       ✓       ✓     Owner-scoped
-- =========================================================================

COMMIT;
