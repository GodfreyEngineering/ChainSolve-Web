/**
 * auditLogRedaction.test.ts — P128: Audit log redaction guarantee.
 *
 * Explicitly verifies that NO sensitive data survives into the audit log:
 *  - Secret-keyed fields (token, password, secret, auth, jwt, …)
 *  - JWT token strings embedded in values
 *  - Bearer token strings embedded in values
 *  - Email addresses embedded in values
 *  - Nested objects containing secrets
 *
 * These tests are independent of the Supabase mock — they test the
 * redactObject() function directly as the canonical redaction contract.
 */

import { describe, it, expect } from 'vitest'
import { redactObject } from '../observability/redact'

// ── Secret-keyed fields ───────────────────────────────────────────────────────

describe('Audit log redaction — secret-keyed fields', () => {
  const SENSITIVE_KEYS = [
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
    'supabase',
  ]

  for (const key of SENSITIVE_KEYS) {
    it(`redacts field "${key}"`, () => {
      const result = redactObject({ [key]: 'super-sensitive-value' }) as Record<string, unknown>
      expect(result[key]).toBe('[REDACTED]')
    })
  }

  it('redacts case-insensitive key variants', () => {
    const result = redactObject({ TOKEN: 'val', Password: 'val2' }) as Record<string, unknown>
    expect(result.TOKEN).toBe('[REDACTED]')
    expect(result.Password).toBe('[REDACTED]')
  })

  it('does NOT redact safe fields', () => {
    const result = redactObject({
      name: 'My project',
      eventType: 'project.create',
      objectId: 'proj-123',
      count: 42,
    }) as Record<string, unknown>
    expect(result.name).toBe('My project')
    expect(result.eventType).toBe('project.create')
    expect(result.objectId).toBe('proj-123')
    expect(result.count).toBe(42)
  })
})

// ── JWT token strings in values ───────────────────────────────────────────────

describe('Audit log redaction — JWT tokens in string values', () => {
  const FAKE_JWT =
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

  it('replaces a bare JWT in a string value', () => {
    const result = redactObject({ note: FAKE_JWT }) as Record<string, unknown>
    expect(String(result.note)).not.toContain(FAKE_JWT)
    expect(String(result.note)).toContain('[TOKEN]')
  })

  it('replaces a JWT embedded in a longer string', () => {
    const result = redactObject({
      description: `Logged in with ${FAKE_JWT} from mobile`,
    }) as Record<string, unknown>
    expect(String(result.description)).not.toContain(FAKE_JWT)
    expect(String(result.description)).toContain('[TOKEN]')
  })
})

// ── Bearer tokens in values ───────────────────────────────────────────────────

describe('Audit log redaction — Bearer tokens in string values', () => {
  it('replaces a Bearer token string', () => {
    // Use a non-secret key so value redaction (not key redaction) is tested.
    const result = redactObject({
      requestHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9xyz',
    }) as Record<string, unknown>
    expect(String(result.requestHeader)).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9xyz')
    expect(String(result.requestHeader)).toContain('[TOKEN]')
  })
})

// ── Email addresses in values ─────────────────────────────────────────────────

describe('Audit log redaction — email addresses in string values', () => {
  it('replaces an email address in a string value', () => {
    const result = redactObject({ invitedBy: 'admin@example.com' }) as Record<string, unknown>
    expect(String(result.invitedBy)).not.toContain('admin@example.com')
    expect(String(result.invitedBy)).toContain('[EMAIL]')
  })

  it('replaces an email embedded in a longer string', () => {
    const result = redactObject({
      message: 'Invited user bob@domain.org to the org',
    }) as Record<string, unknown>
    expect(String(result.message)).not.toContain('bob@domain.org')
    expect(String(result.message)).toContain('[EMAIL]')
  })
})

// ── Nested objects ────────────────────────────────────────────────────────────

describe('Audit log redaction — nested object scrubbing', () => {
  it('redacts secrets in nested objects', () => {
    const result = redactObject({
      outer: {
        inner: { token: 'leak', safe: 'ok' },
      },
    }) as Record<string, Record<string, Record<string, unknown>>>
    expect(result.outer.inner.token).toBe('[REDACTED]')
    expect(result.outer.inner.safe).toBe('ok')
  })

  it('redacts secrets in arrays', () => {
    const result = redactObject([{ password: 'secret123' }, { name: 'safe' }]) as Array<
      Record<string, unknown>
    >
    expect(result[0].password).toBe('[REDACTED]')
    expect(result[1].name).toBe('safe')
  })

  it('passes primitives through unchanged', () => {
    expect(redactObject(42)).toBe(42)
    expect(redactObject(true)).toBe(true)
    expect(redactObject(null)).toBeNull()
  })
})
