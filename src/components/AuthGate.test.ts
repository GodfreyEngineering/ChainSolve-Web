/**
 * AuthGate.test.ts — Unit tests for AuthGate error handling (G0-1).
 *
 * Verifies that the error extraction logic correctly handles:
 *  - Standard Error instances
 *  - PostgrestError-like plain objects with a `message` property
 *  - Unknown error types (falls back to generic message)
 */

import { describe, it, expect } from 'vitest'

/**
 * Extracted error message logic from TermsAcceptanceScreen.handleAccept.
 * Kept in sync with AuthGate.tsx — if the logic changes there, update here.
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err)
    return String((err as { message: unknown }).message)
  return 'Failed to record acceptance. Please retry.'
}

describe('AuthGate error extraction', () => {
  it('extracts message from Error instance', () => {
    expect(extractErrorMessage(new Error('Network timeout'))).toBe('Network timeout')
  })

  it('extracts message from PostgrestError-like object', () => {
    const pgError = {
      message: 'new row violates RLS policy',
      code: '42501',
      details: '',
      hint: '',
    }
    expect(extractErrorMessage(pgError)).toBe('new row violates RLS policy')
  })

  it('extracts message from plain object with message property', () => {
    expect(extractErrorMessage({ message: 'custom error' })).toBe('custom error')
  })

  it('handles numeric message property by converting to string', () => {
    expect(extractErrorMessage({ message: 500 })).toBe('500')
  })

  it('falls back to generic message for null', () => {
    expect(extractErrorMessage(null)).toBe('Failed to record acceptance. Please retry.')
  })

  it('falls back to generic message for undefined', () => {
    expect(extractErrorMessage(undefined)).toBe('Failed to record acceptance. Please retry.')
  })

  it('falls back to generic message for string', () => {
    expect(extractErrorMessage('some string error')).toBe(
      'Failed to record acceptance. Please retry.',
    )
  })

  it('falls back to generic message for object without message', () => {
    expect(extractErrorMessage({ code: 42 })).toBe('Failed to record acceptance. Please retry.')
  })
})

describe('AuthGate module', () => {
  it('exports a default function component', async () => {
    const mod = await import('./AuthGate')
    expect(typeof mod.default).toBe('function')
    expect(mod.default.name).toBe('AuthGate')
  })
})
