/**
 * reauth.ts — Module-level re-authentication state for billing-sensitive ops.
 *
 * Billing operations require password re-authentication with a 10-minute
 * validity window (SEC-4, AU-5).  This module tracks the timestamp; the
 * actual password check is done via auth.ts:reauthenticate().
 */

/** Re-authentication window in milliseconds (10 minutes). */
export const REAUTH_WINDOW_MS = 10 * 60 * 1000

/** Module-level timestamp; 0 means not yet re-authenticated. */
let _reauthExpiry = 0

/** Returns true if re-auth was completed within the last 10 minutes. */
export function isReauthed(): boolean {
  return Date.now() < _reauthExpiry
}

/** Mark the user as re-authenticated right now (starts 10-minute window). */
export function markReauthed(): void {
  _reauthExpiry = Date.now() + REAUTH_WINDOW_MS
}

/** Invalidate re-auth state (called on sign-out). */
export function clearReauth(): void {
  _reauthExpiry = 0
}
