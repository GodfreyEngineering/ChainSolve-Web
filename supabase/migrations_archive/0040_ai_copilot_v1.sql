-- 0040_ai_copilot_v1.sql
-- AI-1: ChainSolve Copilot — AI-assisted graph building for Pro/Enterprise.
--
-- Tables:
--   ai_org_policies      — per-org AI policy (bypass, token budget)
--   ai_usage_monthly     — per-user monthly token counters
--   ai_request_log       — request metadata (NO content/prompts)
--
-- Privacy: No user prompts or AI responses are stored.

-- ── ai_org_policies ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_org_policies (
  org_id              uuid        PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  allow_bypass        boolean     NOT NULL DEFAULT false,
  allow_explore       boolean     NOT NULL DEFAULT true,
  monthly_token_limit_per_seat  int NOT NULL DEFAULT 200000
    CHECK (monthly_token_limit_per_seat > 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_org_policies ENABLE ROW LEVEL SECURITY;

-- Org owners and admins can read their org's AI policy.
CREATE POLICY ai_org_policies_select ON public.ai_org_policies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = ai_org_policies.org_id
        AND org_members.user_id = (SELECT auth.uid())
    )
  );

-- Only org owners can update the AI policy.
CREATE POLICY ai_org_policies_update ON public.ai_org_policies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = ai_org_policies.org_id
        AND org_members.user_id = (SELECT auth.uid())
        AND org_members.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = ai_org_policies.org_id
        AND org_members.user_id = (SELECT auth.uid())
        AND org_members.role = 'owner'
    )
  );

-- ── ai_usage_monthly ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage_monthly (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start    date        NOT NULL,
  tokens_in       bigint      NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out      bigint      NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  requests        int         NOT NULL DEFAULT 0 CHECK (requests >= 0),
  last_request_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_monthly_unique UNIQUE (owner_id, org_id, period_start)
);

ALTER TABLE public.ai_usage_monthly ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage rows.
CREATE POLICY ai_usage_monthly_select ON public.ai_usage_monthly
  FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Inserts and updates are done via service_role only (from the API route).
-- No insert/update policy for authenticated users — server uses service_role key.

CREATE INDEX IF NOT EXISTS idx_ai_usage_monthly_owner_period
  ON public.ai_usage_monthly (owner_id, period_start);

-- ── ai_request_log ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  mode            text        NOT NULL CHECK (mode IN ('plan', 'edit', 'bypass')),
  model           text        NOT NULL,
  tokens_in       bigint      NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out      bigint      NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  ops_count       int         NOT NULL DEFAULT 0 CHECK (ops_count >= 0),
  risk_level      text        NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  response_id     text,
  error_code      text
);

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own log rows.
CREATE POLICY ai_request_log_select ON public.ai_request_log
  FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Inserts are done via service_role only.

CREATE INDEX IF NOT EXISTS idx_ai_request_log_owner_created
  ON public.ai_request_log (owner_id, created_at DESC);

-- ── Auto-update triggers ────────────────────────────────────────────────────

CREATE TRIGGER set_ai_org_policies_updated_at
  BEFORE UPDATE ON public.ai_org_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_ai_usage_monthly_updated_at
  BEFORE UPDATE ON public.ai_usage_monthly
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();
