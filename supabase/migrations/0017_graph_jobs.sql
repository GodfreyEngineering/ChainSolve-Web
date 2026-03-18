-- 0017_graph_jobs: graph execution job queue for REST API (10.3)
--
-- Stores graph evaluation jobs submitted via POST /api/graph/execute.
-- Jobs start as 'pending', transition to 'running', then 'completed' or 'failed'.
-- Results and errors are stored as JSON strings.
--
-- Retention: completed/failed jobs are purged after 7 days by the
-- data_retention policy (0015_data_retention.sql).

SET search_path = public;

CREATE TABLE IF NOT EXISTS graph_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  snapshot_json   text NOT NULL,
  options_json    text,
  result_json     text,
  error_json      text,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  -- Soft metadata for observability
  node_count      integer,
  elapsed_ms      integer
);

-- Index for per-user polling and cleanup
CREATE INDEX IF NOT EXISTS graph_jobs_user_id_submitted_at
  ON graph_jobs(user_id, submitted_at DESC);

-- Index for status-based worker polling
CREATE INDEX IF NOT EXISTS graph_jobs_status_submitted
  ON graph_jobs(status, submitted_at)
  WHERE status IN ('pending', 'running');

-- RLS: users can only access their own jobs
ALTER TABLE graph_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "graph_jobs: users access own rows" ON graph_jobs
  FOR ALL USING (user_id = auth.uid());
