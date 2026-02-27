/**
 * projects.enforcement.test.ts — DB-level enforcement error surfacing (P056).
 *
 * The `enforce_project_limit` Postgres trigger (migration 0006) raises an
 * exception when a user exceeds their plan's project quota.  Supabase
 * surfaces this as a PostgREST error with the RAISE message as the body.
 *
 * These tests verify that the application layer (createProject, createCanvas)
 * propagates the DB-trigger error message unchanged so that the UI can display
 * a meaningful message ("Project limit reached") instead of a generic one.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mock state ────────────────────────────────────────────────────────

const _single = vi.hoisted(() => vi.fn())
const _from = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    chain[m] = vi.fn(() => chain)
  }
  chain['single'] = _single
  const fromFn = vi.fn(() => chain)
  return { fromFn, chain }
})
const _getSession = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: _getSession },
    from: _from.fromFn,
  },
}))

// createProject calls saveProjectJson and readUpdatedAt which use storage/supabase
vi.mock('./storage', () => ({
  saveProjectJson: vi.fn().mockResolvedValue(undefined),
  loadProjectJson: vi.fn(),
  listProjectAssets: vi.fn(),
  downloadAssetBytes: vi.fn(),
  uploadAssetBytes: vi.fn(),
}))

// createCanvas calls uploadCanvasGraph and listCanvases
vi.mock('./canvasStorage', () => ({
  uploadCanvasGraph: vi.fn().mockResolvedValue(undefined),
  downloadCanvasGraph: vi.fn(),
  deleteCanvasGraph: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { createProject } from './projects'
import { createCanvas } from './canvases'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION = { user: { id: 'user-1' } }

function setupSession() {
  _getSession.mockResolvedValue({ data: { session: SESSION } })
  // Reinitialise chain mocks
  const { chain, fromFn } = _from
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    chain[m].mockReturnValue(chain)
  }
  fromFn.mockReturnValue(chain)
}

// ── createProject — DB trigger error ─────────────────────────────────────────

describe('createProject — DB trigger enforcement', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupSession()
  })

  it('surfaces "Project limit reached" when the trigger rejects the INSERT', async () => {
    // Simulate the Postgres trigger RAISE EXCEPTION message
    _single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Project limit reached' },
    })

    await expect(createProject('My project')).rejects.toThrow('Project limit reached')
  })

  it('surfaces a generic error when Supabase returns a non-trigger error', async () => {
    _single.mockResolvedValueOnce({
      data: null,
      error: { message: 'network error' },
    })

    await expect(createProject('My project')).rejects.toThrow('network error')
  })

  it('surfaces a fallback message when Supabase returns no error object', async () => {
    _single.mockResolvedValueOnce({ data: null, error: null })

    await expect(createProject('My project')).rejects.toThrow('Failed to create project')
  })
})

// ── createCanvas — DB error surfacing ────────────────────────────────────────

describe('createCanvas — DB error surfacing', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupSession()
  })

  it('surfaces the Supabase error when canvas INSERT fails', async () => {
    // listCanvases() uses from().select().eq().order() — mock to return empty list
    const { chain, fromFn } = _from
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
      chain[m].mockReturnValue(chain)
    }
    fromFn.mockReturnValue(chain)

    // First call (listCanvases): returns empty array via .order()
    chain['order'].mockResolvedValueOnce({ data: [], error: null })

    // Second call (insert → select → single): returns DB trigger error
    _single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Canvas limit reached' },
    })

    await expect(createCanvas('proj-1', 'Sheet 3')).rejects.toThrow('Canvas limit reached')
  })

  it('surfaces a fallback message when canvas INSERT returns no error object', async () => {
    const { chain, fromFn } = _from
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
      chain[m].mockReturnValue(chain)
    }
    fromFn.mockReturnValue(chain)

    chain['order'].mockResolvedValueOnce({ data: [], error: null })
    _single.mockResolvedValueOnce({ data: null, error: null })

    await expect(createCanvas('proj-1', 'Sheet 3')).rejects.toThrow('Failed to create canvas')
  })
})
