/**
 * suggestionsService.test.ts — Unit tests for suggestion submission (H9-2).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: mockInsert,
    }),
  },
}))

vi.mock('../observability/redact', () => ({
  redactString: (s: string) => `[R]${s}`,
  redactObject: (o: Record<string, unknown>) => o,
}))

import { submitSuggestion } from './suggestionsService'

beforeEach(() => {
  vi.clearAllMocks()
  mockInsert.mockResolvedValue({ error: null })
})

describe('submitSuggestion', () => {
  it('inserts a redacted suggestion into the suggestions table', async () => {
    await submitSuggestion({
      userId: 'u1',
      category: 'feature_request',
      title: 'Dark mode',
      description: 'Please add dark mode',
      metadata: { source: 'menu' },
    })
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'u1',
      category: 'feature_request',
      title: '[R]Dark mode',
      description: '[R]Please add dark mode',
      metadata: { source: 'menu' },
    })
  })

  it('supports all three categories', async () => {
    for (const cat of ['feature_request', 'block_library', 'ux_feedback'] as const) {
      mockInsert.mockResolvedValueOnce({ error: null })
      await submitSuggestion({
        userId: 'u1',
        category: cat,
        title: 't',
        description: 'd',
        metadata: {},
      })
    }
    expect(mockInsert).toHaveBeenCalledTimes(3)
  })

  it('throws on Supabase error', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'RLS denied' } })
    await expect(
      submitSuggestion({
        userId: 'u1',
        category: 'ux_feedback',
        title: 't',
        description: 'd',
        metadata: {},
      }),
    ).rejects.toEqual({ message: 'RLS denied' })
  })
})
