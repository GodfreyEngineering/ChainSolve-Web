/**
 * marketplaceService.test.ts — Unit tests for the marketplace data layer.
 *
 * Mocks Supabase to test query building + error propagation without
 * touching a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listPublishedItems, getItem, recordInstall, getUserInstalls } from './marketplaceService'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIlike = vi.fn()
const mockOrder = vi.fn()
const mockMaybeSingle = vi.fn()
const mockUpsert = vi.fn()

// Build a chainable query builder
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const qb = {
    select: mockSelect,
    eq: mockEq,
    ilike: mockIlike,
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
    upsert: mockUpsert,
  }
  mockSelect.mockReturnValue(qb)
  mockEq.mockReturnValue(qb)
  mockIlike.mockReturnValue(qb)
  mockOrder.mockResolvedValue(finalResult)
  mockMaybeSingle.mockResolvedValue(finalResult)
  mockUpsert.mockResolvedValue(finalResult)
  return qb
}

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'uid-1' } } }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'uid-1' } } },
      }),
    },
    from: vi.fn(),
  },
}))

let supabaseMock: { from: ReturnType<typeof vi.fn>; auth: unknown }

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('./supabase')
  supabaseMock = mod.supabase as unknown as typeof supabaseMock
})

// ── listPublishedItems ────────────────────────────────────────────────────────

describe('listPublishedItems', () => {
  it('returns items from supabase ordered by downloads_count desc', async () => {
    const items = [
      { id: '1', name: 'Physics 101', category: 'template', downloads_count: 42 },
      { id: '2', name: 'Finance 101', category: 'template', downloads_count: 10 },
    ]
    makeQueryBuilder({ data: items, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      ilike: mockIlike,
      order: mockOrder,
    })

    const result = await listPublishedItems()
    expect(result).toEqual(items)
    expect(supabaseMock.from).toHaveBeenCalledWith('marketplace_items')
  })

  it('returns empty array when no results', async () => {
    makeQueryBuilder({ data: null, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      ilike: mockIlike,
      order: mockOrder,
    })

    const result = await listPublishedItems()
    expect(result).toEqual([])
  })

  it('throws when supabase returns an error', async () => {
    makeQueryBuilder({ data: null, error: { message: 'DB down' } })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      ilike: mockIlike,
      order: mockOrder,
    })

    await expect(listPublishedItems()).rejects.toMatchObject({ message: 'DB down' })
  })
})

// ── getItem ───────────────────────────────────────────────────────────────────

describe('getItem', () => {
  it('returns null when item not found', async () => {
    makeQueryBuilder({ data: null, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    const result = await getItem('nonexistent-id')
    expect(result).toBeNull()
  })

  it('returns item when found', async () => {
    const item = { id: 'abc', name: 'Test', is_published: true }
    makeQueryBuilder({ data: item, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    const result = await getItem('abc')
    expect(result).toEqual(item)
  })

  it('throws when supabase errors', async () => {
    makeQueryBuilder({ data: null, error: { message: 'Not found' } })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    await expect(getItem('bad-id')).rejects.toMatchObject({ message: 'Not found' })
  })
})

// ── recordInstall ─────────────────────────────────────────────────────────────

describe('recordInstall', () => {
  it('calls upsert with user_id + item_id', async () => {
    makeQueryBuilder({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ upsert: mockUpsert })

    await recordInstall('item-99')
    expect(supabaseMock.from).toHaveBeenCalledWith('marketplace_purchases')
    expect(mockUpsert).toHaveBeenCalledWith(
      { user_id: 'uid-1', item_id: 'item-99' },
      expect.objectContaining({ onConflict: 'user_id,item_id' }),
    )
  })

  it('throws when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
    })

    await expect(recordInstall('item-1')).rejects.toThrow('Sign in')
  })

  it('throws when supabase upsert errors', async () => {
    makeQueryBuilder({ data: null, error: { message: 'Conflict' } })
    supabaseMock.from.mockReturnValue({ upsert: mockUpsert })

    await expect(recordInstall('item-1')).rejects.toMatchObject({ message: 'Conflict' })
  })
})

// ── getUserInstalls ───────────────────────────────────────────────────────────

describe('getUserInstalls', () => {
  it('returns empty array when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { session: null },
    })

    const result = await getUserInstalls()
    expect(result).toEqual([])
  })

  it('returns installs when authenticated', async () => {
    const installs = [{ id: 'p1', user_id: 'uid-1', item_id: 'i1', installed_at: '2026-01-01' }]
    makeQueryBuilder({ data: installs, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      order: mockOrder,
    })

    const result = await getUserInstalls()
    expect(result).toEqual(installs)
  })
})
