/**
 * sessionService.test.ts — Unit tests for device session tracking (E2-5)
 * and single-session enforcement (H9-1).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock (hoisted so vi.mock factory can reference them) ────────────

const {
  mockDelete,
  mockDeleteEq,
  mockInsert,
  mockInsertSelect,
  mockInsertSelectSingle,
  mockSelectEq,
  mockSelectEqMaybeSingle,
  mockUpdateEq,
} = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockDeleteEq: vi.fn(),
  mockInsert: vi.fn(),
  mockInsertSelect: vi.fn(),
  mockInsertSelectSingle: vi.fn(),
  mockSelectEq: vi.fn(),
  mockSelectEqMaybeSingle: vi.fn(),
  mockUpdateEq: vi.fn(),
}))

vi.mock('./supabase', () => {
  mockDelete.mockReturnValue({ eq: mockDeleteEq })
  mockDeleteEq.mockResolvedValue({ error: null })
  mockInsertSelectSingle.mockResolvedValue({ data: { id: 'new-sess-id' }, error: null })
  mockInsertSelect.mockReturnValue({ single: mockInsertSelectSingle })
  mockInsert.mockReturnValue({ select: mockInsertSelect })
  mockSelectEqMaybeSingle.mockResolvedValue({ data: { id: 'sess-1' }, error: null })
  mockSelectEq.mockReturnValue({ maybeSingle: mockSelectEqMaybeSingle })
  mockUpdateEq.mockResolvedValue({ error: null })

  return {
    supabase: {
      from: vi.fn().mockReturnValue({
        delete: mockDelete,
        insert: mockInsert,
        select: vi.fn().mockReturnValue({ eq: mockSelectEq }),
        update: vi.fn().mockReturnValue({ eq: mockUpdateEq }),
      }),
    },
  }
})

import {
  parseDeviceLabel,
  getCurrentSessionId,
  enforceAndRegisterSession,
  isSessionValid,
  SESSION_CHECK_INTERVAL_MS,
} from './sessionService'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // Re-set mock chain defaults
  mockDelete.mockReturnValue({ eq: mockDeleteEq })
  mockDeleteEq.mockResolvedValue({ error: null })
  mockInsertSelectSingle.mockResolvedValue({ data: { id: 'new-sess-id' }, error: null })
  mockInsertSelect.mockReturnValue({ single: mockInsertSelectSingle })
  mockInsert.mockReturnValue({ select: mockInsertSelect })
  mockSelectEqMaybeSingle.mockResolvedValue({ data: { id: 'sess-1' }, error: null })
  mockSelectEq.mockReturnValue({ maybeSingle: mockSelectEqMaybeSingle })
})

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

// ── H9-1: SESSION_CHECK_INTERVAL_MS ──────────────────────────────────────────

describe('SESSION_CHECK_INTERVAL_MS', () => {
  it('is 60 seconds', () => {
    expect(SESSION_CHECK_INTERVAL_MS).toBe(60_000)
  })
})

// ── H9-1: getCurrentSessionId ────────────────────────────────────────────────

describe('getCurrentSessionId', () => {
  it('returns null when no session stored', () => {
    expect(getCurrentSessionId()).toBeNull()
  })

  it('returns stored session ID', () => {
    localStorage.setItem('cs:session_id', 'test-id')
    expect(getCurrentSessionId()).toBe('test-id')
  })
})

// ── H9-1: enforceAndRegisterSession ──────────────────────────────────────────

describe('enforceAndRegisterSession', () => {
  it('deletes all existing sessions then registers a new one', async () => {
    const id = await enforceAndRegisterSession('user-1')
    expect(id).toBe('new-sess-id')
    // Should have deleted user's sessions first
    expect(mockDeleteEq).toHaveBeenCalledWith('user_id', 'user-1')
    // Should have stored the session ID locally
    expect(localStorage.getItem('cs:session_id')).toBe('new-sess-id')
  })

  it('returns null when insert fails', async () => {
    mockInsertSelectSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    const id = await enforceAndRegisterSession('user-1')
    expect(id).toBeNull()
  })
})

// ── H9-1: isSessionValid ────────────────────────────────────────────────────

describe('isSessionValid', () => {
  it('returns true when no session ID is stored (unauthenticated)', async () => {
    expect(await isSessionValid()).toBe(true)
  })

  it('returns true when session record exists in database', async () => {
    localStorage.setItem('cs:session_id', 'sess-1')
    mockSelectEqMaybeSingle.mockResolvedValueOnce({ data: { id: 'sess-1' }, error: null })
    expect(await isSessionValid()).toBe(true)
  })

  it('returns false when session record has been deleted (revoked)', async () => {
    localStorage.setItem('cs:session_id', 'sess-1')
    mockSelectEqMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await isSessionValid()).toBe(false)
  })

  it('returns true on network error to avoid false lockouts', async () => {
    localStorage.setItem('cs:session_id', 'sess-1')
    mockSelectEqMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'network error' },
    })
    expect(await isSessionValid()).toBe(true)
  })
})
