/**
 * turnstile.ts — Turnstile CAPTCHA configuration (E2-2).
 *
 * Shared constants and helpers for the Turnstile integration.
 * Kept separate from the widget component to satisfy react-refresh
 * (components-only files).
 */

import { TURNSTILE_SITE_KEY } from './env'
export { TURNSTILE_SITE_KEY }

/** Returns true if a Turnstile site key is configured. */
export function isTurnstileEnabled(): boolean {
  return TURNSTILE_SITE_KEY.length > 0
}
