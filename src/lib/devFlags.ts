/**
 * Dev-only feature flags driven by URL query parameters.
 *
 * These are evaluated once at module init (not per-render) so the overhead
 * for production users is effectively zero.
 */

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null

/** Returns true if `?perf=1` is present in the URL. */
export function isPerfHudEnabled(): boolean {
  return params?.get('perf') === '1'
}
