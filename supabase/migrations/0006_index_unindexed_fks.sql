-- 0006_index_unindexed_fks.sql
--
-- Add indexes for public-schema foreign key columns that were flagged
-- as unindexed by the Supabase performance advisor.
--
-- Indexes are required on FK columns for efficient JOIN, ON DELETE CASCADE,
-- and ON UPDATE CASCADE operations. Without them, PostgreSQL falls back to
-- sequential scans on the child table for every parent-row modification.
--
-- All statements are idempotent (IF NOT EXISTS).

-- organizations
CREATE INDEX IF NOT EXISTS idx_organizations_owner
  ON public.organizations(owner_id);

-- org_members
CREATE INDEX IF NOT EXISTS idx_org_members_org
  ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_invited_by
  ON public.org_members(invited_by) WHERE invited_by IS NOT NULL;

-- csp_reports
CREATE INDEX IF NOT EXISTS idx_csp_reports_user
  ON public.csp_reports(user_id) WHERE user_id IS NOT NULL;

-- marketplace_likes
CREATE INDEX IF NOT EXISTS idx_mkt_likes_user
  ON public.marketplace_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_mkt_likes_item
  ON public.marketplace_likes(item_id);

-- avatar_reports
CREATE INDEX IF NOT EXISTS idx_avatar_reports_reporter
  ON public.avatar_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_avatar_reports_target
  ON public.avatar_reports(target_id);
CREATE INDEX IF NOT EXISTS idx_avatar_reports_resolved_by
  ON public.avatar_reports(resolved_by) WHERE resolved_by IS NOT NULL;

-- ai_usage_monthly
CREATE INDEX IF NOT EXISTS idx_ai_usage_monthly_org
  ON public.ai_usage_monthly(org_id) WHERE org_id IS NOT NULL;

-- ai_request_log
CREATE INDEX IF NOT EXISTS idx_ai_request_log_org
  ON public.ai_request_log(org_id) WHERE org_id IS NOT NULL;

-- user_reports
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter
  ON public.user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_resolved_by
  ON public.user_reports(resolved_by) WHERE resolved_by IS NOT NULL;

-- student_verifications
CREATE INDEX IF NOT EXISTS idx_student_verifications_user
  ON public.student_verifications(user_id);
