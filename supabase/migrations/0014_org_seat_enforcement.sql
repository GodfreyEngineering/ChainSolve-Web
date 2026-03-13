-- ============================================================
-- 0014_org_seat_enforcement.sql
-- ChainSolve — Enforce max_seats at DB level for org_members.
--
-- Currently enforcement is application-only. This trigger
-- prevents INSERT on org_members if the org has reached its
-- max_seats limit. Idempotent — safe to run multiple times.
-- ============================================================

BEGIN;

-- =========================================================================
-- 1. Trigger function: enforce org seat limit on INSERT
-- =========================================================================

CREATE OR REPLACE FUNCTION public.enforce_org_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _max_seats int;
  _current_count int;
BEGIN
  -- Get the org's seat limit
  SELECT max_seats INTO _max_seats
    FROM public.organizations
   WHERE id = NEW.org_id;

  -- If org not found or no limit set, allow
  IF _max_seats IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count current members (excluding this insert)
  SELECT count(*) INTO _current_count
    FROM public.org_members
   WHERE org_id = NEW.org_id;

  IF _current_count >= _max_seats THEN
    RAISE EXCEPTION 'Organization has reached its maximum seat limit (%)', _max_seats
      USING ERRCODE = 'P0001',
            HINT = 'Upgrade the organization plan to add more seats.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_org_seat_limit IS
  'BEFORE INSERT trigger on org_members: prevents adding members beyond organizations.max_seats.';

-- =========================================================================
-- 2. Attach trigger to org_members
-- =========================================================================

DROP TRIGGER IF EXISTS trg_enforce_org_seat_limit ON public.org_members;
CREATE TRIGGER trg_enforce_org_seat_limit
  BEFORE INSERT ON public.org_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_org_seat_limit();

COMMIT;
