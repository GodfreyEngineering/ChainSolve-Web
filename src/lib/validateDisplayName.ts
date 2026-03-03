/**
 * validateDisplayName.ts — Display name validation (J1-1).
 *
 * Checks length, allowed characters, and a basic forbidden words list.
 * Used during signup wizard profile creation and profile settings edits.
 */

export interface DisplayNameResult {
  ok: boolean
  error?: string
}

const MAX_LENGTH = 100
const MIN_LENGTH = 2

/**
 * Forbidden substrings (case-insensitive). Covers common offensive terms,
 * impersonation patterns, and spam indicators. This is a baseline filter;
 * community moderation (user_reports) handles edge cases.
 */
const FORBIDDEN_PATTERNS: string[] = [
  // Impersonation
  'admin',
  'moderator',
  'chainsolveteam',
  'chainsolvesupport',
  'support_team',
  'official',
  // Spam indicators
  'free_money',
  'click_here',
  'buy_now',
  'limited_offer',
  // Placeholder / test
  'test_user',
  'null',
  'undefined',
  'anonymous',
  '[deleted]',
]

/** Characters allowed: letters (any script), digits, spaces, hyphens, underscores, periods, apostrophes. */
const ALLOWED_CHARS = /^[\p{L}\p{N}\s\-_.']+$/u

/** Control characters (ASCII 0x00-0x1F, 0x7F, and common Unicode control). */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1F\x7F\u200B-\u200F\u2028-\u202F\uFEFF]/

/**
 * Validate a display name for profile creation.
 *
 * Returns { ok: true } or { ok: false, error: string }.
 */
export function validateDisplayName(name: string): DisplayNameResult {
  const trimmed = name.trim()

  if (!trimmed) {
    return { ok: false, error: 'displayNameRequired' }
  }

  if (trimmed.length < MIN_LENGTH) {
    return { ok: false, error: 'displayNameTooShort' }
  }

  if (trimmed.length > MAX_LENGTH) {
    return { ok: false, error: 'displayNameTooLong' }
  }

  if (CONTROL_CHARS.test(trimmed)) {
    return { ok: false, error: 'displayNameControlChars' }
  }

  if (!ALLOWED_CHARS.test(trimmed)) {
    return { ok: false, error: 'displayNameInvalidChars' }
  }

  // Normalize for forbidden word check: lowercase, collapse whitespace, strip special chars.
  const normalized = trimmed.toLowerCase().replace(/[\s\-_.']+/g, '_')
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (normalized.includes(pattern)) {
      return { ok: false, error: 'displayNameForbidden' }
    }
  }

  return { ok: true }
}
