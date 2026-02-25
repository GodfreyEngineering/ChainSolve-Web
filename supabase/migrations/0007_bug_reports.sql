-- 0007_bug_reports.sql — In-app bug reporting table
-- W5.3: Production hardening pack

CREATE TABLE IF NOT EXISTS bug_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users can insert their own reports, admins can read all
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own bug reports"
  ON bug_reports FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own bug reports"
  ON bug_reports FOR SELECT
  USING (user_id = auth.uid());

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON bug_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON bug_reports (user_id);
