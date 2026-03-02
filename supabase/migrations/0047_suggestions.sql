-- 0047_suggestions.sql — In-app suggestion / feature request table (H9-2)

CREATE TABLE IF NOT EXISTS suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'feature_request',
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users can insert their own suggestions and read them back
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own suggestions"
  ON suggestions FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can read own suggestions"
  ON suggestions FOR SELECT
  USING (user_id = (select auth.uid()));

-- Indices for admin queries
CREATE INDEX IF NOT EXISTS idx_suggestions_created ON suggestions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_user ON suggestions (user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_category ON suggestions (category);
