-- 0003_fix_function_search_path.sql
--
-- Fix Supabase security advisor "function_search_path_mutable" warnings.
-- All SECURITY DEFINER functions must pin search_path to prevent
-- privilege-escalation via schema injection.
--
-- Already fixed: handle_canvases_updated_at (baseline has SET search_path).
-- Fixed here:    enforce_comment_rate_limit, enforce_org_install_policy,
--                enforce_org_comment_policy, cleanup_expired_audit_logs.

-- 1. enforce_comment_rate_limit
CREATE OR REPLACE FUNCTION public.enforce_comment_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
    FROM public.marketplace_comments
   WHERE user_id = NEW.user_id AND created_at > now() - interval '60 seconds';
  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded — max 5 per minute' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. enforce_org_install_policy
CREATE OR REPLACE FUNCTION public.enforce_org_install_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.org_members om
    JOIN public.organizations o ON o.id = om.org_id
    WHERE om.user_id = NEW.user_id AND o.policy_installs_allowed = false
  ) THEN
    RAISE EXCEPTION 'Organization policy prohibits marketplace installs' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. enforce_org_comment_policy
CREATE OR REPLACE FUNCTION public.enforce_org_comment_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.org_members om
    JOIN public.organizations o ON o.id = om.org_id
    WHERE om.user_id = NEW.user_id AND o.policy_comments_allowed = false
  ) THEN
    RAISE EXCEPTION 'Organization policy prohibits marketplace comments' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. cleanup_expired_audit_logs
CREATE OR REPLACE FUNCTION public.cleanup_expired_audit_logs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted_count integer := 0;
  batch_count   integer;
  org_rec       record;
BEGIN
  FOR org_rec IN
    SELECT id, policy_data_retention_days FROM public.organizations
    WHERE policy_data_retention_days IS NOT NULL AND policy_data_retention_days > 0
  LOOP
    DELETE FROM public.audit_log
    WHERE org_id = org_rec.id
      AND created_at < (now() - (org_rec.policy_data_retention_days || ' days')::interval);
    GET DIAGNOSTICS batch_count = ROW_COUNT;
    deleted_count := deleted_count + batch_count;
  END LOOP;
  RETURN deleted_count;
END;
$$;
