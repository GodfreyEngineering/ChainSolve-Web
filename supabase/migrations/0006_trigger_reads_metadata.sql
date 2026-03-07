-- Migration 0006: handle_new_user reads signup metadata
--
-- Problem: signUp() now passes accepted_terms_version and marketing_opt_in
-- as user_metadata. The trigger must read these from raw_user_meta_data
-- and persist them to the profiles row at creation time, eliminating the
-- need for a separate AuthGate ToS screen on first signup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _terms text;
  _mktg  boolean;
BEGIN
  _terms := NEW.raw_user_meta_data ->> 'accepted_terms_version';
  _mktg  := COALESCE((NEW.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false);

  INSERT INTO public.profiles (
    id, email,
    accepted_terms_version, accepted_terms_at,
    marketing_opt_in, marketing_opt_in_at
  )
  VALUES (
    NEW.id, NEW.email,
    _terms, CASE WHEN _terms IS NOT NULL THEN now() END,
    _mktg,  CASE WHEN _mktg THEN now() END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
