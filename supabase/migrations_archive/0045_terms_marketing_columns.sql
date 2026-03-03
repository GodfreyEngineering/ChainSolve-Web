-- E2-3: Email verification + ToS versioning
-- Add ToS acceptance and marketing opt-in tracking columns to profiles.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS accepted_terms_version text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accepted_terms_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN profiles.accepted_terms_version IS 'Semantic version of ToS the user accepted (e.g. 1.0)';
COMMENT ON COLUMN profiles.accepted_terms_at IS 'Timestamp when the user accepted the current ToS';
COMMENT ON COLUMN profiles.marketing_opt_in IS 'Whether the user opted in to marketing emails';
COMMENT ON COLUMN profiles.marketing_opt_in_at IS 'Timestamp when marketing opt-in was last changed';
