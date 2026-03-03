-- Migration: 0019_marketplace_payload
-- P106: Add payload column to marketplace_items for template project data.
--
-- For category='template' the payload stores a ProjectJSON snapshot that is
-- forked (copied) into a user's project list on install.
-- Other categories (block_pack, theme) reserve the column for future use.

ALTER TABLE marketplace_items
  ADD COLUMN IF NOT EXISTS payload JSONB;

COMMENT ON COLUMN marketplace_items.payload IS
  'category=template: ProjectJSON snapshot forked into user projects on install. '
  'Other categories: reserved for future use.';
