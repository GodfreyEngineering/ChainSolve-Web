-- D10-3: Seat model for organizations
--
-- max_seats column on organizations. NULL = unlimited (Enterprise Unlimited).
-- Default 10 for standard Enterprise plans. The invite flow checks
-- current member count against max_seats before allowing new invites.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS max_seats int DEFAULT 10;

NOTIFY pgrst, 'reload schema';
