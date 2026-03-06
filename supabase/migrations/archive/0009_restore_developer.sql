-- ============================================================
-- 0009_restore_developer.sql
--
-- Ensures the developer account gets is_developer=true
-- automatically when created (survives DB wipes).
--
-- Uses an AFTER INSERT trigger on profiles so the flag is set
-- as soon as the profile row is created by the auth trigger.
-- ============================================================

BEGIN;

-- Trigger function: auto-set is_developer for known dev email
CREATE OR REPLACE FUNCTION public.fn_auto_developer_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'ben.godfrey@chainsolve.co.uk' THEN
    NEW.is_developer := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Use BEFORE INSERT so we can modify the row before it's written
DROP TRIGGER IF EXISTS trg_auto_developer_flag ON public.profiles;
CREATE TRIGGER trg_auto_developer_flag
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_developer_flag();

-- Also fix any existing row (in case profile was already re-created)
UPDATE public.profiles
SET is_developer = true
WHERE email = 'ben.godfrey@chainsolve.co.uk'
  AND is_developer IS NOT TRUE;

COMMIT;
