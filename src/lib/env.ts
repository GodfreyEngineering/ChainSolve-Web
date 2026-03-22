/**
 * Centralized client-side environment config.
 *
 * All VITE_* variables are accessed through this module. Validation runs
 * eagerly on import so missing required vars surface as actionable errors
 * at boot time rather than silently failing later.
 */

// ── Typed accessors ──────────────────────────────────────────────────────────

/** Supabase project URL (required in production). */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''

/** Supabase anonymous key (required in production). */
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Set to 'true' only in CI smoke builds — bypasses placeholder credential guard. */
export const IS_CI_BUILD = import.meta.env.VITE_IS_CI_BUILD === 'true'

/** Opt-in observability pipeline. */
export const OBS_ENABLED = import.meta.env.VITE_OBS_ENABLED === 'true'

/** Observability sampling rate (0.0–1.0). */
export const OBS_SAMPLE_RATE = (() => {
  const raw = import.meta.env.VITE_OBS_SAMPLE_RATE
  if (raw == null) return 1.0
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1.0
})()

/** Turnstile CAPTCHA site key. Empty string disables CAPTCHA. */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

/** Diagnostics UI enabled in production. Always available in dev. */
export const DIAGNOSTICS_UI_ENABLED = import.meta.env.VITE_DIAGNOSTICS_UI_ENABLED === 'true'

/** LLM API key for ChainSolve AI. Empty string = not configured. */
export const LLM_API_KEY = (import.meta.env.VITE_LLM_API_KEY as string) ?? ''

/** DEV-04: Sentry DSN for error tracking. Empty string disables Sentry. */
export const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string) ?? ''

/** PostHog project API key. Empty string disables PostHog. */
export const POSTHOG_KEY = (import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string) ?? ''

/** PostHog API host (e.g. https://eu.i.posthog.com). */
export const POSTHOG_HOST = (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string) ?? ''

/** Plausible domain for traffic analytics (e.g. app.chainsolve.co.uk). */
export const PLAUSIBLE_DOMAIN = (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string) ?? ''

/** Application version string. Updated each release. */
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string) ?? ''

// ── Placeholder detection ────────────────────────────────────────────────────

const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder'

export const isPlaceholderCredentials =
  !SUPABASE_URL ||
  SUPABASE_URL === PLACEHOLDER_URL ||
  !SUPABASE_ANON_KEY ||
  SUPABASE_ANON_KEY === PLACEHOLDER_KEY

// ── Startup validation (production only) ─────────────────────────────────────

/**
 * Validates that required env vars are present. Throws an actionable error
 * if production builds have missing or placeholder credentials.
 *
 * Called automatically on import in production. CI builds (VITE_IS_CI_BUILD)
 * intentionally use placeholder credentials and skip this check.
 */
export function validateClientEnv(): void {
  if (!import.meta.env.PROD || IS_CI_BUILD) return

  if (!SUPABASE_URL || SUPABASE_URL === PLACEHOLDER_URL) {
    throw new Error(
      '[CONFIG_INVALID] VITE_SUPABASE_URL is missing or still set to the placeholder ' +
        'value. Set the real Supabase project URL in GitHub Secrets ' +
        '(Settings → Secrets → Actions → VITE_SUPABASE_URL) and redeploy.',
    )
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === PLACEHOLDER_KEY) {
    throw new Error(
      '[CONFIG_INVALID] VITE_SUPABASE_ANON_KEY is missing or still set to the placeholder ' +
        'value. Set the real Supabase anon key in GitHub Secrets ' +
        '(Settings → Secrets → Actions → VITE_SUPABASE_ANON_KEY) and redeploy.',
    )
  }
}

// Run validation eagerly on import in production.
validateClientEnv()
