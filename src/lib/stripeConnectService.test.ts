/**
 * stripeConnectService.test.ts — P111/P112 tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  startConnectOnboarding,
  getConnectStatus,
  createCheckoutSession,
  hasPurchased,
} from './stripeConnectService'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockMaybeSingle = vi.fn()
const mockEq2 = vi.fn()
const mockEq1 = vi.fn()
const mockSelect = vi.fn()

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'tok-abc', user: { id: 'uid-1' } } },
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'uid-1' } } }),
    },
    from: vi.fn(),
  },
}))

let supabaseMock: {
  from: ReturnType<typeof vi.fn>
  auth: { getSession: ReturnType<typeof vi.fn>; getUser: ReturnType<typeof vi.fn> }
}

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('./supabase')
  supabaseMock = mod.supabase as unknown as typeof supabaseMock

  // Default mock chain for marketplace_purchases select
  mockMaybeSingle.mockResolvedValue({ data: null, error: null })
  mockEq2.mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockEq1.mockReturnValue({ eq: mockEq2 })
  mockSelect.mockReturnValue({ eq: mockEq1 })
  supabaseMock.from.mockReturnValue({ select: mockSelect })
})

// ── Stubs still pending (P113) ────────────────────────────────────────────────

describe('stripeConnectService — remaining stubs', () => {
  it('startConnectOnboarding throws not-implemented', async () => {
    await expect(startConnectOnboarding()).rejects.toThrow('not yet implemented')
  })

  it('getConnectStatus throws not-implemented', async () => {
    await expect(getConnectStatus()).rejects.toThrow('not yet implemented')
  })
})

// ── createCheckoutSession (P112) ─────────────────────────────────────────────

describe('createCheckoutSession', () => {
  it('throws when not authenticated', async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null } })

    await expect(createCheckoutSession('item-1')).rejects.toThrow('Sign in')
  })

  it('throws when edge function returns error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ ok: false, error: 'Item not found' }),
      }),
    )

    await expect(createCheckoutSession('item-x')).rejects.toThrow('Item not found')
    vi.unstubAllGlobals()
  })

  it('returns { url } on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, url: 'https://checkout.stripe.com/abc' }),
      }),
    )

    const result = await createCheckoutSession('item-1')
    expect(result.url).toBe('https://checkout.stripe.com/abc')
    vi.unstubAllGlobals()
  })

  it('sends Authorization Bearer token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, url: 'https://checkout.stripe.com/abc' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await createCheckoutSession('item-1')
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-abc')
    vi.unstubAllGlobals()
  })
})

// ── hasPurchased (P112) ───────────────────────────────────────────────────────

describe('hasPurchased', () => {
  it('returns false when not authenticated', async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null } })

    const result = await hasPurchased('item-1')
    expect(result).toBe(false)
  })

  it('returns false when no purchase record', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await hasPurchased('item-1')
    expect(result).toBe(false)
  })

  it('returns true when purchase record exists', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'p-1' }, error: null })

    const result = await hasPurchased('item-1')
    expect(result).toBe(true)
  })

  it('throws on supabase error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })

    await expect(hasPurchased('item-1')).rejects.toMatchObject({ message: 'DB error' })
  })
})
