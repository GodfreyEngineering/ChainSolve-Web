/**
 * Canonical server-side environment type for Cloudflare Pages Functions.
 *
 * Import this instead of defining a local `type Env` in each handler.
 * Use `requireEnv()` to validate that required vars are present and get
 * an actionable error if any are missing.
 */

/** All environment variables available in Cloudflare Pages Functions. */
export interface CfEnv {
  // ── Supabase ────────────────────────────────────────────────────────────────
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string

  // ── Stripe ──────────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_PRICE_ID_PRO_MONTHLY: string
  STRIPE_PRICE_ID_PRO_ANNUAL: string
  STRIPE_PRICE_ID_ENT_10_MONTHLY: string
  STRIPE_PRICE_ID_ENT_10_ANNUAL: string
  STRIPE_PRICE_ID_ENT_UNLIMITED_MONTHLY: string
  STRIPE_PRICE_ID_ENT_UNLIMITED_ANNUAL: string

  // ── AI Copilot ──────────────────────────────────────────────────────────────
  OPEN_AI_API_KEY?: string
  AI_MODEL?: string
}

/**
 * Validate that required environment variables are present. Returns a typed
 * object with the requested keys. Throws a 500 JSON response if any are missing.
 *
 * Usage:
 *   const { SUPABASE_URL, STRIPE_SECRET_KEY } = requireEnv(context.env, [
 *     'SUPABASE_URL', 'STRIPE_SECRET_KEY',
 *   ])
 */
export function requireEnv<K extends keyof CfEnv>(
  env: CfEnv,
  keys: K[],
): Pick<CfEnv, K> {
  const missing = keys.filter((k) => !env[k])
  if (missing.length > 0) {
    throw new Response(
      JSON.stringify({
        ok: false,
        error: `Missing required environment variable(s): ${missing.join(', ')}. ` +
          'Configure them in Cloudflare Pages → Settings → Environment variables.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return env
}
