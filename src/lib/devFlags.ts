/**
 * Dev-only feature flags driven by URL query parameters.
 *
 * These are evaluated once at module init (not per-render) so the overhead
 * for production users is effectively zero.
 */

import { DIAGNOSTICS_UI_ENABLED } from './env'

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null

/** Returns true if `?perf=1` is present in the URL. */
export function isPerfHudEnabled(): boolean {
  return params?.get('perf') === '1'
}

/**
 * Returns true if the /diagnostics UI should be accessible.
 *
 * Rules:
 *   - Development: always enabled.
 *   - Production: only if VITE_DIAGNOSTICS_UI_ENABLED=true AND
 *     localStorage contains 'cs_diag=1'.
 */
export function isDiagnosticsUIEnabled(): boolean {
  if (import.meta.env.DEV) return true
  if (!DIAGNOSTICS_UI_ENABLED) return false
  try {
    return typeof window !== 'undefined' && localStorage.getItem('cs_diag') === '1'
  } catch {
    return false
  }
}
