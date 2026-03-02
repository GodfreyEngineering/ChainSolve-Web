-- E2-5: Device sessions + remember-me rules
-- Track active user sessions for the "active sessions" list in Security settings.

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_label text NOT NULL DEFAULT 'Unknown device',
  user_agent text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own sessions"
  ON user_sessions FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

COMMENT ON TABLE user_sessions IS 'Tracks active browser sessions for device management (E2-5)';
COMMENT ON COLUMN user_sessions.device_label IS 'Human-readable device description parsed from User-Agent';
COMMENT ON COLUMN user_sessions.last_active_at IS 'Last time this session was actively used (updated on page load)';
