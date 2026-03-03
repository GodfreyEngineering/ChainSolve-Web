-- E10-3: Server-side enforcement of org policy flags.
--
-- Prevents marketplace installs and comments when the user's org
-- has disabled the corresponding policy flag.
-- Conservative approach: if ANY org the user belongs to has the policy
-- disabled, the action is blocked.

-- ── Install policy enforcement ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_org_install_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.organizations o ON o.id = om.org_id
    WHERE om.user_id = NEW.user_id
      AND o.policy_installs_allowed = false
  ) THEN
    RAISE EXCEPTION 'Organization policy prohibits marketplace installs'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_org_install_policy
  BEFORE INSERT ON public.marketplace_install_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_install_policy();

-- ── Comment policy enforcement ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_org_comment_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.organizations o ON o.id = om.org_id
    WHERE om.user_id = NEW.user_id
      AND o.policy_comments_allowed = false
  ) THEN
    RAISE EXCEPTION 'Organization policy prohibits marketplace comments'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_org_comment_policy
  BEFORE INSERT ON public.marketplace_comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_comment_policy();
