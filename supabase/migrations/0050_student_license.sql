-- I7-1: Student license flow — schema additions.
--
-- Adds is_student flag, student metadata columns, and a pending
-- verification table.  University email verification sets is_student
-- = TRUE, which resolveEffectivePlan() maps to the "student" plan
-- (identical entitlements to pro, zero cost).
--
-- Extends the plan_status enum with 'student' and 'enterprise' values
-- that are already used in the TS layer.

-- ── 1. Extend plan_status enum ──────────────────────────────────────

ALTER TYPE plan_status ADD VALUE IF NOT EXISTS 'student';
ALTER TYPE plan_status ADD VALUE IF NOT EXISTS 'enterprise';

-- ── 2. Add student columns to profiles ──────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_student          BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS student_email       TEXT,
  ADD COLUMN IF NOT EXISTS student_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS student_expires_at  TIMESTAMPTZ;

-- ── 3. Prevent self-promotion via is_student ────────────────────────
--
-- Replace the existing role-escalation policy to also freeze is_student.

DROP POLICY IF EXISTS "Users can update own profile (no role escalation)" ON public.profiles;

CREATE POLICY "Users can update own profile (no role escalation)"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING  (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND is_developer IS NOT DISTINCT FROM (
      SELECT p.is_developer FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    )
    AND is_admin IS NOT DISTINCT FROM (
      SELECT p.is_admin FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    )
    AND is_student IS NOT DISTINCT FROM (
      SELECT p.is_student FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    )
  );

-- ── 4. Student verification requests table ──────────────────────────
--
-- Stores pending verification codes.  Each row represents a single
-- verification attempt.  Rows are consumed on confirmation or expire.

CREATE TABLE IF NOT EXISTS public.student_verifications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  university_email TEXT        NOT NULL,
  code_hash        TEXT        NOT NULL,       -- SHA-256 of the 6-digit code
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  confirmed_at     TIMESTAMPTZ,                -- set when code is verified
  CONSTRAINT student_verif_no_empty_email CHECK (university_email <> '')
);

-- RLS: users can only read their own verification rows.
ALTER TABLE public.student_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own verifications"
  ON public.student_verifications
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Only service_role can insert/update/delete (server functions do this).
-- No permissive INSERT/UPDATE/DELETE policies for authenticated users.
