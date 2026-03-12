-- ============================================================
-- 0011_schema_gaps_and_hardening.sql
-- ChainSolve — Schema gap fixes and hardening.
--
-- Apply with:  supabase db push   (remote)
-- Or paste into: Supabase Dashboard > SQL Editor > Run
--
-- All statements are idempotent — safe to run multiple times.
-- ============================================================

BEGIN;

-- =========================================================================
-- 1. Missing column: organizations.policy_single_session
--    Referenced by sessionService.ts and orgsService.ts (Org interface).
--    Controls whether org enforces single active session per user.
-- =========================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS policy_single_session boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.policy_single_session IS
  'When true, only one active session is allowed per user in this org.';


-- =========================================================================
-- 2. Storage buckets — ensure they exist with correct settings.
--    Baseline inserts these but uses ON CONFLICT DO NOTHING so this is safe
--    to run even if they already exist. We also ensure the marketplace
--    bucket exists (omitted from some earlier deploys).
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('projects',     'projects',     false,  52428800,  NULL),  -- 50 MB, private
  ('uploads',      'uploads',      false,  10485760,  ARRAY['image/jpeg','image/png','image/webp','text/csv','application/pdf']),  -- 10 MB
  ('marketplace',  'marketplace',  true,   5242880,   ARRAY['image/jpeg','image/png','image/webp'])  -- 5 MB, public read
ON CONFLICT (id) DO UPDATE
  SET
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- =========================================================================
-- 3. Missing storage RLS policies for marketplace bucket (idempotent).
--    Baseline adds projects/uploads policies but some deploys missed the
--    marketplace bucket's ON CONFLICT update.
-- =========================================================================

-- marketplace bucket: public read (cover images, thumbnails)
DROP POLICY IF EXISTS "marketplace bucket: public select" ON storage.objects;
CREATE POLICY "marketplace bucket: public select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketplace');

DROP POLICY IF EXISTS "marketplace bucket: author insert" ON storage.objects;
CREATE POLICY "marketplace bucket: author insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "marketplace bucket: author update" ON storage.objects;
CREATE POLICY "marketplace bucket: author update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "marketplace bucket: author delete" ON storage.objects;
CREATE POLICY "marketplace bucket: author delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketplace'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- =========================================================================
-- 4. Performance indexes for common service file query patterns.
--    All use IF NOT EXISTS (via DO block) to be idempotent.
-- =========================================================================

-- 4a. user_sessions — sessionService queries by user_id + last_active_at
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON public.user_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active
  ON public.user_sessions (user_id, last_active_at DESC);

-- 4b. audit_log — auditLogService queries by user_id, org_id, created_at
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
  ON public.audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_id
  ON public.audit_log (org_id, created_at DESC)
  WHERE org_id IS NOT NULL;

-- 4c. suggestions — suggestionsService by user_id
CREATE INDEX IF NOT EXISTS idx_suggestions_user_id
  ON public.suggestions (user_id, created_at DESC);

-- 4d. node_comments — nodeCommentsService queries by canvas + node
CREATE INDEX IF NOT EXISTS idx_node_comments_canvas_node
  ON public.node_comments (canvas_id, node_id)
  WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_node_comments_project
  ON public.node_comments (project_id, created_at DESC);

-- 4e. share_links — shareService queries by token (active only) and project
CREATE INDEX IF NOT EXISTS idx_share_links_token_active
  ON public.share_links (token)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_share_links_project
  ON public.share_links (project_id, created_by);

-- 4f. marketplace_install_events — analytics queries by item_id + event_type
CREATE INDEX IF NOT EXISTS idx_mkt_install_events_item
  ON public.marketplace_install_events (item_id, event_type, created_at DESC);

-- 4g. marketplace_comments — by item_id for listing
CREATE INDEX IF NOT EXISTS idx_mkt_comments_item
  ON public.marketplace_comments (item_id, created_at DESC)
  WHERE is_flagged = false;

-- 4h. group_templates — by owner_id
CREATE INDEX IF NOT EXISTS idx_group_templates_owner
  ON public.group_templates (owner_id, updated_at DESC);

-- 4i. org_members — by user_id (for session and policy checks)
CREATE INDEX IF NOT EXISTS idx_org_members_user_id
  ON public.org_members (user_id);


-- =========================================================================
-- 5. user_preferences upsert RPC — prevents silent data loss when the
--    preferences row is missing (edge case: user created before handle_new_user
--    trigger was deployed, or trigger race on signup).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.upsert_my_preferences(
  p_locale            text    DEFAULT NULL,
  p_theme             text    DEFAULT NULL,
  p_region            text    DEFAULT NULL,
  p_editor_layout     text    DEFAULT NULL,
  p_sidebar_collapsed boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_preferences (user_id)
  VALUES (_uid)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_preferences
  SET
    locale            = COALESCE(p_locale,            locale),
    theme             = COALESCE(p_theme,             theme),
    region            = CASE WHEN p_region IS NOT NULL THEN p_region ELSE region END,
    editor_layout     = COALESCE(p_editor_layout,     editor_layout),
    sidebar_collapsed = COALESCE(p_sidebar_collapsed, sidebar_collapsed),
    updated_at        = now()
  WHERE user_id = _uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_my_preferences(text, text, text, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.upsert_my_preferences IS
  'Idempotent preference update: creates the row if missing, then patches supplied fields.';


-- =========================================================================
-- 6. Node comments rate limiting — prevent comment spam.
--    Max 10 node comments per user per canvas per minute.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.enforce_node_comment_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
    FROM public.node_comments
   WHERE owner_id = NEW.owner_id
     AND canvas_id = NEW.canvas_id
     AND created_at > now() - interval '60 seconds';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded — max 10 per minute per canvas'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_node_comment_rate_limit ON public.node_comments;
CREATE TRIGGER trg_node_comment_rate_limit
  BEFORE INSERT ON public.node_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_node_comment_rate_limit();


-- =========================================================================
-- 7. suggestion rate limiting — prevent suggestion spam.
--    Max 5 suggestions per user per hour.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.enforce_suggestion_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
    FROM public.suggestions
   WHERE user_id = NEW.user_id
     AND created_at > now() - interval '1 hour';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Suggestion rate limit exceeded — max 5 per hour'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suggestion_rate_limit ON public.suggestions;
CREATE TRIGGER trg_suggestion_rate_limit
  BEFORE INSERT ON public.suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_suggestion_rate_limit();


-- =========================================================================
-- 8. user_sessions cleanup function — remove stale sessions > 30 days.
--    Called via pg_cron or manually; safe to run any time.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions(p_days int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.user_sessions
  WHERE last_active_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_stale_sessions IS
  'Removes user_sessions not active for p_days days (default 30). Returns count deleted.';


-- =========================================================================
-- 9. Share link view count increment RPC — atomic increment.
--    Prevents race conditions from concurrent viewers.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.increment_share_link_views(p_token text)
RETURNS TABLE(project_id uuid, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    UPDATE public.share_links
    SET view_count = view_count + 1
    WHERE token = p_token
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    RETURNING share_links.project_id, share_links.is_active;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_share_link_views(text) TO authenticated, anon;

COMMENT ON FUNCTION public.increment_share_link_views IS
  'Atomically increments view_count for an active, non-expired share link. Returns project_id if found.';


-- =========================================================================
-- 10. ensure handle_new_user also inserts user_preferences row.
--     Migration 0006 updates the trigger but does not guarantee preferences
--     row creation. Reapply the canonical version here.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _terms_version text;
  _marketing_opt_in boolean;
BEGIN
  -- Read signup metadata (set by frontend during registration)
  _terms_version    := (NEW.raw_user_meta_data->>'accepted_terms_version');
  _marketing_opt_in := COALESCE((NEW.raw_user_meta_data->>'marketing_opt_in')::boolean, false);

  -- Create profile row
  INSERT INTO public.profiles (id, email, accepted_terms_version, accepted_terms_at, marketing_opt_in, marketing_opt_in_at)
  VALUES (
    NEW.id,
    NEW.email,
    _terms_version,
    CASE WHEN _terms_version IS NOT NULL THEN now() ELSE NULL END,
    _marketing_opt_in,
    CASE WHEN _marketing_opt_in THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create user_preferences row (ensures it always exists after signup)
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =========================================================================
-- 11. Grant EXECUTE on all new functions
-- =========================================================================

-- upsert_my_preferences is already granted above (section 5)
-- increment_share_link_views is already granted above (section 9)
-- cleanup_stale_sessions is intentionally service_role only (no public grant)

COMMIT;
