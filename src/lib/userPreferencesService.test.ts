/**
 * userPreferencesService.test.ts — unit tests for user preferences CRUD.
 *
 * Supabase is mocked so these run without a live DB connection.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mock state ────────────────────────────────────────────────────────

const _getUser = vi.hoisted(() => vi.fn())
const _maybeSingle = vi.hoisted(() => vi.fn())
const _rpc = vi.hoisted(() => vi.fn())

const _from = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['select', 'update', 'insert', 'eq', 'order', 'single']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  chain['maybeSingle'] = _maybeSingle
  return { fromFn: vi.fn(() => chain), chain }
})

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: _getUser },
    from: _from.fromFn,
    rpc: _rpc,
  },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { getUserPreferences, updateUserPreferences } from './userPreferencesService'

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER = { id: 'user-abc' }

const PREFS_ROW = {
  user_id: 'user-abc',
  locale: 'en',
  theme: 'dark' as const,
  region: null,
  editor_layout: 'default' as const,
  sidebar_collapsed: false,
}

function setupUser() {
  _getUser.mockResolvedValue({ data: { user: USER } })
}

function setupNoUser() {
  _getUser.mockResolvedValue({ data: { user: null } })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getUserPreferences', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    const { chain } = _from
    for (const m of ['select', 'eq', 'order', 'single']) {
      chain[m].mockReturnValue(chain)
    }
    _from.fromFn.mockReturnValue(_from.chain)
  })

  it('returns null when user is not signed in', async () => {
    setupNoUser()
    const result = await getUserPreferences()
    expect(result).toBeNull()
    expect(_from.fromFn).not.toHaveBeenCalled()
  })

  it('returns preferences row when user is signed in and row exists', async () => {
    setupUser()
    _maybeSingle.mockResolvedValueOnce({ data: PREFS_ROW, error: null })
    const result = await getUserPreferences()
    expect(result).toEqual(PREFS_ROW)
    expect(_from.fromFn).toHaveBeenCalledWith('user_preferences')
    expect(_from.chain.select).toHaveBeenCalledWith(
      'user_id,locale,theme,region,editor_layout,sidebar_collapsed',
    )
    expect(_from.chain.eq).toHaveBeenCalledWith('user_id', USER.id)
  })

  it('returns null when no preferences row exists yet', async () => {
    setupUser()
    _maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const result = await getUserPreferences()
    expect(result).toBeNull()
  })

  it('throws when DB returns an error', async () => {
    setupUser()
    _maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'connection refused' } })
    await expect(getUserPreferences()).rejects.toMatchObject({ message: 'connection refused' })
  })
})

describe('updateUserPreferences', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    _rpc.mockResolvedValue({ error: null })
  })

  it('calls upsert_my_preferences rpc with mapped params', async () => {
    await updateUserPreferences({ locale: 'fr', theme: 'light' })
    expect(_rpc).toHaveBeenCalledWith('upsert_my_preferences', {
      p_locale: 'fr',
      p_theme: 'light',
    })
  })

  it('includes only the fields present in the patch', async () => {
    await updateUserPreferences({ sidebar_collapsed: true })
    expect(_rpc).toHaveBeenCalledWith('upsert_my_preferences', {
      p_sidebar_collapsed: true,
    })
  })

  it('throws when rpc returns an error', async () => {
    _rpc.mockResolvedValueOnce({ error: { message: 'update failed' } })
    await expect(updateUserPreferences({ region: 'us' })).rejects.toMatchObject({
      message: 'update failed',
    })
  })

  it('throws when rpc returns an auth error (not authenticated)', async () => {
    _rpc.mockResolvedValueOnce({ error: { message: 'Not authenticated' } })
    await expect(updateUserPreferences({ locale: 'fr' })).rejects.toMatchObject({
      message: 'Not authenticated',
    })
  })

  it('can update a single field (sidebar_collapsed)', async () => {
    await updateUserPreferences({ sidebar_collapsed: false })
    expect(_rpc).toHaveBeenCalledWith('upsert_my_preferences', {
      p_sidebar_collapsed: false,
    })
  })

  it('can update editor_layout', async () => {
    await updateUserPreferences({ editor_layout: 'compact' })
    expect(_rpc).toHaveBeenCalledWith('upsert_my_preferences', {
      p_editor_layout: 'compact',
    })
  })

  it('maps all fields correctly when all are provided', async () => {
    await updateUserPreferences({
      locale: 'de',
      theme: 'dark',
      region: 'eu',
      editor_layout: 'wide',
      sidebar_collapsed: false,
    })
    expect(_rpc).toHaveBeenCalledWith('upsert_my_preferences', {
      p_locale: 'de',
      p_theme: 'dark',
      p_region: 'eu',
      p_editor_layout: 'wide',
      p_sidebar_collapsed: false,
    })
  })
})
