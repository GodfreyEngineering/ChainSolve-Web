/**
 * commentModerationService.test.ts — E10-1: Tests for comment moderation.
 *
 * Mocks Supabase to test query building and error propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listFlaggedComments,
  unflagComment,
  deleteFlaggedComment,
} from './commentModerationService'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const qb = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    update: mockUpdate,
    delete: mockDelete,
  }
  // Every method returns the builder for chaining
  for (const fn of Object.values(qb)) {
    fn.mockReturnValue(qb)
  }
  // Terminal methods resolve to the final result
  mockLimit.mockReturnValue(finalResult)
  return qb
}

const mockFrom = vi.fn()

vi.mock('./supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ── listFlaggedComments ───────────────────────────────────────────────────────

describe('listFlaggedComments', () => {
  it('queries flagged comments ordered by created_at desc', async () => {
    const comments = [
      {
        id: 'c1',
        item_id: 'i1',
        user_id: 'u1',
        content: 'bad',
        flag_reason: 'spam',
        created_at: '2026-01-01',
      },
    ]
    const qb = makeQueryBuilder({ data: comments, error: null })
    mockFrom.mockReturnValue(qb)

    const result = await listFlaggedComments()
    expect(mockFrom).toHaveBeenCalledWith('marketplace_comments')
    expect(mockSelect).toHaveBeenCalledWith('id,item_id,user_id,content,flag_reason,created_at')
    expect(mockEq).toHaveBeenCalledWith('is_flagged', true)
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(50)
    expect(result).toEqual(comments)
  })

  it('respects custom limit', async () => {
    const qb = makeQueryBuilder({ data: [], error: null })
    mockFrom.mockReturnValue(qb)

    await listFlaggedComments(10)
    expect(mockLimit).toHaveBeenCalledWith(10)
  })

  it('throws on error', async () => {
    const qb = makeQueryBuilder({ data: null, error: { message: 'forbidden' } })
    mockFrom.mockReturnValue(qb)

    await expect(listFlaggedComments()).rejects.toEqual({ message: 'forbidden' })
  })
})

// ── unflagComment ─────────────────────────────────────────────────────────────

describe('unflagComment', () => {
  it('clears is_flagged and flag_reason', async () => {
    const qb = makeQueryBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(qb)
    mockUpdate.mockReturnValue(qb)
    mockEq.mockReturnValue({ data: null, error: null })

    await unflagComment('c1')
    expect(mockFrom).toHaveBeenCalledWith('marketplace_comments')
    expect(mockUpdate).toHaveBeenCalledWith({ is_flagged: false, flag_reason: null })
    expect(mockEq).toHaveBeenCalledWith('id', 'c1')
  })

  it('throws on error', async () => {
    const qb = makeQueryBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(qb)
    mockUpdate.mockReturnValue(qb)
    mockEq.mockReturnValue({ data: null, error: { message: 'not mod' } })

    await expect(unflagComment('c1')).rejects.toEqual({ message: 'not mod' })
  })
})

// ── deleteFlaggedComment ──────────────────────────────────────────────────────

describe('deleteFlaggedComment', () => {
  it('deletes the comment by ID', async () => {
    const qb = makeQueryBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(qb)
    mockDelete.mockReturnValue(qb)
    mockEq.mockReturnValue({ data: null, error: null })

    await deleteFlaggedComment('c1')
    expect(mockFrom).toHaveBeenCalledWith('marketplace_comments')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'c1')
  })

  it('throws on error', async () => {
    const qb = makeQueryBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(qb)
    mockDelete.mockReturnValue(qb)
    mockEq.mockReturnValue({ data: null, error: { message: 'not mod' } })

    await expect(deleteFlaggedComment('c1')).rejects.toEqual({ message: 'not mod' })
  })
})
