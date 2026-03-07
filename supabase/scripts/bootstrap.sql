-- ============================================================
-- ChainSolve — Idempotent Bootstrap Script
--
-- Disaster-recovery script. Paste into Supabase Dashboard >
-- SQL Editor > Run to rebuild the entire schema from scratch.
--
-- SAFE TO RUN MULTIPLE TIMES: uses DROP IF EXISTS / CREATE IF
-- NOT EXISTS throughout. Will not destroy existing data.
--
-- For normal development, use `supabase db reset` instead
-- (which runs supabase/migrations/0001_baseline.sql).
--
-- Prerequisites:
--   - Supabase project with auth.users enabled
--   - Run as service_role / postgres superuser
-- ============================================================


-- =========================================================================
-- 1. ENUM TYPES
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_status') THEN
    CREATE TYPE public.plan_status AS ENUM (
      'free', 'trialing', 'pro', 'past_due', 'canceled', 'student', 'enterprise'
    );
  END IF;
END
$$;

ALTER TYPE public.plan_status ADD VALUE IF NOT EXISTS 'student';
ALTER TYPE public.plan_status ADD VALUE IF NOT EXISTS 'enterprise';


-- =========================================================================
-- 2. CORE TABLES
-- =========================================================================

-- 2a. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id                      uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   text,
  full_name               text,
  avatar_url              text,
  plan                    plan_status   NOT NULL DEFAULT 'free',
  stripe_customer_id      text          UNIQUE,
  stripe_subscription_id  text,
  current_period_end      timestamptz,
  is_developer            boolean       NOT NULL DEFAULT false,
  is_admin                boolean       NOT NULL DEFAULT false,
  is_moderator            boolean       NOT NULL DEFAULT false,
  verified_author         boolean       NOT NULL DEFAULT false,
  stripe_account_id       text,
  stripe_onboarded        boolean       NOT NULL DEFAULT false,
  accepted_terms_version  text,
  accepted_terms_at       timestamptz,
  marketing_opt_in        boolean       NOT NULL DEFAULT false,
  marketing_opt_in_at     timestamptz,
  is_student              boolean       NOT NULL DEFAULT false,
  student_email           text,
  student_verified_at     timestamptz,
  student_expires_at      timestamptz,
  onboarding_completed_at timestamptz,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_full_name_length;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_full_name_length
    CHECK (full_name IS NULL OR char_length(full_name) <= 100);
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_length;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_length
    CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048);
END $$;

-- 2b. organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text          NOT NULL
                              CHECK (char_length(name) >= 1 AND char_length(name) <= 80),
  owner_id                  uuid          NOT NULL
                              REFERENCES public.profiles(id) ON DELETE RESTRICT,
  policy_explore_enabled    boolean       NOT NULL DEFAULT true,
  policy_installs_allowed   boolean       NOT NULL DEFAULT true,
  policy_comments_allowed   boolean       NOT NULL DEFAULT true,
  policy_ai_enabled         boolean       NOT NULL DEFAULT true,
  policy_export_enabled     boolean       NOT NULL DEFAULT true,
  policy_custom_fns_enabled boolean       NOT NULL DEFAULT true,
  policy_data_retention_days integer,
  max_seats                 int           DEFAULT 10,
  created_at                timestamptz   NOT NULL DEFAULT now(),
  updated_at                timestamptz   NOT NULL DEFAULT now()
);

-- 2c. org_members
CREATE TABLE IF NOT EXISTS public.org_members (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid          NOT NULL
                REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     uuid          NOT NULL
                REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text          NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner', 'admin', 'member')),
  invited_by  uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- 2d. projects
CREATE TABLE IF NOT EXISTS public.projects (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              text          NOT NULL,
  description       text,
  storage_key       text,
  active_canvas_id  uuid,
  variables         jsonb         NOT NULL DEFAULT '{}'::jsonb,
  org_id            uuid          REFERENCES public.organizations(id) ON DELETE SET NULL,
  folder            text,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_name_length;
  ALTER TABLE public.projects ADD CONSTRAINT projects_name_length
    CHECK (char_length(name) >= 1 AND char_length(name) <= 100);
  ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_description_length;
  ALTER TABLE public.projects ADD CONSTRAINT projects_description_length
    CHECK (description IS NULL OR char_length(description) <= 500);
  ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_owner_name_unique;
  ALTER TABLE public.projects ADD CONSTRAINT projects_owner_name_unique UNIQUE (owner_id, name);
  ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_name_safe;
  ALTER TABLE public.projects ADD CONSTRAINT projects_name_safe
    CHECK (name ~ '^[^\x00-\x1F\x7F/\\:*?"<>|]+$' AND char_length(trim(name)) >= 1);
  ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_folder_safe;
  ALTER TABLE public.projects ADD CONSTRAINT projects_folder_safe
    CHECK (folder IS NULL OR (
      char_length(folder) >= 1 AND char_length(folder) <= 100
      AND folder ~ '^[^\x00-\x1F\x7F/\\:*?"<>|]+$'
    ));
END $$;

-- 2e. canvases
CREATE TABLE IF NOT EXISTS public.canvases (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text          NOT NULL,
  position      int           NOT NULL,
  storage_path  text          NOT NULL,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT canvases_project_position_unique UNIQUE (project_id, position)
);

DO $$ BEGIN
  ALTER TABLE public.canvases DROP CONSTRAINT IF EXISTS canvases_name_length;
  ALTER TABLE public.canvases ADD CONSTRAINT canvases_name_length
    CHECK (char_length(name) >= 1 AND char_length(name) <= 100);
  ALTER TABLE public.canvases DROP CONSTRAINT IF EXISTS canvases_name_safe;
  ALTER TABLE public.canvases ADD CONSTRAINT canvases_name_safe
    CHECK (name ~ '^[^\x00-\x1F\x7F/\\:*?"<>|]+$' AND char_length(trim(name)) >= 1);
END $$;

-- 2f. fs_items
CREATE TABLE IF NOT EXISTS public.fs_items (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id   uuid          REFERENCES public.fs_items(id) ON DELETE CASCADE,
  name        text          NOT NULL,
  type        text          NOT NULL CHECK (type IN ('file', 'folder')),
  content     text,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

-- 2g. project_assets
CREATE TABLE IF NOT EXISTS public.project_assets (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id       uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          text          NOT NULL,
  storage_path  text          NOT NULL,
  mime_type     text,
  size          bigint,
  kind          text,
  sha256        text,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

-- 2h. stripe_events
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id          text          PRIMARY KEY,
  type        text          NOT NULL,
  payload     jsonb         NOT NULL,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- 2i. bug_reports
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           text          NOT NULL,
  description     text          NOT NULL DEFAULT '',
  metadata        jsonb         NOT NULL DEFAULT '{}',
  screenshot_path text,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.bug_reports DROP CONSTRAINT IF EXISTS bug_reports_title_length;
  ALTER TABLE public.bug_reports ADD CONSTRAINT bug_reports_title_length
    CHECK (char_length(title) >= 1 AND char_length(title) <= 200);
END $$;

-- 2j. suggestions
CREATE TABLE IF NOT EXISTS public.suggestions (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category    text          NOT NULL DEFAULT 'feature_request',
  title       text          NOT NULL,
  description text          NOT NULL DEFAULT '',
  metadata    jsonb         NOT NULL DEFAULT '{}',
  created_at  timestamptz   NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.suggestions DROP CONSTRAINT IF EXISTS suggestions_title_length;
  ALTER TABLE public.suggestions ADD CONSTRAINT suggestions_title_length
    CHECK (char_length(title) >= 1 AND char_length(title) <= 200);
END $$;

-- 2k. group_templates
CREATE TABLE IF NOT EXISTS public.group_templates (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text          NOT NULL,
  color       text          NOT NULL DEFAULT '#1CABB0',
  payload     jsonb         NOT NULL,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.group_templates DROP CONSTRAINT IF EXISTS group_templates_name_length;
  ALTER TABLE public.group_templates ADD CONSTRAINT group_templates_name_length
    CHECK (char_length(name) >= 1 AND char_length(name) <= 100);
END $$;

-- 2l. csp_reports
CREATE TABLE IF NOT EXISTS public.csp_reports (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz   NOT NULL DEFAULT now(),
  user_id               uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  page                  text,
  document_uri          text,
  referrer              text,
  violated_directive    text,
  effective_directive   text,
  original_policy       text,
  blocked_uri           text,
  disposition           text,
  user_agent            text,
  raw                   jsonb         NOT NULL DEFAULT '{}',
  dedup_key             text          UNIQUE
);

-- 2m. observability_events
CREATE TABLE IF NOT EXISTS public.observability_events (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  ts            timestamptz   NOT NULL,
  env           text          NOT NULL CHECK (length(env) <= 32),
  app_version   text,
  event_type    text          NOT NULL CHECK (length(event_type) <= 64),
  user_id       uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id    uuid,
  route_path    text,
  fingerprint   text,
  payload       jsonb         NOT NULL DEFAULT '{}',
  tags          jsonb         NOT NULL DEFAULT '{}',
  cf            jsonb         NOT NULL DEFAULT '{}',
  created_at    timestamptz   NOT NULL DEFAULT now()
);

-- 2n. marketplace_items
CREATE TABLE IF NOT EXISTS public.marketplace_items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text          NOT NULL,
  description     text,
  category        text          NOT NULL DEFAULT 'template',
  version         text          NOT NULL DEFAULT '1.0.0',
  thumbnail_url   text,
  payload         jsonb,
  downloads_count int           NOT NULL DEFAULT 0,
  likes_count     int           NOT NULL DEFAULT 0,
  comments_count  int           NOT NULL DEFAULT 0,
  is_published    boolean       NOT NULL DEFAULT false,
  review_status   text          NOT NULL DEFAULT 'pending'
                    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  price_cents     integer       NOT NULL DEFAULT 0
                    CHECK (price_cents >= 0),
  tags            text[]        NOT NULL DEFAULT '{}',
  org_id          uuid          REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_official     boolean       NOT NULL DEFAULT false,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_items_version_semver CHECK (version ~ '^\d+\.\d+\.\d+$')
);

-- 2o. marketplace_purchases
CREATE TABLE IF NOT EXISTS public.marketplace_purchases (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id       uuid          NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  installed_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

-- 2p. marketplace_install_events
CREATE TABLE IF NOT EXISTS public.marketplace_install_events (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid          NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  user_id     uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type  text          NOT NULL CHECK (event_type IN ('install', 'fork', 'purchase')),
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- 2q. marketplace_likes
CREATE TABLE IF NOT EXISTS public.marketplace_likes (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     uuid          NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

-- 2r. marketplace_comments
CREATE TABLE IF NOT EXISTS public.marketplace_comments (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid          NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  user_id     uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text          NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_flagged  boolean       NOT NULL DEFAULT false,
  flag_reason text,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

-- 2s. avatar_reports
CREATE TABLE IF NOT EXISTS public.avatar_reports (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id   uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text          NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  status      text          NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT no_self_report CHECK (reporter_id <> target_id)
);

-- 2t. audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  org_id      uuid          REFERENCES public.organizations(id) ON DELETE SET NULL,
  event_type  text          NOT NULL,
  object_type text          NOT NULL,
  object_id   text          NOT NULL,
  metadata    jsonb         NOT NULL DEFAULT '{}',
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- 2u. AI tables
CREATE TABLE IF NOT EXISTS public.ai_org_policies (
  org_id                        uuid          PRIMARY KEY
                                  REFERENCES public.organizations(id) ON DELETE CASCADE,
  allow_bypass                  boolean       NOT NULL DEFAULT false,
  allow_explore                 boolean       NOT NULL DEFAULT true,
  monthly_token_limit_per_seat  int           NOT NULL DEFAULT 200000
                                  CHECK (monthly_token_limit_per_seat > 0),
  ai_enabled                    boolean       NOT NULL DEFAULT true,
  ai_allowed_modes              text[]        NOT NULL DEFAULT ARRAY['plan','edit','bypass'],
  created_at                    timestamptz   NOT NULL DEFAULT now(),
  updated_at                    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT ai_org_policies_modes_check CHECK (ai_allowed_modes <@ ARRAY['plan','edit','bypass'])
);

CREATE TABLE IF NOT EXISTS public.ai_usage_monthly (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          uuid          REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start    date          NOT NULL,
  tokens_in       bigint        NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out      bigint        NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  requests        int           NOT NULL DEFAULT 0 CHECK (requests >= 0),
  last_request_at timestamptz,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_monthly_unique UNIQUE (owner_id, org_id, period_start)
);

CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        uuid          REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  mode          text          NOT NULL CHECK (mode IN ('plan', 'edit', 'bypass')),
  model         text          NOT NULL,
  tokens_in     bigint        NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out    bigint        NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  ops_count     int           NOT NULL DEFAULT 0 CHECK (ops_count >= 0),
  risk_level    text          NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  response_id   text,
  error_code    text,
  task          text          NOT NULL DEFAULT 'chat'
                  CHECK (task IN ('chat', 'fix_graph', 'explain_node', 'generate_template', 'generate_theme'))
);

-- 2v. user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_label    text          NOT NULL DEFAULT 'Unknown device',
  user_agent      text,
  last_active_at  timestamptz   NOT NULL DEFAULT now(),
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- 2w. user_preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id           uuid          PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  locale            text          NOT NULL DEFAULT 'en',
  theme             text          NOT NULL DEFAULT 'system'
                      CHECK (theme IN ('light', 'dark', 'system')),
  region            text,
  editor_layout     text          NOT NULL DEFAULT 'default'
                      CHECK (editor_layout IN ('default', 'compact', 'wide')),
  sidebar_collapsed boolean       NOT NULL DEFAULT false,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

-- 2x. user_terms_log
CREATE TABLE IF NOT EXISTS public.user_terms_log (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  terms_version   text          NOT NULL,
  accepted_at     timestamptz   NOT NULL DEFAULT now(),
  ip_address      inet,
  user_agent      text
);

-- 2y. user_reports
CREATE TABLE IF NOT EXISTS public.user_reports (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type   text          NOT NULL
                  CHECK (target_type IN ('display_name', 'avatar', 'comment', 'marketplace_item')),
  target_id     text          NOT NULL,
  reason        text          NOT NULL CHECK (char_length(reason) <= 1000),
  status        text          NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by   uuid          REFERENCES public.profiles(id),
  resolved_at   timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT user_reports_unique_pending
    EXCLUDE USING btree (reporter_id WITH =, target_type WITH =, target_id WITH =)
    WHERE (status = 'pending')
);

-- 2z. student_verifications
CREATE TABLE IF NOT EXISTS public.student_verifications (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  university_email  text          NOT NULL,
  code_hash         text          NOT NULL,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  expires_at        timestamptz   NOT NULL DEFAULT (now() + interval '30 minutes'),
  confirmed_at      timestamptz,
  CONSTRAINT student_verif_no_empty_email CHECK (university_email <> '')
);


-- =========================================================================
-- 3. FUNCTIONS (all use CREATE OR REPLACE for idempotency)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.user_has_active_plan(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.is_developer = true OR p.is_admin = true
       OR (p.is_student = true AND (p.plan)::text = 'free')
       OR (p.plan)::text IN ('trialing', 'pro', 'enterprise')
     FROM public.profiles p WHERE p.id = uid), false);
$$;

CREATE OR REPLACE FUNCTION public.user_can_write_projects(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (p.plan)::text <> 'canceled' FROM public.profiles p WHERE p.id = uid), true);
$$;

CREATE OR REPLACE FUNCTION public.enforce_project_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _plan text; _is_dev boolean; _is_admin boolean; _is_student boolean; _count integer; _max integer;
BEGIN
  SELECT (p.plan)::text, p.is_developer, p.is_admin, p.is_student INTO _plan, _is_dev, _is_admin, _is_student
    FROM public.profiles p WHERE p.id = NEW.owner_id;
  IF _plan IS NULL THEN _plan := 'free'; END IF;
  IF COALESCE(_is_dev, false) OR COALESCE(_is_admin, false) THEN RETURN NEW; END IF;
  IF COALESCE(_is_student, false) AND _plan = 'free' THEN RETURN NEW; END IF;
  CASE _plan WHEN 'trialing' THEN _max := 2147483647; WHEN 'pro' THEN _max := 2147483647;
    WHEN 'enterprise' THEN _max := 2147483647; WHEN 'canceled' THEN _max := 0; ELSE _max := 1; END CASE;
  SELECT count(*) INTO _count FROM public.projects WHERE owner_id = NEW.owner_id;
  IF _count >= _max THEN
    RAISE EXCEPTION 'CS_PROJECT_LIMIT: Free plan allows % project(s). Delete an existing project or upgrade to Pro.', _max
      USING ERRCODE = 'P0001', HINT = 'Upgrade at /app/settings#billing';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_canvas_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _plan text; _is_dev boolean; _is_admin boolean; _is_student boolean; _count integer; _max integer;
BEGIN
  SELECT (p.plan)::text, p.is_developer, p.is_admin, p.is_student INTO _plan, _is_dev, _is_admin, _is_student
    FROM public.profiles p WHERE p.id = NEW.owner_id;
  IF _plan IS NULL THEN _plan := 'free'; END IF;
  IF COALESCE(_is_dev, false) OR COALESCE(_is_admin, false) THEN RETURN NEW; END IF;
  IF COALESCE(_is_student, false) AND _plan = 'free' THEN RETURN NEW; END IF;
  CASE _plan WHEN 'trialing' THEN _max := 2147483647; WHEN 'pro' THEN _max := 2147483647;
    WHEN 'enterprise' THEN _max := 2147483647; WHEN 'canceled' THEN _max := 0; ELSE _max := 2; END CASE;
  SELECT count(*) INTO _count FROM public.canvases WHERE project_id = NEW.project_id;
  IF _count >= _max THEN
    RAISE EXCEPTION 'Canvas limit reached for plan "%". Current: %, max: %.', _plan, _count, _max USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_marketplace_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.marketplace_items SET likes_count = likes_count + 1 WHERE id = NEW.item_id; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.marketplace_items SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.item_id; RETURN OLD;
  END IF; RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_marketplace_downloads_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.marketplace_items SET downloads_count = downloads_count + 1 WHERE id = NEW.item_id; RETURN NEW; END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_marketplace_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.marketplace_items SET comments_count = comments_count + 1 WHERE id = NEW.item_id; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.marketplace_items SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.item_id; RETURN OLD;
  END IF; RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_marketplace_item_official()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT verified_author INTO NEW.is_official FROM public.profiles WHERE id = NEW.author_id;
  IF NEW.is_official IS NULL THEN NEW.is_official := false; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_comment_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent_count int;
BEGIN
  SELECT count(*) INTO recent_count FROM public.marketplace_comments
   WHERE user_id = NEW.user_id AND created_at > now() - interval '60 seconds';
  IF recent_count >= 5 THEN RAISE EXCEPTION 'Comment rate limit exceeded -- max 5 per minute' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_org_install_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.org_members om JOIN public.organizations o ON o.id = om.org_id
    WHERE om.user_id = NEW.user_id AND o.policy_installs_allowed = false)
  THEN RAISE EXCEPTION 'Organization policy prohibits marketplace installs' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_org_comment_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.org_members om JOIN public.organizations o ON o.id = om.org_id
    WHERE om.user_id = NEW.user_id AND o.policy_comments_allowed = false)
  THEN RAISE EXCEPTION 'Organization policy prohibits marketplace comments' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_audit_logs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deleted_count integer := 0; batch_count integer; org_rec record;
BEGIN
  FOR org_rec IN SELECT id, policy_data_retention_days FROM public.organizations
    WHERE policy_data_retention_days IS NOT NULL AND policy_data_retention_days > 0
  LOOP
    DELETE FROM public.audit_log WHERE org_id = org_rec.id
      AND created_at < (now() - (org_rec.policy_data_retention_days || ' days')::interval);
    GET DIAGNOSTICS batch_count = ROW_COUNT;
    deleted_count := deleted_count + batch_count;
  END LOOP;
  RETURN deleted_count;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_auto_developer_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email = 'ben.godfrey@chainsolve.co.uk' THEN NEW.is_developer := true; END IF;
  RETURN NEW;
END; $$;


-- =========================================================================
-- 4. TRIGGERS (DROP IF EXISTS + CREATE for idempotency)
-- =========================================================================

-- updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.projects;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.fs_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.fs_items FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_group_templates ON public.group_templates;
CREATE TRIGGER set_updated_at_group_templates BEFORE UPDATE ON public.group_templates FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS trg_canvases_updated_at ON public.canvases;
CREATE TRIGGER trg_canvases_updated_at BEFORE UPDATE ON public.canvases FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS trg_mkt_items_updated_at ON public.marketplace_items;
CREATE TRIGGER trg_mkt_items_updated_at BEFORE UPDATE ON public.marketplace_items FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_ai_org_policies_updated_at ON public.ai_org_policies;
CREATE TRIGGER set_ai_org_policies_updated_at BEFORE UPDATE ON public.ai_org_policies FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_ai_usage_monthly_updated_at ON public.ai_usage_monthly;
CREATE TRIGGER set_ai_usage_monthly_updated_at BEFORE UPDATE ON public.ai_usage_monthly FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.user_preferences;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.project_assets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_assets FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.marketplace_comments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.marketplace_comments FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON public.organizations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- Auth signup trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Developer auto-flag
DROP TRIGGER IF EXISTS trg_auto_developer_flag ON public.profiles;
CREATE TRIGGER trg_auto_developer_flag BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_auto_developer_flag();

-- Business logic
DROP TRIGGER IF EXISTS trg_enforce_project_limit ON public.projects;
CREATE TRIGGER trg_enforce_project_limit BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.enforce_project_limit();
DROP TRIGGER IF EXISTS trg_enforce_canvas_limit ON public.canvases;
CREATE TRIGGER trg_enforce_canvas_limit BEFORE INSERT ON public.canvases FOR EACH ROW EXECUTE FUNCTION public.enforce_canvas_limit();

-- Marketplace counters
DROP TRIGGER IF EXISTS trg_mkt_likes_count ON public.marketplace_likes;
CREATE TRIGGER trg_mkt_likes_count AFTER INSERT OR DELETE ON public.marketplace_likes FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_likes_count();
DROP TRIGGER IF EXISTS trg_mkt_downloads_count ON public.marketplace_purchases;
CREATE TRIGGER trg_mkt_downloads_count AFTER INSERT ON public.marketplace_purchases FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_downloads_count();
DROP TRIGGER IF EXISTS trg_mkt_comments_count ON public.marketplace_comments;
CREATE TRIGGER trg_mkt_comments_count AFTER INSERT OR DELETE ON public.marketplace_comments FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_comments_count();
DROP TRIGGER IF EXISTS trg_mkt_items_official ON public.marketplace_items;
CREATE TRIGGER trg_mkt_items_official BEFORE INSERT ON public.marketplace_items FOR EACH ROW EXECUTE FUNCTION public.handle_marketplace_item_official();

-- Rate limit + org policy
DROP TRIGGER IF EXISTS trg_comment_rate_limit ON public.marketplace_comments;
CREATE TRIGGER trg_comment_rate_limit BEFORE INSERT ON public.marketplace_comments FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_rate_limit();
DROP TRIGGER IF EXISTS trg_enforce_org_install_policy ON public.marketplace_install_events;
CREATE TRIGGER trg_enforce_org_install_policy BEFORE INSERT ON public.marketplace_install_events FOR EACH ROW EXECUTE FUNCTION public.enforce_org_install_policy();
DROP TRIGGER IF EXISTS trg_enforce_org_comment_policy ON public.marketplace_comments;
CREATE TRIGGER trg_enforce_org_comment_policy BEFORE INSERT ON public.marketplace_comments FOR EACH ROW EXECUTE FUNCTION public.enforce_org_comment_policy();


-- =========================================================================
-- 5. ROW LEVEL SECURITY
-- =========================================================================

ALTER TABLE public.profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvases                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fs_items                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_templates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csp_reports                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observability_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_purchases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_install_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_likes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_org_policies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_monthly            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_request_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_terms_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_verifications       ENABLE ROW LEVEL SECURITY;


-- =========================================================================
-- 6. RLS POLICIES (idempotent: DROP IF EXISTS + CREATE)
-- =========================================================================

-- Helper to drop + recreate policies idempotently
-- We use DO blocks for policies that may already exist

-- 6a. profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = (select auth.uid()));

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_moderator = true))
  WITH CHECK (
    (id = (select auth.uid())
      AND is_developer IS NOT DISTINCT FROM (SELECT p.is_developer FROM public.profiles p WHERE p.id = (select auth.uid()))
      AND is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM public.profiles p WHERE p.id = (select auth.uid()))
      AND is_moderator IS NOT DISTINCT FROM (SELECT p.is_moderator FROM public.profiles p WHERE p.id = (select auth.uid()))
      AND is_student IS NOT DISTINCT FROM (SELECT p.is_student FROM public.profiles p WHERE p.id = (select auth.uid()))
      AND verified_author IS NOT DISTINCT FROM (SELECT p.verified_author FROM public.profiles p WHERE p.id = (select auth.uid()))
    ) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.is_moderator = true)
  );

-- 6b. projects
DROP POLICY IF EXISTS projects_select_own ON public.projects;
CREATE POLICY projects_select_own ON public.projects FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS projects_insert_own ON public.projects;
CREATE POLICY projects_insert_own ON public.projects FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS projects_update_own ON public.projects;
CREATE POLICY projects_update_own ON public.projects FOR UPDATE TO authenticated USING (owner_id = (select auth.uid())) WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS projects_delete_own ON public.projects;
CREATE POLICY projects_delete_own ON public.projects FOR DELETE TO authenticated USING (owner_id = (select auth.uid()));

-- 6c. canvases
DROP POLICY IF EXISTS canvases_select_own ON public.canvases;
CREATE POLICY canvases_select_own ON public.canvases FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS canvases_insert_own ON public.canvases;
CREATE POLICY canvases_insert_own ON public.canvases FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS canvases_update_own ON public.canvases;
CREATE POLICY canvases_update_own ON public.canvases FOR UPDATE TO authenticated USING (owner_id = (select auth.uid())) WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS canvases_delete_own ON public.canvases;
CREATE POLICY canvases_delete_own ON public.canvases FOR DELETE TO authenticated USING (owner_id = (select auth.uid()));

-- 6d. fs_items
DROP POLICY IF EXISTS fs_items_select_own ON public.fs_items;
CREATE POLICY fs_items_select_own ON public.fs_items FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS fs_items_insert_own ON public.fs_items;
CREATE POLICY fs_items_insert_own ON public.fs_items FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS fs_items_update_own ON public.fs_items;
CREATE POLICY fs_items_update_own ON public.fs_items FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS fs_items_delete_own ON public.fs_items;
CREATE POLICY fs_items_delete_own ON public.fs_items FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- 6e. project_assets
DROP POLICY IF EXISTS assets_select_own ON public.project_assets;
CREATE POLICY assets_select_own ON public.project_assets FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS assets_insert_own ON public.project_assets;
CREATE POLICY assets_insert_own ON public.project_assets FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS assets_update_own ON public.project_assets;
CREATE POLICY assets_update_own ON public.project_assets FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS assets_delete_own ON public.project_assets;
CREATE POLICY assets_delete_own ON public.project_assets FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- 6f. bug_reports
DROP POLICY IF EXISTS bug_reports_select_own ON public.bug_reports;
CREATE POLICY bug_reports_select_own ON public.bug_reports FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS bug_reports_insert_own ON public.bug_reports;
CREATE POLICY bug_reports_insert_own ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- 6g. suggestions
DROP POLICY IF EXISTS suggestions_select_own ON public.suggestions;
CREATE POLICY suggestions_select_own ON public.suggestions FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS suggestions_insert_own ON public.suggestions;
CREATE POLICY suggestions_insert_own ON public.suggestions FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- 6h. group_templates
DROP POLICY IF EXISTS templates_select_own ON public.group_templates;
CREATE POLICY templates_select_own ON public.group_templates FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS templates_insert_own ON public.group_templates;
CREATE POLICY templates_insert_own ON public.group_templates FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS templates_update_own ON public.group_templates;
CREATE POLICY templates_update_own ON public.group_templates FOR UPDATE TO authenticated USING (owner_id = (select auth.uid())) WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS templates_delete_own ON public.group_templates;
CREATE POLICY templates_delete_own ON public.group_templates FOR DELETE TO authenticated USING (owner_id = (select auth.uid()));

-- 6i. csp_reports
DROP POLICY IF EXISTS csp_reports_insert_own ON public.csp_reports;
CREATE POLICY csp_reports_insert_own ON public.csp_reports FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- 6j. observability_events (deny-all)
DROP POLICY IF EXISTS obs_events_deny_all ON public.observability_events;
CREATE POLICY obs_events_deny_all ON public.observability_events FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 6k. stripe_events (deny-all)
DROP POLICY IF EXISTS stripe_events_deny_all ON public.stripe_events;
CREATE POLICY stripe_events_deny_all ON public.stripe_events FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 6l. marketplace_items
DROP POLICY IF EXISTS mkt_items_select ON public.marketplace_items;
CREATE POLICY mkt_items_select ON public.marketplace_items FOR SELECT
  USING ((is_published = true AND review_status = 'approved') OR (author_id = (select auth.uid()))
    OR (org_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.org_members om WHERE om.org_id = marketplace_items.org_id AND om.user_id = (select auth.uid()))));
DROP POLICY IF EXISTS mkt_items_author_insert ON public.marketplace_items;
CREATE POLICY mkt_items_author_insert ON public.marketplace_items FOR INSERT TO authenticated
  WITH CHECK (author_id = (select auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND verified_author = true));
DROP POLICY IF EXISTS mkt_items_update ON public.marketplace_items;
CREATE POLICY mkt_items_update ON public.marketplace_items FOR UPDATE TO authenticated
  USING (author_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_moderator = true))
  WITH CHECK (author_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_moderator = true));
DROP POLICY IF EXISTS mkt_items_author_delete ON public.marketplace_items;
CREATE POLICY mkt_items_author_delete ON public.marketplace_items FOR DELETE TO authenticated USING (author_id = (select auth.uid()));

-- 6m. marketplace_purchases
DROP POLICY IF EXISTS mkt_purchases_user_select ON public.marketplace_purchases;
CREATE POLICY mkt_purchases_user_select ON public.marketplace_purchases FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS mkt_purchases_user_insert ON public.marketplace_purchases;
CREATE POLICY mkt_purchases_user_insert ON public.marketplace_purchases FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- 6n. marketplace_install_events
DROP POLICY IF EXISTS mie_select ON public.marketplace_install_events;
CREATE POLICY mie_select ON public.marketplace_install_events FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.marketplace_items mi WHERE mi.id = marketplace_install_events.item_id AND mi.author_id = (select auth.uid())));
DROP POLICY IF EXISTS mie_user_insert ON public.marketplace_install_events;
CREATE POLICY mie_user_insert ON public.marketplace_install_events FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- 6o. marketplace_likes
DROP POLICY IF EXISTS mkt_likes_user_select ON public.marketplace_likes;
CREATE POLICY mkt_likes_user_select ON public.marketplace_likes FOR SELECT USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS mkt_likes_user_insert ON public.marketplace_likes;
CREATE POLICY mkt_likes_user_insert ON public.marketplace_likes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS mkt_likes_user_delete ON public.marketplace_likes;
CREATE POLICY mkt_likes_user_delete ON public.marketplace_likes FOR DELETE USING ((select auth.uid()) = user_id);

-- 6p. marketplace_comments
DROP POLICY IF EXISTS mkt_comments_select ON public.marketplace_comments;
CREATE POLICY mkt_comments_select ON public.marketplace_comments FOR SELECT USING (
  is_flagged = false OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_moderator = true));
DROP POLICY IF EXISTS mkt_comments_user_insert ON public.marketplace_comments;
CREATE POLICY mkt_comments_user_insert ON public.marketplace_comments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS mkt_comments_update ON public.marketplace_comments;
CREATE POLICY mkt_comments_update ON public.marketplace_comments FOR UPDATE USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK (is_flagged = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_moderator = true));
DROP POLICY IF EXISTS mkt_comments_delete ON public.marketplace_comments;
CREATE POLICY mkt_comments_delete ON public.marketplace_comments FOR DELETE USING (
  (select auth.uid()) = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_moderator = true)
  OR EXISTS (SELECT 1 FROM public.marketplace_items WHERE id = marketplace_comments.item_id AND author_id = (select auth.uid())));

-- 6q. avatar_reports
DROP POLICY IF EXISTS avatar_reports_insert ON public.avatar_reports;
CREATE POLICY avatar_reports_insert ON public.avatar_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = (select auth.uid()));
DROP POLICY IF EXISTS avatar_reports_select ON public.avatar_reports;
CREATE POLICY avatar_reports_select ON public.avatar_reports FOR SELECT TO authenticated
  USING (reporter_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_moderator = true));
DROP POLICY IF EXISTS avatar_reports_mod_update ON public.avatar_reports;
CREATE POLICY avatar_reports_mod_update ON public.avatar_reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_moderator = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_moderator = true));

-- 6r. audit_log
DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.org_members AS m WHERE m.org_id = audit_log.org_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner', 'admin'))));
DROP POLICY IF EXISTS audit_log_user_insert ON public.audit_log;
CREATE POLICY audit_log_user_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- 6s. organizations
DROP POLICY IF EXISTS orgs_member_select ON public.organizations;
CREATE POLICY orgs_member_select ON public.organizations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members WHERE org_id = organizations.id AND user_id = (select auth.uid())));
DROP POLICY IF EXISTS orgs_auth_insert ON public.organizations;
CREATE POLICY orgs_auth_insert ON public.organizations FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS orgs_owner_update ON public.organizations;
CREATE POLICY orgs_owner_update ON public.organizations FOR UPDATE TO authenticated USING (owner_id = (select auth.uid())) WITH CHECK (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS orgs_owner_delete ON public.organizations;
CREATE POLICY orgs_owner_delete ON public.organizations FOR DELETE TO authenticated USING (owner_id = (select auth.uid()));

-- 6t. org_members
DROP POLICY IF EXISTS org_members_select ON public.org_members;
CREATE POLICY org_members_select ON public.org_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members AS m2 WHERE m2.org_id = org_members.org_id AND m2.user_id = (select auth.uid())));
DROP POLICY IF EXISTS org_members_insert ON public.org_members;
CREATE POLICY org_members_insert ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_members AS m WHERE m.org_id = org_members.org_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner', 'admin')));
DROP POLICY IF EXISTS org_members_update ON public.org_members;
CREATE POLICY org_members_update ON public.org_members FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members AS m WHERE m.org_id = org_members.org_id AND m.user_id = (select auth.uid()) AND (m.role = 'owner' OR (m.role = 'admin' AND org_members.role = 'member'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_members AS m WHERE m.org_id = org_members.org_id AND m.user_id = (select auth.uid()) AND (m.role = 'owner' OR (m.role = 'admin' AND org_members.role = 'member'))));
DROP POLICY IF EXISTS org_members_delete ON public.org_members;
CREATE POLICY org_members_delete ON public.org_members FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.org_members AS m WHERE m.org_id = org_members.org_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner', 'admin')));

-- 6u. AI tables
DROP POLICY IF EXISTS ai_org_policies_select ON public.ai_org_policies;
CREATE POLICY ai_org_policies_select ON public.ai_org_policies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members WHERE org_members.org_id = ai_org_policies.org_id AND org_members.user_id = (select auth.uid())));
DROP POLICY IF EXISTS ai_org_policies_update ON public.ai_org_policies;
CREATE POLICY ai_org_policies_update ON public.ai_org_policies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members WHERE org_members.org_id = ai_org_policies.org_id AND org_members.user_id = (select auth.uid()) AND org_members.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_members WHERE org_members.org_id = ai_org_policies.org_id AND org_members.user_id = (select auth.uid()) AND org_members.role = 'owner'));
DROP POLICY IF EXISTS ai_usage_monthly_select ON public.ai_usage_monthly;
CREATE POLICY ai_usage_monthly_select ON public.ai_usage_monthly FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));
DROP POLICY IF EXISTS ai_request_log_select ON public.ai_request_log;
CREATE POLICY ai_request_log_select ON public.ai_request_log FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));

-- 6v. user_sessions
DROP POLICY IF EXISTS user_sessions_select_own ON public.user_sessions;
CREATE POLICY user_sessions_select_own ON public.user_sessions FOR SELECT USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS user_sessions_insert_own ON public.user_sessions;
CREATE POLICY user_sessions_insert_own ON public.user_sessions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS user_sessions_update_own ON public.user_sessions;
CREATE POLICY user_sessions_update_own ON public.user_sessions FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS user_sessions_delete_own ON public.user_sessions;
CREATE POLICY user_sessions_delete_own ON public.user_sessions FOR DELETE USING ((select auth.uid()) = user_id);

-- 6w. user_preferences
DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
CREATE POLICY user_preferences_select_own ON public.user_preferences FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
CREATE POLICY user_preferences_insert_own ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
CREATE POLICY user_preferences_update_own ON public.user_preferences FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- 6x. user_terms_log
DROP POLICY IF EXISTS user_terms_log_select_own ON public.user_terms_log;
CREATE POLICY user_terms_log_select_own ON public.user_terms_log FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS user_terms_log_insert_own ON public.user_terms_log;
CREATE POLICY user_terms_log_insert_own ON public.user_terms_log FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- 6y. user_reports
DROP POLICY IF EXISTS user_reports_insert_own ON public.user_reports;
CREATE POLICY user_reports_insert_own ON public.user_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = (select auth.uid()));
DROP POLICY IF EXISTS user_reports_select ON public.user_reports;
CREATE POLICY user_reports_select ON public.user_reports FOR SELECT TO authenticated
  USING (reporter_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND (is_admin = true OR is_developer = true)));
DROP POLICY IF EXISTS user_reports_update_mod ON public.user_reports;
CREATE POLICY user_reports_update_mod ON public.user_reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND (is_admin = true OR is_developer = true)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND (is_admin = true OR is_developer = true)));

-- 6z. student_verifications
DROP POLICY IF EXISTS student_verif_select_own ON public.student_verifications;
CREATE POLICY student_verif_select_own ON public.student_verifications FOR SELECT TO authenticated USING (user_id = (select auth.uid()));


-- =========================================================================
-- 7. INDEXES (all use IF NOT EXISTS)
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_invited_by ON public.org_members(invited_by) WHERE invited_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_owner_updated ON public.projects(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_active_canvas ON public.projects(active_canvas_id) WHERE active_canvas_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_owner_folder ON public.projects(owner_id, folder) WHERE folder IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_canvases_owner_project ON public.canvases(owner_id, project_id);
CREATE INDEX IF NOT EXISTS idx_canvases_project_position ON public.canvases(project_id, position);
CREATE INDEX IF NOT EXISTS idx_fs_items_project_id ON public.fs_items(project_id);
CREATE INDEX IF NOT EXISTS idx_fs_items_user_id ON public.fs_items(user_id);
CREATE INDEX IF NOT EXISTS idx_fs_items_parent_id ON public.fs_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON public.project_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_user_id ON public.project_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_kind ON public.project_assets(kind);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON public.bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_created ON public.suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_user ON public.suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_category ON public.suggestions(category);
CREATE INDEX IF NOT EXISTS idx_group_templates_owner ON public.group_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_csp_reports_created ON public.csp_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_csp_reports_user ON public.csp_reports(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obs_events_created ON public.observability_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_events_type ON public.observability_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_events_session ON public.observability_events(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obs_events_user ON public.observability_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obs_events_fingerprint ON public.observability_events(fingerprint, created_at DESC) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_items_author ON public.marketplace_items(author_id);
CREATE INDEX IF NOT EXISTS idx_mkt_items_category ON public.marketplace_items(category);
CREATE INDEX IF NOT EXISTS idx_mkt_items_downloads ON public.marketplace_items(downloads_count DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_items_tags ON public.marketplace_items USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_mkt_items_org ON public.marketplace_items(org_id);
CREATE INDEX IF NOT EXISTS idx_mkt_purchases_user ON public.marketplace_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_mkt_purchases_item ON public.marketplace_purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_mkt_events_item ON public.marketplace_install_events(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_events_user ON public.marketplace_install_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_likes_user ON public.marketplace_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_mkt_likes_item ON public.marketplace_likes(item_id);
CREATE INDEX IF NOT EXISTS idx_mkt_comments_item ON public.marketplace_comments(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_comments_user ON public.marketplace_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_reports_reporter ON public.avatar_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_avatar_reports_target ON public.avatar_reports(target_id);
CREATE INDEX IF NOT EXISTS idx_avatar_reports_resolved_by ON public.avatar_reports(resolved_by) WHERE resolved_by IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS avatar_reports_pending_uniq ON public.avatar_reports(reporter_id, target_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id ON public.audit_log(org_id, created_at DESC) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_monthly_owner_period ON public.ai_usage_monthly(owner_id, period_start);
CREATE INDEX IF NOT EXISTS idx_ai_usage_monthly_org ON public.ai_usage_monthly(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_request_log_owner_created ON public.ai_request_log(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_org ON public.ai_request_log(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_terms_log_user ON public.user_terms_log(user_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON public.user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_resolved_by ON public.user_reports(resolved_by) WHERE resolved_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON public.user_reports(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_user_reports_target ON public.user_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_student_verifications_user ON public.student_verifications(user_id);


-- =========================================================================
-- 8. STORAGE BUCKETS + POLICIES
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('projects',    'projects',    false, 52428800),
  ('uploads',     'uploads',     false, 52428800),
  ('marketplace', 'marketplace', true,  10485760)
ON CONFLICT (id) DO NOTHING;

-- projects bucket
DROP POLICY IF EXISTS "projects bucket: users select own files" ON storage.objects;
CREATE POLICY "projects bucket: users select own files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'projects' AND (storage.foldername(name))[1] = (select auth.uid())::text);
DROP POLICY IF EXISTS "projects bucket: users insert own files" ON storage.objects;
CREATE POLICY "projects bucket: users insert own files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'projects' AND (storage.foldername(name))[1] = (select auth.uid())::text AND public.user_can_write_projects((select auth.uid())));
DROP POLICY IF EXISTS "projects bucket: users update own files" ON storage.objects;
CREATE POLICY "projects bucket: users update own files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'projects' AND (storage.foldername(name))[1] = (select auth.uid())::text AND public.user_can_write_projects((select auth.uid())));
DROP POLICY IF EXISTS "projects bucket: users delete own files" ON storage.objects;
CREATE POLICY "projects bucket: users delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'projects' AND (storage.foldername(name))[1] = (select auth.uid())::text);

-- uploads bucket
DROP POLICY IF EXISTS "uploads bucket: users select own files" ON storage.objects;
CREATE POLICY "uploads bucket: users select own files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = (select auth.uid())::text);
DROP POLICY IF EXISTS "uploads bucket: users insert own files" ON storage.objects;
CREATE POLICY "uploads bucket: users insert own files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = (select auth.uid())::text AND public.user_has_active_plan((select auth.uid())));
DROP POLICY IF EXISTS "uploads bucket: users update own files" ON storage.objects;
CREATE POLICY "uploads bucket: users update own files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = (select auth.uid())::text AND public.user_has_active_plan((select auth.uid())));
DROP POLICY IF EXISTS "uploads bucket: users delete own files" ON storage.objects;
CREATE POLICY "uploads bucket: users delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = (select auth.uid())::text);

-- marketplace bucket
DROP POLICY IF EXISTS "marketplace bucket: author insert" ON storage.objects;
CREATE POLICY "marketplace bucket: author insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketplace' AND (storage.foldername(name))[1] = (select auth.uid())::text);
DROP POLICY IF EXISTS "marketplace bucket: author update" ON storage.objects;
CREATE POLICY "marketplace bucket: author update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'marketplace' AND (storage.foldername(name))[1] = (select auth.uid())::text)
  WITH CHECK (bucket_id = 'marketplace' AND (storage.foldername(name))[1] = (select auth.uid())::text);
DROP POLICY IF EXISTS "marketplace bucket: author delete" ON storage.objects;
CREATE POLICY "marketplace bucket: author delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marketplace' AND (storage.foldername(name))[1] = (select auth.uid())::text);


-- =========================================================================
-- 9. REFRESH POSTGREST SCHEMA CACHE
-- =========================================================================

NOTIFY pgrst, 'reload schema';
