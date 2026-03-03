-- E2-6: Developer/admin role flags on profiles.
--
-- is_developer: all features unlocked, admin tools, diagnostics
-- is_admin:     moderation tools, admin panels
--
-- Users cannot self-promote — only service_role (or direct SQL) can set these.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_developer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_admin     BOOLEAN NOT NULL DEFAULT FALSE;

-- Prevent users from setting their own developer/admin flags.
-- The existing "Users can update their own profile" policy allows updates
-- to all columns. We add a restrictive policy that blocks role escalation.
-- Note: Supabase RLS WITH CHECK fails the entire update if any column
-- violates the check, so we rely on the UPDATE policy's WITH CHECK.
--
-- Strategy: drop the permissive self-update policy and replace it with one
-- that freezes is_developer and is_admin to their current values.

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

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
  );
