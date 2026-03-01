/**
 * auth.test.ts — Unit tests for the auth service layer (E2-2: captchaToken support).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing auth
const mockSignIn = vi.fn()
const mockSignUp = vi.fn()
const mockResetPassword = vi.fn()
const mockResend = vi.fn()
const mockGetUser = vi.fn()
const mockGetSession = vi.fn()
const mockSignOut = vi.fn()
const mockRefreshSession = vi.fn()
const mockMfaEnroll = vi.fn()
const mockMfaChallengeAndVerify = vi.fn()
const mockMfaUnenroll = vi.fn()
const mockMfaListFactors = vi.fn()

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPassword(...args),
      resend: (...args: unknown[]) => mockResend(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
      mfa: {
        enroll: (...args: unknown[]) => mockMfaEnroll(...args),
        challengeAndVerify: (...args: unknown[]) => mockMfaChallengeAndVerify(...args),
        unenroll: (...args: unknown[]) => mockMfaUnenroll(...args),
        listFactors: (...args: unknown[]) => mockMfaListFactors(...args),
      },
    },
  },
}))

import {
  signInWithPassword,
  signUp,
  resetPasswordForEmail,
  resendConfirmation,
  getCurrentUser,
  getSession,
  signOut,
  refreshSession,
  reauthenticate,
  enrollTotp,
  verifyTotp,
  unenrollTotp,
  listMfaFactors,
} from './auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('signInWithPassword', () => {
  it('passes email and password without captcha when token is omitted', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    const result = await signInWithPassword('a@b.com', 'pw')
    expect(result).toEqual({ error: null })
    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
      options: undefined,
    })
  })

  it('passes captchaToken in options when provided', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    await signInWithPassword('a@b.com', 'pw', 'tok-123')
    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
      options: { captchaToken: 'tok-123' },
    })
  })
})

describe('signUp', () => {
  it('passes email and password without captcha when token is omitted', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
    const result = await signUp('a@b.com', 'pw')
    expect(result).toEqual({ session: null, error: null })
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
      options: undefined,
    })
  })

  it('passes captchaToken in options when provided', async () => {
    const mockSession = { access_token: 'x' }
    mockSignUp.mockResolvedValue({ data: { session: mockSession }, error: null })
    const result = await signUp('a@b.com', 'pw', 'tok-456')
    expect(result).toEqual({ session: mockSession, error: null })
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
      options: { captchaToken: 'tok-456' },
    })
  })
})

describe('resetPasswordForEmail', () => {
  it('calls supabase with email only when no captcha', async () => {
    mockResetPassword.mockResolvedValue({ error: null })
    const result = await resetPasswordForEmail('a@b.com')
    expect(result).toEqual({ error: null })
    expect(mockResetPassword).toHaveBeenCalledWith('a@b.com', {
      captchaToken: undefined,
    })
  })

  it('passes captchaToken when provided', async () => {
    mockResetPassword.mockResolvedValue({ error: null })
    await resetPasswordForEmail('a@b.com', 'tok-789')
    expect(mockResetPassword).toHaveBeenCalledWith('a@b.com', {
      captchaToken: 'tok-789',
    })
  })
})

describe('resendConfirmation', () => {
  it('calls supabase resend with type and email', async () => {
    mockResend.mockResolvedValue({ error: null })
    const result = await resendConfirmation('a@b.com')
    expect(result).toEqual({ error: null })
    expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.com' })
  })
})

describe('getCurrentUser', () => {
  it('returns user when present', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: '1' } } })
    const user = await getCurrentUser()
    expect(user).toEqual({ id: '1' })
  })

  it('returns null when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const user = await getCurrentUser()
    expect(user).toBeNull()
  })
})

describe('getSession', () => {
  it('returns session when present', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'x' } } })
    const session = await getSession()
    expect(session).toEqual({ access_token: 'x' })
  })
})

describe('signOut', () => {
  it('calls supabase signOut', async () => {
    mockSignOut.mockResolvedValue({})
    await signOut()
    expect(mockSignOut).toHaveBeenCalled()
  })
})

describe('refreshSession', () => {
  it('returns refreshed session', async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'new' } },
      error: null,
    })
    const result = await refreshSession()
    expect(result.session).toEqual({ access_token: 'new' })
    expect(result.error).toBeNull()
  })
})

describe('reauthenticate', () => {
  it('uses current user email to sign in again', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'a@b.com' } } })
    mockSignIn.mockResolvedValue({ error: null })
    const result = await reauthenticate('pw')
    expect(result).toEqual({ error: null })
    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
      options: undefined,
    })
  })

  it('returns no error when no user is found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await reauthenticate('pw')
    expect(result).toEqual({ error: null })
    expect(mockSignIn).not.toHaveBeenCalled()
  })
})

// ── MFA / TOTP (E2-4) ──────────────────────────────────────────────────────

describe('enrollTotp', () => {
  it('returns enrollment data on success', async () => {
    mockMfaEnroll.mockResolvedValue({
      data: {
        id: 'f-1',
        totp: { uri: 'otpauth://totp/test', qr_code: 'data:image/svg+xml,...', secret: 'ABCD1234' },
      },
      error: null,
    })
    const result = await enrollTotp()
    expect(result.enrollment).toEqual({
      id: 'f-1',
      uri: 'otpauth://totp/test',
      qrCode: 'data:image/svg+xml,...',
      secret: 'ABCD1234',
    })
    expect(result.error).toBeNull()
    expect(mockMfaEnroll).toHaveBeenCalledWith({ factorType: 'totp' })
  })

  it('returns error when enroll fails', async () => {
    const err = { message: 'enroll failed' }
    mockMfaEnroll.mockResolvedValue({ data: null, error: err })
    const result = await enrollTotp()
    expect(result.enrollment).toBeNull()
    expect(result.error).toBe(err)
  })
})

describe('verifyTotp', () => {
  it('calls challengeAndVerify with factorId and code', async () => {
    mockMfaChallengeAndVerify.mockResolvedValue({ error: null })
    const result = await verifyTotp('f-1', '123456')
    expect(result).toEqual({ error: null })
    expect(mockMfaChallengeAndVerify).toHaveBeenCalledWith({ factorId: 'f-1', code: '123456' })
  })

  it('returns error on verify failure', async () => {
    const err = { message: 'invalid code' }
    mockMfaChallengeAndVerify.mockResolvedValue({ error: err })
    const result = await verifyTotp('f-1', '000000')
    expect(result.error).toBe(err)
  })
})

describe('unenrollTotp', () => {
  it('calls unenroll with factorId', async () => {
    mockMfaUnenroll.mockResolvedValue({ error: null })
    const result = await unenrollTotp('f-1')
    expect(result).toEqual({ error: null })
    expect(mockMfaUnenroll).toHaveBeenCalledWith({ factorId: 'f-1' })
  })
})

describe('listMfaFactors', () => {
  it('returns mapped factors', async () => {
    mockMfaListFactors.mockResolvedValue({
      data: {
        totp: [
          {
            id: 'f-1',
            friendly_name: 'My phone',
            factor_type: 'totp',
            status: 'verified',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
          },
        ],
      },
      error: null,
    })
    const result = await listMfaFactors()
    expect(result.factors).toHaveLength(1)
    expect(result.factors[0].id).toBe('f-1')
    expect(result.factors[0].friendly_name).toBe('My phone')
    expect(result.error).toBeNull()
  })

  it('returns empty array when no factors', async () => {
    mockMfaListFactors.mockResolvedValue({ data: { totp: [] }, error: null })
    const result = await listMfaFactors()
    expect(result.factors).toEqual([])
  })

  it('returns error on failure', async () => {
    const err = { message: 'not authenticated' }
    mockMfaListFactors.mockResolvedValue({ data: null, error: err })
    const result = await listMfaFactors()
    expect(result.factors).toEqual([])
    expect(result.error).toBe(err)
  })
})
