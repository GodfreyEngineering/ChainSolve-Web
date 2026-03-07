-- Migration 0005: ensure_profile RPC
--
-- Problem: handle_new_user() trigger on auth.users INSERT creates the profile
-- row, but if it fails or the user was created before the trigger existed,
-- there is no profile row. The client has no INSERT policy on profiles
-- (by design — users shouldn't create arbitrary profiles), so it can't
-- self-heal. The user gets stuck on the "Setting up your account" screen.
--
-- Solution: A SECURITY DEFINER RPC that the authenticated user can call to
-- create their own profile row if it doesn't exist. It only creates a row
-- for the calling user (auth.uid()), so it cannot be abused.

-- 1. RPC: ensure_profile — creates the caller's profile row if missing
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid   uuid := auth.uid();
  _email text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if profile already exists (fast path)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid) THEN
    RETURN;
  END IF;

  -- Look up the email from auth.users
  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  -- Insert the profile row (ON CONFLICT for race-safety)
  INSERT INTO public.profiles (id, email)
  VALUES (_uid, _email)
  ON CONFLICT (id) DO NOTHING;

  -- Also create user_preferences if missing
  INSERT INTO public.user_preferences (user_id)
  VALUES (_uid)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;

-- 2. Backfill: create profile rows for any auth.users missing them
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Also backfill user_preferences
INSERT INTO public.user_preferences (user_id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.user_preferences up ON up.user_id = u.id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
