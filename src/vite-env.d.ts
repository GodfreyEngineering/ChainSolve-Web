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
}
