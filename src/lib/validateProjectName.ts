/**
 * validateProjectName — Runtime validation for user-supplied project names.
 *
 * Rules:
 *   - Must be a non-empty string after trimming
 *   - Max 100 characters (post-trim)
 *   - No control characters (ASCII 0x00–0x1F or 0x7F)
 *
 * Used by SaveAsDialog and CanvasPage inline rename before persisting to DB.
 */

export const PROJECT_NAME_MAX_LENGTH = 100

export interface ProjectNameValidation {
  ok: boolean
  /** Human-readable reason when ok === false. */
  error?: string
}

/** Matches any ASCII control character (U+0000–U+001F, U+007F). */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1F\x7F]/

/**
 * Validate a project name string.
 *
 * Callers should pass the raw (un-trimmed) user input.
 * The function trims internally for length/empty checks but rejects
 * names whose trimmed form differs from the trimmed expectation —
 * actual trimming is left to the caller on save.
 */
export function validateProjectName(name: unknown): ProjectNameValidation {
  if (typeof name !== 'string') {
    return { ok: false, error: 'project name must be a string' }
  }

  const trimmed = name.trim()

  if (trimmed.length === 0) {
    return { ok: false, error: 'project name must not be empty' }
  }

  if (trimmed.length > PROJECT_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `project name must not exceed ${PROJECT_NAME_MAX_LENGTH} characters`,
    }
  }

  if (CONTROL_CHARS.test(trimmed)) {
    return { ok: false, error: 'project name must not contain control characters' }
  }

  return { ok: true }
}
