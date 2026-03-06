/**
 * sessionService.test.ts — Unit tests for device session tracking (E2-5)
 * and single-session enforcement (H9-1, L3-1).
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
  mockFrom,
  // L3-1: org_members + organizations table mocks
  mockOrgMembersSelectEqMaybeSingle,
  mockOrgsSelectEqMaybeSingle,
} = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockDeleteEq: vi.fn(),
  mockInsert: vi.fn(),
  mockInsertSelect: vi.fn(),
  mockInsertSelectSingle: vi.fn(),
  mockSelectEq: vi.fn(),
  mockSelectEqMaybeSingle: vi.fn(),
  mockUpdateEq: vi.fn(),
  mockFrom: vi.fn(),
  mockOrgMembersSelectEqMaybeSingle: vi.fn(),
  mockOrgsSelectEqMaybeSingle: vi.fn(),
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
  mockOrgMembersSelectEqMaybeSingle.mockResolvedValue({ data: null, error: null })
  mockOrgsSelectEqMaybeSingle.mockResolvedValue({ data: null, error: null })

  // Return different mock chains depending on the table name
  const userSessionsTable = {
    delete: mockDelete,
    insert: mockInsert,
    select: vi.fn().mockReturnValue({ eq: mockSelectEq }),
    update: vi.fn().mockReturnValue({ eq: mockUpdateEq }),
  }

  mockFrom.mockImplementation((table: string) => {
    if (table === 'org_members') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockOrgMembersSelectEqMaybeSingle,
          }),
        }),
      }
    }
    if (table === 'organizations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockOrgsSelectEqMaybeSingle,
          }),
        }),
      }
    }
    return userSessionsTable
  })

  return { supabase: { from: mockFrom } }
})

import {
  parseDeviceLabel,
  getCurrentSessionId,
  enforceAndRegisterSession,
  isSingleSessionRequired,
  isSessionValid,
  resetSessionFailures,
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
  // L3-1: reset org mocks
  mockOrgMembersSelectEqMaybeSingle.mockResolvedValue({ data: null, error: null })
  mockOrgsSelectEqMaybeSingle.mockResolvedValue({ data: null, error: null })
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

// ── L3-1: enforceAndRegisterSession ─────────────────────────────────────────

describe('enforceAndRegisterSession', () => {
  it('defaults to multi-session (no deletion)', async () => {
    const id = await enforceAndRegisterSession('user-1')
    expect(id).toBe('new-sess-id')
    // Should NOT have deleted existing sessions (default = false)
    expect(mockDeleteEq).not.toHaveBeenCalled()
    // Should have stored the session ID locally
    expect(localStorage.getItem('cs:session_id')).toBe('new-sess-id')
  })

  it('deletes all existing sessions when singleSessionRequired = true', async () => {
    const id = await enforceAndRegisterSession('user-1', true)
    expect(id).toBe('new-sess-id')
    // Should have deleted user's sessions first
    expect(mockDeleteEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(localStorage.getItem('cs:session_id')).toBe('new-sess-id')
  })

  it('skips deletion when singleSessionRequired = false', async () => {
    const id = await enforceAndRegisterSession('user-1', false)
    expect(id).toBe('new-sess-id')
    expect(mockDeleteEq).not.toHaveBeenCalled()
  })

  it('returns null when insert fails', async () => {
    mockInsertSelectSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })
    const id = await enforceAndRegisterSession('user-1')
    expect(id).toBeNull()
  })
})

// ── H9-1: isSessionValid ────────────────────────────────────────────────────

describe('isSessionValid', () => {
  beforeEach(() => {
    resetSessionFailures()
  })

  it('returns true when no session ID is stored (unauthenticated)', async () => {
    expect(await isSessionValid()).toBe(true)
  })

  it('returns true when session record exists in database', async () => {
    localStorage.setItem('cs:session_id', 'sess-1')
    mockSelectEqMaybeSingle.mockResolvedValueOnce({ data: { id: 'sess-1' }, error: null })
    expect(await isSessionValid()).toBe(true)
  })

  it('returns true on first failure (consecutive-failure grace period)', async () => {
    localStorage.setItem('cs:session_id', 'sess-1')
    mockSelectEqMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await isSessionValid()).toBe(true)
  })

  it('returns false after 3 consecutive failures (confirmed revocation)', async () => {
    localStorage.setItem('cs:session_id', 'sess-1')
    mockSelectEqMaybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await isSessionValid()).toBe(true) // failure 1
    expect(await isSessionValid()).toBe(true) // failure 2
    expect(await isSessionValid()).toBe(false) // failure 3 → revoked
  })

  it('resets failure counter when session is found again', async () => {
    localStorage.setItem('cs:session_id', 'sess-1')
    mockSelectEqMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await isSessionValid()).toBe(true) // failure 1
    mockSelectEqMaybeSingle.mockResolvedValueOnce({ data: { id: 'sess-1' }, error: null })
    expect(await isSessionValid()).toBe(true) // success → resets counter
    mockSelectEqMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await isSessionValid()).toBe(true) // failure 1 again (counter was reset)
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

// ── L3-1: isSingleSessionRequired ───────────────────────────────────────────

describe('isSingleSessionRequired', () => {
  it('returns false when user has no org membership', async () => {
    mockOrgMembersSelectEqMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await isSingleSessionRequired('user-1')).toBe(false)
  })

  it('returns false when org_members query fails', async () => {
    mockOrgMembersSelectEqMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'RLS denied' },
    })
    expect(await isSingleSessionRequired('user-1')).toBe(false)
  })

  it('returns false when org has policy_single_session = false', async () => {
    mockOrgMembersSelectEqMaybeSingle.mockResolvedValueOnce({
      data: { org_id: 'org-1' },
      error: null,
    })
    mockOrgsSelectEqMaybeSingle.mockResolvedValueOnce({
      data: { policy_single_session: false },
      error: null,
    })
    expect(await isSingleSessionRequired('user-1')).toBe(false)
  })

  it('returns true when org has policy_single_session = true', async () => {
    mockOrgMembersSelectEqMaybeSingle.mockResolvedValueOnce({
      data: { org_id: 'org-1' },
      error: null,
    })
    mockOrgsSelectEqMaybeSingle.mockResolvedValueOnce({
      data: { policy_single_session: true },
      error: null,
    })
    expect(await isSingleSessionRequired('user-1')).toBe(true)
  })

  it('returns false when organizations query fails', async () => {
    mockOrgMembersSelectEqMaybeSingle.mockResolvedValueOnce({
      data: { org_id: 'org-1' },
      error: null,
    })
    mockOrgsSelectEqMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'network error' },
    })
    expect(await isSingleSessionRequired('user-1')).toBe(false)
  })
})
