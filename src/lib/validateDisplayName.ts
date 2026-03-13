/**
 * validateDisplayName.ts — Display name validation (J1-1).
 *
 * Uses shared forbidden-word list from validateUserString.ts.
 * Keeps its own character set (relaxed: allows spaces, periods, apostrophes)
 * and error key format for backward compatibility.
 */

import { hasControlChars, findForbiddenWord } from './validateUserString'

export interface DisplayNameResult {
  ok: boolean
  error?: string
}

const MAX_LENGTH = 100
const MIN_LENGTH = 2

/** Characters allowed: letters (any script), digits, spaces, hyphens, underscores, periods, apostrophes. */
const ALLOWED_CHARS = /^[\p{L}\p{N}\s\-_.']+$/u

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

  if (hasControlChars(trimmed)) {
    return { ok: false, error: 'displayNameControlChars' }
  }

  if (!ALLOWED_CHARS.test(trimmed)) {
    return { ok: false, error: 'displayNameInvalidChars' }
  }

  if (findForbiddenWord(trimmed)) {
    return { ok: false, error: 'displayNameForbidden' }
  }

  return { ok: true }
}
