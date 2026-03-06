import { describe, it, expect } from 'vitest'
import { ServiceError, isRetryableError } from './errors'

describe('ServiceError', () => {
  it('constructs with code and message', () => {
    const err = new ServiceError('DB_ERROR', 'Something broke')
    expect(err.code).toBe('DB_ERROR')
    expect(err.message).toBe('Something broke')
    expect(err.retryable).toBe(false)
    expect(err.name).toBe('ServiceError')
    expect(err).toBeInstanceOf(Error)
  })

  it('supports retryable flag', () => {
    const err = new ServiceError('NETWORK_ERROR', 'timeout', true)
    expect(err.retryable).toBe(true)
  })

  it('supports cause', () => {
    const cause = new Error('original')
    const err = new ServiceError('STORAGE_ERROR', 'upload failed', false, cause)
    expect(err.cause).toBe(cause)
  })
})

describe('isRetryableError', () => {
  it('returns true for retryable ServiceError', () => {
    expect(isRetryableError(new ServiceError('NETWORK_ERROR', 'fail', true))).toBe(true)
  })

  it('returns false for non-retryable ServiceError', () => {
    expect(isRetryableError(new ServiceError('DB_ERROR', 'fail', false))).toBe(false)
  })

  it('returns true for network-related error messages', () => {
    expect(isRetryableError(new Error('network timeout'))).toBe(true)
    expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isRetryableError(new Error('invalid input'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isRetryableError('string')).toBe(false)
    expect(isRetryableError(null)).toBe(false)
  })
})
