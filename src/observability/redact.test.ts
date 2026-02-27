/**
 * Redaction unit tests.
 *
 * Run with: npm run test:unit
 *
 * Tests verify:
 *   - Tokens / JWTs are replaced
 *   - Emails are replaced
 *   - CC-like numbers are replaced
 *   - Querystrings are stripped from URLs
 *   - Secret keys in objects are redacted
 *   - Safe strings pass through unchanged
 *   - djb2 fingerprints are stable
 *   - SHA-256 hashString produces consistent hex
 */

import { describe, it, expect } from 'vitest'
import {
  redactUrl,
  pathOnly,
  redactString,
  redactObject,
  isSecretKey,
  redactTags,
  makeFingerprint,
  hashString,
  djb2,
} from './redact'

// ── redactUrl ─────────────────────────────────────────────────────────────────

describe('redactUrl', () => {
  it('strips querystring', () => {
    expect(redactUrl('https://app.chainsolve.co.uk/canvas/abc?token=xyz')).toBe(
      'https://app.chainsolve.co.uk/canvas/abc',
    )
  })

  it('strips fragment', () => {
    expect(redactUrl('https://app.chainsolve.co.uk/app#section')).toBe(
      'https://app.chainsolve.co.uk/app',
    )
  })

  it('strips both query and fragment', () => {
    expect(redactUrl('https://example.com/path?a=1&b=2#frag')).toBe('https://example.com/path')
  })

  it('returns path-only URL unchanged if no query', () => {
    expect(redactUrl('/canvas/proj123')).toBe('/canvas/proj123')
  })

  it('handles empty string', () => {
    expect(redactUrl('')).toBe('')
  })

  it('handles non-URL string with query', () => {
    expect(redactUrl('/app?secret=abc123')).toBe('/app')
  })
})

// ── pathOnly ──────────────────────────────────────────────────────────────────

describe('pathOnly', () => {
  it('extracts pathname from full URL', () => {
    expect(pathOnly('https://app.chainsolve.co.uk/canvas/proj123?x=y')).toBe('/canvas/proj123')
  })

  it('handles bare path', () => {
    expect(pathOnly('/canvas')).toBe('/canvas')
  })
})

// ── redactString ──────────────────────────────────────────────────────────────

describe('redactString', () => {
  it('replaces JWT tokens', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const result = redactString(`Bearer ${jwt}`)
    expect(result).not.toContain('eyJ')
    expect(result).toContain('[TOKEN]')
  })

  it('replaces email addresses', () => {
    expect(redactString('Error from user@example.com at line 42')).toBe(
      'Error from [EMAIL] at line 42',
    )
  })

  it('replaces credit-card-like numbers', () => {
    expect(redactString('Card: 4111 1111 1111 1111 declined')).toBe('Card: [CC] declined')
  })

  it('replaces CC without spaces', () => {
    expect(redactString('4111111111111111')).toBe('[CC]')
  })

  it('leaves safe strings unchanged', () => {
    const safe = 'Canvas evaluation completed in 12ms'
    expect(redactString(safe)).toBe(safe)
  })

  it('handles empty string', () => {
    expect(redactString('')).toBe('')
  })

  it('replaces multiple emails in one string', () => {
    const result = redactString('From a@b.com to c@d.co.uk')
    expect(result).toBe('From [EMAIL] to [EMAIL]')
  })
})

// ── isSecretKey ───────────────────────────────────────────────────────────────

describe('isSecretKey', () => {
  it.each([
    'token',
    'access_token',
    'Authorization',
    'password',
    'api_key',
    'sessionId',
    'cookie',
    'bearer_token',
    'jwt',
    'secret',
    'STRIPE_SECRET_KEY',
    'client_credential',
    'private_key',
    'supabaseKey',
    'SUPABASE_SERVICE_ROLE_KEY',
    'supabase_anon_key',
  ])('flags %s as secret', (key) => {
    expect(isSecretKey(key)).toBe(true)
  })

  it.each(['canvasId', 'projectId', 'locale', 'message', 'nodeId', 'count', 'ok'])(
    'does not flag %s as secret',
    (key) => {
      expect(isSecretKey(key)).toBe(false)
    },
  )
})

// ── redactObject ──────────────────────────────────────────────────────────────

describe('redactObject', () => {
  it('redacts secret keys', () => {
    const obj = { canvasId: 'abc', token: 'secret-token', message: 'hello' }
    const result = redactObject(obj) as Record<string, unknown>
    expect(result['canvasId']).toBe('abc')
    expect(result['token']).toBe('[REDACTED]')
    expect(result['message']).toBe('hello')
  })

  it('handles nested objects', () => {
    const obj = {
      meta: { authorization: 'Bearer xyz', nodeId: '1' },
    }
    const result = redactObject(obj) as { meta: Record<string, unknown> }
    expect(result.meta['authorization']).toBe('[REDACTED]')
    expect(result.meta['nodeId']).toBe('1')
  })

  it('redacts email values in strings', () => {
    const obj = { description: 'Error for user@test.com' }
    const result = redactObject(obj) as Record<string, unknown>
    expect(result['description']).toBe('Error for [EMAIL]')
  })

  it('handles arrays', () => {
    const arr = ['safe', 'user@x.com']
    const result = redactObject(arr) as string[]
    expect(result[0]).toBe('safe')
    expect(result[1]).toBe('[EMAIL]')
  })

  it('passes through numbers and booleans', () => {
    const obj = { count: 42, ok: true }
    const result = redactObject(obj) as Record<string, unknown>
    expect(result['count']).toBe(42)
    expect(result['ok']).toBe(true)
  })

  it('handles null', () => {
    expect(redactObject(null)).toBe(null)
  })

  it('redacts supabase key values', () => {
    const obj = {
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
      SUPABASE_SERVICE_ROLE_KEY: 'super-secret-service-key',
      canvasId: 'c123',
    }
    const result = redactObject(obj) as Record<string, unknown>
    expect(result['supabaseKey']).toBe('[REDACTED]')
    expect(result['SUPABASE_SERVICE_ROLE_KEY']).toBe('[REDACTED]')
    expect(result['canvasId']).toBe('c123')
  })
})

// ── redactTags ────────────────────────────────────────────────────────────────

describe('redactTags', () => {
  it('keeps allowlisted keys', () => {
    const tags = { canvasId: 'c1', projectId: 'p1', locale: 'en' }
    expect(redactTags(tags)).toEqual(tags)
  })

  it('drops non-allowlisted keys', () => {
    const tags = { canvasId: 'c1', userId: 'should-be-dropped', secret: 'x' }
    const result = redactTags(tags)
    expect(result['canvasId']).toBe('c1')
    expect(result['userId']).toBeUndefined()
    expect(result['secret']).toBeUndefined()
  })

  it('truncates values to 128 chars', () => {
    const longVal = 'x'.repeat(200)
    const result = redactTags({ canvasId: longVal })
    expect(result['canvasId']!.length).toBe(128)
  })
})

// ── djb2 + makeFingerprint ────────────────────────────────────────────────────

describe('djb2', () => {
  it('produces consistent output for same input', () => {
    expect(djb2('hello')).toBe(djb2('hello'))
  })

  it('produces different output for different inputs', () => {
    expect(djb2('hello')).not.toBe(djb2('world'))
  })

  it('returns a hex string', () => {
    expect(djb2('test')).toMatch(/^[0-9a-f]+$/)
  })
})

describe('makeFingerprint', () => {
  it('is stable for same args', () => {
    expect(makeFingerprint('client_error', 'TypeError: null', '/canvas')).toBe(
      makeFingerprint('client_error', 'TypeError: null', '/canvas'),
    )
  })

  it('differs for different event types', () => {
    expect(makeFingerprint('client_error', 'msg', '/')).not.toBe(
      makeFingerprint('react_errorboundary', 'msg', '/'),
    )
  })

  it('differs for different routes', () => {
    expect(makeFingerprint('client_error', 'msg', '/canvas')).not.toBe(
      makeFingerprint('client_error', 'msg', '/app'),
    )
  })
})

// ── hashString ────────────────────────────────────────────────────────────────

describe('hashString', () => {
  it('produces a 64-char hex string', async () => {
    const h = await hashString('hello world')
    expect(h).toHaveLength(64)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', async () => {
    const a = await hashString('test input')
    const b = await hashString('test input')
    expect(a).toBe(b)
  })

  it('differs for different inputs', async () => {
    const a = await hashString('input-a')
    const b = await hashString('input-b')
    expect(a).not.toBe(b)
  })
})
