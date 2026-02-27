/**
 * validateStoragePath — defence-in-depth against path traversal attacks.
 *
 * Supabase Storage RLS already guarantees the first path segment is
 * `{auth.uid()}`. This module adds an application-level second layer that
 * rejects paths before they reach the storage API.
 *
 * Detects:
 *   - `..` path segments (literal)
 *   - URL-encoded traversal (`%2e%2e`, `%2F`, etc.)
 *   - Double-encoded traversal (`%252e%252e`)
 *   - Null bytes (`\0`, `%00`)
 *   - Backslashes (not valid in our path convention)
 *   - Malformed percent-encoding
 */

export interface StoragePathValidation {
  ok: boolean
  reason?: string
}

/** `..` as a path segment, optionally surrounded by `/` or at start/end of string. */
const DOT_DOT_SEG = /(^|\/)\.\.($|\/)/

/** Encoded null byte in URL form (`%00`). Raw null bytes checked via `includes`. */
const ENCODED_NULL = /%00/i

/** Single- or double-encoded dot-dot variants (`%2e%2e`, `%252e`). */
const ENCODED_TRAVERSAL = /%2e%2e|%252e/i

/** Backslash — not valid in our storage paths. */
const BACKSLASH = /\\/

/**
 * Validate a Supabase Storage path against traversal and injection attacks.
 *
 * Returns `{ ok: true }` for safe paths.
 * Returns `{ ok: false, reason }` for rejected paths.
 *
 * Does NOT validate that the path starts with the correct user prefix — that
 * is enforced by RLS. This function only rejects traversal-style inputs.
 */
export function validateStoragePath(path: string): StoragePathValidation {
  if (typeof path !== 'string' || path.length === 0) {
    return { ok: false, reason: 'empty path' }
  }

  // Raw null byte check — avoids no-control-regex lint by using string includes
  if (path.includes('\x00')) {
    return { ok: false, reason: 'null byte in path' }
  }

  if (ENCODED_NULL.test(path)) {
    return { ok: false, reason: 'null byte in path' }
  }

  if (BACKSLASH.test(path)) {
    return { ok: false, reason: 'backslash not allowed' }
  }

  if (ENCODED_TRAVERSAL.test(path)) {
    return { ok: false, reason: 'URL-encoded traversal sequence' }
  }

  if (DOT_DOT_SEG.test(path)) {
    return { ok: false, reason: 'traversal: ..' }
  }

  // Decode once and re-check (single-encoded traversal that slipped past above)
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return { ok: false, reason: 'malformed URL encoding' }
  }

  if (decoded.includes('\x00')) {
    return { ok: false, reason: 'null byte in decoded path' }
  }

  if (DOT_DOT_SEG.test(decoded)) {
    return { ok: false, reason: 'traversal: .. (decoded)' }
  }

  return { ok: true }
}

/**
 * Assert that a storage path is safe; throw `Error` if not.
 *
 * Call this in service functions that accept a `storagePath` sourced from the
 * DB or user-supplied JSON before passing it to the storage API.
 */
export function assertSafeStoragePath(path: string): void {
  const result = validateStoragePath(path)
  if (!result.ok) {
    throw new Error(`Rejected unsafe storage path: ${result.reason ?? 'invalid'}`)
  }
}
