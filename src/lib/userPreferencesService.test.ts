/**
 * userPreferencesService.test.ts — unit tests for user preferences CRUD.
 *
 * Supabase is mocked so these run without a live DB connection.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mock state ────────────────────────────────────────────────────────

const _getUser = vi.hoisted(() => vi.fn())
const _maybeSingle = vi.hoisted(() => vi.fn())
const _updateResult = vi.hoisted(() => vi.fn())

const _from = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['select', 'update', 'insert', 'eq', 'order', 'single']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  chain['maybeSingle'] = _maybeSingle
  // update() returns a separate chain where eq() resolves
  const updateChain: Record<string, ReturnType<typeof vi.fn>> = {}
  updateChain['eq'] = _updateResult
  chain['update'] = vi.fn(() => updateChain)
  return { fromFn: vi.fn(() => chain), chain, updateChain }
})

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: _getUser },
    from: _from.fromFn,
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
    _from.fromFn.mockReturnValue(_from.chain)
    _from.chain.update.mockReturnValue(_from.updateChain)
    _from.updateChain.eq.mockResolvedValue({ error: null })
  })

  it('throws when user is not signed in', async () => {
    setupNoUser()
    await expect(updateUserPreferences({ locale: 'fr' })).rejects.toThrow('Sign in to update')
    expect(_from.fromFn).not.toHaveBeenCalled()
  })

  it('calls supabase update with the patch and updated_at', async () => {
    setupUser()
    await updateUserPreferences({ locale: 'fr', theme: 'light' })

    expect(_from.fromFn).toHaveBeenCalledWith('user_preferences')
    expect(_from.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'fr', theme: 'light', updated_at: expect.any(String) }),
    )
    expect(_from.updateChain.eq).toHaveBeenCalledWith('user_id', USER.id)
  })

  it('includes updated_at as a valid ISO timestamp', async () => {
    setupUser()
    await updateUserPreferences({ sidebar_collapsed: true })

    const updateArg = _from.chain.update.mock.calls[0][0] as Record<string, unknown>
    expect(() => new Date(updateArg['updated_at'] as string)).not.toThrow()
    const ts = new Date(updateArg['updated_at'] as string)
    expect(ts.getTime()).toBeGreaterThan(0)
  })

  it('throws when DB returns an error', async () => {
    setupUser()
    _from.updateChain.eq.mockResolvedValueOnce({ error: { message: 'update failed' } })
    await expect(updateUserPreferences({ region: 'us' })).rejects.toMatchObject({
      message: 'update failed',
    })
  })

  it('can update a single field (sidebar_collapsed)', async () => {
    setupUser()
    await updateUserPreferences({ sidebar_collapsed: false })
    expect(_from.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ sidebar_collapsed: false }),
    )
  })

  it('can update editor_layout', async () => {
    setupUser()
    await updateUserPreferences({ editor_layout: 'compact' })
    expect(_from.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ editor_layout: 'compact' }),
    )
  })
})
