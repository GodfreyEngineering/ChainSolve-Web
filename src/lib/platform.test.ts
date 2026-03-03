import { describe, it, expect } from 'vitest'
import {
  IS_WEB,
  IS_DESKTOP,
  IS_MOBILE,
  PLATFORM,
  supportsNativeFs,
  supportsPushNotifications,
  isWebview,
} from './platform'

describe('platform flags', () => {
  it('detects web platform', () => {
    expect(IS_WEB).toBe(true)
    expect(PLATFORM).toBe('web')
  })

  it('desktop and mobile are disabled', () => {
    expect(IS_DESKTOP).toBe(false)
    expect(IS_MOBILE).toBe(false)
  })

  it('native FS not supported on web', () => {
    expect(supportsNativeFs()).toBe(false)
  })

  it('push notifications not supported on web', () => {
    expect(supportsPushNotifications()).toBe(false)
  })

  it('web is not a webview', () => {
    expect(isWebview()).toBe(false)
  })
})
