/**
 * marketplaceService.test.ts — Unit tests for the marketplace data layer.
 *
 * Mocks Supabase to test query building + error propagation without
 * touching a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listPublishedItems,
  getItem,
  recordInstall,
  getUserInstalls,
  forkTemplate,
  listAuthorItems,
  createAuthorItem,
  togglePublishItem,
  validateMarketplaceVersion,
  isVerifiedAuthor,
  getPublishGate,
} from './marketplaceService'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIlike = vi.fn()
const mockOrder = vi.fn()
const mockMaybeSingle = vi.fn()
const mockUpsert = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockSingle = vi.fn()

// Build a chainable query builder
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const qb = {
    select: mockSelect,
    eq: mockEq,
    ilike: mockIlike,
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
    upsert: mockUpsert,
    insert: mockInsert,
    update: mockUpdate,
    single: mockSingle,
  }
  mockSelect.mockReturnValue(qb)
  mockEq.mockReturnValue(qb)
  mockIlike.mockReturnValue(qb)
  mockOrder.mockResolvedValue(finalResult)
  mockMaybeSingle.mockResolvedValue(finalResult)
  mockUpsert.mockResolvedValue(finalResult)
  mockInsert.mockReturnValue(qb)
  mockUpdate.mockReturnValue(qb)
  mockSingle.mockResolvedValue(finalResult)
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

// Mock projects service for forkTemplate tests
const mockImportProject = vi.fn().mockResolvedValue({ id: 'new-proj-1' })
vi.mock('./projects', () => ({
  importProject: (...args: unknown[]) => mockImportProject(...args),
}))

let supabaseMock: { from: ReturnType<typeof vi.fn>; auth: unknown }

beforeEach(async () => {
  vi.clearAllMocks()
  mockImportProject.mockResolvedValue({ id: 'new-proj-1' })
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

// ── forkTemplate ─────────────────────────────────────────────────────────────

describe('forkTemplate', () => {
  const templateItem = {
    id: 'item-t1',
    name: 'Beam Analysis',
    category: 'template',
    payload: { schemaVersion: 3, graph: { nodes: [], edges: [] } },
  }

  it('throws when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
    })

    await expect(forkTemplate('item-t1')).rejects.toThrow('Sign in')
  })

  it('throws when item not found', async () => {
    makeQueryBuilder({ data: null, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    await expect(forkTemplate('missing')).rejects.toThrow('not found')
  })

  it('throws when item is not a template', async () => {
    makeQueryBuilder({ data: { ...templateItem, category: 'theme' }, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    await expect(forkTemplate('item-t1')).rejects.toThrow('not a project template')
  })

  it('throws when payload is null', async () => {
    makeQueryBuilder({ data: { ...templateItem, payload: null }, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    await expect(forkTemplate('item-t1')).rejects.toThrow('no project data')
  })

  it('calls importProject with the payload and item name', async () => {
    // First call: maybeSingle for item lookup
    makeQueryBuilder({ data: templateItem, error: null })
    // Second call: upsert for recordInstall
    const mockUpsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from
      .mockReturnValueOnce({
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      })
      .mockReturnValueOnce({ upsert: mockUpsertFn })

    await forkTemplate('item-t1')

    expect(mockImportProject).toHaveBeenCalledWith(templateItem.payload, templateItem.name)
  })

  it('records the install after forking', async () => {
    makeQueryBuilder({ data: templateItem, error: null })
    const mockUpsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from
      .mockReturnValueOnce({
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      })
      .mockReturnValueOnce({ upsert: mockUpsertFn })

    await forkTemplate('item-t1')

    expect(mockUpsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: 'item-t1' }),
      expect.anything(),
    )
  })

  it('returns the new project ID', async () => {
    makeQueryBuilder({ data: templateItem, error: null })
    const mockUpsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from
      .mockReturnValueOnce({
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      })
      .mockReturnValueOnce({ upsert: mockUpsertFn })

    const projectId = await forkTemplate('item-t1')
    expect(projectId).toBe('new-proj-1')
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

// ── validateMarketplaceVersion (P107) ────────────────────────────────────────

describe('validateMarketplaceVersion', () => {
  it('accepts valid semver strings', () => {
    expect(validateMarketplaceVersion('1.0.0').ok).toBe(true)
    expect(validateMarketplaceVersion('0.0.1').ok).toBe(true)
    expect(validateMarketplaceVersion('10.20.300').ok).toBe(true)
  })

  it('rejects missing patch component', () => {
    expect(validateMarketplaceVersion('1.0').ok).toBe(false)
  })

  it('rejects single digit', () => {
    expect(validateMarketplaceVersion('1').ok).toBe(false)
  })

  it('rejects prerelease suffixes', () => {
    expect(validateMarketplaceVersion('1.0.0-alpha').ok).toBe(false)
    expect(validateMarketplaceVersion('1.0.0+build').ok).toBe(false)
  })

  it('rejects non-numeric components', () => {
    expect(validateMarketplaceVersion('a.b.c').ok).toBe(false)
    expect(validateMarketplaceVersion('v1.0.0').ok).toBe(false)
  })

  it('returns an error message on failure', () => {
    const res = validateMarketplaceVersion('bad')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/X\.Y\.Z/)
  })
})

// ── listAuthorItems (P108) ────────────────────────────────────────────────────

describe('listAuthorItems', () => {
  it('returns empty array when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
    })

    const result = await listAuthorItems()
    expect(result).toEqual([])
  })

  it('returns author items ordered by created_at desc', async () => {
    const items = [{ id: 'i1', author_id: 'uid-1', name: 'My Template' }]
    makeQueryBuilder({ data: items, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    })

    const result = await listAuthorItems()
    expect(result).toEqual(items)
    expect(supabaseMock.from).toHaveBeenCalledWith('marketplace_items')
  })
})

// ── createAuthorItem (P108) ───────────────────────────────────────────────────

describe('createAuthorItem', () => {
  it('throws when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
    })

    await expect(
      createAuthorItem({ name: 'Test', category: 'template', version: '1.0.0' }),
    ).rejects.toThrow('Sign in')
  })

  it('inserts item and returns it', async () => {
    const created = { id: 'new-item', name: 'My Pack', category: 'block_pack', version: '1.0.0' }
    makeQueryBuilder({ data: created, error: null })
    supabaseMock.from.mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    })

    const result = await createAuthorItem({
      name: 'My Pack',
      category: 'block_pack',
      version: '1.0.0',
    })
    expect(result).toEqual(created)
    expect(supabaseMock.from).toHaveBeenCalledWith('marketplace_items')
  })
})

// ── isVerifiedAuthor (P109) ───────────────────────────────────────────────────

describe('isVerifiedAuthor', () => {
  it('returns false when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
    })

    const result = await isVerifiedAuthor()
    expect(result).toBe(false)
  })

  it('returns true when profile has verified_author = true', async () => {
    makeQueryBuilder({ data: { verified_author: true }, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    const result = await isVerifiedAuthor()
    expect(result).toBe(true)
  })

  it('returns false when profile has verified_author = false', async () => {
    makeQueryBuilder({ data: { verified_author: false }, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    const result = await isVerifiedAuthor()
    expect(result).toBe(false)
  })

  it('returns false when profile row not found', async () => {
    makeQueryBuilder({ data: null, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    const result = await isVerifiedAuthor()
    expect(result).toBe(false)
  })

  it('throws on supabase error', async () => {
    makeQueryBuilder({ data: null, error: { message: 'DB error' } })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    await expect(isVerifiedAuthor()).rejects.toMatchObject({ message: 'DB error' })
  })
})

// ── getPublishGate (P113) ─────────────────────────────────────────────────────

describe('getPublishGate', () => {
  it('returns all-false when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
    })

    const result = await getPublishGate()
    expect(result).toEqual({ verified: false, stripeOnboarded: false })
  })

  it('returns verified=true, stripeOnboarded=true when both flags are set', async () => {
    makeQueryBuilder({ data: { verified_author: true, stripe_onboarded: true }, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    const result = await getPublishGate()
    expect(result).toEqual({ verified: true, stripeOnboarded: true })
  })

  it('returns verified=true, stripeOnboarded=false when not yet onboarded', async () => {
    makeQueryBuilder({ data: { verified_author: true, stripe_onboarded: false }, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    const result = await getPublishGate()
    expect(result).toEqual({ verified: true, stripeOnboarded: false })
  })

  it('returns all-false when profile row not found', async () => {
    makeQueryBuilder({ data: null, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    const result = await getPublishGate()
    expect(result).toEqual({ verified: false, stripeOnboarded: false })
  })

  it('throws on supabase error', async () => {
    makeQueryBuilder({ data: null, error: { message: 'DB error' } })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })

    await expect(getPublishGate()).rejects.toMatchObject({ message: 'DB error' })
  })
})

// ── togglePublishItem (P108) ──────────────────────────────────────────────────

describe('togglePublishItem', () => {
  it('updates is_published on the item', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })
    supabaseMock.from.mockReturnValue({ update: mockUpdateFn })

    await togglePublishItem('item-x', true)
    expect(supabaseMock.from).toHaveBeenCalledWith('marketplace_items')
    expect(mockUpdateFn).toHaveBeenCalledWith({ is_published: true })
  })

  it('throws on supabase error', async () => {
    const mockEqFn = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'Permission denied' } })
    const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })
    supabaseMock.from.mockReturnValue({ update: mockUpdateFn })

    await expect(togglePublishItem('item-x', false)).rejects.toMatchObject({
      message: 'Permission denied',
    })
  })
})
