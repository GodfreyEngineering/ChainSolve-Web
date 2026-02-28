-- D10-2: Enterprise policy flags on organizations
--
-- Three boolean policy columns on the organizations table, all default TRUE.
-- Org owners/admins can toggle these to control:
--   - Explore visibility for org members
--   - Install permissions for org members
--   - Comment permissions for org members

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS policy_explore_enabled  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS policy_installs_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS policy_comments_allowed boolean NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
