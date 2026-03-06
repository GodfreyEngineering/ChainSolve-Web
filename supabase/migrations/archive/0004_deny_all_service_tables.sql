-- 0004_deny_all_service_tables.sql
--
-- Add explicit deny-all RLS policies for service-role-only tables.
-- These tables have RLS enabled but (on pre-baseline databases) no policies,
-- triggering Supabase advisor "rls_enabled_no_policy" warnings.
--
-- Implicit deny (RLS on + zero policies) already blocks access, but explicit
-- policies document intent and silence advisor warnings.

-- observability_events: written by service_role from /api/report/csp and /api/report/client
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'observability_events'
      AND policyname = 'obs_events_deny_all'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY obs_events_deny_all ON public.observability_events
        FOR ALL TO authenticated
        USING (false) WITH CHECK (false)
    $pol$;
  END IF;
END
$$;

-- stripe_events: written by service_role from /api/stripe/webhook
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'stripe_events'
      AND policyname = 'stripe_events_deny_all'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY stripe_events_deny_all ON public.stripe_events
        FOR ALL TO authenticated
        USING (false) WITH CHECK (false)
    $pol$;
  END IF;
END
$$;
