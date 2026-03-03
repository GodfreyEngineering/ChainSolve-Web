-- 0052_user_data_model.sql — J0-1: Fresh-state user data model.
--
-- Creates three new tables for the Phase J auth/profiles overhaul:
--   1. user_preferences  — locale, theme, editor layout defaults
--   2. user_terms_log    — immutable audit log of every ToS acceptance
--   3. user_reports      — unified content reporting (names, avatars, comments)
--
-- Also updates the handle_new_user() trigger to auto-create a
-- default user_preferences row on signup.

BEGIN;

-- ── 1. user_preferences ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  locale     text NOT NULL DEFAULT 'en',
  theme      text NOT NULL DEFAULT 'system'
               CHECK (theme IN ('light', 'dark', 'system')),
  region     text,
  editor_layout   text NOT NULL DEFAULT 'default'
               CHECK (editor_layout IN ('default', 'compact', 'wide')),
  sidebar_collapsed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_preferences IS 'Per-user UI/locale preferences. One row per user, auto-created on signup.';

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_select_own ON public.user_preferences
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY user_preferences_update_own ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ── 2. user_terms_log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_terms_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  terms_version  text NOT NULL,
  accepted_at    timestamptz NOT NULL DEFAULT now(),
  ip_address     inet,
  user_agent     text
);

COMMENT ON TABLE public.user_terms_log IS 'Immutable audit log of every ToS acceptance. One row per version per user.';

CREATE INDEX IF NOT EXISTS idx_user_terms_log_user
  ON public.user_terms_log (user_id, accepted_at DESC);

ALTER TABLE public.user_terms_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own acceptance history.
CREATE POLICY user_terms_log_select_own ON public.user_terms_log
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Users can insert their own acceptance records.
CREATE POLICY user_terms_log_insert_own ON public.user_terms_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- No UPDATE or DELETE — this is an append-only audit log.

-- ── 3. user_reports ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type  text NOT NULL CHECK (target_type IN ('display_name', 'avatar', 'comment', 'marketplace_item')),
  target_id    text NOT NULL,
  reason       text NOT NULL CHECK (char_length(reason) <= 1000),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by  uuid REFERENCES public.profiles(id),
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- One pending report per reporter + target pair.
  CONSTRAINT user_reports_unique_pending
    EXCLUDE USING btree (reporter_id WITH =, target_type WITH =, target_id WITH =)
    WHERE (status = 'pending')
);

COMMENT ON TABLE public.user_reports IS 'Unified content reporting for offensive names, avatars, comments, and items.';

CREATE INDEX IF NOT EXISTS idx_user_reports_status
  ON public.user_reports (status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_user_reports_target
  ON public.user_reports (target_type, target_id);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert reports (but not for themselves — enforced in app code).
CREATE POLICY user_reports_insert_own ON public.user_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (select auth.uid()));

-- Users can view their own reports.
CREATE POLICY user_reports_select_own ON public.user_reports
  FOR SELECT TO authenticated
  USING (reporter_id = (select auth.uid()));

-- Moderators/admins can view all pending reports.
CREATE POLICY user_reports_select_mod ON public.user_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND (is_admin = true OR is_developer = true)
    )
  );

-- Moderators/admins can update report status.
CREATE POLICY user_reports_update_mod ON public.user_reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND (is_admin = true OR is_developer = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND (is_admin = true OR is_developer = true)
    )
  );

-- ── 4. Update handle_new_user trigger ───────────────────────────────────────
-- Now also creates a default user_preferences row on signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;
