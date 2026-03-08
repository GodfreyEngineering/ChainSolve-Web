-- Migration 0007: get_my_profile RPC
--
-- Problem: RLS SELECT policy on profiles blocks the client from reading its
-- own profile row after ensure_profile creates it. Rather than debugging the
-- policy (which varies across Supabase project configurations), provide a
-- SECURITY DEFINER RPC that both ensures the profile exists AND returns it.
-- This bypasses the SELECT policy entirely since SECURITY DEFINER runs as
-- the function owner (postgres), not the caller.

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid    uuid := auth.uid();
  _email  text;
  _result json;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Ensure profile row exists (same logic as ensure_profile)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid) THEN
    SELECT email INTO _email FROM auth.users WHERE id = _uid;

    INSERT INTO public.profiles (id, email)
    VALUES (_uid, _email)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_preferences (user_id)
    VALUES (_uid)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Return the profile as JSON (bypasses RLS)
  SELECT row_to_json(t) INTO _result
  FROM (
    SELECT id, email, full_name, plan::text AS plan,
           stripe_customer_id, current_period_end,
           is_developer, is_admin, is_student,
           accepted_terms_version, marketing_opt_in,
           onboarding_completed_at
    FROM public.profiles
    WHERE id = _uid
  ) t;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
