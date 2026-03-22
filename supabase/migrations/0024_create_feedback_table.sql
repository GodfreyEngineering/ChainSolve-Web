-- 0024: Feedback table for in-app bug reports, suggestions, and questions.
--
-- This replaces the separate bug_reports / suggestions tables with a unified
-- feedback table that supports status tracking, priority, and resolution.

SET search_path = public;

CREATE TABLE IF NOT EXISTS public.feedback (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  type          text        NOT NULL CHECK (type IN ('bug', 'improvement', 'question')),
  category      text        CHECK (category IN (
                              'calculation', 'ui', 'performance', 'blocks',
                              'export', 'auth', 'billing', 'other'
                            )),
  title         text        NOT NULL,
  description   text        NOT NULL,
  error_logs    text,
  browser_info  jsonb,
  app_version   text,
  route         text,
  status        text        DEFAULT 'new' CHECK (status IN (
                              'new', 'triaged', 'in_progress', 'done',
                              'wont_fix', 'duplicate'
                            )),
  priority      text        DEFAULT 'medium' CHECK (priority IN (
                              'critical', 'high', 'medium', 'low'
                            )),
  created_at    timestamptz DEFAULT now(),
  resolved_at   timestamptz,
  resolution_notes text
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_feedback_status  ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user    ON public.feedback(user_id);

-- RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can view their own feedback (for status tracking)
CREATE POLICY "Users can view own feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role has full access (for edge functions, admin dashboard)
CREATE POLICY "Service role full access"
  ON public.feedback FOR ALL TO service_role
  USING (true) WITH CHECK (true);
