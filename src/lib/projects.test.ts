/**
 * projects.test.ts — unit tests for duplicateProject canvas + asset copy (P028).
 *
 * Supabase is mocked at the module level via vi.mock. Canvas and storage
 * helpers are also mocked so the tests stay fast and deterministic.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { CanvasJSON } from './canvasSchema'
import type { ProjectAsset } from './storage'

// ── Hoisted mock state ────────────────────────────────────────────────────────
// vi.hoisted runs before vi.mock so the references are safe to use inside
// the factory functions below.

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

vi.mock('./storage', () => ({
  saveProjectJson: vi.fn(),
  loadProjectJson: vi.fn(),
  listProjectAssets: vi.fn(),
  downloadAssetBytes: vi.fn(),
  uploadAssetBytes: vi.fn(),
}))

vi.mock('./canvases', () => ({
  listCanvases: vi.fn(),
  loadCanvasGraph: vi.fn(),
  createCanvas: vi.fn(),
  setActiveCanvas: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { duplicateProject } from './projects'
import * as StorageMod from './storage'
import * as CanvasesMod from './canvases'

// ── Shared fixtures ───────────────────────────────────────────────────────────

const SESSION = { user: { id: 'user-1' } }
const SRC_ID = 'src-proj'
const NEW_NAME = 'Copy of Source'
const NEW_ID = 'new-proj-1'

const LEGACY_PJ = {
  schemaVersion: 3 as const,
  formatVersion: 1,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  project: { id: SRC_ID, name: 'Source' },
  graph: { nodes: [], edges: [] },
  blockVersions: {},
}

function makeCanvasRow(id: string, name: string, pos: number, projectId: string) {
  return {
    id,
    name,
    position: pos,
    project_id: projectId,
    owner_id: 'user-1',
    storage_path: `user-1/${projectId}/canvases/${id}.json`,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  }
}

function setupDefaultMocks() {
  // Re-initialise the chain return values (vi.resetAllMocks clears them)
  const { chain, fromFn } = _from
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    chain[m].mockReturnValue(chain)
  }
  fromFn.mockReturnValue(chain)

  _getSession.mockResolvedValue({ data: { session: SESSION } })

  // 1st single call — readProjectRow
  _single.mockResolvedValueOnce({
    data: {
      name: 'Source',
      updated_at: '2025-01-01T00:00:00Z',
      active_canvas_id: null,
      variables: {},
    },
  })
  // 2nd single call — insert new project row
  _single.mockResolvedValueOnce({
    data: {
      id: NEW_ID,
      owner_id: 'user-1',
      name: NEW_NAME,
      description: null,
      storage_key: null,
      active_canvas_id: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    error: null,
  })
  // 3rd single call — readUpdatedAt
  _single.mockResolvedValueOnce({ data: { updated_at: '2025-01-02T00:00:00Z' } })

  // Storage helpers
  vi.mocked(StorageMod.loadProjectJson).mockResolvedValue(LEGACY_PJ)
  vi.mocked(StorageMod.saveProjectJson).mockResolvedValue(undefined)
  vi.mocked(StorageMod.listProjectAssets).mockResolvedValue([])
  vi.mocked(StorageMod.downloadAssetBytes).mockResolvedValue(new Uint8Array())
  vi.mocked(StorageMod.uploadAssetBytes).mockResolvedValue({ storage_key: 'uploads/x' })

  // Canvas helpers — defaults (no canvases, no assets)
  vi.mocked(CanvasesMod.listCanvases).mockResolvedValue([])
  vi.mocked(CanvasesMod.loadCanvasGraph).mockResolvedValue({
    nodes: [],
    edges: [],
  } as unknown as CanvasJSON)
  vi.mocked(CanvasesMod.createCanvas).mockResolvedValue(
    makeCanvasRow('new-c1', 'Sheet 1', 0, NEW_ID),
  )
  vi.mocked(CanvasesMod.setActiveCanvas).mockResolvedValue('2025-01-02T00:00:00Z')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('duplicateProject — no canvases / no assets', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupDefaultMocks()
  })

  it('returns a new project row with the given name', async () => {
    const proj = await duplicateProject(SRC_ID, NEW_NAME)
    expect(proj.id).toBe(NEW_ID)
    expect(proj.name).toBe(NEW_NAME)
    expect(proj.updated_at).toBe('2025-01-02T00:00:00Z')
  })

  it('does not call createCanvas when source has no canvases', async () => {
    await duplicateProject(SRC_ID, NEW_NAME)
    expect(CanvasesMod.createCanvas).not.toHaveBeenCalled()
    expect(CanvasesMod.setActiveCanvas).not.toHaveBeenCalled()
  })

  it('does not download or upload assets when source has no assets', async () => {
    await duplicateProject(SRC_ID, NEW_NAME)
    expect(StorageMod.downloadAssetBytes).not.toHaveBeenCalled()
    expect(StorageMod.uploadAssetBytes).not.toHaveBeenCalled()
  })
})

describe('duplicateProject — canvas copy', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupDefaultMocks()
  })

  it('creates a canvas in the new project for each source canvas', async () => {
    vi.mocked(CanvasesMod.listCanvases).mockResolvedValue([
      makeCanvasRow('c1', 'Sheet 1', 0, SRC_ID),
      makeCanvasRow('c2', 'Sheet 2', 1, SRC_ID),
    ])
    vi.mocked(CanvasesMod.loadCanvasGraph)
      .mockResolvedValueOnce({ nodes: [{ id: 'n1' }], edges: [] } as unknown as CanvasJSON)
      .mockResolvedValueOnce({ nodes: [], edges: [{ id: 'e1' }] } as unknown as CanvasJSON)
    vi.mocked(CanvasesMod.createCanvas)
      .mockResolvedValueOnce(makeCanvasRow('new-c1', 'Sheet 1', 0, NEW_ID))
      .mockResolvedValueOnce(makeCanvasRow('new-c2', 'Sheet 2', 1, NEW_ID))

    await duplicateProject(SRC_ID, NEW_NAME)

    expect(CanvasesMod.listCanvases).toHaveBeenCalledWith(SRC_ID)
    expect(CanvasesMod.loadCanvasGraph).toHaveBeenCalledTimes(2)
    expect(CanvasesMod.loadCanvasGraph).toHaveBeenNthCalledWith(1, SRC_ID, 'c1')
    expect(CanvasesMod.loadCanvasGraph).toHaveBeenNthCalledWith(2, SRC_ID, 'c2')
    expect(CanvasesMod.createCanvas).toHaveBeenCalledTimes(2)
    expect(CanvasesMod.createCanvas).toHaveBeenNthCalledWith(1, NEW_ID, 'Sheet 1', {
      nodes: [{ id: 'n1' }],
      edges: [],
    })
    expect(CanvasesMod.createCanvas).toHaveBeenNthCalledWith(2, NEW_ID, 'Sheet 2', {
      nodes: [],
      edges: [{ id: 'e1' }],
    })
  })

  it('sets the first new canvas as active', async () => {
    vi.mocked(CanvasesMod.listCanvases).mockResolvedValue([
      makeCanvasRow('c1', 'Sheet 1', 0, SRC_ID),
      makeCanvasRow('c2', 'Sheet 2', 1, SRC_ID),
    ])
    vi.mocked(CanvasesMod.loadCanvasGraph).mockResolvedValue({
      nodes: [],
      edges: [],
    } as unknown as CanvasJSON)
    vi.mocked(CanvasesMod.createCanvas)
      .mockResolvedValueOnce(makeCanvasRow('new-c1', 'Sheet 1', 0, NEW_ID))
      .mockResolvedValueOnce(makeCanvasRow('new-c2', 'Sheet 2', 1, NEW_ID))

    await duplicateProject(SRC_ID, NEW_NAME)

    expect(CanvasesMod.setActiveCanvas).toHaveBeenCalledOnce()
    expect(CanvasesMod.setActiveCanvas).toHaveBeenCalledWith(NEW_ID, 'new-c1')
  })
})

describe('duplicateProject — asset copy', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupDefaultMocks()
  })

  it('downloads source asset bytes and re-uploads to new project', async () => {
    const srcAsset: ProjectAsset = {
      id: 'a1',
      project_id: SRC_ID,
      user_id: 'user-1',
      name: 'data.csv',
      storage_path: 'user-1/src-proj/uploads/123_data.csv',
      mime_type: 'text/csv',
      size: 42,
      sha256: 'sha-abc',
      kind: 'csv',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }
    vi.mocked(StorageMod.listProjectAssets).mockResolvedValue([srcAsset])
    const bytes = new Uint8Array([10, 20, 30])
    vi.mocked(StorageMod.downloadAssetBytes).mockResolvedValue(bytes)

    await duplicateProject(SRC_ID, NEW_NAME)

    expect(StorageMod.listProjectAssets).toHaveBeenCalledWith(SRC_ID)
    expect(StorageMod.downloadAssetBytes).toHaveBeenCalledWith(srcAsset.storage_path)
    expect(StorageMod.uploadAssetBytes).toHaveBeenCalledWith(
      NEW_ID,
      'data.csv',
      'text/csv',
      bytes,
      'sha-abc',
      'csv',
    )
  })

  it('falls back to octet-stream when asset has no mime_type', async () => {
    const srcAsset: ProjectAsset = {
      id: 'a2',
      project_id: SRC_ID,
      user_id: 'user-1',
      name: 'file.bin',
      storage_path: 'user-1/src-proj/uploads/file.bin',
      mime_type: null,
      size: 10,
      sha256: null,
      kind: null,
      created_at: '',
      updated_at: '',
    }
    vi.mocked(StorageMod.listProjectAssets).mockResolvedValue([srcAsset])
    vi.mocked(StorageMod.downloadAssetBytes).mockResolvedValue(new Uint8Array([1]))

    await duplicateProject(SRC_ID, NEW_NAME)

    expect(StorageMod.uploadAssetBytes).toHaveBeenCalledWith(
      NEW_ID,
      'file.bin',
      'application/octet-stream',
      new Uint8Array([1]),
      null,
      'csv',
    )
  })
})
