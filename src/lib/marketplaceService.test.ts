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
  installBlockPack,
  installTheme,
  listAuthorItems,
  createAuthorItem,
  togglePublishItem,
  updateItemPayload,
  validateMarketplaceVersion,
  isVerifiedAuthor,
  getPublishGate,
  emitInstallEvent,
  getItemAnalyticsSummary,
  setReviewStatus,
  getUserLikes,
  likeItem,
  unlikeItem,
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

// Mock installedBlockPacksService for installBlockPack tests
const mockAddInstalledBlockPack = vi.fn()
vi.mock('./installedBlockPacksService', () => ({
  addInstalledBlockPack: (...args: unknown[]) => mockAddInstalledBlockPack(...args),
}))

// Mock marketplaceThemeService for installTheme tests
const mockInstallMarketplaceTheme = vi.fn()
vi.mock('./marketplaceThemeService', () => ({
  sanitizeThemeVariables: (raw: Record<string, unknown>) => {
    // Minimal sanitizer: keep string values for '--' keys
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('--') && typeof v === 'string') out[k] = v
    }
    return out
  },
  installMarketplaceTheme: (...args: unknown[]) => mockInstallMarketplaceTheme(...args),
}))

let supabaseMock: { from: ReturnType<typeof vi.fn>; auth: unknown }

beforeEach(async () => {
  vi.clearAllMocks()
  mockImportProject.mockResolvedValue({ id: 'new-proj-1' })
  mockAddInstalledBlockPack.mockResolvedValue(undefined)
  mockInstallMarketplaceTheme.mockReturnValue(undefined)
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

// ── updateItemPayload (D8-3) ────────────────────────────────────────────────

describe('updateItemPayload', () => {
  it('calls update with the payload on the correct item', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })
    supabaseMock.from.mockReturnValue({ update: mockUpdateFn })

    const payload = { variables: { '--primary': '#ff0000' } }
    await updateItemPayload('item-1', payload)

    expect(supabaseMock.from).toHaveBeenCalledWith('marketplace_items')
    expect(mockUpdateFn).toHaveBeenCalledWith({ payload })
    expect(mockEqFn).toHaveBeenCalledWith('id', 'item-1')
  })

  it('throws when Supabase returns an error', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS violation' } })
    const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })
    supabaseMock.from.mockReturnValue({ update: mockUpdateFn })

    await expect(updateItemPayload('item-1', {})).rejects.toMatchObject({
      message: 'RLS violation',
    })
  })
})

// ── emitInstallEvent (P114) ───────────────────────────────────────────────────

describe('emitInstallEvent', () => {
  it('inserts into marketplace_install_events with correct fields', async () => {
    const mockInsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ insert: mockInsertFn })

    await emitInstallEvent('uid-1', 'item-1', 'install')

    expect(supabaseMock.from).toHaveBeenCalledWith('marketplace_install_events')
    expect(mockInsertFn).toHaveBeenCalledWith({
      user_id: 'uid-1',
      item_id: 'item-1',
      event_type: 'install',
    })
  })

  it('inserts event_type fork', async () => {
    const mockInsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ insert: mockInsertFn })

    await emitInstallEvent('uid-1', 'item-2', 'fork')
    expect(mockInsertFn).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'fork' }))
  })

  it('inserts event_type purchase', async () => {
    const mockInsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ insert: mockInsertFn })

    await emitInstallEvent('uid-1', 'item-3', 'purchase')
    expect(mockInsertFn).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'purchase' }))
  })
})

// ── getItemAnalyticsSummary (P115) ────────────────────────────────────────────

// Helper: set up a mock chain for select().eq() that resolves directly from eq().
function makeAnalyticsMock(result: { data: unknown; error: unknown }) {
  const eqFn = vi.fn().mockResolvedValue(result)
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  supabaseMock.from.mockReturnValue({ select: selectFn })
  return { eqFn, selectFn }
}

describe('getItemAnalyticsSummary', () => {
  const now = new Date().toISOString()
  const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days ago

  it('returns zero counts when no events', async () => {
    makeAnalyticsMock({ data: [], error: null })

    const result = await getItemAnalyticsSummary('item-1')
    expect(result).toEqual({
      total: 0,
      last30Days: 0,
      byType: { install: 0, fork: 0, purchase: 0 },
    })
  })

  it('counts total and last-30-days correctly', async () => {
    const events = [
      { event_type: 'install', created_at: now },
      { event_type: 'install', created_at: old },
      { event_type: 'fork', created_at: now },
    ]
    makeAnalyticsMock({ data: events, error: null })

    const result = await getItemAnalyticsSummary('item-1')
    expect(result.total).toBe(3)
    expect(result.last30Days).toBe(2) // only the 2 'now' events
  })

  it('counts event types correctly', async () => {
    const events = [
      { event_type: 'install', created_at: now },
      { event_type: 'fork', created_at: now },
      { event_type: 'fork', created_at: now },
      { event_type: 'purchase', created_at: now },
    ]
    makeAnalyticsMock({ data: events, error: null })

    const result = await getItemAnalyticsSummary('item-1')
    expect(result.byType).toEqual({ install: 1, fork: 2, purchase: 1 })
  })

  it('throws on supabase error', async () => {
    makeAnalyticsMock({ data: null, error: { message: 'Forbidden' } })

    await expect(getItemAnalyticsSummary('item-1')).rejects.toMatchObject({ message: 'Forbidden' })
  })
})

// ── installBlockPack (P116) ───────────────────────────────────────────────────

describe('installBlockPack', () => {
  const VALID_PAYLOAD = {
    defs: [{ id: 'd1', label: 'Power', block_type: 'eng.mechanics.power_work_time', data: {} }],
  }

  it('throws when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
    })
    await expect(installBlockPack('item-1')).rejects.toThrow('Sign in')
  })

  it('throws when item not found', async () => {
    makeQueryBuilder({ data: null, error: null })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })
    await expect(installBlockPack('item-x')).rejects.toThrow('not found')
  })

  it('throws when category is not block_pack', async () => {
    makeQueryBuilder({
      data: { id: 'i1', name: 'T', category: 'template', payload: VALID_PAYLOAD },
      error: null,
    })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })
    await expect(installBlockPack('item-1')).rejects.toThrow('not a block pack')
  })

  it('throws when minContractVersion exceeds current (P118)', async () => {
    const incompatiblePayload = { ...VALID_PAYLOAD, minContractVersion: 999 }
    makeQueryBuilder({
      data: { id: 'i1', name: 'P', category: 'block_pack', payload: incompatiblePayload },
      error: null,
    })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })
    await expect(installBlockPack('item-1')).rejects.toThrow('contract version')
  })

  it('calls addInstalledBlockPack and recordInstall on success', async () => {
    makeQueryBuilder({
      data: { id: 'item-1', name: 'Physics', category: 'block_pack', payload: VALID_PAYLOAD },
      error: null,
    })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })
    // recordInstall will call supabase.from again — mock it for upsert
    const mockUpsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from
      .mockReturnValueOnce({ select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle })
      .mockReturnValue({ upsert: mockUpsertFn })

    await installBlockPack('item-1')
    expect(mockAddInstalledBlockPack).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item-1', name: 'Physics' }),
    )
  })
})

// ── installTheme (P117) ───────────────────────────────────────────────────────

describe('installTheme', () => {
  const VALID_PAYLOAD = { variables: { '--primary': '#ff6b6b', '--bg': '#0a0a0a' } }

  it('throws when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
    })
    await expect(installTheme('item-1')).rejects.toThrow('Sign in')
  })

  it('throws when category is not theme', async () => {
    makeQueryBuilder({
      data: { id: 'i1', name: 'T', category: 'template', payload: VALID_PAYLOAD },
      error: null,
    })
    supabaseMock.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    })
    await expect(installTheme('item-1')).rejects.toThrow('not a theme')
  })

  it('calls installMarketplaceTheme and recordInstall on success', async () => {
    makeQueryBuilder({
      data: { id: 'item-1', name: 'Ocean', category: 'theme', payload: VALID_PAYLOAD },
      error: null,
    })
    supabaseMock.from
      .mockReturnValueOnce({ select: mockSelect, eq: mockEq, maybeSingle: mockMaybeSingle })
      .mockReturnValue({ upsert: vi.fn().mockResolvedValue({ data: null, error: null }) })

    await installTheme('item-1')
    expect(mockInstallMarketplaceTheme).toHaveBeenCalledWith(
      'item-1',
      'Ocean',
      expect.objectContaining({ '--primary': '#ff6b6b' }),
    )
  })
})

// ── setReviewStatus (P119) ────────────────────────────────────────────────────

describe('setReviewStatus', () => {
  it('calls update with the given review_status and returns on success', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })
    supabaseMock.from.mockReturnValue({ update: mockUpdateFn })

    await setReviewStatus('item-1', 'approved')

    expect(supabaseMock.from).toHaveBeenCalledWith('marketplace_items')
    expect(mockUpdateFn).toHaveBeenCalledWith({ review_status: 'approved' })
    expect(mockEqFn).toHaveBeenCalledWith('id', 'item-1')
  })

  it('can set status to rejected', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockEqFn }) })

    await setReviewStatus('item-2', 'rejected')
    expect(mockEqFn).toHaveBeenCalledWith('id', 'item-2')
  })

  it('can set status to pending', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockEqFn }) })

    await setReviewStatus('item-3', 'pending')
    expect(mockEqFn).toHaveBeenCalledWith('id', 'item-3')
  })

  it('throws when Supabase returns an error', async () => {
    const mockEqFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'RLS violation' } })
    supabaseMock.from.mockReturnValue({ update: vi.fn().mockReturnValue({ eq: mockEqFn }) })

    await expect(setReviewStatus('item-1', 'approved')).rejects.toMatchObject({
      message: 'RLS violation',
    })
  })
})

// ── getUserLikes (D9-2) ─────────────────────────────────────────────────────

describe('getUserLikes', () => {
  it('returns empty set when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { session: null },
    })
    const result = await getUserLikes()
    expect(result).toEqual(new Set())
  })

  it('returns set of liked item IDs when authenticated', async () => {
    const likes = [{ item_id: 'i1' }, { item_id: 'i2' }]
    const mockSelectFn = vi.fn().mockResolvedValue({ data: likes, error: null })
    supabaseMock.from.mockReturnValue({ select: mockSelectFn })

    const result = await getUserLikes()
    expect(result).toEqual(new Set(['i1', 'i2']))
  })
})

// ── likeItem (D9-2) ─────────────────────────────────────────────────────────

describe('likeItem', () => {
  it('throws when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
    })
    await expect(likeItem('item-1')).rejects.toThrow('Sign in')
  })

  it('calls upsert on marketplace_likes', async () => {
    makeQueryBuilder({ data: null, error: null })
    supabaseMock.from.mockReturnValue({ upsert: mockUpsert })

    await likeItem('item-1')
    expect(supabaseMock.from).toHaveBeenCalledWith('marketplace_likes')
    expect(mockUpsert).toHaveBeenCalledWith(
      { user_id: 'uid-1', item_id: 'item-1' },
      expect.objectContaining({ onConflict: 'user_id,item_id' }),
    )
  })
})

// ── unlikeItem (D9-2) ───────────────────────────────────────────────────────

describe('unlikeItem', () => {
  it('throws when not authenticated', async () => {
    const mod = await import('./supabase')
    ;(mod.supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { user: null },
    })
    await expect(unlikeItem('item-1')).rejects.toThrow('Sign in')
  })

  it('calls delete on marketplace_likes with correct filters', async () => {
    const mockDeleteEq2 = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockDeleteEq1 = vi.fn().mockReturnValue({ eq: mockDeleteEq2 })
    const mockDeleteFn = vi.fn().mockReturnValue({ eq: mockDeleteEq1 })
    supabaseMock.from.mockReturnValue({ delete: mockDeleteFn })

    await unlikeItem('item-1')
    expect(supabaseMock.from).toHaveBeenCalledWith('marketplace_likes')
    expect(mockDeleteEq1).toHaveBeenCalledWith('user_id', 'uid-1')
    expect(mockDeleteEq2).toHaveBeenCalledWith('item_id', 'item-1')
  })
})
