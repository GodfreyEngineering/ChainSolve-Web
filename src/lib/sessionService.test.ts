/**
 * sessionService.test.ts — Unit tests for device session tracking (E2-5).
 */

import { describe, it, expect } from 'vitest'
import { parseDeviceLabel } from './sessionService'

describe('parseDeviceLabel', () => {
  it('detects Chrome on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(parseDeviceLabel(ua)).toBe('Chrome on Windows')
  })

  it('detects Firefox on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
    expect(parseDeviceLabel(ua)).toBe('Firefox on macOS')
  })

  it('detects Safari on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
    expect(parseDeviceLabel(ua)).toBe('Safari on macOS')
  })

  it('detects Edge on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    expect(parseDeviceLabel(ua)).toBe('Edge on Windows')
  })

  it('detects Chrome on Linux', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(parseDeviceLabel(ua)).toBe('Chrome on Linux')
  })

  it('detects Chrome on Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    expect(parseDeviceLabel(ua)).toBe('Chrome on Android')
  })

  it('detects Safari on iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
    expect(parseDeviceLabel(ua)).toBe('Safari on iOS')
  })

  it('returns Unknown device for empty string', () => {
    expect(parseDeviceLabel('')).toBe('Unknown device')
  })

  it('returns Browser for unknown user agent', () => {
    expect(parseDeviceLabel('SomeBot/1.0')).toBe('Browser')
  })
})
