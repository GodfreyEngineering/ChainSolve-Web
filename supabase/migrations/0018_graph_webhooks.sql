-- 0018_graph_webhooks: webhook registry for graph job events (10.8)
--
-- Users register HTTPS URLs to receive POST notifications when their
-- graph_jobs transition to 'completed' or 'failed'.
-- Optional HMAC-SHA256 signing via secret_hash.

SET search_path = public;

CREATE TABLE IF NOT EXISTS graph_webhooks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url             text NOT NULL,
  -- Array of event types: 'job.completed', 'job.failed', 'job.all'
  events          text[] NOT NULL DEFAULT ARRAY['job.all'],
  -- HMAC-SHA256 signing secret (plaintext, user-supplied, stored server-side only)
  secret_hash     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_fired_at   timestamptz,
  last_status     integer  -- HTTP status from last delivery attempt
);

-- Index for per-user lookup
CREATE INDEX IF NOT EXISTS graph_webhooks_user_id
  ON graph_webhooks(user_id);

-- RLS: users can only manage their own webhooks
ALTER TABLE graph_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "graph_webhooks: users access own rows" ON graph_webhooks
  FOR ALL USING (user_id = auth.uid());
