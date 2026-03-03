-- P126: Audit log schema + capture key events
--
-- audit_log: immutable append-only event stream for enterprise audit trails.
-- user_id / org_id are nullable so server-side events (service_role) can also
-- be captured without a signed-in user context.
--
-- Captured event types (informational — not enforced by CHECK):
--   auth.login, auth.logout
--   project.create, project.delete
--   canvas.create, canvas.delete
--   org.create, org.dissolve
--   org.member.invite, org.member.remove
--   marketplace.install, marketplace.fork, marketplace.purchase

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES public.profiles(id)      ON DELETE SET NULL,
  org_id       uuid        REFERENCES public.organizations(id) ON DELETE SET NULL,
  event_type   text        NOT NULL,
  object_type  text        NOT NULL,
  object_id    text        NOT NULL,
  metadata     jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Optimise per-user and per-org timeline queries.
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
  ON public.audit_log (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_org_id
  ON public.audit_log (org_id, created_at DESC)
  WHERE org_id IS NOT NULL;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ──────────────────────────────────────────────────────────────

-- Users can see their own events.
DROP POLICY IF EXISTS "audit_log_user_select" ON public.audit_log;
CREATE POLICY "audit_log_user_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Org owners and admins can read all events for their org.
DROP POLICY IF EXISTS "audit_log_org_admin_select" ON public.audit_log;
CREATE POLICY "audit_log_org_admin_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_members AS m
      WHERE m.org_id = audit_log.org_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin')
    )
  );

-- Authenticated users may append their own events (client-side).
-- Server-side events use service_role which bypasses RLS entirely.
DROP POLICY IF EXISTS "audit_log_user_insert" ON public.audit_log;
CREATE POLICY "audit_log_user_insert" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- No UPDATE or DELETE — the log is append-only.

COMMIT;
