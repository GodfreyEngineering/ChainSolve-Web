-- 0015_project_variables.sql — Project-level variables JSONB column (W12.2)
--
-- Adds a `variables` JSONB column to the `projects` table.
-- Variables are scalar values shared across all canvases in a project.
-- Format: { "varId": { "id": "...", "name": "...", "value": 0, "description": "..." }, ... }

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS variables jsonb NOT NULL DEFAULT '{}'::jsonb;
