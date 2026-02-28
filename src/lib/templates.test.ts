/**
 * templates.test.ts — P150: Unit tests for group template CRUD service.
 *
 * Tests the templates.ts service layer via Supabase mock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ── Mock Supabase ─────────────────────────────────────────────────────────────

vi.mock('./supabase', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  }
  return {
    supabase: {
      from: vi.fn(() => chain),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      _chain: chain,
    },
  }
})

import { listTemplates, saveTemplate, deleteTemplate, renameTemplate } from './templates'
import { supabase } from './supabase'

// Helper to get the mock chain from the module
function getChain() {
  return (supabase as unknown as { _chain: Record<string, Mock> })._chain
}

// ── listTemplates ─────────────────────────────────────────────────────────────

describe('listTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const chain = getChain()
    chain.select.mockReturnThis()
    chain.order.mockResolvedValue({
      data: [
        {
          id: 'tmpl-1',
          name: 'Physics Kit',
          color: '#1CABB0',
          payload: { nodes: [], edges: [], proxyHandles: [] },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ],
      error: null,
    })
    ;(supabase.from as Mock).mockReturnValue(chain)
  })

  it('returns templates from Supabase', async () => {
    const templates = await listTemplates()
    expect(templates).toHaveLength(1)
    expect(templates[0].name).toBe('Physics Kit')
  })

  it('queries the group_templates table', async () => {
    await listTemplates()
    expect(supabase.from).toHaveBeenCalledWith('group_templates')
  })

  it('throws on Supabase error', async () => {
    const chain = getChain()
    chain.order.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })
    await expect(listTemplates()).rejects.toThrow('listTemplates')
  })

  it('returns empty array when data is null', async () => {
    const chain = getChain()
    chain.order.mockResolvedValueOnce({ data: null, error: null })
    const result = await listTemplates()
    expect(result).toEqual([])
  })
})

// ── saveTemplate ──────────────────────────────────────────────────────────────

describe('saveTemplate', () => {
  const PAYLOAD = { nodes: [], edges: [], proxyHandles: [] }
  const SAVED = {
    id: 'tmpl-new',
    name: 'My Template',
    color: '#ff0000',
    payload: PAYLOAD,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const chain = getChain()
    chain.select.mockReturnThis()
    chain.insert.mockReturnThis()
    chain.single.mockResolvedValue({ data: SAVED, error: null })
    ;(supabase.from as Mock).mockReturnValue(chain)
    ;(supabase.auth.getUser as Mock).mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns the created template', async () => {
    const result = await saveTemplate('My Template', '#ff0000', PAYLOAD)
    expect(result.id).toBe('tmpl-new')
    expect(result.name).toBe('My Template')
  })

  it('throws when not authenticated', async () => {
    ;(supabase.auth.getUser as Mock).mockResolvedValueOnce({ data: { user: null } })
    await expect(saveTemplate('Test', '#000', PAYLOAD)).rejects.toThrow('Not authenticated')
  })

  it('throws on Supabase insert error', async () => {
    const chain = getChain()
    chain.single.mockResolvedValueOnce({ data: null, error: { message: 'Insert error' } })
    await expect(saveTemplate('Test', '#000', PAYLOAD)).rejects.toThrow('saveTemplate')
  })
})

// ── deleteTemplate ────────────────────────────────────────────────────────────

describe('deleteTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const chain = getChain()
    chain.delete.mockReturnThis()
    chain.eq.mockResolvedValue({ error: null })
    ;(supabase.from as Mock).mockReturnValue(chain)
  })

  it('calls delete on the correct id', async () => {
    await deleteTemplate('tmpl-1')
    expect(getChain().eq).toHaveBeenCalledWith('id', 'tmpl-1')
  })

  it('throws on Supabase error', async () => {
    const chain = getChain()
    chain.eq.mockResolvedValueOnce({ error: { message: 'Delete failed' } })
    await expect(deleteTemplate('tmpl-1')).rejects.toThrow('deleteTemplate')
  })
})

// ── renameTemplate ────────────────────────────────────────────────────────────

describe('renameTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const chain = getChain()
    chain.update.mockReturnThis()
    chain.eq.mockResolvedValue({ error: null })
    ;(supabase.from as Mock).mockReturnValue(chain)
  })

  it('calls update with new name', async () => {
    await renameTemplate('tmpl-1', 'New Name')
    expect(getChain().update).toHaveBeenCalledWith({ name: 'New Name' })
    expect(getChain().eq).toHaveBeenCalledWith('id', 'tmpl-1')
  })

  it('throws on Supabase error', async () => {
    const chain = getChain()
    chain.eq.mockResolvedValueOnce({ error: { message: 'Update failed' } })
    await expect(renameTemplate('tmpl-1', 'New Name')).rejects.toThrow('renameTemplate')
  })
})
