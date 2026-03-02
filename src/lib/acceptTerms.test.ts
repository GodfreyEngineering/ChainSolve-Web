/**
 * acceptTerms.test.ts — Unit tests for ToS acceptance (G0-1).
 *
 * Verifies that acceptTerms:
 *  - records the version and timestamp via Supabase update
 *  - verifies the write by selecting the updated row
 *  - wraps PostgrestError in a proper Error instance
 *  - throws when no profile row exists
 *  - throws when not authenticated
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ────────────────────────────────────────────────────────────

const { mockMaybeSingle, mockSelect, mockEq, mockUpdate } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockUpdate: vi.fn(),
}))

const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => {
  mockMaybeSingle.mockResolvedValue({
    data: { accepted_terms_version: '1.0' },
    error: null,
  })
  mockSelect.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockEq.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-42' } } })

  return {
    supabase: {
      auth: { getUser: mockGetUser },
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    },
  }
})

import { acceptTerms } from './profilesService'

beforeEach(() => {
  vi.clearAllMocks()
  // Restore defaults after clearAllMocks
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-42' } } })
  mockMaybeSingle.mockResolvedValue({
    data: { accepted_terms_version: '1.0' },
    error: null,
  })
  mockSelect.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockEq.mockReturnValue({ select: mockSelect })
  mockUpdate.mockReturnValue({ eq: mockEq })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('acceptTerms', () => {
  it('updates the profile with version and timestamp', async () => {
    await acceptTerms('1.0')
    expect(mockUpdate).toHaveBeenCalledWith({
      accepted_terms_version: '1.0',
      accepted_terms_at: expect.any(String),
    })
    expect(mockEq).toHaveBeenCalledWith('id', 'user-42')
  })

  it('verifies the write by selecting the updated row', async () => {
    await acceptTerms('1.0')
    expect(mockSelect).toHaveBeenCalledWith('accepted_terms_version')
    expect(mockMaybeSingle).toHaveBeenCalled()
  })

  it('throws a proper Error when Supabase returns an error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'RLS policy violation', code: '42501', details: '', hint: '' },
    })
    await expect(acceptTerms('1.0')).rejects.toThrow('RLS policy violation')
  })

  it('thrown error is instanceof Error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'some pg error', code: '42000' },
    })
    try {
      await acceptTerms('1.0')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toBe('some pg error')
    }
  })

  it('throws when no profile row exists (data is null)', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(acceptTerms('1.0')).rejects.toThrow('Profile not found')
  })

  it('throws when the version was not written correctly', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { accepted_terms_version: '0.9' },
      error: null,
    })
    await expect(acceptTerms('1.0')).rejects.toThrow('not recorded')
  })

  it('throws when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    await expect(acceptTerms('1.0')).rejects.toThrow('Sign in')
  })

  it('resolves successfully on a valid acceptance', async () => {
    await expect(acceptTerms('1.0')).resolves.toBeUndefined()
  })
})
