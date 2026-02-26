/**
 * GET /api/health
 *
 * Lightweight post-deploy config check.  Reports whether each required
 * server-side environment variable is present (truthy) in Cloudflare Pages.
 *
 * Returns 200 if all vars are set, 500 if any are missing.
 * Never reveals the actual values — only whether they exist.
 *
 * Usage:
 *   curl https://app.chainsolve.co.uk/api/health | jq .
 *
 * Expected response (all configured):
 *   { "ok": true, "checks": { "SUPABASE_URL": true, ... } }
 *
 * Missing vars:
 *   { "ok": false, "checks": { "SUPABASE_URL": false, ... } }  → HTTP 500
 */

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID_PRO_MONTHLY: string;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const checks: Record<string, boolean> = {
    SUPABASE_URL: Boolean(context.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(context.env.SUPABASE_SERVICE_ROLE_KEY),
    STRIPE_SECRET_KEY: Boolean(context.env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: Boolean(context.env.STRIPE_WEBHOOK_SECRET),
    STRIPE_PRICE_ID_PRO_MONTHLY: Boolean(context.env.STRIPE_PRICE_ID_PRO_MONTHLY),
  };

  const ok = Object.values(checks).every(Boolean);

  return Response.json({ ok, checks }, { status: ok ? 200 : 500 });
};
