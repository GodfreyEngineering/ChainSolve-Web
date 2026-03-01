-- 0039_avatar_reports.sql
-- D12-2: Avatar moderation — report + review infrastructure.
--
-- Any authenticated user can report another user's avatar.
-- Moderators (profiles.is_moderator = true) can review and resolve reports
-- and remove offending avatars.

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.avatar_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text        NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_report CHECK (reporter_id <> target_id)
);

-- One pending report per reporter/target pair (prevent spam).
CREATE UNIQUE INDEX avatar_reports_pending_uniq
  ON public.avatar_reports (reporter_id, target_id)
  WHERE status = 'pending';

ALTER TABLE public.avatar_reports ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ─────────────────────────────────────────────────────────────

-- Any authenticated user can create a report.
CREATE POLICY avatar_reports_insert ON public.avatar_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()));

-- Users can see their own reports.
CREATE POLICY avatar_reports_own_select ON public.avatar_reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = (SELECT auth.uid()));

-- Moderators can see all reports.
CREATE POLICY avatar_reports_mod_select ON public.avatar_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_moderator = true
    )
  );

-- Moderators can update reports (resolve/dismiss).
CREATE POLICY avatar_reports_mod_update ON public.avatar_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_moderator = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND is_moderator = true
    )
  );

-- Moderators can remove a user's avatar (update profiles.avatar_url to null).
-- This leverages the existing profile update mechanism — moderators already
-- have their own profile update path. We add a specific policy for clearing
-- another user's avatar_url.
CREATE POLICY profiles_mod_clear_avatar ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_moderator = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_moderator = true
    )
  );
