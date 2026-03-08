-- Migration 0008: Consolidated profile RPCs (V6 auth overhaul)
--
-- Problem: The RLS SELECT policy on profiles does not work in some Supabase
-- configurations, causing the client to be unable to read its own profile.
-- Previous migrations (0005–0007) tried workarounds but the fundamental
-- issue remains: direct table access via PostgREST is unreliable.
--
-- Solution: All auth-critical profile operations use SECURITY DEFINER RPCs
-- that bypass RLS entirely. This is safe because each RPC only operates on
-- the calling user's own row (auth.uid()).

-- ── 1. get_or_create_profile ─────────────────────────────────────────────────
-- Ensures the profile row exists and returns it as JSON.
-- Used by the frontend auth flow as the primary profile fetch method.

CREATE OR REPLACE FUNCTION public.get_or_create_profile()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid    uuid := auth.uid();
  _email  text;
  _meta   jsonb;
  _terms  text;
  _mktg   boolean;
  _result json;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create profile if missing (reads signup metadata from auth.users)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid) THEN
    SELECT email, raw_user_meta_data INTO _email, _meta
    FROM auth.users WHERE id = _uid;

    _terms := _meta ->> 'accepted_terms_version';
    _mktg  := COALESCE((_meta ->> 'marketing_opt_in')::boolean, false);

    INSERT INTO public.profiles (
      id, email,
      accepted_terms_version, accepted_terms_at,
      marketing_opt_in, marketing_opt_in_at
    ) VALUES (
      _uid, _email,
      _terms, CASE WHEN _terms IS NOT NULL THEN now() END,
      _mktg,  CASE WHEN _mktg THEN now() END
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_preferences (user_id)
    VALUES (_uid) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Return profile as JSON (bypasses RLS)
  SELECT row_to_json(t) INTO _result FROM (
    SELECT id, email, full_name, avatar_url,
           plan::text AS plan,
           stripe_customer_id, current_period_end,
           is_developer, is_admin, is_student,
           accepted_terms_version, accepted_terms_at,
           marketing_opt_in, marketing_opt_in_at,
           onboarding_completed_at
    FROM public.profiles
    WHERE id = _uid
  ) t;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_profile() TO authenticated;

-- ── 2. update_my_profile ─────────────────────────────────────────────────────
-- Updates display name and/or avatar URL for the calling user.

CREATE OR REPLACE FUNCTION public.update_my_profile(p_full_name text DEFAULT NULL, p_avatar_url text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles
  SET full_name  = COALESCE(p_full_name, full_name),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      updated_at = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text) TO authenticated;

-- ── 3. accept_my_terms ───────────────────────────────────────────────────────
-- Records that the calling user accepted the given ToS version.

CREATE OR REPLACE FUNCTION public.accept_my_terms(p_version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles
  SET accepted_terms_version = p_version,
      accepted_terms_at      = now(),
      updated_at             = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_my_terms(text) TO authenticated;

-- ── 4. complete_my_onboarding ────────────────────────────────────────────────
-- Marks the calling user's onboarding as complete.

CREATE OR REPLACE FUNCTION public.complete_my_onboarding()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles
  SET onboarding_completed_at = now(),
      updated_at              = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_my_onboarding() TO authenticated;

-- ── 5. update_my_marketing ───────────────────────────────────────────────────
-- Updates the calling user's marketing opt-in preference.

CREATE OR REPLACE FUNCTION public.update_my_marketing(p_opt_in boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles
  SET marketing_opt_in    = p_opt_in,
      marketing_opt_in_at = now(),
      updated_at          = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_marketing(boolean) TO authenticated;

-- ── 6. Re-apply RLS SELECT policy (idempotent) ──────────────────────────────
-- Uses auth.uid() directly (no subquery wrapper) for maximum compatibility.

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());
