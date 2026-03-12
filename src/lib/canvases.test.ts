/**
 * canvases.test.ts — unit tests for canvas service layer.
 *
 * Section 1: pure helper tests (no mocks needed)
 * Section 2: Supabase-dependent operations (Supabase + storage mocked)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { assertUniqueCanvasName, type CanvasRow } from './canvases'

// ── Section 1: Pure helpers ───────────────────────────────────────────────────

function makeRow(id: string, name: string, position = 0): CanvasRow {
  return {
    id,
    project_id: 'p-1',
    owner_id: 'u-1',
    name,
    position,
    storage_path: '',
    created_at: '',
    updated_at: '',
  }
}

describe('assertUniqueCanvasName', () => {
  const existing = [
    makeRow('c-1', 'Sheet 1'),
    makeRow('c-2', 'Sheet 2'),
    makeRow('c-3', 'Analysis'),
  ]

  it('passes when name is unique', () => {
    expect(() => assertUniqueCanvasName('Sheet 3', existing)).not.toThrow()
  })

  it('rejects exact duplicate', () => {
    expect(() => assertUniqueCanvasName('Sheet 1', existing)).toThrow(/already exists/)
  })

  it('rejects case-insensitive duplicate', () => {
    expect(() => assertUniqueCanvasName('sheet 1', existing)).toThrow(/already exists/)
    expect(() => assertUniqueCanvasName('ANALYSIS', existing)).toThrow(/already exists/)
  })

  it('rejects duplicate with whitespace padding', () => {
    expect(() => assertUniqueCanvasName('  Sheet 1  ', existing)).toThrow(/already exists/)
  })

  it('allows rename to same canvas id (excludeId)', () => {
    expect(() => assertUniqueCanvasName('Sheet 1', existing, 'c-1')).not.toThrow()
  })

  it('still rejects when excludeId does not match the duplicate', () => {
    expect(() => assertUniqueCanvasName('Sheet 1', existing, 'c-2')).toThrow(/already exists/)
  })

  it('passes with empty existing list', () => {
    expect(() => assertUniqueCanvasName('Sheet 1', [])).not.toThrow()
  })
})

// ── Section 2: Supabase-dependent operations ──────────────────────────────────

// Hoisted mock state
const _single = vi.hoisted(() => vi.fn())
const _getSession = vi.hoisted(() => vi.fn())

const _from = vi.hoisted(() => {
  // updateChain is both chainable (eq/select return it) and thenable (can be awaited)
  // This mirrors the Supabase query builder pattern.
  const updateChain: Record<string, unknown> = {}
  let _updateError: { message: string } | null = null
  // Make updateChain thenable — awaiting resolves to { error }
  updateChain['then'] = (resolve: (v: { error: null | { message: string } }) => void) => {
    resolve({ error: _updateError })
    _updateError = null // reset after use
    return { catch: () => {} }
  }
  updateChain['eq'] = vi.fn(() => updateChain)
  updateChain['select'] = vi.fn(() => updateChain)
  updateChain['single'] = _single
  // Helper used in tests to simulate an update error
  const _setUpdateError = (err: { message: string } | null) => {
    _updateError = err
  }

  // Main select/query chain
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select', 'delete', 'eq', 'order', 'not', 'in']) {
    chain[m] = vi.fn(() => chain)
  }
  chain['single'] = _single
  chain['update'] = vi.fn(() => updateChain)

  // insert() returns its own chain
  const insertChain: Record<string, ReturnType<typeof vi.fn>> = {}
  insertChain['select'] = vi.fn(() => insertChain)
  insertChain['single'] = _single
  chain['insert'] = vi.fn(() => insertChain)

  const fromFn = vi.fn(() => chain)
  return {
    fromFn,
    chain,
    updateChain: updateChain as Record<string, ReturnType<typeof vi.fn>>,
    insertChain,
    _setUpdateError,
  }
})

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: _getSession },
    from: _from.fromFn,
  },
}))

vi.mock('./canvasStorage', () => ({
  uploadCanvasGraph: vi.fn().mockResolvedValue(undefined),
  downloadCanvasGraph: vi.fn().mockResolvedValue('{}'),
  deleteCanvasGraph: vi.fn().mockResolvedValue(undefined),
  verifyCanvasGraph: vi.fn().mockResolvedValue(true),
}))

vi.mock('./canvasSchema', () => ({
  buildCanvasJson: vi.fn().mockReturnValue({ schemaVersion: 1, nodes: [], edges: [] }),
  buildCanvasJsonFromGraph: vi.fn().mockReturnValue({ schemaVersion: 1, nodes: [], edges: [] }),
  parseCanvasJson: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
}))

import {
  listCanvases,
  setActiveCanvas,
  getActiveCanvasId,
  saveCanvasGraph,
  renameCanvas,
} from './canvases'
import * as CanvasStorageMod from './canvasStorage'
import * as CanvasSchemaMod from './canvasSchema'

const SESSION = { user: { id: 'user-1' } }
const PROJECT_ID = 'proj-1'
const CANVAS_ID = 'canvas-1'

function setupChain() {
  const { chain, fromFn, updateChain, insertChain, _setUpdateError } = _from
  for (const m of ['select', 'delete', 'eq', 'order', 'not', 'in']) {
    chain[m].mockReturnValue(chain)
  }
  chain['update'].mockReturnValue(updateChain)
  _setUpdateError(null) // reset update error
  ;(updateChain['eq'] as ReturnType<typeof vi.fn>).mockReturnValue(updateChain)
  ;(updateChain['select'] as ReturnType<typeof vi.fn>).mockReturnValue(updateChain)
  chain['insert'].mockReturnValue(insertChain)
  insertChain['select'].mockReturnValue(insertChain)
  fromFn.mockReturnValue(chain)
  _getSession.mockResolvedValue({ data: { session: SESSION } })

  // Re-setup module mocks cleared by vi.resetAllMocks()
  vi.mocked(CanvasStorageMod.uploadCanvasGraph).mockResolvedValue(undefined)
  vi.mocked(CanvasStorageMod.downloadCanvasGraph).mockResolvedValue('{}')
  vi.mocked(CanvasStorageMod.deleteCanvasGraph).mockResolvedValue(undefined)
  vi.mocked(CanvasStorageMod.verifyCanvasGraph).mockResolvedValue(true)
  vi.mocked(CanvasSchemaMod.buildCanvasJson).mockReturnValue({
    schemaVersion: 1,
    nodes: [],
    edges: [],
  } as unknown as ReturnType<typeof CanvasSchemaMod.buildCanvasJson>)
  vi.mocked(CanvasSchemaMod.buildCanvasJsonFromGraph).mockReturnValue({
    schemaVersion: 1,
    nodes: [],
    edges: [],
  } as unknown as ReturnType<typeof CanvasSchemaMod.buildCanvasJsonFromGraph>)
  vi.mocked(CanvasSchemaMod.parseCanvasJson).mockReturnValue({
    nodes: [],
    edges: [],
  } as unknown as ReturnType<typeof CanvasSchemaMod.parseCanvasJson>)
}

const CANVAS_ROW: CanvasRow = {
  id: CANVAS_ID,
  project_id: PROJECT_ID,
  owner_id: 'user-1',
  name: 'Sheet 1',
  position: 0,
  storage_path: 'user-1/proj-1/canvases/canvas-1.json',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
}

// ── listCanvases ──────────────────────────────────────────────────────────────

describe('listCanvases', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupChain()
  })

  it('returns canvas rows sorted by position', async () => {
    const rows = [
      { ...CANVAS_ROW, id: 'c-1', position: 0 },
      { ...CANVAS_ROW, id: 'c-2', position: 1 },
    ]
    _from.chain.order.mockResolvedValueOnce({ data: rows, error: null })

    const result = await listCanvases(PROJECT_ID)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('c-1')
    expect(_from.fromFn).toHaveBeenCalledWith('canvases')
    expect(_from.chain.eq).toHaveBeenCalledWith('project_id', PROJECT_ID)
    expect(_from.chain.order).toHaveBeenCalledWith('position', { ascending: true })
  })

  it('returns empty array when project has no canvases', async () => {
    _from.chain.order.mockResolvedValueOnce({ data: [], error: null })
    const result = await listCanvases(PROJECT_ID)
    expect(result).toEqual([])
  })

  it('throws on DB error', async () => {
    _from.chain.order.mockResolvedValueOnce({
      data: null,
      error: { message: 'relation not found' },
    })
    await expect(listCanvases(PROJECT_ID)).rejects.toThrow(/Failed to list canvases/)
  })
})

// ── setActiveCanvas ───────────────────────────────────────────────────────────

describe('setActiveCanvas', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupChain()
  })

  it('returns the updated_at timestamp from the DB response', async () => {
    _single.mockResolvedValueOnce({
      data: { updated_at: '2025-06-01T12:00:00Z' },
      error: null,
    })

    const result = await setActiveCanvas(PROJECT_ID, CANVAS_ID)

    expect(result).toBe('2025-06-01T12:00:00Z')
    expect(_from.fromFn).toHaveBeenCalledWith('projects')
    expect(_from.chain.update).toHaveBeenCalledWith({ active_canvas_id: CANVAS_ID })
  })

  it('throws on DB error', async () => {
    _single.mockResolvedValueOnce({ data: null, error: { message: 'update failed' } })
    await expect(setActiveCanvas(PROJECT_ID, CANVAS_ID)).rejects.toThrow(/Set active canvas failed/)
  })

  it('throws when not authenticated', async () => {
    _getSession.mockResolvedValueOnce({ data: { session: null } })
    await expect(setActiveCanvas(PROJECT_ID, CANVAS_ID)).rejects.toThrow(/Not authenticated/)
  })
})

// ── getActiveCanvasId ─────────────────────────────────────────────────────────

describe('getActiveCanvasId', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupChain()
  })

  it('returns active_canvas_id from the project row', async () => {
    _single.mockResolvedValueOnce({ data: { active_canvas_id: CANVAS_ID }, error: null })
    const result = await getActiveCanvasId(PROJECT_ID)
    expect(result).toBe(CANVAS_ID)
  })

  it('returns null when active_canvas_id is not set', async () => {
    _single.mockResolvedValueOnce({ data: { active_canvas_id: null }, error: null })
    const result = await getActiveCanvasId(PROJECT_ID)
    expect(result).toBeNull()
  })

  it('throws on DB error', async () => {
    _single.mockResolvedValueOnce({ data: null, error: { message: 'read failed' } })
    await expect(getActiveCanvasId(PROJECT_ID)).rejects.toThrow(/Read active canvas failed/)
  })
})

// ── saveCanvasGraph ───────────────────────────────────────────────────────────

describe('saveCanvasGraph', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupChain()
  })

  it('uploads the graph JSON to storage', async () => {
    await saveCanvasGraph(PROJECT_ID, CANVAS_ID, [], [])
    expect(CanvasStorageMod.uploadCanvasGraph).toHaveBeenCalledWith(
      SESSION.user.id,
      PROJECT_ID,
      CANVAS_ID,
      expect.anything(),
    )
  })

  it('throws when not authenticated', async () => {
    _getSession.mockResolvedValueOnce({ data: { session: null } })
    await expect(saveCanvasGraph(PROJECT_ID, CANVAS_ID, [], [])).rejects.toThrow(
      /Not authenticated/,
    )
  })

  it('calls verifyCanvasGraph when verify option is set', async () => {
    await saveCanvasGraph(PROJECT_ID, CANVAS_ID, [], [], { verify: true })
    expect(CanvasStorageMod.verifyCanvasGraph).toHaveBeenCalledWith(
      SESSION.user.id,
      PROJECT_ID,
      CANVAS_ID,
      0,
    )
  })

  it('throws STORAGE_ERROR when verify returns false', async () => {
    vi.mocked(CanvasStorageMod.verifyCanvasGraph).mockResolvedValueOnce(false)
    await expect(
      saveCanvasGraph(PROJECT_ID, CANVAS_ID, [], [], { verify: true }),
    ).rejects.toMatchObject({ code: 'STORAGE_ERROR' })
  })

  it('does not call verifyCanvasGraph when verify is not set', async () => {
    await saveCanvasGraph(PROJECT_ID, CANVAS_ID, [], [])
    expect(CanvasStorageMod.verifyCanvasGraph).not.toHaveBeenCalled()
  })
})

// ── renameCanvas ──────────────────────────────────────────────────────────────

describe('renameCanvas', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupChain()
  })

  it('updates the canvas name in the DB', async () => {
    // listCanvases call
    _from.chain.order.mockResolvedValueOnce({
      data: [{ ...CANVAS_ROW, id: CANVAS_ID, name: 'Sheet 1' }],
      error: null,
    })
    // update().eq() defaults to { error: null } from setupChain

    await renameCanvas(CANVAS_ID, PROJECT_ID, 'Renamed Sheet')

    expect(_from.chain.update).toHaveBeenCalledWith({ name: 'Renamed Sheet' })
  })

  it('throws on duplicate name', async () => {
    _from.chain.order.mockResolvedValueOnce({
      data: [
        { ...CANVAS_ROW, id: 'c-other', name: 'Renamed Sheet' },
        { ...CANVAS_ROW, id: CANVAS_ID, name: 'Sheet 1' },
      ],
      error: null,
    })

    await expect(renameCanvas(CANVAS_ID, PROJECT_ID, 'Renamed Sheet')).rejects.toThrow(
      /already exists/,
    )
  })

  it('throws on invalid name (empty)', async () => {
    await expect(renameCanvas(CANVAS_ID, PROJECT_ID, '')).rejects.toThrow()
  })

  it('throws on DB error during update', async () => {
    _from.chain.order.mockResolvedValueOnce({
      data: [{ ...CANVAS_ROW }],
      error: null,
    })
    _from._setUpdateError({ message: 'update rejected' })

    await expect(renameCanvas(CANVAS_ID, PROJECT_ID, 'New Name')).rejects.toThrow(
      /Rename canvas failed/,
    )
  })
})
