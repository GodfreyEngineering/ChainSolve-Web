/**
 * stripeConnectService.test.ts — P111 stub tests.
 *
 * Verifies that each stub rejects with a "not yet implemented" message,
 * providing a clear signal when a stub is accidentally called in production.
 */

import { describe, it, expect } from 'vitest'
import {
  startConnectOnboarding,
  getConnectStatus,
  createCheckoutSession,
  hasPurchased,
} from './stripeConnectService'

describe('stripeConnectService stubs', () => {
  it('startConnectOnboarding throws not-implemented', async () => {
    await expect(startConnectOnboarding()).rejects.toThrow('not yet implemented')
  })

  it('getConnectStatus throws not-implemented', async () => {
    await expect(getConnectStatus()).rejects.toThrow('not yet implemented')
  })

  it('createCheckoutSession throws not-implemented', async () => {
    await expect(createCheckoutSession('item-1')).rejects.toThrow('not yet implemented')
  })

  it('hasPurchased throws not-implemented', async () => {
    await expect(hasPurchased('item-1')).rejects.toThrow('not yet implemented')
  })
})
