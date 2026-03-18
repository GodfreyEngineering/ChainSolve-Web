-- 0020_user_consents: GDPR consent audit table (16.80)
--
-- Records every discrete consent event for GDPR Art. 7 evidence.
-- This table is append-only (no UPDATE/DELETE) — a new row is inserted
-- each time the user grants or withdraws consent.
--
-- Consent types:
--   tos_accepted         - Terms of Service acceptance
--   privacy_accepted     - Privacy Policy acknowledgment (implied by tos_accepted)
--   cookie_analytics     - Consent to analytics/error-reporting cookies
--   cookie_marketing     - Consent to marketing cookies (currently none used)
--   marketing_email      - Opt-in/opt-out to marketing emails
--
-- The 'granted' column distinguishes consent from withdrawal.

SET search_path = public;

CREATE TABLE IF NOT EXISTS public.user_consents (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- NULL user_id allowed for pre-auth consent (e.g. cookie banner before login)
  consent_type     text          NOT NULL,
  granted          boolean       NOT NULL,       -- true = consent given; false = withdrawn
  document_version text,                         -- ToS/Privacy version number if applicable
  ip_address       inet,
  user_agent       text,
  created_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT user_consents_consent_type_check CHECK (
    consent_type IN (
      'tos_accepted',
      'privacy_accepted',
      'cookie_analytics',
      'cookie_marketing',
      'marketing_email'
    )
  )
);

COMMENT ON TABLE public.user_consents IS
  'Append-only GDPR consent audit log. Records every consent grant/withdrawal event. '
  'Never delete or update rows — insert a new withdrawal row instead.';

COMMENT ON COLUMN public.user_consents.granted IS
  'true = user gave consent; false = user withdrew consent.';

COMMENT ON COLUMN public.user_consents.document_version IS
  'For tos_accepted/privacy_accepted: the version string of the document accepted (e.g. "1.0").';

-- Index for querying a user's consent history
CREATE INDEX IF NOT EXISTS user_consents_user_id_idx
  ON public.user_consents (user_id, consent_type, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Index for querying pre-auth cookie consents by IP (GDPR evidence)
CREATE INDEX IF NOT EXISTS user_consents_created_at_idx
  ON public.user_consents (created_at DESC);

-- RLS: Enable row level security
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Users can read their own consent history
CREATE POLICY "users_read_own_consents"
  ON public.user_consents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own consent records
CREATE POLICY "users_insert_own_consents"
  ON public.user_consents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
-- NULL user_id is allowed for pre-auth cookie consent records

-- Audit: make clear this table is append-only in migrations
DO $$
BEGIN
  RAISE NOTICE '0020_user_consents: GDPR consent audit table created.';
END $$;
