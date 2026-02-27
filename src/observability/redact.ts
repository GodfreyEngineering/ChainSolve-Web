/**
 * observability/redact.ts — Ruthless redaction of sensitive data.
 *
 * Used by every event capture path before storage or transport.
 * Functions are pure (no side effects) and deterministic.
 *
 * Redaction rules:
 *   1. Strip querystrings + fragments from URLs.
 *   2. Detect and replace JWT tokens, bearer tokens, emails, CC-like numbers.
 *   3. Deep-scrub objects: any key matching a secret-key pattern → '[REDACTED]'.
 *   4. Allowlist for safe context tags: only canvasId, projectId, locale, etc.
 *
 * See docs/observability/overview.md §Redaction for the full policy.
 */

// ── Patterns ──────────────────────────────────────────────────────────────────

/** Keys whose values are always redacted (case-insensitive substring match). */
const SECRET_KEY_PATTERNS = [
  'token',
  'secret',
  'password',
  'passwd',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'auth',
  'credential',
  'bearer',
  'jwt',
  'private',
  'signature',
  'signing',
  'hmac',
  'supabase',
]

/** Regex patterns for sensitive values in strings. */
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._+/=-]{10,}/gi
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
/** Very conservative CC detection: 16 digits in groups of 4 */
const CC_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g

// ── URL redaction ─────────────────────────────────────────────────────────────

/**
 * Strip querystring and fragment from a URL string.
 * Returns only scheme://host/path.
 *
 * @example
 * redactUrl('https://example.com/app?token=abc#hash') → 'https://example.com/app'
 */
export function redactUrl(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    // Not a full URL — strip from the first ? or #
    const q = url.indexOf('?')
    const h = url.indexOf('#')
    const cut = Math.min(q >= 0 ? q : url.length, h >= 0 ? h : url.length)
    return url.slice(0, cut)
  }
}

/**
 * Extract only the pathname from a URL string.
 * Used for route_path where we want path-only (no origin).
 */
export function pathOnly(url: string): string {
  if (!url) return url
  try {
    return new URL(url).pathname
  } catch {
    return redactUrl(url)
  }
}

// ── Value redaction ───────────────────────────────────────────────────────────

/**
 * Redact sensitive patterns from a single string value.
 * Replaces JWTs, bearer tokens, emails, CC-like numbers.
 */
export function redactString(s: string): string {
  return s
    .replace(BEARER_PATTERN, 'Bearer [TOKEN]')
    .replace(JWT_PATTERN, '[TOKEN]')
    .replace(EMAIL_PATTERN, '[EMAIL]')
    .replace(CC_PATTERN, '[CC]')
}

/** Returns true if the key name indicates a sensitive field. */
export function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SECRET_KEY_PATTERNS.some((p) => lower.includes(p))
}

// ── Object deep-scrub ─────────────────────────────────────────────────────────

/**
 * Deep-scrub an object: recursively replace any value whose key is in the
 * secret-key blocklist with '[REDACTED]'. Redacts strings at all levels.
 *
 * @param obj   The value to scrub (any type).
 * @param depth Current recursion depth (max 10; beyond that returns '[TRUNCATED]').
 */
export function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[TRUNCATED]'

  if (typeof obj === 'string') {
    return redactString(obj)
  }

  if (typeof obj === 'number' || typeof obj === 'boolean' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 100).map((v) => redactObject(v, depth + 1))
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (isSecretKey(k)) {
        result[k] = '[REDACTED]'
      } else {
        result[k] = redactObject(v, depth + 1)
      }
    }
    return result
  }

  // Function, symbol, undefined → drop
  return undefined
}

// ── Tag allowlist ─────────────────────────────────────────────────────────────

/**
 * Allowed tag keys for ObsEvent.tags.
 * Any key not in this list is silently dropped.
 */
const ALLOWED_TAG_KEYS = new Set([
  'canvasId',
  'projectId',
  'locale',
  'plan',
  'engineVersion',
  'routeType',
])

/**
 * Filter tags to the allowlist only, truncating values to 128 chars.
 */
export function redactTags(tags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tags)) {
    if (ALLOWED_TAG_KEYS.has(k) && typeof v === 'string') {
      out[k] = v.slice(0, 128)
    }
  }
  return out
}

// ── Fingerprinting ────────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hex fingerprint of the input string.
 * Uses Web Crypto (available in browser + Node 18+ + CF Workers).
 */
export async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Fast synchronous djb2 hash — used for in-process dedup only.
 * NOT cryptographically strong; do NOT use for server-side fingerprinting.
 */
export function djb2(s: string): string {
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i)
    hash = hash >>> 0 // keep 32-bit unsigned
  }
  return hash.toString(16)
}

/**
 * Build a dedup fingerprint for a client error event.
 * Synchronous — used in the hot path before deciding to send.
 */
export function makeFingerprint(eventType: string, message: string, routePath: string): string {
  return djb2(`${eventType}|${message.slice(0, 200)}|${routePath}`)
}
