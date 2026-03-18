-- 0022_community_demonstrations.sql
--
-- Adds the `demonstrations` table for community graph sharing.
-- Users can publish a project as a "Demonstration" — a read-only,
-- publicly searchable graph with title, description, tags, and a
-- link to the Discourse forum thread.
--
-- Features:
--   - RLS: anyone can read published demonstrations
--   - RLS: only the owner can insert/update/delete their own demonstrations
--   - Full-text search index on title + description + tags
--   - Soft delete via `deleted_at` (GDPR)
--   - Foreign key to public.projects

SET search_path = public;

-- ── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.demonstrations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       uuid        REFERENCES public.projects(id) ON DELETE SET NULL,

  -- Display metadata
  title            text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description      text        NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  tags             text[]      NOT NULL DEFAULT '{}',

  -- Graph snapshot (read-only copy at publish time)
  snapshot_json    text        NOT NULL,

  -- Community integration
  discourse_topic_id  integer, -- Discourse topic ID (set after forum post is created)
  discourse_topic_url text,    -- Full URL to the forum thread

  -- Stats (updated by triggers / RPC, not by users)
  view_count       integer     NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  like_count       integer     NOT NULL DEFAULT 0 CHECK (like_count >= 0),

  -- Lifecycle
  published_at     timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,         -- soft delete

  -- Full-text search
  search_vector    tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
  ) STORED
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS demonstrations_user_id_idx
  ON public.demonstrations (user_id);

CREATE INDEX IF NOT EXISTS demonstrations_published_at_idx
  ON public.demonstrations (published_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS demonstrations_search_vector_idx
  ON public.demonstrations USING GIN (search_vector)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS demonstrations_tags_idx
  ON public.demonstrations USING GIN (tags)
  WHERE deleted_at IS NULL;

-- ── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.demonstrations_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_demonstrations_updated_at ON public.demonstrations;
CREATE TRIGGER set_demonstrations_updated_at
  BEFORE UPDATE ON public.demonstrations
  FOR EACH ROW EXECUTE FUNCTION public.demonstrations_set_updated_at();

-- ── RLS policies ─────────────────────────────────────────────────────────────

ALTER TABLE public.demonstrations ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read published demonstrations
CREATE POLICY "demonstrations: public read"
  ON public.demonstrations
  FOR SELECT
  USING (deleted_at IS NULL);

-- Authenticated users can insert their own demonstrations
CREATE POLICY "demonstrations: owner insert"
  ON public.demonstrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owners can update their own demonstrations
CREATE POLICY "demonstrations: owner update"
  ON public.demonstrations
  FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Owners can soft-delete by setting deleted_at
-- (hard delete is not permitted via RLS)
CREATE POLICY "demonstrations: owner soft delete"
  ON public.demonstrations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- ── Full-text search RPC ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_demonstrations(
  query         text,
  tag_filter    text[]  DEFAULT NULL,
  limit_n       integer DEFAULT 20,
  offset_n      integer DEFAULT 0
)
RETURNS SETOF public.demonstrations
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM   public.demonstrations
  WHERE  deleted_at IS NULL
    AND  (query = '' OR search_vector @@ websearch_to_tsquery('english', query))
    AND  (tag_filter IS NULL OR tags && tag_filter)
  ORDER BY
    CASE WHEN query = '' THEN NULL
         ELSE ts_rank(search_vector, websearch_to_tsquery('english', query))
    END DESC NULLS LAST,
    like_count DESC,
    published_at DESC
  LIMIT  least(limit_n, 100)
  OFFSET offset_n;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.search_demonstrations(text, text[], integer, integer)
  TO anon, authenticated;

-- ── Increment view count RPC ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_demonstration_view(demo_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.demonstrations
  SET    view_count = view_count + 1
  WHERE  id = demo_id AND deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.increment_demonstration_view(uuid)
  TO anon, authenticated;
