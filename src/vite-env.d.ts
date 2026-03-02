/// <reference types="vite/client" />

// Build-time constants injected via vite.config.ts `define`
declare const __CS_VERSION__: string
declare const __CS_SHA__: string
declare const __CS_BUILD_TIME__: string
declare const __CS_ENV__: string

// Custom VITE_ env variables (replaced at build time by Vite)
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /**
   * Set to 'true' only in the node_checks CI build step so e2e smoke tests
   * can boot the app with placeholder Supabase credentials.  Must NOT be set
   * in the deploy job — see .github/workflows/ci.yml.
   */
  readonly VITE_IS_CI_BUILD?: string

  // ── Observability (W9.8) ──────────────────────────────────────────────────
  /** Set to 'false' to disable the client observability pipeline entirely. */
  readonly VITE_OBS_ENABLED?: string
  /**
   * Enables the /diagnostics UI in production when set to 'true'.
   * In development, /diagnostics is always available.
   * In production it is also gated by localStorage key 'cs_diag=1'.
   */
  readonly VITE_DIAGNOSTICS_UI_ENABLED?: string
  /** Sampling rate for client events (0.0–1.0). Default: 1.0. */
  readonly VITE_OBS_SAMPLE_RATE?: string

  // ── Turnstile CAPTCHA (E2-2) ──────────────────────────────────────────────
  /** Turnstile site key. Omit to disable CAPTCHA. */
  readonly VITE_TURNSTILE_SITE_KEY?: string

  // ── AI Copilot ─────────────────────────────────────────────────────────────
  /** LLM API key for AI copilot. Omit to disable. */
  readonly VITE_LLM_API_KEY?: string
}
