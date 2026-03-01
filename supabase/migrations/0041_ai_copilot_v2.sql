-- 0041_ai_copilot_v2.sql
-- AI-2: Enhanced enterprise controls + per-seat quotas + workflow task tracking.
--
-- Adds:
--   ai_org_policies.ai_enabled             — master toggle (org-wide)
--   ai_org_policies.ai_allowed_modes       — restrict modes (array of plan/edit/bypass)
--   ai_request_log.task                    — workflow task type
--
-- Privacy: No user prompts or AI responses are stored.

-- ── ai_org_policies: enterprise control columns ───────────────────────────────

ALTER TABLE public.ai_org_policies
  ADD COLUMN IF NOT EXISTS ai_enabled       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_allowed_modes text[]  NOT NULL DEFAULT ARRAY['plan','edit','bypass'];

-- Validate allowed_modes values.
ALTER TABLE public.ai_org_policies
  ADD CONSTRAINT ai_org_policies_modes_check
  CHECK (ai_allowed_modes <@ ARRAY['plan','edit','bypass']);

-- ── ai_request_log: task field for workflow tracking ──────────────────────────

ALTER TABLE public.ai_request_log
  ADD COLUMN IF NOT EXISTS task text NOT NULL DEFAULT 'chat'
  CHECK (task IN ('chat', 'fix_graph', 'explain_node', 'generate_template', 'generate_theme'));
