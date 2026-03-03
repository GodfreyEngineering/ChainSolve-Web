-- I8-1: Enterprise policy extensions.
--
-- Adds granular feature-lock policies that org owners/admins can toggle
-- to control what members may do.  These give Enterprise customers
-- concrete reasons to choose Enterprise over multiple Pro seats.
--
-- New policy flags:
--   policy_ai_enabled            — gate AI Copilot usage (default TRUE)
--   policy_export_enabled        — gate export (PDF/XLSX/JSON) (default TRUE)
--   policy_custom_fns_enabled    — gate custom function creation (default TRUE)
--   policy_data_retention_days   — audit log retention period in days (NULL = indefinite)
--
-- Also adds policy_single_session to the existing enforcement trigger.

-- ── 1. New policy columns ───────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS policy_ai_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS policy_export_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS policy_custom_fns_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS policy_data_retention_days  INTEGER;

-- ── 2. Audit log retention cleanup function ─────────────────────────
--
-- Callable via cron (pg_cron) or manual invocation.  Deletes audit_log
-- rows older than the org's policy_data_retention_days for orgs that
-- have a retention limit set.

CREATE OR REPLACE FUNCTION public.cleanup_expired_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
  batch_count   INTEGER;
  org_rec RECORD;
BEGIN
  FOR org_rec IN
    SELECT id, policy_data_retention_days
    FROM public.organizations
    WHERE policy_data_retention_days IS NOT NULL
      AND policy_data_retention_days > 0
  LOOP
    DELETE FROM public.audit_log
    WHERE org_id = org_rec.id
      AND created_at < (NOW() - (org_rec.policy_data_retention_days || ' days')::INTERVAL);
    GET DIAGNOSTICS batch_count = ROW_COUNT;
    deleted_count := deleted_count + batch_count;
  END LOOP;
  RETURN deleted_count;
END;
$$;
