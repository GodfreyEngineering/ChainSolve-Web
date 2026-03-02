/**
 * redaction-regression.test.ts — F2-3: Canonical redaction guarantees.
 *
 * Regression tests that verify tokens, keys, emails, and passwords NEVER
 * survive through any redaction path. These tests exercise redactString,
 * redactObject, and validateNoSecrets as the three canonical gates.
 */

import { describe, it, expect } from 'vitest'
import { redactString, redactObject, isSecretKey } from '../observability/redact'
import { validateNoSecrets } from './chainsolvejson/model'

// ── Sample secrets ───────────────────────────────────────────────────────────

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
const SAMPLE_BEARER = `Bearer ${SAMPLE_JWT}`
const SAMPLE_EMAIL = 'user@example.com'
const SAMPLE_CC = '4111 1111 1111 1111'
const SAMPLE_KEY = 'sk_test_FAKE_00000000000000000000000'

// ── redactString: no secrets survive ─────────────────────────────────────────

describe('Redaction regression: redactString never leaks', () => {
  it('strips JWT tokens', () => {
    const result = redactString(`token: ${SAMPLE_JWT}`)
    expect(result).not.toContain('eyJ')
    expect(result).toContain('[TOKEN]')
  })

  it('strips Bearer tokens', () => {
    const result = redactString(SAMPLE_BEARER)
    expect(result).not.toContain('eyJ')
    expect(result).toContain('Bearer [TOKEN]')
  })

  it('strips email addresses', () => {
    const result = redactString(`contact: ${SAMPLE_EMAIL}`)
    expect(result).not.toContain('@example.com')
    expect(result).toContain('[EMAIL]')
  })

  it('strips credit card numbers', () => {
    const result = redactString(`card: ${SAMPLE_CC}`)
    expect(result).not.toContain('4111')
    expect(result).toContain('[CC]')
  })

  it('handles mixed sensitive content', () => {
    const mixed = `User ${SAMPLE_EMAIL} authenticated with ${SAMPLE_BEARER} using card ${SAMPLE_CC}`
    const result = redactString(mixed)
    expect(result).not.toContain('@example.com')
    expect(result).not.toContain('eyJ')
    expect(result).not.toContain('4111')
  })
})

// ── redactObject: no secret-keyed values survive ─────────────────────────────

describe('Redaction regression: redactObject never leaks', () => {
  it('redacts all secret-keyed fields', () => {
    const obj = {
      token: SAMPLE_JWT,
      password: 'hunter2',
      apikey: SAMPLE_KEY,
      authorization: SAMPLE_BEARER,
      secret: 'my-secret-value',
      session: 'sess_abc123',
      safe_field: 'visible',
    }
    const result = redactObject(obj) as Record<string, unknown>

    expect(result.token).toBe('[REDACTED]')
    expect(result.password).toBe('[REDACTED]')
    expect(result.apikey).toBe('[REDACTED]')
    expect(result.authorization).toBe('[REDACTED]')
    expect(result.secret).toBe('[REDACTED]')
    expect(result.session).toBe('[REDACTED]')
    expect(result.safe_field).toBe('visible')
  })

  it('redacts deeply nested secrets', () => {
    const obj = {
      level1: {
        level2: {
          api_key: 'secret-key-value',
          data: 'safe',
        },
      },
    }
    const result = redactObject(obj) as { level1: { level2: Record<string, unknown> } }
    expect(result.level1.level2.api_key).toBe('[REDACTED]')
    expect(result.level1.level2.data).toBe('safe')
  })

  it('redacts JWTs in non-secret-keyed string values', () => {
    const obj = { message: `Error: ${SAMPLE_JWT}` }
    const result = redactObject(obj) as Record<string, unknown>
    expect(String(result.message)).not.toContain('eyJ')
  })

  it('redacts emails in string values', () => {
    const obj = { log: `User ${SAMPLE_EMAIL} logged in` }
    const result = redactObject(obj) as Record<string, unknown>
    expect(String(result.log)).not.toContain('@example.com')
  })
})

// ── isSecretKey: comprehensive key detection ─────────────────────────────────

describe('Redaction regression: isSecretKey catches all patterns', () => {
  const SECRET_KEYS = [
    'token',
    'access_token',
    'refresh_token',
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

  for (const key of SECRET_KEYS) {
    it(`detects "${key}" as secret`, () => {
      expect(isSecretKey(key)).toBe(true)
    })

    it(`detects "${key.toUpperCase()}" as secret (case-insensitive)`, () => {
      expect(isSecretKey(key.toUpperCase())).toBe(true)
    })
  }

  it('allows safe keys through', () => {
    expect(isSecretKey('name')).toBe(false)
    expect(isSecretKey('value')).toBe(false)
    expect(isSecretKey('description')).toBe(false)
  })
})

// ── validateNoSecrets: export gate ───────────────────────────────────────────

describe('Redaction regression: validateNoSecrets blocks export', () => {
  it('blocks JSON with access_token field', () => {
    const json = JSON.stringify({ access_token: 'abc123' })
    const result = validateNoSecrets(json)
    expect(result.ok).toBe(false)
    expect(result.found).toContain('access_token')
  })

  it('blocks JSON with password field', () => {
    const json = JSON.stringify({ password: 'hunter2' })
    const result = validateNoSecrets(json)
    expect(result.ok).toBe(false)
    expect(result.found).toContain('password')
  })

  it('allows clean JSON through', () => {
    const json = JSON.stringify({ name: 'My Project', nodes: [], edges: [] })
    const result = validateNoSecrets(json)
    expect(result.ok).toBe(true)
    expect(result.found).toHaveLength(0)
  })
})
