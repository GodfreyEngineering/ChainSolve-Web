/**
 * validateUserString.ts — Shared input validation for user-supplied names.
 *
 * Provides:
 * - `validateUserString()` — strict code-friendly identifier (no spaces)
 * - `validateUserLabel()` — relaxed human-readable name (spaces OK)
 * - Shared `FORBIDDEN_PATTERNS`, `hasControlChars()`, `findForbiddenWord()`
 *
 * Other validators (validateDisplayName, validateProjectName) can import
 * the shared helpers to stay in sync.
 */

export interface ValidationResult {
  ok: boolean
  error?: string
}

// ── Forbidden patterns (case-insensitive) ──────────────────────────────

export const FORBIDDEN_PATTERNS: readonly string[] = [
  // Impersonation
  'admin',
  'moderator',
  'chainsolveteam',
  'chainsolvesupport',
  'support_team',
  'chainsolve_admin',
  'cs_support',
  'system',
  'root',
  'official',
  // Spam indicators
  'free_money',
  'click_here',
  'buy_now',
  'limited_offer',
  'casino',
  'viagra',
  'crypto_free',
  // Placeholder / test
  'test_user',
  'null',
  'undefined',
  'anonymous',
  '[deleted]',
  'deleted_user',
  // Offensive (baseline — community moderation handles edge cases)
  'fuck',
  'shit',
  'asshole',
  'bitch',
  'nigger',
  'faggot',
  'retard',
  'cunt',
  'porn',
  'nazi',
  'hitler',
  'kill_yourself',
  'kys',
]

/** Control characters (ASCII 0x00-0x1F, 0x7F, and common Unicode control). */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1F\x7F\u200B-\u200F\u2028-\u202F\uFEFF]/

/** Strict identifier: ASCII letters, digits, underscore, dash only. */
const STRICT_CHARS = /^[a-zA-Z0-9_-]+$/

// ── Shared helpers (exported for other validators) ─────────────────────

/** Returns true if the string contains control characters. */
export function hasControlChars(s: string): boolean {
  return CONTROL_CHARS.test(s)
}

/**
 * Returns the first forbidden pattern found in the name, or null if clean.
 * Normalizes by lowercasing and collapsing whitespace/punctuation to underscores.
 */
export function findForbiddenWord(name: string): string | null {
  const normalized = name.toLowerCase().replace(/[\s\-_.']+/g, '_')
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (normalized.includes(pattern)) {
      return pattern
    }
  }
  return null
}

// ── Strict validator (identifiers: no spaces) ──────────────────────────

export interface StrictOptions {
  /** Minimum length (default 3). */
  minLength?: number
  /** Maximum length (default 50). */
  maxLength?: number
  /** Field label for error messages (default "name"). */
  field?: string
}

/**
 * Validate a strict code-friendly identifier.
 *
 * Rules: 3–50 chars (configurable), alphanumeric + underscore + dash only,
 * no spaces, no offensive words.
 *
 * Use for: material names, group names, theme names, filenames.
 */
export function validateUserString(name: unknown, opts: StrictOptions = {}): ValidationResult {
  const { minLength = 3, maxLength = 50, field = 'name' } = opts

  if (typeof name !== 'string') {
    return { ok: false, error: `${field} must be a string` }
  }

  const trimmed = name.trim()

  if (!trimmed) {
    return { ok: false, error: `${field} is required` }
  }

  if (trimmed.length < minLength) {
    return {
      ok: false,
      error: `${field} must be at least ${minLength} characters`,
    }
  }

  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${field} must not exceed ${maxLength} characters`,
    }
  }

  if (hasControlChars(trimmed)) {
    return { ok: false, error: `${field} contains invalid characters` }
  }

  if (!STRICT_CHARS.test(trimmed)) {
    return {
      ok: false,
      error: `${field} can only contain letters, numbers, underscores, and dashes`,
    }
  }

  const forbidden = findForbiddenWord(trimmed)
  if (forbidden) {
    return { ok: false, error: `${field} contains a forbidden word` }
  }

  return { ok: true }
}
