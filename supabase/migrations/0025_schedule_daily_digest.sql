-- 0025: Schedule daily feedback digest email at 18:00 UTC.
--
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase).
-- The edge function is invoked via net.http_post.
--
-- SETUP: This migration creates the cron job with a placeholder auth token.
-- After running, you MUST update the job via the Supabase Dashboard:
--
--   1. Go to Supabase Dashboard → Database → Extensions → pg_cron (or SQL Editor)
--   2. Run the SQL below in the SQL Editor, replacing YOUR_SERVICE_ROLE_KEY:
--
--      SELECT cron.unschedule('chainsolve-daily-digest');
--      SELECT cron.schedule(
--        'chainsolve-daily-digest',
--        '0 18 * * *',
--        $$
--        SELECT net.http_post(
--          url    := 'https://zjgfosqtnlhlfgpohnnu.supabase.co/functions/v1/daily-digest',
--          headers := jsonb_build_object(
--            'Content-Type',  'application/json',
--            'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--          ),
--          body   := '{}'::jsonb
--        );
--        $$
--      );
--
-- The service_role_key is safe to embed here because pg_cron SQL runs
-- server-side inside PostgreSQL — it is never exposed to the client.

-- Create the cron job (placeholder — must be updated with real key via SQL Editor)
SELECT cron.unschedule('chainsolve-daily-digest');
SELECT cron.schedule(
  'chainsolve-daily-digest',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url    := 'https://zjgfosqtnlhlfgpohnnu.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer PLACEHOLDER_REPLACE_WITH_SERVICE_ROLE_KEY'
    ),
    body   := '{}'::jsonb
  );
  $$
);
