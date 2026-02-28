-- Migration: 0020_marketplace_version_semver
-- P107: Enforce semver format (MAJOR.MINOR.PATCH) on marketplace_items.version.
--
-- The regex '^\d+\.\d+\.\d+$' matches exactly X.Y.Z where each component
-- is one or more digits. Pre-release suffixes (e.g. -alpha, +build) are
-- intentionally rejected to keep version comparison simple.

ALTER TABLE marketplace_items
  ADD CONSTRAINT marketplace_items_version_semver
  CHECK (version ~ '^\d+\.\d+\.\d+$');
